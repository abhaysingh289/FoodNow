import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong disabled:bg-fill-strong disabled:text-muted",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-fill disabled:text-muted disabled:hover:bg-surface",
  ghost: "bg-transparent text-ink hover:bg-fill disabled:text-muted disabled:opacity-50 disabled:hover:bg-transparent",
  danger: "bg-danger-soft text-danger hover:bg-danger-soft-strong disabled:opacity-50",
};
const SIZES: Record<Size, string> = {
  sm: "h-11 px-3 text-sm md:h-9",
  md: "h-11 px-4 text-[15px]",
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
