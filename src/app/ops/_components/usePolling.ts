"use client";

import { useCallback, useEffect, useState } from "react";
import { createPollStore } from "./pollStore";

const store = createPollStore(
  async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
    return res.json();
  },
  () => typeof document !== "undefined" && document.visibilityState === "hidden",
);

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") store.pollAll();
  });
}

/** GETs `url` now and every 2 s, shared with every other component polling the same URL. */
export function usePolling<T>(url: string): { data: T | null; refresh: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => store.subscribe(url, (d) => setData(d as T)), [url]);

  const refresh = useCallback(() => store.refresh(url), [url]);
  return { data, refresh };
}
