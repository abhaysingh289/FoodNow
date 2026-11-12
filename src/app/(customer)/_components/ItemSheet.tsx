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
  imageUrl: string | null;
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

  const plus = (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.1)] transition-colors group-hover:border-ink"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M10 4v12M4 10h12" strokeLinecap="round" />
      </svg>
    </span>
  );

  const row = (
    <>
      <div className="min-w-0 flex-1">
        <h3 className={cn("text-[15px] font-semibold leading-snug", !addable && "text-muted")}>{item.name}</h3>
        {item.description && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{item.description}</p>}
        <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold">
          <Price cents={item.priceCents} country={country} className={addable ? undefined : "text-muted"} />
          {!item.isAvailable && (
            <span className="rounded-chip bg-fill-strong px-2 py-0.5 text-xs font-semibold text-ink">Sold out</span>
          )}
        </p>
      </div>
      {item.imageUrl ? (
        <div className="relative h-24 w-24 shrink-0">
          <div className="relative h-full w-full overflow-hidden rounded-card bg-fill">
            <Image
              src={item.imageUrl}
              alt=""
              fill
              unoptimized
              className={cn("object-cover", !addable && "opacity-50 grayscale")}
            />
          </div>
          {addable && <span className="absolute -bottom-1.5 -right-1.5">{plus}</span>}
        </div>
      ) : (
        addable && <span className="shrink-0 self-center">{plus}</span>
      )}
    </>
  );

  return (
    <>
      {addable ? (
        <button
          type="button"
          data-testid={`item-${item.id}`}
          onClick={() => setOpen(true)}
          className="group flex w-full items-start gap-4 border-b border-line py-4 text-left"
        >
          {row}
        </button>
      ) : (
        <div data-testid={`item-${item.id}`} className="flex items-start gap-4 border-b border-line py-4">
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
        {item.imageUrl && (
          <div className="relative aspect-[4/3] w-full bg-fill md:aspect-video">
            <Image src={item.imageUrl} alt="" fill unoptimized className="object-cover" />
          </div>
        )}
        <div className="space-y-6 px-5 pb-5 pt-5">
          <div className={cn(!item.imageUrl && "pr-12")}>
            <h2 className="text-[22px] font-bold leading-tight tracking-tight">{item.name}</h2>
            {item.description && <p className="mt-1.5 text-muted">{item.description}</p>}
            <p className="mt-2 font-semibold">
              <Price cents={item.priceCents} country={country} />
            </p>
          </div>

          {item.groups.map((g) => {
            const isUnmet = showUnmet && unmet.some((u) => u.id === g.id);
            return (
              <fieldset key={g.id}>
                <legend className="flex w-full items-center justify-between gap-3 pb-1">
                  <span className="text-base font-semibold">{g.name}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-chip px-2.5 py-0.5 text-xs font-semibold",
                      isUnmet ? "bg-danger-soft text-danger" : "bg-fill text-muted",
                    )}
                  >
                    {groupHint(g)}
                    {g.required && " · Required"}
                  </span>
                </legend>
                {isUnmet && (
                  <p role="alert" className="pt-1 text-sm text-danger">
                    Please choose {minFor(g)} for {g.name}.
                  </p>
                )}
                <div role={g.maxSelect === 1 ? "radiogroup" : "group"} aria-label={g.name} className="divide-y divide-line">
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
                        className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left"
                      >
                        <span className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center border-2 text-white transition-colors",
                              g.maxSelect === 1 ? "rounded-full" : "rounded-md",
                              on ? "border-ink bg-ink" : "border-line-strong bg-surface",
                            )}
                          >
                            {on &&
                              (g.maxSelect === 1 ? (
                                <span className="h-2 w-2 rounded-full bg-white" />
                              ) : (
                                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ))}
                          </span>
                          <span className={on ? "font-medium" : undefined}>{o.name}</span>
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

          <label className="block space-y-2">
            <span className="text-base font-semibold">Note for the kitchen</span>
            <textarea
              data-testid="item-note"
              value={note}
              maxLength={140}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Allergies, no onions, extra napkins…"
              className="w-full rounded-control border border-line-strong bg-surface p-3 text-base placeholder:text-muted"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-control bg-danger-soft p-3 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-surface px-5 py-3">
          <div className="flex items-center rounded-chip border border-line-strong">
            <Button
              variant="ghost"
              size="md"
              aria-label="Decrease quantity"
              data-testid="sheet-qty-dec"
              disabled={qty <= 1}
              onClick={() => setQty((q) => q - 1)}
              className="w-11 rounded-chip px-0"
            >
              −
            </Button>
            <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite" data-testid="sheet-qty">
              {qty}
            </span>
            <Button
              variant="ghost"
              size="md"
              aria-label="Increase quantity"
              data-testid="sheet-qty-inc"
              disabled={qty >= 20}
              onClick={() => setQty((q) => q + 1)}
              className="w-11 rounded-chip px-0"
            >
              +
            </Button>
          </div>
          <Button size="lg" block data-testid="add-to-cart" disabled={busy} onClick={() => add(false)}>
            Add · <Price cents={unitCents * qty} country={country} />
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={conflictWith !== null}
        onClose={() => setConflictWith(null)}
        title="Start a new cart?"
        variant="center"
        testId={conflictWith !== null ? "cart-conflict" : undefined}
      >
        <div className="space-y-5 p-6">
          <div className="space-y-1.5 pr-8">
            <h2 className="text-xl font-bold tracking-tight">Start a new cart?</h2>
            <p className="text-muted">Your cart from {conflictWith} will be cleared.</p>
          </div>
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
