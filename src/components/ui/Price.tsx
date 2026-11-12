import type { HTMLAttributes } from "react";
import type { CountryCode } from "@/lib/countries";
import { formatMoney } from "@/lib/money";

/** Formatted money. `negative` renders a leading "-" before the currency (for discounts). */
export function Price({
  cents,
  country,
  negative = false,
  ...props
}: { cents: number; country: CountryCode; negative?: boolean } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...props}>
      {negative ? "-" : ""}
      {formatMoney(cents, country)}
    </span>
  );
}
