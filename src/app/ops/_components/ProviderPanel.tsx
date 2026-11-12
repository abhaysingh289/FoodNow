"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { usePolling } from "./usePolling";

type Item = {
  kind: "intent" | "refund";
  ref: string;
  amountCents: number;
  currency: string;
  status: string;
  hasEvent: boolean;
};

const UNDECIDED = ["REQUIRES_ACTION", "PENDING"];

export function ProviderPanel() {
  const { data: items, refresh } = usePolling<Item[]>("/api/fake-provider/items");
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body: object) {
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        setError(data?.error?.message ?? "Something went wrong");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    await refresh();
  }

  const decide = (i: Item, outcome: "succeed" | "fail", mode?: string) =>
    post(
      `/api/fake-provider/${i.kind === "intent" ? "intents" : "refunds"}/${i.ref}`,
      mode ? { outcome, mode } : { outcome },
    );

  return (
    <Card className="p-3">
      <h2 className="mb-2 font-display text-lg font-bold">Payment provider</h2>
      {error && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {error}
        </p>
      )}
      {items === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No payments or refunds yet.</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {items.map((i) => (
            <li
              key={`${i.kind}-${i.ref}`}
              data-testid={`provider-item-${i.ref}`}
              className="rounded-control border border-line p-2 text-xs"
            >
              <p className="flex justify-between gap-2">
                <span className="font-semibold uppercase">{i.kind}</span>
                <span>
                  {(i.amountCents / 100).toFixed(2)} {i.currency}
                </span>
              </p>
              <p className="truncate font-mono text-muted">{i.ref}</p>
              <p className="font-medium">{i.status}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {UNDECIDED.includes(i.status) ? (
                  <>
                    <Button size="sm" data-testid="provider-succeed" onClick={() => void decide(i, "succeed")}>
                      Succeed
                    </Button>
                    <Button size="sm" variant="danger" data-testid="provider-fail" onClick={() => void decide(i, "fail")}>
                      Fail
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid="provider-twice"
                      onClick={() => void decide(i, "succeed", "twice")}
                    >
                      Succeed x2
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid="provider-badsig"
                      onClick={() => void decide(i, "succeed", "bad_signature")}
                    >
                      Bad signature
                    </Button>
                  </>
                ) : (
                  i.hasEvent && (
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid="provider-resend"
                      onClick={() => void post("/api/fake-provider/resend", { kind: i.kind, ref: i.ref })}
                    >
                      Resend webhook
                    </Button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
