import { describe, it, expect } from "vitest";
import { formatDateTime, formatTime } from "@/lib/time";

describe("time", () => {
  const instant = "2026-11-12T16:30:00Z"; // 00:30 next day in both HK and SG (UTC+8)
  it("renders HH:mm in the country timezone", () => {
    expect(formatTime(instant, "HK")).toBe("00:30");
    expect(formatTime(new Date("2026-11-12T04:05:00Z"), "SG")).toBe("12:05");
  });
  it("renders date and time in the country timezone", () => {
    expect(formatDateTime(instant, "SG")).toBe("13 Nov 2026, 00:30");
  });
});
