import { createHmac, timingSafeEqual } from "node:crypto";

export const FAKE_SIGNATURE_HEADER = "x-fake-signature";

export function signFake(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyFake(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signFake(rawBody, secret), "utf8");
  const given = Buffer.from(signature, "utf8");
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}
