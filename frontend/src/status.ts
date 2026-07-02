import type { BridgeState, DiagnosticState } from "./types";

export function stateTone(state: BridgeState): "neutral" | "active" | "success" | "warning" | "danger" {
  switch (state) {
    case "RECEIVING_STREAM":
      return "success";
    case "STREAM_LOST":
    case "READY":
    case "WAITING_FOR_STREAM":
      return "warning";
    case "ERROR":
      return "danger";
    case "STARTING":
      return "active";
    case "OFF":
      return "neutral";
  }
}

export function diagnosticLabel(state: DiagnosticState): string {
  switch (state) {
    case "pass":
      return "ผ่าน";
    case "warn":
      return "ต้องตรวจ";
    case "fail":
      return "ไม่ผ่าน";
    case "unknown":
      return "ไม่ทราบ";
  }
}

export function valueOrEmpty(value?: string): string {
  return value && value.trim() ? value : "ไม่พบข้อมูลจาก Stream";
}
