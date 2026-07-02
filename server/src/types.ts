export const STREAM_PATH = "live/drone1";
export const RTMP_PORT = 1935;
export const API_PORT = 9997;
export const WEB_PORT = 19555;
export const FIREWALL_RULE_NAME = "PEPS LIVE Drone RTMP Bridge 1935";

export type BridgeState =
  | "OFF"
  | "STARTING"
  | "READY"
  | "WAITING_FOR_STREAM"
  | "RECEIVING_STREAM"
  | "STREAM_LOST"
  | "ERROR";

export type DiagnosticState = "pass" | "warn" | "fail" | "unknown";

export interface NetworkAdapter {
  id: string;
  name: string;
  address: string;
  netmask?: string;
  mac?: string;
  internal: boolean;
  recommended: boolean;
  reason?: string;
}

export interface StreamInfo {
  path: string;
  protocol?: string;
  sourceIp?: string;
  codec?: string;
  resolution?: string;
  fps?: string;
  bitrate?: string;
  connectionDuration?: string;
  lastUpdate?: string;
}

export interface BridgeUrls {
  djiFly?: string;
  obs: string;
}

export interface BridgeStatus {
  state: BridgeState;
  stateTextTh: string;
  detailTextTh: string;
  updatedAt: string;
  mediamtxFound: boolean;
  mediamtxPath?: string;
  processRunning: boolean;
  rtmpPort: number;
  apiBaseUrl: string;
  streamPath: string;
  selectedAdapter?: NetworkAdapter;
  adapters: NetworkAdapter[];
  urls: BridgeUrls;
  startedAt?: string;
  lastStreamAt?: string;
  stream?: StreamInfo;
  warnings: string[];
  errors: string[];
}

export interface DiagnosticItem {
  id: string;
  label: string;
  state: DiagnosticState;
  message: string;
}

export interface DiagnosticsReport {
  generatedAt: string;
  items: DiagnosticItem[];
}

export interface MediaMtxPathSnapshot {
  apiOk: boolean;
  hasPublisher: boolean;
  stream?: StreamInfo;
}

export interface StoredSettings {
  selectedAdapterId?: string;
}
