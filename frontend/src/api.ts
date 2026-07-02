import type { BridgeStatus, DiagnosticsReport } from "./types";

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function getStatus(): Promise<BridgeStatus> {
  return jsonRequest<BridgeStatus>("/api/status");
}

export function startServer(): Promise<BridgeStatus> {
  return jsonRequest<BridgeStatus>("/api/server/start", {
    method: "POST"
  });
}

export function stopServer(): Promise<BridgeStatus> {
  return jsonRequest<BridgeStatus>("/api/server/stop", {
    method: "POST"
  });
}

export function selectAdapter(adapterId: string): Promise<BridgeStatus> {
  return jsonRequest<BridgeStatus>("/api/adapters/select", {
    method: "POST",
    body: JSON.stringify({ adapterId })
  });
}

export function getDiagnostics(): Promise<DiagnosticsReport> {
  return jsonRequest<DiagnosticsReport>("/api/diagnostics");
}

export function openLogs(): Promise<{ ok: boolean; path: string }> {
  return jsonRequest<{ ok: boolean; path: string }>("/api/logs/open-folder", {
    method: "POST"
  });
}

export function openFirewallRule(): Promise<{ ok: boolean; message: string }> {
  return jsonRequest<{ ok: boolean; message: string }>("/api/firewall/open", {
    method: "POST",
    body: JSON.stringify({ confirm: true })
  });
}
