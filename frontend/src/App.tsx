import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  FolderOpen,
  MonitorUp,
  Network,
  Power,
  RefreshCw,
  Router,
  Server,
  Settings,
  ShieldAlert,
  Square,
  Wifi
} from "lucide-react";
import {
  getDiagnostics,
  getStatus,
  openFirewallRule,
  openLogs,
  selectAdapter,
  startServer,
  stopServer
} from "./api";
import { diagnosticLabel, stateTone, valueOrEmpty } from "./status";
import type { BridgeStatus, DiagnosticsReport, NetworkAdapter, StreamInfo } from "./types";

const setupCommand = "npm run setup:mediamtx";

function formatTime(value?: string): string {
  if (!value) {
    return "ยังไม่มีข้อมูล";
  }
  return new Date(value).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function streamRows(stream?: StreamInfo): Array<[string, string]> {
  return [
    ["Path", valueOrEmpty(stream?.path)],
    ["Protocol", valueOrEmpty(stream?.protocol)],
    ["Source IP", valueOrEmpty(stream?.sourceIp)],
    ["Codec", valueOrEmpty(stream?.codec)],
    ["Resolution", valueOrEmpty(stream?.resolution)],
    ["FPS", valueOrEmpty(stream?.fps)],
    ["Bitrate", valueOrEmpty(stream?.bitrate)],
    ["Connection duration", valueOrEmpty(stream?.connectionDuration)],
    ["Last update", stream?.lastUpdate ? formatTime(stream.lastUpdate) : "ไม่พบข้อมูลจาก Stream"]
  ];
}

function AdapterOption({ adapter }: { adapter: NetworkAdapter }) {
  return (
    <option value={adapter.id}>
      {adapter.name} • {adapter.address}{adapter.recommended ? "" : ` • ${adapter.reason ?? "advanced"}`}
    </option>
  );
}

export default function App() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmFirewall, setConfirmFirewall] = useState(false);

  useEffect(() => {
    let active = true;
    getStatus()
      .then((nextStatus) => {
        if (active) {
          setStatus(nextStatus);
          setLoadError(null);
        }
      })
      .catch((error: Error) => {
        if (active) {
          setLoadError(error.message);
        }
      });

    const events = new EventSource("/api/events");
    events.addEventListener("status", (event) => {
      setStatus(JSON.parse((event as MessageEvent).data) as BridgeStatus);
      setLoadError(null);
    });
    events.onerror = () => {
      setLoadError("SSE disconnected: ตรวจว่า backend ที่ 127.0.0.1:19555 ยังทำงานอยู่");
    };

    return () => {
      active = false;
      events.close();
    };
  }, []);

  const tone = stateTone(status?.state ?? "OFF");
  const visibleAdapters = useMemo(() => {
    const adapters = status?.adapters ?? [];
    return showAdvanced ? adapters : adapters.filter((adapter) => adapter.recommended);
  }, [showAdvanced, status?.adapters]);

  async function runAction(action: () => Promise<BridgeStatus | DiagnosticsReport | { ok: boolean; message?: string; path?: string }>, done?: (value: Awaited<ReturnType<typeof action>>) => void) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      done?.(result);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "คำสั่งล้มเหลว");
    } finally {
      setBusy(false);
    }
  }

  function copyText(value: string | undefined, label: string) {
    if (!value) {
      setNotice("ยังไม่มี URL ให้คัดลอก");
      return;
    }

    void navigator.clipboard.writeText(value).then(() => {
      setNotice(`คัดลอก ${label} แล้ว`);
    }).catch(() => {
      setNotice("คัดลอกไม่ได้จาก browser นี้");
    });
  }

  if (!status) {
    return (
      <main className="app-shell">
        <section className="boot-panel">
          <Server aria-hidden="true" />
          <h1>PEPS LIVE Drone RTMP Bridge</h1>
          <p>{loadError ?? "กำลังอ่านสถานะระบบ..."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-name">PEPS LIVE</span>
          <span className="brand-divider">/</span>
          <span className="brand-product">DRONE RTMP BRIDGE</span>
        </div>
        <span className="build-badge">LOCAL TEST BUILD</span>
      </header>

      <section className={`hero-status tone-${tone}`}>
        <div className="hero-copy">
          <div className="on-air-box">
            <div className="bulb-rail bulb-rail-top" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => <span key={`top-${index}`} />)}
            </div>
            <div className="on-air-content">
              <span className={`status-dot ${status.state === "RECEIVING_STREAM" ? "pulse" : ""}`} aria-hidden="true" />
              <div className="status-copy">
                <div className="eyebrow-strip">
                  <span className="eyebrow">RTMP DRONE STATUS</span>
                  <span className="signal-badge">{status.state}</span>
                </div>
                <h1>{status.stateTextTh}</h1>
              </div>
            </div>
            <div className="bulb-rail bulb-rail-bottom" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => <span key={`bottom-${index}`} />)}
            </div>
          </div>
          <p className="hero-detail">{status.detailTextTh}</p>
          <div className="url-strip">
            <span className="url-label">DJI Fly RTMP URL</span>
            <code>{status.urls.djiFly ?? "หา IPv4 LAN ไม่พบ"}</code>
          </div>
        </div>

        <div className="hero-actions">
          <button
            className="primary-action"
            type="button"
            disabled={busy || status.processRunning}
            onClick={() => void runAction(startServer, (next) => setStatus(next as BridgeStatus))}
            title="เปิด Server"
          >
            <Power size={18} />
            เปิด Server
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => copyText(status.urls.djiFly, "RTMP URL")}
            title="คัดลอก RTMP URL"
          >
            <Clipboard size={18} />
            คัดลอก RTMP URL
          </button>
          <button
            type="button"
            disabled={busy || !status.processRunning}
            onClick={() => void runAction(stopServer, (next) => setStatus(next as BridgeStatus))}
            title="หยุด Server"
          >
            <Square size={18} />
            หยุด Server
          </button>
        </div>
      </section>

      {(notice || loadError || status.errors.length > 0 || status.warnings.length > 0) && (
        <section className="notice-rail" aria-live="polite">
          {notice && <p>{notice}</p>}
          {loadError && <p>{loadError}</p>}
          {status.errors.map((error) => <p className="danger-text" key={error}>{error}</p>)}
          {status.warnings.map((warning) => <p className="warning-text" key={warning}>{warning}</p>)}
        </section>
      )}

      {!status.mediamtxFound && (
        <section className="setup-rail">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>ไม่พบ mediamtx.exe</span>
          <code>{setupCommand}</code>
        </section>
      )}

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <Router size={18} aria-hidden="true" />
            <h2>NETWORK / SERVER</h2>
            <button className="icon-button" type="button" onClick={() => setShowAdvanced((value) => !value)} title="Advanced Settings" aria-label="Advanced Settings">
              <Settings size={17} />
            </button>
          </div>

          <label className="field-label" htmlFor="adapter-select">IP / Adapter</label>
          <select
            id="adapter-select"
            value={status.selectedAdapter?.id ?? ""}
            onChange={(event) => void runAction(() => selectAdapter(event.target.value), (next) => setStatus(next as BridgeStatus))}
          >
            {visibleAdapters.length === 0 && <option value="">ไม่พบ adapter ที่แนะนำ</option>}
            {visibleAdapters.map((adapter) => <AdapterOption adapter={adapter} key={adapter.id} />)}
          </select>

          <div className="metric-list">
            <div>
              <span>Port status</span>
              <strong>{status.processRunning ? "1935 เปิดโดย MediaMTX" : "1935 ยังไม่เปิดโดยระบบนี้"}</strong>
            </div>
            <div>
              <span>Control API</span>
              <strong>127.0.0.1:{status.apiBaseUrl.split(":").at(-1)}</strong>
            </div>
            <div>
              <span>Last update</span>
              <strong>{formatTime(status.updatedAt)}</strong>
            </div>
          </div>

          <div className="button-row">
            <button type="button" onClick={() => void runAction(getDiagnostics, (report) => setDiagnostics(report as DiagnosticsReport))}>
              <Network size={17} />
              ตรวจสอบ Network
            </button>
            <button type="button" onClick={() => setConfirmFirewall(true)}>
              <ShieldAlert size={17} />
              เปิด Firewall
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <MonitorUp size={18} aria-hidden="true" />
            <h2>OBS OUTPUT</h2>
          </div>
          <div className="compact-url">
            <span>OBS RTMP URL</span>
            <code>{status.urls.obs}</code>
          </div>
          <button type="button" onClick={() => copyText(status.urls.obs, "OBS URL")}>
            <Clipboard size={17} />
            คัดลอก OBS URL
          </button>
          <ol className="mini-steps">
            <li>เพิ่ม Media Source หรือ VLC Source ใน OBS</li>
            <li>ใช้ URL 127.0.0.1 บนเครื่องนี้</li>
            <li>ตั้ง Network Buffering ต่ำสุดก่อน ถ้ากระตุกค่อยเพิ่มทีละน้อย</li>
            <li>เริ่ม DJI Fly stream แล้วรอภาพเข้า</li>
          </ol>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <Wifi size={18} aria-hidden="true" />
            <h2>DJI FLY SETUP</h2>
          </div>
          <ol className="setup-steps">
            <li>ให้มือถือและคอมอยู่ Wi-Fi วงเดียวกัน</li>
            <li>เปิด DJI Fly → Transmission → Live Streaming Platforms → RTMP</li>
            <li>วาง RTMP URL จากระบบนี้</li>
            <li>กด Start แล้วรอสถานะ “รับสัญญาณภาพโดรนแล้ว”</li>
          </ol>
          <div className="button-row">
            <button type="button" onClick={() => copyText(status.urls.djiFly, "RTMP URL")}>
              <Clipboard size={17} />
              คัดลอก RTMP URL
            </button>
            <button type="button" onClick={() => void runAction(openLogs, (result) => setNotice((result as { path?: string }).path ?? "เปิด Log Folder แล้ว"))}>
              <FolderOpen size={17} />
              เปิด Log Folder
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <Activity size={18} aria-hidden="true" />
            <h2>LIVE STREAM DATA</h2>
            <button className="icon-button" type="button" title="Refresh Diagnostics" aria-label="Refresh Diagnostics" onClick={() => void runAction(getDiagnostics, (report) => setDiagnostics(report as DiagnosticsReport))}>
              <RefreshCw size={17} />
            </button>
          </div>
          <div className="stream-table">
            {streamRows(status.stream).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      {diagnostics && (
        <section className="diagnostics-panel">
          <div className="panel-heading">
            <CheckCircle2 size={18} aria-hidden="true" />
            <h2>NETWORK DIAGNOSTIC</h2>
            <span>{formatTime(diagnostics.generatedAt)}</span>
          </div>
          <div className="diagnostic-grid">
            {diagnostics.items.map((item) => (
              <div className={`diagnostic-item diag-${item.state}`} key={item.id}>
                <span>{item.label}</span>
                <strong>{diagnosticLabel(item.state)}</strong>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {confirmFirewall && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="firewall-title">
            <ShieldAlert size={24} aria-hidden="true" />
            <h2 id="firewall-title">ยืนยันการเปิด Firewall</h2>
            <p>ระบบจะเปิด Inbound Rule สำหรับ TCP Port 1935</p>
            <p>Windows อาจแสดงหน้าต่าง Administrator ให้กด Yes ก่อนดำเนินการ</p>
            <div className="button-row">
              <button type="button" onClick={() => setConfirmFirewall(false)}>ยกเลิก</button>
              <button
                className="primary-action"
                type="button"
                onClick={() => {
                  setConfirmFirewall(false);
                  void runAction(openFirewallRule, (result) => {
                    const payload = result as { message?: string };
                    setNotice(payload.message ?? "ส่งคำสั่งเปิด Firewall แล้ว");
                  });
                }}
              >
                <ShieldAlert size={17} />
                ยืนยัน
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
