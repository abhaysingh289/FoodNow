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
          <li key={l.id} data-testid="cart-line" className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{l.name}</p>
              {l.options.length > 0 && <p className="text-sm text-muted">{l.options.map((o) => o.name).join(", ")}</p>}
              {l.note && <p className="text-sm italic text-muted">“{l.note}”</p>}
              {!l.isAvailable && <p className="text-sm font-semibold text-danger">No longer available. Please remove.</p>}
              <p className="mt-1 text-sm">
                <Price cents={l.unitPriceCents * l.qty} country={country} />
              </p>
            </div>
            <div className="flex items-center rounded-control border border-line bg-surface">
              <Button
                variant="ghost"
                aria-label={l.qty === 1 ? `Remove ${l.name}` : `Decrease ${l.name}`}
                data-testid="qty-dec"
                disabled={busy}
                onClick={() => setQty(l.id, l.qty - 1)}
              >
                {l.qty === 1 ? "🗑" : "−"}
              </Button>
              <span className="w-7 text-center font-semibold" data-testid="line-qty">
                {l.qty}
              </span>
              <Button
                variant="ghost"
                aria-label={`Increase ${l.name}`}
                data-testid="qty-inc"
                disabled={busy || l.qty >= 20}
                onClick={() => setQty(l.id, l.qty + 1)}
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
