import { checkFirewallRule } from "./firewall.js";
import { listNetworkAdapters, selectAdapter } from "./network.js";
import { findWindowsPortOwner, isTcpPortOpen } from "./ports.js";
import { readSettings } from "./settings.js";
import { RTMP_PORT, type DiagnosticItem, type DiagnosticsReport } from "./types.js";

export interface DiagnosticContext {
  processRunning: boolean;
}

export async function buildDiagnostics(context: DiagnosticContext): Promise<DiagnosticsReport> {
  const adapters = listNetworkAdapters();
  const selectedAdapter = selectAdapter(adapters, readSettings().selectedAdapterId);
  const portOpen = await isTcpPortOpen("127.0.0.1", RTMP_PORT);
  const owner = await findWindowsPortOwner(RTMP_PORT);
  const firewall = await checkFirewallRule();

  const items: DiagnosticItem[] = [
    {
      id: "mediamtx-process",
      label: "MediaMTX process",
      state: context.processRunning ? "pass" : "warn",
      message: context.processRunning ? "MediaMTX กำลังทำงาน" : "MediaMTX ยังไม่ทำงาน"
    },
    {
      id: "rtmp-port-open",
      label: "พอร์ต 1935",
      state: portOpen ? "pass" : "warn",
      message: portOpen ? "พอร์ต 1935 เปิดและรับ connection ได้" : "พอร์ต 1935 ยังไม่เปิด"
    },
    {
      id: "rtmp-port-owner",
      label: "Process ที่จับพอร์ต 1935",
      state: owner && !context.processRunning ? "fail" : owner ? "pass" : "unknown",
      message: owner
        ? `พบ ${owner}`
        : "ไม่พบ process ที่ listen พอร์ต 1935 จาก netstat"
    },
    {
      id: "selected-lan-ip",
      label: "IPv4 LAN",
      state: selectedAdapter ? "pass" : "fail",
      message: selectedAdapter
        ? `เลือก ${selectedAdapter.name} (${selectedAdapter.address})`
        : "หา IPv4 LAN ที่ใช้งานได้ไม่พบ"
    },
    {
      id: "firewall-rule",
      label: "Windows Firewall",
      state: firewall === "present" ? "pass" : firewall === "missing" ? "warn" : "unknown",
      message: firewall === "present"
        ? "พบ Inbound Rule สำหรับ TCP 1935"
        : firewall === "missing"
          ? "ยังไม่พบ Inbound Rule สำหรับ TCP 1935"
          : "ตรวจ Firewall rule ไม่ได้บนระบบนี้"
    },
    {
      id: "same-subnet",
      label: "มือถือกับคอมอยู่ subnet เดียวกัน",
      state: selectedAdapter ? "unknown" : "fail",
      message: selectedAdapter
        ? "ระบบตรวจ subnet ของมือถือไม่ได้ ให้ตรวจว่า DJI Fly อยู่ Wi-Fi วงเดียวกับ IP นี้"
        : "ยังไม่มี IP LAN ให้เทียบ subnet"
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    items
  };
}
