/**
 * Shared polling for the ops console. Every component that polls the same URL shares one
 * timer and one request, a poll is skipped while the previous one for that URL is still
 * running, and nothing is polled while the tab is hidden.
 */
export type Fetcher = (url: string) => Promise<unknown>;
type Listener = (data: unknown) => void;
type Entry = {
  listeners: Set<Listener>;
  data: unknown;
  hasData: boolean;
  inFlight: Promise<void> | null;
  timer: ReturnType<typeof setInterval> | null;
};

export function createPollStore(fetcher: Fetcher, isHidden: () => boolean, intervalMs = 2000) {
  const entries = new Map<string, Entry>();

  function fetchNow(url: string, entry: Entry): Promise<void> {
    const p = fetcher(url)
      .then((data) => {
        entry.data = data;
        entry.hasData = true;
        entry.listeners.forEach((l) => l(data));
      })
      .catch(() => {
        // transient error: keep the last data, the next tick retries
      })
      .finally(() => {
        if (entry.inFlight === p) entry.inFlight = null;
      });
    entry.inFlight = p;
    return p;
  }

  /** Polls `url` unless a request for it is already running. */
  function poll(url: string): Promise<void> {
    const entry = entries.get(url);
    if (!entry) return Promise.resolve();
    return entry.inFlight ?? fetchNow(url, entry);
  }

  /** Forces fresh data (e.g. after a mutation): waits out any running request, then fetches again. */
  async function refresh(url: string): Promise<void> {
    const entry = entries.get(url);
    if (!entry) return;
    if (entry.inFlight) await entry.inFlight;
    await fetchNow(url, entry);
  }

  function subscribe(url: string, listener: Listener): () => void {
    let entry = entries.get(url);
    if (!entry) {
      entry = { listeners: new Set(), data: undefined, hasData: false, inFlight: null, timer: null };
      entries.set(url, entry);
    }
    entry.listeners.add(listener);
    if (entry.hasData) listener(entry.data);
    if (!entry.timer) {
      entry.timer = setInterval(() => {
        if (!isHidden()) void poll(url);
      }, intervalMs);
      void poll(url);
    }
    const e = entry;
    return () => {
      e.listeners.delete(listener);
      if (e.listeners.size === 0) {
        if (e.timer) clearInterval(e.timer);
        entries.delete(url);
      }
    };
  }

  /** Polls every subscribed URL now (used when the tab becomes visible again). */
  function pollAll(): void {
    for (const url of entries.keys()) void poll(url);
  }

  return { subscribe, refresh, poll, pollAll };
}
