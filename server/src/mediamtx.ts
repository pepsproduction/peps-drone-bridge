import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { readMediaMtxSnapshot } from "./mediamtx-api.js";
import { buildRtmpUrl, listNetworkAdapters, selectAdapter } from "./network.js";
import { datedLogFile, ensureRuntimeDirs, LOG_DIR, MEDIAMTX_CONFIG, MEDIAMTX_EXE, PROJECT_ROOT } from "./paths.js";
import { canBindTcpPort, isTcpPortOpen } from "./ports.js";
import { readSettings, writeSettings } from "./settings.js";
import {
  API_PORT,
  RTMP_PORT,
  STREAM_PATH,
  type BridgeState,
  type BridgeStatus,
  type StreamInfo
} from "./types.js";

const execFileAsync = promisify(execFile);

interface RuntimeState {
  state: BridgeState;
  warnings: string[];
  errors: string[];
  startedAt?: string;
  lastStreamAt?: string;
  stream?: StreamInfo;
}

export function mediamtxConfig(): string {
  return [
    "logLevel: info",
    "logDestinations: [stdout]",
    "readTimeout: 10s",
    "writeTimeout: 10s",
    "writeQueueSize: 512",
    "api: yes",
    `apiAddress: 127.0.0.1:${API_PORT}`,
    "metrics: no",
    "pprof: no",
    "playback: no",
    "rtsp: no",
    "rtmp: yes",
    "rtmpEncryption: \"no\"",
    `rtmpAddress: :${RTMP_PORT}`,
    "rtmpTrustedProxies: []",
    "hls: no",
    "webrtc: no",
    "srt: no",
    "moq: no",
    "paths:",
    `  ${STREAM_PATH}:`,
    "    source: publisher",
    ""
  ].join("\n");
}

async function commandExists(command: string): Promise<string | undefined> {
  try {
    const lookup = process.platform === "win32" ? "where.exe" : "which";
    const { stdout } = await execFileAsync(lookup, [command], {
      windowsHide: true,
      timeout: 3000
    });
    return stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  } catch {
    return undefined;
  }
}

export async function locateMediaMtx(): Promise<string | undefined> {
  if (process.env.MEDIAMTX_PATH && fs.existsSync(process.env.MEDIAMTX_PATH)) {
    return process.env.MEDIAMTX_PATH;
  }

  if (fs.existsSync(MEDIAMTX_EXE)) {
    return MEDIAMTX_EXE;
  }

  const fromPath = await commandExists(process.platform === "win32" ? "mediamtx.exe" : "mediamtx");
  return fromPath;
}

export class MediaMtxController extends EventEmitter {
  private child?: ChildProcessWithoutNullStreams;
  private refreshTimer?: NodeJS.Timeout;
  private stopping = false;
  private runtime: RuntimeState = {
    state: "OFF",
    warnings: [],
    errors: []
  };

  startPolling(): void {
    if (this.refreshTimer) {
      return;
    }

    void this.refreshStatus();
    this.refreshTimer = setInterval(() => {
      void this.refreshStatus();
    }, 1000);
  }

  async shutdown(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    await this.stop();
  }

