"use client";

import { useRef } from "react";
import { PHONE, areaFor } from "@/lib/viewMode";
import { ModeSwitch } from "./ModeSwitch";
import { writePref } from "./prefs";

/** Renders an app page inside a phone-sized iframe, so the page's own mobile layout applies. */
export function DeviceFrame({ src }: { src: string }) {
  const frame = useRef<HTMLIFrameElement>(null);

  /** Where the user has navigated to inside the frame (same origin, so readable). */
  function framedPath(): string {
    try {
      const loc = frame.current?.contentWindow?.location;
      if (loc && loc.href !== "about:blank" && loc.origin === window.location.origin) return loc.pathname + loc.search + loc.hash;
    } catch {
      // fall through to the page the frame started on
    }
    return src;
  }

  function toDesktop() {
    const path = framedPath();
    writePref(areaFor(path), "desktop");
    window.location.assign(path);
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-fill px-4 py-5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">
          Phone preview · {PHONE.width} × {PHONE.height}
        </span>
        <ModeSwitch mode="mobile" onChange={toDesktop} />
      </div>
      <div className="rounded-[46px] bg-ink p-2.5 shadow-[0_12px_40px_rgb(0_0_0/0.18)]">
        <iframe
          ref={frame}
          src={src}
          title="Phone preview"
          data-testid="device-frame"
          className="block rounded-[36px] bg-surface"
          style={{ width: PHONE.width, height: `min(${PHONE.height}px, calc(100dvh - 7.5rem))` }}
        />
      </div>
    </div>
  );
}
