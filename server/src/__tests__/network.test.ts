import { describe, expect, it } from "vitest";
import { buildRtmpUrl, selectAdapter } from "../network.js";
import type { NetworkAdapter } from "../types.js";

const adapters: NetworkAdapter[] = [
  {
    id: "Loopback|127.0.0.1",
    name: "Loopback",
    address: "127.0.0.1",
    internal: true,
    recommended: false,
    reason: "Loopback"
  },
  {
    id: "Wi-Fi|192.168.1.20",
    name: "Wi-Fi",
    address: "192.168.1.20",
    internal: false,
    recommended: true
  }
];

describe("network helpers", () => {
  it("builds RTMP URLs without hardcoded LAN IP", () => {
    expect(buildRtmpUrl("192.168.1.20", 1935, "live/drone1"))
      .toBe("rtmp://192.168.1.20:1935/live/drone1");
  });

  it("prefers the selected adapter", () => {
    expect(selectAdapter(adapters, "Wi-Fi|192.168.1.20")?.address).toBe("192.168.1.20");
  });

  it("falls back to recommended adapters before loopback", () => {
    expect(selectAdapter(adapters)?.name).toBe("Wi-Fi");
  });
});