  async start(): Promise<BridgeStatus> {
    if (this.child && !this.child.killed) {
      return this.getStatus();
    }

    ensureRuntimeDirs();
    const mediamtxPath = await locateMediaMtx();
    if (!mediamtxPath) {
      this.runtime = {
        state: "ERROR",
        warnings: [],
        errors: ["ไม่พบ mediamtx.exe ให้รัน npm run setup:mediamtx หรือวางไฟล์ไว้ใน mediamtx/"]
      };
      return this.emitStatus();
    }

    const portFree = await canBindTcpPort(RTMP_PORT);
    if (!portFree) {
      this.runtime = {
        state: "ERROR",
        warnings: [],
        errors: [`พอร์ต ${RTMP_PORT} ถูกใช้งานอยู่หรือถูกบล็อก ไม่สามารถเริ่ม RTMP listener ได้`]
      };
      return this.emitStatus();
    }

    fs.writeFileSync(MEDIAMTX_CONFIG, mediamtxConfig(), "utf8");
    const stdoutLog = fs.createWriteStream(datedLogFile("mediamtx"), { flags: "a" });
    const bridgeLog = fs.createWriteStream(datedLogFile("bridge"), { flags: "a" });
    bridgeLog.write(`[${new Date().toISOString()}] Starting MediaMTX: ${mediamtxPath}\n`);

    this.stopping = false;
    this.runtime = {
      state: "STARTING",
      warnings: [],
      errors: [],
      startedAt: new Date().toISOString()
    };

    this.child = spawn(mediamtxPath, [MEDIAMTX_CONFIG], {
      cwd: PROJECT_ROOT,
      windowsHide: true
    });

    this.child.stdout.on("data", (chunk: Buffer) => {
      stdoutLog.write(`[${new Date().toISOString()}] ${chunk.toString()}`);
    });

    this.child.stderr.on("data", (chunk: Buffer) => {
      stdoutLog.write(`[${new Date().toISOString()}] ${chunk.toString()}`);
    });

    this.child.once("error", (error) => {
      this.runtime = {
        ...this.runtime,
        state: "ERROR",
        errors: [`MediaMTX เปิดไม่สำเร็จ: ${error.message}`]
      };
      bridgeLog.write(`[${new Date().toISOString()}] Spawn error: ${error.message}\n`);
      void this.emitStatus();
    });

    this.child.once("exit", (code, signal) => {
      stdoutLog.end();
      bridgeLog.write(`[${new Date().toISOString()}] MediaMTX exited code=${code ?? ""} signal=${signal ?? ""}\n`);
      bridgeLog.end();
      this.child = undefined;
      if (!this.stopping) {
        this.runtime = {
          ...this.runtime,
          state: "ERROR",
          errors: [`MediaMTX process หยุดทำงาน unexpectedly (code=${code ?? "n/a"}, signal=${signal ?? "n/a"})`]
        };
        void this.emitStatus();
      }
    });

    return this.emitStatus();
  }

