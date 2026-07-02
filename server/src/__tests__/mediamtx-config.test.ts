import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { mediamtxConfig } from "../mediamtx.js";
import { API_PORT, RTMP_PORT, STREAM_PATH } from "../types.js";

describe("MediaMTX safety constraints", () => {
  it("uses local Control API and the required RTMP path constants", () => {
    expect(API_PORT).toBe(9997);
    expect(RTMP_PORT).toBe(1935);
    expect(STREAM_PATH).toBe("live/drone1");
  });

  it("does not contain the forbidden drone status phrase", () => {
    const source = fs.readFileSync(new URL("../mediamtx.ts", import.meta.url), "utf8");
    expect(source.includes("เชื่อมต่อโดรนแล้ว")).toBe(false);
  });

  it("generates a lean RTMP-only MediaMTX config", () => {
    const config = mediamtxConfig();
    expect(config).toContain(`apiAddress: 127.0.0.1:${API_PORT}`);
    expect(config).toContain(`rtmpAddress: :${RTMP_PORT}`);
    expect(config).toContain("rtmp: yes");
    expect(config).toContain("rtsp: no");
    expect(config).toContain("hls: no");
    expect(config).toContain("webrtc: no");
    expect(config).toContain("srt: no");
    expect(config).toContain("moq: no");
    expect(config).toContain(`  ${STREAM_PATH}:`);
  });
});
