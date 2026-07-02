import { describe, expect, it } from "vitest";
import { stateTone, valueOrEmpty } from "./status";

describe("status helpers", () => {
  it("uses green only for actual stream receiving state", () => {
    expect(stateTone("RECEIVING_STREAM")).toBe("success");
    expect(stateTone("WAITING_FOR_STREAM")).not.toBe("success");
  });

  it("does not fabricate empty stream data", () => {
    expect(valueOrEmpty(undefined)).toBe("ไม่พบข้อมูลจาก Stream");
  });
});
