import Link from "next/link";
import { Card, Price, buttonClasses } from "@/components/ui";
import { getSession } from "@/lib/session";
import { getCart } from "@/modules/cart";
import { PayButton } from "../_components/PayButton";
import { PriceBreakdown } from "../_components/PriceBreakdown";

export default async function CheckoutPage() {
  const session = await getSession();
  const cart = await getCart(session.user.id, session.address);

  if (!cart.restaurant || cart.lines.length === 0) {
    return (
      <div data-testid="checkout-empty" className="space-y-4 py-16 text-center">
        <h1 className="font-display text-3xl font-extrabold">Nothing to check out</h1>
        <p className="text-muted">Your cart is empty.</p>
        <Link href="/" className={buttonClasses({ size: "lg" })}>
          Browse restaurants
        </Link>
      </div>
    );
  }

  const { restaurant, lines, price } = cart;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold">Checkout</h1>

      <Card className="space-y-1 p-4">
        <p className="text-sm font-semibold text-muted">Deliver to</p>
        <p data-testid="checkout-address" className="font-semibold">
          {session.address.label} · {session.address.line1}
        </p>
        <Link href="/cart" className="text-sm font-semibold text-brand">
          Back to cart (change the address in the top bar)
        </Link>
      </Card>

      <Card className="p-4">
        <p className="font-semibold">{restaurant.name}</p>
        <ul className="mt-2 divide-y divide-line">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-2 text-sm">
              <span>
                {l.qty} × {l.name}
                {l.options.length > 0 && <span className="block text-muted">{l.options.map((o) => o.name).join(", ")}</span>}
              </span>
              <Price cents={l.unitPriceCents * l.qty} country={restaurant.country} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <PriceBreakdown price={price} country={restaurant.country} />
      </Card>

      <PayButton />
    </div>
  );
}
