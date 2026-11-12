"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Price } from "@/components/ui";
import type { CountryCode } from "@/lib/countries";

/** Mobile-only floating "View cart" bar, shown while browsing (home and restaurant pages). */
export function CartBar({ qty, subtotalCents, country }: { qty: number; subtotalCents: number; country: CountryCode }) {
  const pathname = usePathname();
  if (pathname !== "/" && !pathname.startsWith("/r/")) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
      <Link
        href="/cart"
        data-testid="cart-bar"
        className="pointer-events-auto flex h-14 w-full items-center justify-between gap-3 rounded-control bg-brand px-4 font-semibold text-white shadow-float hover:bg-brand-strong"
      >
        <span className="min-w-0 truncate">
          View cart
          <span className="font-medium">
            {" "}
            · {qty} {qty === 1 ? "item" : "items"}
          </span>
        </span>
        <Price cents={subtotalCents} country={country} className="shrink-0" />
      </Link>
    </div>
  );
}
