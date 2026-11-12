import { beforeAll, describe, expect, it } from "vitest";
import { resolveSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { resetDb } from "../helpers/db";

describe("resolveSession", () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("falls back to the first user when the user is unknown", async () => {
    expect((await resolveSession({})).user.id).toBe("u_mei");
    expect((await resolveSession({ userId: "nope" })).user.id).toBe("u_mei");
  });

  it("defaults the country to the user's default country", async () => {
    expect((await resolveSession({ userId: "u_arjun" })).country).toBe("SG");
  });

  it("falls back to the default country for an invalid country", async () => {
    expect((await resolveSession({ userId: "u_mei", country: "XX" })).country).toBe("HK");
  });

  it("keeps a valid address in the current country", async () => {
    const s = await resolveSession({ userId: "u_mei", country: "SG", addressId: "a_mei_sg" });
    expect(s.address.id).toBe("a_mei_sg");
  });

  it("falls back to the user's first address in the country when the address is in another country", async () => {
    const s = await resolveSession({ userId: "u_mei", country: "SG", addressId: "a_mei_hk" });
    expect(s.country).toBe("SG");
    expect(s.address.id).toBe("a_mei_sg");
  });

  it("falls back when the address belongs to another user", async () => {
    const t = await resolveSession({ userId: "u_mei", country: "HK", addressId: "a_arjun_hk" });
    expect(t.address.id).toBe("a_mei_hk");
  });

  it("throws NotFound when the user has no address in the country", async () => {
    await prisma.user.create({ data: { id: "u_tmp_hk", name: "Tmp", phone: "0", defaultCountry: "HK" } });
    await prisma.address.create({
      data: { id: "a_tmp_hk", userId: "u_tmp_hk", country: "HK", districtId: "d_hk_mongkok", label: "H", line1: "x", lat: 22.3, lng: 114.1 },
    });
    await expect(resolveSession({ userId: "u_tmp_hk", country: "SG" })).rejects.toThrow(/No SG address/);
    await prisma.address.delete({ where: { id: "a_tmp_hk" } });
    await prisma.user.delete({ where: { id: "u_tmp_hk" } });
  });
});
