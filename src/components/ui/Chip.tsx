import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

/** Toggle chip. `pressed` drives both the look and aria-pressed. */
export function Chip({
  pressed = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-chip border px-4 text-sm font-medium transition-colors md:h-9",
        pressed
          ? "border-brand bg-brand text-white hover:bg-brand-strong"
          : "border-line-strong bg-surface text-ink hover:bg-fill",
        className,
      )}
      {...props}
    />
  );
}
