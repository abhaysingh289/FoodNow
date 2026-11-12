import { Price } from "@/components/ui";
import type { CountryCode } from "@/lib/countries";
import type { PriceBreakdown as PriceData } from "@/modules/cart";

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between text-lg font-bold" : "flex justify-between text-muted"}>
      <dt>{label}</dt>
      <dd className={strong ? "" : "text-ink"}>{children}</dd>
    </div>
  );
}

export function PriceBreakdown({ price, country }: { price: PriceData; country: CountryCode }) {
  return (
    <dl className="space-y-2">
      <Row label="Subtotal">
        <Price data-testid="price-subtotal" cents={price.subtotalCents} country={country} />
      </Row>
      {price.discountCents > 0 && (
        <Row label={price.promoCode ? `Discount (${price.promoCode})` : "Discount"}>
          <Price data-testid="price-discount" cents={price.discountCents} country={country} negative />
        </Row>
      )}
      <Row label="Delivery fee">
        <Price data-testid="price-fee" cents={price.deliveryFeeCents} country={country} />
      </Row>
      {price.taxCents > 0 && (
        <Row label="GST">
          <Price data-testid="price-tax" cents={price.taxCents} country={country} />
        </Row>
      )}
      <div className="border-t border-line pt-2">
        <Row label="Total" strong>
          <Price data-testid="price-total" cents={price.totalCents} country={country} />
        </Row>
      </div>
    </dl>
  );
}
