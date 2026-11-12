"use client";

import { useEffect, useState } from "react";
import { areaFor, deviceUrl } from "@/lib/viewMode";
import { ModeSwitch } from "./ModeSwitch";
import { currentPath, isFramed, readPref, writePref } from "./prefs";

/**
 * Desktop/Mobile switch for a page's top bar. Choosing Mobile reopens the current page inside the
 * phone-preview frame (/device). Hidden inside that frame, as a real phone would not show it.
 * If this area (customer app or ops) was last left in Mobile, a fresh visit reopens in the frame.
 */
export function ViewToggle({ className }: { className?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isFramed()) return;
    if (readPref(areaFor(window.location.pathname)) === "mobile") {
      window.location.replace(deviceUrl(currentPath()));
      return;
    }
    setShow(true); // client-only: whether we are framed is unknown during server rendering
  }, []);

  if (!show) return null;
  return (
    <ModeSwitch
      mode="desktop"
      className={className}
      onChange={() => {
        writePref(areaFor(window.location.pathname), "mobile");
        window.location.assign(deviceUrl(currentPath()));
      }}
    />
  );
}
