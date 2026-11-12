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
        "inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-chip border px-3.5 text-sm font-medium transition-colors",
        pressed
          ? "border-brand bg-brand text-white"
          : "border-line bg-surface text-ink hover:border-brand hover:text-brand",
        className,
      )}
      {...props}
    />
  );
}
