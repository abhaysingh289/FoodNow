import type { HTMLAttributes } from "react";
import type { CountryCode } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { cn } from "./cn";

/** Formatted money. `negative` renders a leading "-" before the currency (for discounts). */
export function Price({
  cents,
  country,
  negative = false,
  className,
  ...props
}: { cents: number; country: CountryCode; negative?: boolean } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("tabular-nums", className)} {...props}>
      {negative ? "-" : ""}
      {formatMoney(cents, country)}
    </span>
  );
}
