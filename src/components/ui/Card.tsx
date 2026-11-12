import type { HTMLAttributes } from "react";
import { cn } from "./cn";

/** Hairline-bordered white tile. No shadow: the redesign keeps shadows for floating elements only. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-surface", className)} {...props} />;
}
