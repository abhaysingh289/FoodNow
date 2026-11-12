import Link from "next/link";
import { buttonClasses } from "@/components/ui";
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
    <p role="status" data-testid="reorder-skipped" className="rounded-card bg-fill p-4 text-sm font-semibold">
      Some items are no longer available: {skipped.join(", ")}
    </p>
  );
  const session = await getSession();
  const cart = await getCart(session.user.id, session.address);

  if (!cart.restaurant) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        {skippedNotice}
        <h1 className="text-[26px] font-bold tracking-tight">Your cart is empty</h1>
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
    <div className="mx-auto max-w-2xl space-y-5">
      {skippedNotice}
      <div>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight md:text-[28px]">Your cart</h1>
        <Link href={`/r/${restaurant.id}`} className="text-[15px] font-medium text-muted hover:text-ink hover:underline">
          {restaurant.name}
        </Link>
      </div>

      {!restaurant.isOpen && (
        <p role="status" className="rounded-card bg-fill p-4 text-sm font-semibold">
          {restaurant.name} is closed right now, so you can&apos;t check out yet.
        </p>
      )}

      <section className="border-y border-line">
        <CartLines lines={lines} country={restaurant.country} />
      </section>

      <section className="space-y-5 rounded-card bg-fill p-4 md:p-5">
        <PromoForm appliedCode={price.promoCode} serverError={price.promoError} />
        <div className="border-t border-line-strong pt-4">
          <PriceBreakdown price={price} country={restaurant.country} />
        </div>
      </section>

      {blocked ? (
        <span
          data-testid="go-checkout"
          aria-disabled="true"
          className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-control bg-fill-strong px-5 font-semibold text-muted"
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
