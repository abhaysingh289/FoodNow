"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** GETs `url` now and every `intervalMs`. `refresh()` forces an immediate reload. */
export function usePolling<T>(url: string, intervalMs = 2000): { data: T | null; refresh: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok && alive.current) setData((await res.json()) as T);
    } catch {
      // transient network error: keep the last data, the next tick retries
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const t = setInterval(() => void refresh(), intervalMs);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [refresh, intervalMs]);

  return { data, refresh };
}
