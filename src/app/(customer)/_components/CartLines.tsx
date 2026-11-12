"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Price } from "@/components/ui";
import type { CountryCode } from "@/lib/countries";
import type { CartView } from "@/modules/cart";
import { callApi } from "./api";

export function CartLines({ lines, country }: { lines: CartView["lines"]; country: CountryCode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setQty(lineId: string, qty: number) {
    setBusy(true);
    const res = await callApi(`/api/cart/items/${lineId}`, "PATCH", { qty });
    setBusy(false);
    setError(res.ok ? null : res.error.message);
    router.refresh();
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {lines.map((l) => (
          <li key={l.id} data-testid="cart-line" className="flex items-start gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{l.name}</p>
              {l.options.length > 0 && (
                <p className="mt-0.5 text-[13px] text-muted">{l.options.map((o) => o.name).join(", ")}</p>
              )}
              {l.note && <p className="mt-0.5 text-[13px] italic text-muted">“{l.note}”</p>}
              {!l.isAvailable && <p className="mt-1 text-sm font-semibold text-danger">No longer available. Please remove.</p>}
              <p className="mt-1.5 text-[15px] font-medium">
                <Price cents={l.unitPriceCents * l.qty} country={country} />
              </p>
            </div>
            <div className="flex shrink-0 items-center rounded-chip border border-line-strong bg-surface">
              <Button
                variant="ghost"
                aria-label={l.qty === 1 ? `Remove ${l.name}` : `Decrease ${l.name}`}
                data-testid="qty-dec"
                disabled={busy}
                onClick={() => setQty(l.id, l.qty - 1)}
                className="w-11 rounded-chip px-0"
              >
                {l.qty === 1 ? (
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 .8 12a2 2 0 0 0 2 1.9h4.4a2 2 0 0 0 2-1.9L18 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  "−"
                )}
              </Button>
              <span className="w-6 text-center font-semibold tabular-nums" data-testid="line-qty">
                {l.qty}
              </span>
              <Button
                variant="ghost"
                aria-label={`Increase ${l.name}`}
                data-testid="qty-inc"
                disabled={busy || l.qty >= 20}
                onClick={() => setQty(l.id, l.qty + 1)}
                className="w-11 rounded-chip px-0"
              >
                +
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
