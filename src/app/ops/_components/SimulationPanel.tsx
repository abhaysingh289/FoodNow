"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";

type Settings = { autoMode: boolean; stepDelaySeconds: number };

export function SimulationPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [delay, setDelay] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/simulation", { cache: "no-store" })
      .then((r) => r.json() as Promise<Settings>)
      .then((s) => {
        if (!alive) return;
        setSettings(s);
        setDelay(String(s.stepDelaySeconds));
      })
      .catch(() => {
        if (alive) setError("Could not load simulation settings");
      });
    return () => {
      alive = false;
    };
  }, []);

  const autoMode = settings?.autoMode ?? false;
  useEffect(() => {
    if (!autoMode) return;
    let busy = false;
    const t = setInterval(() => {
      if (busy) return; // skip this tick while the previous one is still running
      busy = true;
      void fetch("/api/simulation/tick", { method: "POST" })
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    }, 1000);
    return () => clearInterval(t);
  }, [autoMode]);

  async function patch(body: Partial<Settings>) {
    setError(null);
    try {
      const res = await fetch("/api/simulation", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as (Settings & { error?: { message: string } }) | null;
      if (!res.ok || !data) setError(data?.error?.message ?? "Something went wrong");
      else setSettings({ autoMode: data.autoMode, stepDelaySeconds: data.stepDelaySeconds });
    } catch {
      setError("Network error. Please try again.");
    }
  }

  return (
    <Card className="space-y-3 p-3">
      <h2 className="font-display text-lg font-bold">Simulation</h2>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          data-testid="auto-toggle"
          checked={autoMode}
          disabled={!settings}
          onChange={(e) => void patch({ autoMode: e.target.checked })}
          className="h-4 w-4 accent-[var(--color-brand)]"
        />
        Auto mode
      </label>
      <label className="flex items-center justify-between gap-2 text-sm">
        Step delay (seconds)
        <input
          type="number"
          min={1}
          max={60}
          step={1}
          data-testid="delay-input"
          value={delay}
          disabled={!settings}
          onChange={(e) => {
            setDelay(e.target.value);
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 1 && n <= 60) void patch({ stepDelaySeconds: n });
          }}
          className="h-9 w-20 rounded-control border border-line bg-surface px-2 text-right"
        />
      </label>
      <p className="text-xs text-muted">Auto mode runs while this page is open.</p>
    </Card>
  );
}
