import Link from "next/link";
import { Card, buttonClasses } from "@/components/ui";
import { getSession } from "@/lib/session";
import { getCart } from "@/modules/cart";
import { CartLines } from "../_components/CartLines";
import { PriceBreakdown } from "../_components/PriceBreakdown";
import { PromoForm } from "../_components/PromoForm";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ skipped?: string | string[] }>;
}) {
  const { skipped: rawSkipped } = await searchParams;
  const skipped = rawSkipped === undefined ? [] : Array.isArray(rawSkipped) ? rawSkipped : [rawSkipped];
  const skippedNotice = skipped.length > 0 && (
    <p role="status" data-testid="reorder-skipped" className="rounded-card bg-accent/30 p-3 text-sm font-semibold">
      Some items are no longer available: {skipped.join(", ")}
    </p>
  );
  const session = await getSession();
  const cart = await getCart(session.user.id, session.address);

  if (!cart.restaurant) {
    return (
      <div className="space-y-4 py-16 text-center">
        {skippedNotice}
        <h1 className="font-display text-3xl font-extrabold">Your cart is empty</h1>
        <p className="text-muted">Pick something tasty from a restaurant near you.</p>
        <Link href="/" className={buttonClasses({ size: "lg" })}>
          Browse restaurants
        </Link>
      </div>
    );
  }

  const { restaurant, lines, price } = cart;
  const blocked = !restaurant.isOpen || lines.some((l) => !l.isAvailable);

  return (
    <div className="space-y-4">
      {skippedNotice}
      <div>
        <h1 className="font-display text-3xl font-extrabold">Your cart</h1>
        <Link href={`/r/${restaurant.id}`} className="font-semibold text-brand">
          {restaurant.name}
        </Link>
      </div>

      {!restaurant.isOpen && (
        <p role="status" className="rounded-card bg-ink p-3 text-sm font-semibold text-white">
          {restaurant.name} is closed right now, so you can&apos;t check out yet.
        </p>
      )}

      <Card className="px-4">
        <CartLines lines={lines} country={restaurant.country} />
      </Card>

      <Card className="p-4">
        <PromoForm appliedCode={price.promoCode} serverError={price.promoError} />
      </Card>

      <Card className="p-4">
        <PriceBreakdown price={price} country={restaurant.country} />
      </Card>

      {blocked ? (
        <span
          data-testid="go-checkout"
          aria-disabled="true"
          className={`${buttonClasses({ size: "lg", block: true })} cursor-not-allowed bg-line text-muted`}
        >
          Checkout unavailable
        </span>
      ) : (
        <Link href="/checkout" data-testid="go-checkout" className={buttonClasses({ size: "lg", block: true })}>
          Go to checkout
        </Link>
      )}
    </div>
  );
}
