/** Desktop / phone-preview view switching. Pure helpers; the browser-only parts live in components/view. */
export type ViewArea = "customer" | "ops";
export type ViewMode = "desktop" | "mobile";

/** The phone the preview frame emulates (iPhone 14 size, CSS pixels). */
export const PHONE = { width: 390, height: 844 } as const;

export const DEVICE_PATH = "/device";

/** Which remembered preference a path belongs to: the ops console and the customer app are separate. */
export function areaFor(path: string): ViewArea {
  return path === "/ops" || path.startsWith("/ops/") || path.startsWith("/ops?") ? "ops" : "customer";
}

export function prefKey(area: ViewArea): string {
  return `foodnow.view.${area}`;
}

/** Only same-origin app paths may be framed; anything else (absolute, protocol-relative, the frame itself) falls back to "/". */
export function safeSrc(src: string | null | undefined): string {
  if (!src || !src.startsWith("/") || src.startsWith("//") || src.startsWith("/\\")) return "/";
  if (src === DEVICE_PATH || src.startsWith(`${DEVICE_PATH}?`) || src.startsWith(`${DEVICE_PATH}/`)) return "/";
  return src;
}

export function deviceUrl(path: string): string {
  return `${DEVICE_PATH}?src=${encodeURIComponent(safeSrc(path))}`;
}