  async stop(): Promise<BridgeStatus> {
    if (!this.child) {
      this.runtime = {
        state: "OFF",
        warnings: [],
        errors: []
      };
      return this.emitStatus();
    }

    this.stopping = true;
    const child = this.child;
    child.kill("SIGINT");

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!child.killed && child.pid && process.platform === "win32") {
          void execFileAsync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
            windowsHide: true
          }).catch(() => undefined).finally(resolve);
        } else {
          child.kill();
          resolve();
        }
      }, 3000);

      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.child = undefined;
    this.stopping = false;
    this.runtime = {
      state: "OFF",
      warnings: [],
      errors: []
    };
    return this.emitStatus();
  }

  setSelectedAdapter(adapterId: string): BridgeStatus {
    const adapters = listNetworkAdapters();
    const adapter = adapters.find((item) => item.id === adapterId);
    if (adapter) {
      writeSettings({ ...readSettings(), selectedAdapterId: adapter.id });
    }
    return this.emitStatus();
  }

  getStatus(): BridgeStatus {
    const adapters = listNetworkAdapters();
    const settings = readSettings();
    const selectedAdapter = selectAdapter(adapters, settings.selectedAdapterId);
    const djiFly = selectedAdapter
      ? buildRtmpUrl(selectedAdapter.address, RTMP_PORT, STREAM_PATH)
      : undefined;
    const stateText = this.stateText(this.runtime.state);

    return {
      state: this.runtime.state,
      stateTextTh: stateText.title,
      detailTextTh: stateText.detail,
      updatedAt: new Date().toISOString(),
      mediamtxFound: fs.existsSync(MEDIAMTX_EXE) || Boolean(process.env.MEDIAMTX_PATH),
      mediamtxPath: fs.existsSync(MEDIAMTX_EXE) ? MEDIAMTX_EXE : process.env.MEDIAMTX_PATH,
      processRunning: Boolean(this.child && !this.child.killed),
      rtmpPort: RTMP_PORT,
      apiBaseUrl: `http://127.0.0.1:${API_PORT}`,
      streamPath: STREAM_PATH,
      selectedAdapter,
      adapters,
      urls: {
        djiFly,
        obs: buildRtmpUrl("127.0.0.1", RTMP_PORT, STREAM_PATH)
      },
      startedAt: this.runtime.startedAt,
      lastStreamAt: this.runtime.lastStreamAt,
      stream: this.runtime.stream,
      warnings: selectedAdapter ? this.runtime.warnings : [...this.runtime.warnings, "หา IPv4 LAN สำหรับสร้าง RTMP URL ไม่พบ"],
      errors: this.runtime.errors
    };
  }

  async refreshStatus(): Promise<BridgeStatus> {
    if (!this.child) {
      if (this.runtime.state !== "ERROR") {
        this.runtime = {
          ...this.runtime,
          state: "OFF",
          stream: undefined
        };
      }
      return this.emitStatus();
    }

    const portOpen = await isTcpPortOpen("127.0.0.1", RTMP_PORT);
    if (!portOpen) {
      this.runtime = {
        ...this.runtime,
        state: "STARTING",
        warnings: ["กำลังรอ RTMP listener เปิดพอร์ต 1935"],
        errors: []
      };
      return this.emitStatus();
    }

    try {
      const snapshot = await readMediaMtxSnapshot();
      if (snapshot.hasPublisher) {
        this.runtime = {
          ...this.runtime,
          state: "RECEIVING_STREAM",
          warnings: [],
          errors: [],
          lastStreamAt: new Date().toISOString(),
          stream: snapshot.stream
        };
      } else {
        const hadStream = Boolean(this.runtime.lastStreamAt);
        this.runtime = {
          ...this.runtime,
          state: hadStream ? "STREAM_LOST" : "WAITING_FOR_STREAM",
          warnings: [],
          errors: [],
          stream: undefined
        };
      }
    } catch (error) {
      const elapsed = this.runtime.startedAt
        ? Date.now() - Date.parse(this.runtime.startedAt)
        : 0;
      if (elapsed < 8000) {
        this.runtime = {
          ...this.runtime,
          state: "READY",
          warnings: ["RTMP port เปิดแล้ว กำลังรอ MediaMTX Control API พร้อมใช้งาน"],
          errors: []
        };
      } else {
        const message = error instanceof Error ? error.message : "MediaMTX Control API ใช้งานไม่ได้";
        this.runtime = {
          ...this.runtime,
          state: "ERROR",
          warnings: [],
          errors: [message]
        };
      }
    }

    return this.emitStatus();
  }

  openLogFolder(): { ok: boolean; path: string } {
    ensureRuntimeDirs();
    if (process.platform === "win32") {
      spawn("explorer.exe", [LOG_DIR], {
        windowsHide: true,
        detached: true,
        stdio: "ignore"
      }).unref();
    }
    return {
      ok: true,
      path: LOG_DIR
    };
  }

  recentLogs(limit = 120): string[] {
    ensureRuntimeDirs();
    const files = fs.existsSync(LOG_DIR)
      ? fs.readdirSync(LOG_DIR)
        .filter((file) => file.endsWith(".log"))
        .map((file) => path.join(LOG_DIR, file))
        .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
      : [];

    const lines = files.slice(0, 3).flatMap((file) => {
      const content = fs.readFileSync(file, "utf8");
      return content.split(/\r?\n/).filter(Boolean).map((line) => `${path.basename(file)} ${line}`);
    });
    return lines.slice(-limit);
  }

  private emitStatus(): BridgeStatus {
    const status = this.getStatus();
    this.emit("status", status);
    return status;
  }

  private stateText(state: BridgeState): { title: string; detail: string } {
    switch (state) {
      case "OFF":
        return {
          title: "Server ยังไม่เริ่ม",
          detail: "กดเปิด Server เพื่อเตรียมรับ RTMP จาก DJI Fly"
        };
      case "STARTING":
        return {
          title: "กำลังเริ่ม Server",
          detail: "กำลังเปิด MediaMTX และพอร์ต RTMP 1935"
        };
      case "READY":
        return {
          title: "Server พร้อมรับสัญญาณ",
          detail: "Server Ready • กำลังตรวจ Control API"
        };
      case "WAITING_FOR_STREAM":
        return {
          title: "พร้อมรับสัญญาณภาพโดรน",
          detail: "Server Ready • Waiting for DJI Fly"
        };
      case "RECEIVING_STREAM":
        return {
          title: "รับสัญญาณภาพโดรนแล้ว",
          detail: `RTMP Stream Active • ${STREAM_PATH}`
        };
      case "STREAM_LOST":
        return {
          title: "สัญญาณภาพโดรนหลุด",
          detail: this.runtime.lastStreamAt
            ? `ตรวจพบ Stream ล่าสุดเมื่อ ${new Date(this.runtime.lastStreamAt).toLocaleTimeString("th-TH")}`
            : "ไม่พบ publisher ที่ live/drone1"
        };
      case "ERROR":
        return {
          title: "ระบบมีข้อผิดพลาด",
          detail: this.runtime.errors[0] ?? "ตรวจสอบ MediaMTX, พอร์ต 1935 หรือ Firewall"
        };
    }
  }
}
