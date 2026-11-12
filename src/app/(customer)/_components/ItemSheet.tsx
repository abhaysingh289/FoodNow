"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Price, Sheet, cn } from "@/components/ui";
import type { CountryCode } from "@/lib/countries";
import { callApi } from "./api";

export type SheetItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  isAvailable: boolean;
  groups: {
    id: string;
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    options: { id: string; name: string; priceDeltaCents: number }[];
  }[];
};

type Group = SheetItem["groups"][number];

const minFor = (g: Group) => (g.required ? Math.max(g.minSelect, 1) : 0);

function groupHint(g: Group): string {
  const min = minFor(g);
  if (min > 0 && min === g.maxSelect) return `Choose ${min}`;
  if (min > 0) return `Choose ${min} to ${g.maxSelect}`;
  return `Choose up to ${g.maxSelect}`;
}

/** The pushed-in "other restaurant" name from the CART_CONFLICT message. */
function conflictRestaurant(message: string): string {
  return /items from (.+)$/.exec(message)?.[1] ?? "another restaurant";
}

/** One menu row plus the add-to-cart sheet it opens. */
export function ItemSheet({
  item,
  country,
  restaurantOpen,
}: {
  item: SheetItem;
  country: CountryCode;
  restaurantOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [showUnmet, setShowUnmet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictWith, setConflictWith] = useState<string | null>(null);

  const addable = item.isAvailable && restaurantOpen;
  const unmet = item.groups.filter(
    (g) => g.options.filter((o) => selected.includes(o.id)).length < minFor(g),
  );
  const unitCents =
    item.priceCents +
    item.groups.flatMap((g) => g.options).reduce((s, o) => s + (selected.includes(o.id) ? o.priceDeltaCents : 0), 0);

  function reset() {
    setSelected([]);
    setQty(1);
    setNote("");
    setShowUnmet(false);
    setError(null);
  }

  function pick(g: Group, optionId: string) {
    setSelected((cur) => {
      if (cur.includes(optionId)) return cur.filter((id) => id !== optionId);
      const inGroup = g.options.map((o) => o.id);
      if (g.maxSelect === 1) return [...cur.filter((id) => !inGroup.includes(id)), optionId];
      const count = cur.filter((id) => inGroup.includes(id)).length;
      return count >= g.maxSelect ? cur : [...cur, optionId];
    });
  }

  async function add(replaceCart: boolean) {
    if (unmet.length > 0) {
      setShowUnmet(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await callApi("/api/cart/items", "POST", {
      menuItemId: item.id,
      qty,
      optionIds: selected,
      note: note.trim() || undefined,
      replaceCart,
    });
    setBusy(false);
    if (res.ok) {
      setConflictWith(null);
      setOpen(false);
      reset();
      router.refresh();
    } else if (res.error.code === "CART_CONFLICT") {
      setConflictWith(conflictRestaurant(res.error.message));
    } else {
      setError(res.error.message);
    }
  }

  const row = (
    <>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{item.name}</h3>
        {item.description && <p className="line-clamp-2 text-sm text-muted">{item.description}</p>}
        <p className="mt-1 text-sm font-semibold">
          <Price cents={item.priceCents} country={country} />
          {!item.isAvailable && (
            <span className="ml-2 rounded-chip bg-line px-2 py-0.5 text-xs font-semibold text-muted">Sold out</span>
          )}
        </p>
      </div>
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control bg-brand-soft">
        <Image src={item.imageUrl} alt="" fill unoptimized className="object-cover" />
      </div>
    </>
  );

  return (
    <>
      {addable ? (
        <button
          type="button"
          data-testid={`item-${item.id}`}
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-card p-3 text-left hover:bg-brand-soft"
        >
          {row}
        </button>
      ) : (
        <div data-testid={`item-${item.id}`} className="flex items-center gap-3 p-3 opacity-50 grayscale">
          {row}
        </div>
      )}

      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title={item.name}
        testId={open ? "item-sheet" : undefined}
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 className="font-display text-2xl font-bold">{item.name}</h2>
            {item.description && <p className="mt-1 text-muted">{item.description}</p>}
          </div>

          {item.groups.map((g) => {
            const isUnmet = showUnmet && unmet.some((u) => u.id === g.id);
            return (
              <fieldset key={g.id} className="space-y-2">
                <legend className="flex w-full items-baseline justify-between">
                  <span className="font-semibold">{g.name}</span>
                  <span className={cn("text-sm", isUnmet ? "font-semibold text-danger" : "text-muted")}>
                    {groupHint(g)}
                    {g.required && " · Required"}
                  </span>
                </legend>
                {isUnmet && (
                  <p role="alert" className="text-sm text-danger">
                    Please choose {minFor(g)} for {g.name}.
                  </p>
                )}
                <div role={g.maxSelect === 1 ? "radiogroup" : "group"} aria-label={g.name} className="space-y-1.5">
                  {g.options.map((o) => {
                    const on = selected.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role={g.maxSelect === 1 ? "radio" : "checkbox"}
                        aria-checked={on}
                        data-testid={`option-${o.id}`}
                        onClick={() => pick(g, o.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-control border px-3 py-2.5 text-left",
                          on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex h-5 w-5 items-center justify-center border-2 text-xs text-white",
                              g.maxSelect === 1 ? "rounded-full" : "rounded-md",
                              on ? "border-brand bg-brand" : "border-line",
                            )}
                          >
                            {on && "✓"}
                          </span>
                          {o.name}
                        </span>
                        {o.priceDeltaCents !== 0 && (
                          <span className="text-sm text-muted">
                            +<Price cents={o.priceDeltaCents} country={country} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <label className="block space-y-1">
            <span className="font-semibold">Note for the kitchen</span>
            <textarea
              data-testid="item-note"
              value={note}
              maxLength={140}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Allergies, no onions, extra napkins…"
              className="w-full rounded-control border border-line bg-surface p-2.5 text-base"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-control bg-danger-soft p-3 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-control border border-line">
              <Button
                variant="ghost"
                size="md"
                aria-label="Decrease quantity"
                data-testid="sheet-qty-dec"
                disabled={qty <= 1}
                onClick={() => setQty((q) => q - 1)}
              >
                −
              </Button>
              <span className="w-8 text-center font-semibold" aria-live="polite" data-testid="sheet-qty">
                {qty}
              </span>
              <Button
                variant="ghost"
                size="md"
                aria-label="Increase quantity"
                data-testid="sheet-qty-inc"
                disabled={qty >= 20}
                onClick={() => setQty((q) => q + 1)}
              >
                +
              </Button>
            </div>
            <Button size="lg" block data-testid="add-to-cart" disabled={busy} onClick={() => add(false)}>
              Add · <Price cents={unitCents * qty} country={country} />
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={conflictWith !== null}
        onClose={() => setConflictWith(null)}
        title="Start a new cart?"
        variant="center"
        testId={conflictWith !== null ? "cart-conflict" : undefined}
      >
        <div className="space-y-4 p-5">
          <h2 className="font-display text-xl font-bold">Start a new cart?</h2>
          <p className="text-muted">Your cart from {conflictWith} will be cleared.</p>
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => setConflictWith(null)}>
              Keep my cart
            </Button>
            <Button block data-testid="confirm-new-cart" disabled={busy} onClick={() => add(true)}>
              Start new cart
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
