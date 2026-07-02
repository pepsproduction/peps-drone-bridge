import os from "node:os";
import type { NetworkAdapter } from "./types.js";

const EXCLUDED_BY_DEFAULT = [
  "loopback",
  "virtualbox",
  "vmware",
  "tailscale",
  "zerotier",
  "zero tier",
  "hyper-v",
  "hyper v",
  "vethernet",
  "wsl"
];

function adapterId(name: string, address: string): string {
  return `${name}|${address}`;
}

function isApipa(address: string): boolean {
  return address.startsWith("169.254.");
}

function exclusionReason(name: string, address: string, internal: boolean): string | undefined {
  const normalized = name.toLowerCase();
  if (internal) {
    return "Loopback";
  }
  if (isApipa(address)) {
    return "IPv4 ยังไม่ได้รับจาก router";
  }
  const keyword = EXCLUDED_BY_DEFAULT.find((item) => normalized.includes(item));
  return keyword;
}

export function listNetworkAdapters(): NetworkAdapter[] {
  const interfaces = os.networkInterfaces();
  const adapters: NetworkAdapter[] = [];

  for (const [name, details] of Object.entries(interfaces)) {
    for (const detail of details ?? []) {
      if (detail.family !== "IPv4") {
        continue;
      }

      const reason = exclusionReason(name, detail.address, detail.internal);
      adapters.push({
        id: adapterId(name, detail.address),
        name,
        address: detail.address,
        netmask: detail.netmask,
        mac: detail.mac,
        internal: detail.internal,
        recommended: !reason,
        reason
      });
    }
  }

  return adapters.sort((left, right) => {
    if (left.recommended !== right.recommended) {
      return left.recommended ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export function selectAdapter(adapters: NetworkAdapter[], selectedId?: string): NetworkAdapter | undefined {
  return adapters.find((adapter) => adapter.id === selectedId)
    ?? adapters.find((adapter) => adapter.recommended)
    ?? adapters.find((adapter) => !adapter.internal);
}

export function buildRtmpUrl(address: string, port: number, streamPath: string): string {
  return `rtmp://${address}:${port}/${streamPath}`;
}
