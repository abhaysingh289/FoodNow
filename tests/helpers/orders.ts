import { addItem } from "@/modules/cart";
import { placeOrder } from "@/modules/orders";
import { prisma } from "@/lib/db";
import { getFakeControls } from "@/modules/payments/registry";

/** Places an HK order for Mei and settles the payment; returns the order id (status PLACED). */
export async function paidOrder(
  items: { menuItemId: string; qty: number; optionIds?: string[] }[] = [{ menuItemId: "hk_gd_har_gow", qty: 2 }],
): Promise<string> {
  for (const i of items) {
    await addItem("u_mei", { menuItemId: i.menuItemId, qty: i.qty, optionIds: i.optionIds ?? [] });
  }
  const { orderId } = await placeOrder("u_mei", "a_mei_hk");
  const p = await prisma.payment.findFirstOrThrow({ where: { orderId }, orderBy: { createdAt: "desc" } });
  await getFakeControls().decideIntent(p.providerRef, "succeed");
  return orderId;
}
