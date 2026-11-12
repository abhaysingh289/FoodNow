"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COUNTRY_CONFIG, type CountryCode } from "@/lib/countries";
import { cn } from "@/components/ui";
import { callApi } from "./api";

type Props = {
  country: CountryCode;
  userId: string;
  addressId: string;
  users: { id: string; name: string }[];
  addresses: { id: string; label: string; line1: string }[];
  cartQty: number;
};

const selectClass =
  "h-9 min-w-0 flex-1 rounded-control border border-line bg-surface px-2 text-sm text-ink";

export function TopBar({ country, userId, addressId, users, addresses, cartQty }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function update(body: { userId?: string; country?: string; addressId?: string }) {
    // Write the changed cookies immediately so a navigation right after the click already sees
    // them; the API call then normalises the rest (e.g. falls back to a valid address).
    const cookieNames = { userId: "fn_user", country: "fn_country", addressId: "fn_address" } as const;
    for (const [key, name] of Object.entries(cookieNames)) {
      const value = body[key as keyof typeof body];
      if (value) document.cookie = `${name}=${encodeURIComponent(value)}; path=/; samesite=lax`;
    }
    // The route resolves from the body alone, so always send the full current session.
    const res = await callApi("/api/session", "POST", { userId, country, addressId, ...body });
    if (!res.ok) setError(res.error.message);
    else setError(null);
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 px-4 pb-3 pt-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="font-display text-2xl font-extrabold tracking-tight text-brand">
          Food<span className="text-ink">Now</span>
        </Link>
        <div role="group" aria-label="Country" className="flex rounded-chip border border-line bg-surface p-0.5">
          {(Object.keys(COUNTRY_CONFIG) as CountryCode[]).map((c) => (
            <button
              key={c}
              type="button"
              data-testid={`country-${c}`}
              aria-pressed={c === country}
              onClick={() => c !== country && update({ country: c })}
              className={cn(
                "h-8 rounded-chip px-3 text-sm font-semibold transition-colors",
                c === country ? "bg-ink text-white" : "text-muted hover:text-ink",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <Link href="/orders" data-testid="nav-orders" className="text-sm font-semibold text-muted hover:text-ink">
          Orders
        </Link>
        <Link
          href="/cart"
          aria-label={cartQty > 0 ? `Cart, ${cartQty} items` : "Cart"}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-chip border border-line bg-surface"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 7h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z" strokeLinejoin="round" />
            <path d="M9 7a3 3 0 0 1 6 0" strokeLinecap="round" />
          </svg>
          {cartQty > 0 && (
            <span
              data-testid="cart-badge"
              className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-chip bg-brand px-1 text-xs font-bold text-white"
            >
              {cartQty}
            </span>
          )}
        </Link>
      </div>
      <div className="mt-3 flex gap-2">
        <label className="flex min-w-0 flex-1">
          <span className="sr-only">Demo user</span>
          <select
            data-testid="user-switch"
            className={selectClass}
            value={userId}
            onChange={(e) => update({ userId: e.target.value })}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-[1.4]">
          <span className="sr-only">Delivery address</span>
          <select
            data-testid="address-switch"
            className={selectClass}
            value={addressId}
            onChange={(e) => update({ addressId: e.target.value })}
          >
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} · {a.line1}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </header>
  );
}
