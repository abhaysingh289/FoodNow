import { describe, expect, it } from "vitest";
import { computeEta } from "@/modules/delivery/eta";

describe("computeEta", () => {
  it("adds rider-to-restaurant time before pickup", () => {
    expect(computeEta("ACCEPTED", 15, 2.4)).toBe(33);
    expect(computeEta("RIDER_ASSIGNED", 15, 2.4)).toBe(33);
  });
  it("is travel plus buffer once picked up", () => {
    expect(computeEta("PICKED_UP", 15, 2.4)).toBe(13);
  });
});
