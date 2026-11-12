"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COUNTRY_CONFIG, type CountryCode } from "@/lib/countries";
import { cn } from "@/components/ui";
import { callApi } from "./api";
import { ViewToggle } from "@/components/view/ViewToggle";

type Props = {
  country: CountryCode;
  userId: string;
  addressId: string;
  users: { id: string; name: string }[];
  addresses: { id: string; label: string; line1: string }[];
  cartQty: number;
};

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TopBar({ country, userId, addressId, users, addresses, cartQty }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Publish the bar's height so sticky rows below it (restaurant category tabs) can sit right under it.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--topbar-h", `${el.offsetHeight}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const currentAddress = addresses.find((a) => a.id === addressId);

  return (
    <header ref={headerRef} className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 md:flex-nowrap md:gap-x-6 md:px-6 md:py-3">
        <Link href="/" className="flex h-11 items-center text-[22px] font-extrabold tracking-tight text-ink">
          Food<span className="text-brand">Now</span>
        </Link>

        {/* Delivery address: the main control of the bar. Full-width second row on mobile. */}
        <div className="order-last flex w-full min-w-0 items-center gap-2 md:order-none md:w-auto md:flex-1">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-brand" fill="currentColor" aria-hidden="true">
            <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
          </svg>
          <label className="relative flex min-w-0 flex-1 flex-col md:max-w-sm">
            <span aria-hidden="true" className="text-xs leading-tight text-muted">
              Deliver to
            </span>
            <span className="sr-only">Delivery address</span>
            <select
              data-testid="address-switch"
              className="h-7 w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-6 text-[15px] font-semibold text-ink"
              value={addressId}
              title={currentAddress ? `${currentAddress.label} · ${currentAddress.line1}` : undefined}
              onChange={(e) => update({ addressId: e.target.value })}
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {a.line1}
                </option>
              ))}
            </select>
            <Chevron className="pointer-events-none absolute bottom-1.5 right-0 h-4 w-4 text-muted" />
          </label>
          <label className="relative flex shrink-0">
            <span className="sr-only">Demo user</span>
            <select
              data-testid="user-switch"
              className="h-11 cursor-pointer appearance-none rounded-chip bg-transparent pl-2 pr-6 text-sm text-muted hover:text-ink md:h-9"
              value={userId}
              onChange={(e) => update({ userId: e.target.value })}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <Chevron className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </label>
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0 md:gap-2">
          <div className="hidden md:block">
            <ViewToggle />
          </div>
          <div role="group" aria-label="Country" className="flex rounded-chip bg-fill p-0.5">
            {(Object.keys(COUNTRY_CONFIG) as CountryCode[]).map((c) => (
              <button
                key={c}
                type="button"
                data-testid={`country-${c}`}
                aria-pressed={c === country}
                onClick={() => c !== country && update({ country: c })}
                className={cn(
                  "h-11 min-w-11 rounded-chip px-3 text-sm font-semibold transition-colors md:h-8",
                  c === country ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-muted hover:text-ink",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <Link
            href="/orders"
            data-testid="nav-orders"
            className="inline-flex h-11 items-center rounded-chip px-3 text-sm font-semibold text-ink hover:bg-fill md:h-10"
          >
            Orders
          </Link>
          <Link
            href="/cart"
            aria-label={cartQty > 0 ? `Cart, ${cartQty} items` : "Cart"}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-chip text-ink hover:bg-fill md:h-10 md:w-10"
          >
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 7h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z" strokeLinejoin="round" />
              <path d="M9 7a3 3 0 0 1 6 0" strokeLinecap="round" />
            </svg>
            {cartQty > 0 && (
              <span
                data-testid="cart-badge"
                className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-chip bg-brand px-1 text-xs font-bold tabular-nums text-white ring-2 ring-surface"
              >
                {cartQty}
              </span>
            )}
          </Link>
        </div>
      </div>
      {error && (
        <p role="alert" className="mx-auto max-w-6xl px-4 pb-2 text-sm text-danger md:px-6">
          {error}
        </p>
      )}
    </header>
  );
}
