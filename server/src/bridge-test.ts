import net from "node:net";
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { MediaMtxController, locateMediaMtx } from "./mediamtx.js";
import { canBindTcpPort, isTcpPortOpen } from "./ports.js";
import { RTMP_PORT } from "./types.js";

const execFileAsync = promisify(execFile);

function log(message: string): void {
  console.log(`[bridge-test] ${message}`);
}

async function waitFor(
  label: string,
  predicate: () => Promise<boolean> | boolean,
  timeoutMs = 12000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      log(`PASS: ${label}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`TIMEOUT: ${label}`);
}

async function commandExists(command: string): Promise<boolean> {
  try {
    const lookup = process.platform === "win32" ? "where.exe" : "which";
    await execFileAsync(lookup, [command], {
      windowsHide: true,
      timeout: 3000
    });
    return true;
  } catch {
    return false;
  }
}

async function testPortConflict(): Promise<void> {
  const canBind = await canBindTcpPort(RTMP_PORT);
  if (!canBind) {
    log("SKIPPED: port 1935 is already in use before conflict test");
    return;
  }

  const blocker = net.createServer();
  await new Promise<void>((resolve, reject) => {
    blocker.once("error", reject);
    blocker.once("listening", resolve);
    blocker.listen(RTMP_PORT, "0.0.0.0");
  });

  try {
    const canBindWhileBlocked = await canBindTcpPort(RTMP_PORT);
    if (canBindWhileBlocked) {
      throw new Error("expected port 1935 to be unavailable while blocker is listening");
    }
    log("PASS: detects error when port 1935 is already in use");
  } finally {
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
  }
}

async function runFfmpegStream(): Promise<() => Promise<void>> {
  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-re",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=1280x720:rate=30",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-tune",
    "zerolatency",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-f",
    "flv",
    "rtmp://127.0.0.1:1935/live/drone1"
  ];

  const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
    windowsHide: true,
    stdio: "ignore"
  });

  return async () => {
    ffmpeg.kill("SIGINT");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 2500);
      ffmpeg.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  };
}

async function main(): Promise<void> {
  const mediamtx = await locateMediaMtx();
  if (!mediamtx) {
    log("SKIPPED: mediamtx.exe not found. Run npm run setup:mediamtx");
    return;
  }

  await testPortConflict();

  const bridge = new MediaMtxController();
  bridge.startPolling();

  try {
    await bridge.start();
    log("PASS: started MediaMTX");

    await waitFor("API health check passes", async () => {
      const status = bridge.getStatus();
      return status.state === "WAITING_FOR_STREAM" || status.state === "READY";
    });

    await waitFor("port 1935 is open", () => isTcpPortOpen("127.0.0.1", RTMP_PORT));

    await waitFor("state reaches WAITING_FOR_STREAM", () => bridge.getStatus().state === "WAITING_FOR_STREAM");

    if (!(await commandExists("ffmpeg"))) {
      log("SKIPPED: ffmpeg not found");
      return;
    }

    const stopStream = await runFfmpegStream();
    await waitFor("state changes to RECEIVING_STREAM", () => bridge.getStatus().state === "RECEIVING_STREAM", 20000);

    await stopStream();
    await waitFor(
      "state changes to STREAM_LOST or WAITING_FOR_STREAM after test stream stops",
      () => ["STREAM_LOST", "WAITING_FOR_STREAM"].includes(bridge.getStatus().state),
      15000
    );
  } finally {
    await bridge.shutdown();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
