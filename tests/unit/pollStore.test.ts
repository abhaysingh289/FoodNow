import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPollStore } from "@/app/ops/_components/pollStore";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("ops poll store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shares one request and one timer between subscribers of the same URL", async () => {
    const fetcher = vi.fn(async (url: string) => `data:${url}`);
    const store = createPollStore(fetcher, () => false, 2000);
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe("/r", a);
    store.subscribe("/r", b);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith("data:/r");
    expect(b).toHaveBeenCalledWith("data:/r");
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("skips a tick while the previous request is still running", async () => {
    const pending = deferred<string>();
    const fetcher = vi.fn(() => pending.promise);
    const store = createPollStore(fetcher, () => false, 2000);
    store.subscribe("/slow", vi.fn());
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    pending.resolve("done");
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not poll while hidden, and pollAll catches up", async () => {
    let hidden = false;
    const fetcher = vi.fn(async () => 1);
    const store = createPollStore(fetcher, () => hidden, 2000);
    store.subscribe("/x", vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    hidden = true;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    hidden = false;
    store.pollAll();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("refresh fetches again after a running request, so a mutation is never masked by stale data", async () => {
    const first = deferred<string>();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce("fresh");
    const store = createPollStore(fetcher, () => false, 2000);
    const listener = vi.fn();
    store.subscribe("/o", listener);
    const r = store.refresh("/o");
    first.resolve("stale");
    await r;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith("fresh");
  });

  it("keeps the last data on a failed request and stops polling after the last unsubscribe", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("ok").mockRejectedValueOnce(new Error("boom"));
    const store = createPollStore(fetcher, () => false, 2000);
    const listener = vi.fn();
    const off = store.subscribe("/y", listener);
    await vi.advanceTimersByTimeAsync(2000);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("gives a late subscriber the cached data immediately", async () => {
    const store = createPollStore(async () => "cached", () => false, 2000);
    store.subscribe("/z", vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    const late = vi.fn();
    store.subscribe("/z", late);
    expect(late).toHaveBeenCalledWith("cached");
  });
});
