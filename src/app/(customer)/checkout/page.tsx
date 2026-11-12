import Link from "next/link";
import { Price, buttonClasses } from "@/components/ui";
import { getSession } from "@/lib/session";
import { getCart } from "@/modules/cart";
import { PayButton } from "../_components/PayButton";
import { PriceBreakdown } from "../_components/PriceBreakdown";

export default async function CheckoutPage() {
  const session = await getSession();
  const cart = await getCart(session.user.id, session.address);

  if (!cart.restaurant || cart.lines.length === 0) {
    return (
      <div data-testid="checkout-empty" className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-[26px] font-bold tracking-tight">Nothing to check out</h1>
        <p className="text-muted">Your cart is empty.</p>
        <Link href="/" className={buttonClasses({ size: "lg" })}>
          Browse restaurants
        </Link>
      </div>
    );
  }

  const { restaurant, lines, price } = cart;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="pb-4 text-[26px] font-bold leading-tight tracking-tight md:text-[28px]">Checkout</h1>

      <div className="divide-y divide-line border-y border-line">
        <section className="space-y-1 py-5">
          <h2 className="text-[13px] font-medium text-muted">Deliver to</h2>
          <p data-testid="checkout-address" className="font-semibold">
            {session.address.label} · {session.address.line1}
          </p>
          <Link href="/cart" className="inline-block text-sm font-medium text-muted underline hover:text-ink">
            Back to cart (change the address in the top bar)
          </Link>
        </section>

        <section className="py-5">
          <h2 className="text-[13px] font-medium text-muted">Your order</h2>
          <p className="font-semibold">{restaurant.name}</p>
          <ul className="mt-2 space-y-2">
            {lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 text-[15px]">
                <span>
                  <span className="tabular-nums text-muted">{l.qty} ×</span> {l.name}
                  {l.options.length > 0 && (
                    <span className="block text-[13px] text-muted">{l.options.map((o) => o.name).join(", ")}</span>
                  )}
                </span>
                <Price cents={l.unitPriceCents * l.qty} country={restaurant.country} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-5 rounded-card bg-fill p-4 md:p-5">
        <PriceBreakdown price={price} country={restaurant.country} />
      </section>

      <div className="mt-5">
        <PayButton />
      </div>
    </div>
  );
}
