"use client";

import { prefKey, type ViewArea, type ViewMode } from "@/lib/viewMode";

/** Remembered per browser; storage can be unavailable (private mode), so every access is guarded. */
export function readPref(area: ViewArea): ViewMode {
  try {
    return window.localStorage.getItem(prefKey(area)) === "mobile" ? "mobile" : "desktop";
  } catch {
    return "desktop";
  }
}

export function writePref(area: ViewArea, mode: ViewMode): void {
  try {
    window.localStorage.setItem(prefKey(area), mode);
  } catch {
    // not remembered; the switch still works for this visit
  }
}

export function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin parent
  }
}

export function currentPath(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}
