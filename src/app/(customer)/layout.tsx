import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getCart } from "@/modules/cart";
import { CartBar } from "./_components/CartBar";
import { TopBar } from "./_components/TopBar";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const [users, addresses, cart] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true } }),
    prisma.address.findMany({
      where: { userId: session.user.id, country: session.country },
      orderBy: { id: "asc" },
      select: { id: true, label: true, line1: true },
    }),
    getCart(session.user.id, session.address),
  ]);
  const cartQty = cart.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar
        country={session.country}
        userId={session.user.id}
        addressId={session.address.id}
        users={users}
        addresses={addresses}
        cartQty={cartQty}
      />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pt-6">{children}</main>
      {cart.restaurant && cartQty > 0 && (
        <CartBar qty={cartQty} subtotalCents={cart.price.subtotalCents} country={cart.restaurant.country} />
      )}
    </div>
  );
}
