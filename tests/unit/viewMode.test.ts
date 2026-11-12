import { describe, expect, it } from "vitest";
import { areaFor, deviceUrl, prefKey, safeSrc } from "@/lib/viewMode";

describe("view mode helpers", () => {
  it("keeps ops and the customer app as separate preference areas", () => {
    expect(areaFor("/ops")).toBe("ops");
    expect(areaFor("/ops/orders/o_1")).toBe("ops");
    expect(areaFor("/")).toBe("customer");
    expect(areaFor("/r/hk_golden_dragon")).toBe("customer");
    expect(areaFor("/opsx")).toBe("customer");
    expect(prefKey("ops")).not.toBe(prefKey("customer"));
  });

  it("only frames same-origin app paths", () => {
    expect(safeSrc("/r/hk_golden_dragon?x=1")).toBe("/r/hk_golden_dragon?x=1");
    for (const bad of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/device", "/device?src=%2F"]) {
      expect(safeSrc(bad)).toBe("/");
    }
  });

  it("builds the phone-preview URL for the current page", () => {
    expect(deviceUrl("/ops")).toBe("/device?src=%2Fops");
    expect(deviceUrl("/?q=laksa")).toBe("/device?src=%2F%3Fq%3Dlaksa");
    expect(deviceUrl("https://evil.example")).toBe("/device?src=%2F");
  });
});
