import { describe, expect, it } from "vitest";
import { haversineKm } from "@/modules/catalog/geo";
import { etaQuote, travelMinutes } from "@/modules/delivery/eta";

describe("geo and eta", () => {
  it("computes haversine distance rounded to 0.1 km", () => {
    expect(haversineKm({ lat: 22.2819, lng: 114.158 }, { lat: 22.2988, lng: 114.1722 })).toBe(2.4);
  });
  it("computes travel minutes and ETA quote", () => {
    expect(travelMinutes(2.4)).toBe(8);
    expect(etaQuote(15, 2.4)).toBe(28);
  });
});
