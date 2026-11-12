"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { callApi } from "./api";

/** `appliedCode` is set only when the promo currently qualifies; `serverError` is the CartView promoError. */
export function PromoForm({
  appliedCode,
  serverError,
}: {
  appliedCode: string | null;
  serverError: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(next: string | null) {
    setBusy(true);
    const res = await callApi("/api/cart/promo", "PUT", { code: next });
    setBusy(false);
    if (res.ok) {
      setError(null);
      if (inputRef.current) inputRef.current.value = "";
    } else {
      setError(res.error.message);
    }
    router.refresh();
  }

  const message = error ?? serverError;

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const code = inputRef.current?.value.trim();
          if (code) void submit(code);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Promo code</span>
          <input
            data-testid="promo-input"
            ref={inputRef}
            placeholder="Promo code"
            autoCapitalize="characters"
            className="h-11 w-full rounded-control border border-line bg-surface px-3 text-base uppercase placeholder:normal-case"
          />
        </label>
        <Button type="submit" variant="secondary" data-testid="promo-apply" disabled={busy}>
          Apply
        </Button>
      </form>
      {appliedCode && (
        <p className="flex items-center justify-between text-sm text-ok">
          <span>
            Code <strong>{appliedCode}</strong> applied
          </span>
          <button
            type="button"
            data-testid="promo-remove"
            className="font-semibold underline"
            disabled={busy}
            onClick={() => submit(null)}
          >
            Remove
          </button>
        </p>
      )}
      {message && (
        <p role="alert" data-testid="promo-error" className="text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
