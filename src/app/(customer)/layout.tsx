import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getCart } from "@/modules/cart";
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
    <div className="mx-auto min-h-screen w-full max-w-md bg-canvas shadow-[0_0_0_1px_var(--color-line)]">
      <TopBar
        country={session.country}
        userId={session.user.id}
        addressId={session.address.id}
        users={users}
        addresses={addresses}
        cartQty={cartQty}
      />
      <main className="px-4 pb-24 pt-4">{children}</main>
    </div>
  );
}
