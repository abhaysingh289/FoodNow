import type { Address, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isCountryCode, type CountryCode } from "@/lib/countries";
import { NotFound } from "@/lib/errors";

export const SESSION_COOKIES = {
  user: "fn_user",
  country: "fn_country",
  address: "fn_address",
} as const;

export const DEFAULT_USER_ID = "u_mei";

export type Session = { user: User; country: CountryCode; address: Address };

export type RawSession = { userId?: string; country?: string; addressId?: string };

/**
 * Resolves possibly stale cookie values into a consistent session.
 * Fallback chain: user (DEFAULT_USER_ID, else first by id) -> country (user's default) -> address
 * (must belong to the user and the country, else the user's first address in that country).
 */
export async function resolveSession(raw: RawSession): Promise<Session> {
  const user =
    (raw.userId ? await prisma.user.findUnique({ where: { id: raw.userId } }) : null) ??
    (await prisma.user.findUnique({ where: { id: DEFAULT_USER_ID } })) ??
    (await prisma.user.findFirst({ orderBy: { id: "asc" } }));
  if (!user) throw new NotFound("No users found");

  const country: CountryCode = isCountryCode(raw.country)
    ? raw.country
    : isCountryCode(user.defaultCountry)
      ? user.defaultCountry
      : "HK";

  const requested = raw.addressId
    ? await prisma.address.findFirst({ where: { id: raw.addressId, userId: user.id, country } })
    : null;
  const address =
    requested ??
    (await prisma.address.findFirst({ where: { userId: user.id, country }, orderBy: { id: "asc" } }));
  if (!address) throw new NotFound(`No ${country} address for user ${user.id}`);

  return { user, country, address };
}

export async function getSession(): Promise<Session> {
  // Dynamic import keeps resolveSession importable outside a Next request scope (tests).
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return resolveSession({
    userId: jar.get(SESSION_COOKIES.user)?.value,
    country: jar.get(SESSION_COOKIES.country)?.value,
    addressId: jar.get(SESSION_COOKIES.address)?.value,
  });
}
