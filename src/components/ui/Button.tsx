import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong disabled:bg-line disabled:text-muted",
  secondary: "bg-surface text-ink border border-line hover:bg-brand-soft disabled:text-muted",
  ghost: "bg-transparent text-brand hover:bg-brand-soft disabled:text-muted",
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
};
const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-12 px-5 text-base",
};

/** Class string so links (<Link>) can look like buttons. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  block = false,
}: { variant?: Variant; size?: Size; block?: boolean } = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors",
    "disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
  );
}

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }) {
  return <button type={type} className={cn(buttonClasses({ variant, size, block }), className)} {...props} />;
}
