import { describe, expect, it } from "vitest";
import type { PaymentProvider } from "@/modules/payments/provider";

export type ContractHarness = {
  provider: PaymentProvider;
  captured: { rawBody: string; headers: Record<string, string> }[];
  succeed(ref: string): Promise<void>;
  succeedRefund(ref: string): Promise<void>;
};

export function runPaymentProviderContract(name: string, make: () => ContractHarness): void {
  describe(`${name} provider contract`, () => {
    it("creates idempotently, signs webhooks, parses events and refunds idempotently", async () => {
      const { provider, captured, succeed, succeedRefund } = make();
      const a = await provider.createPayment({ orderId: "o1", amountCents: 1234, currency: "HKD", idempotencyKey: "pay_o1_1" });
      const b = await provider.createPayment({ orderId: "o1", amountCents: 1234, currency: "HKD", idempotencyKey: "pay_o1_1" });
      expect(b.providerRef).toBe(a.providerRef);

      await succeed(a.providerRef);
      const { rawBody, headers } = captured.at(-1)!;
      expect(provider.verifyWebhook(rawBody, new Headers(headers))).toBe(true);
      expect(provider.verifyWebhook(rawBody + " ", new Headers(headers))).toBe(false);
      expect(provider.parseWebhook(rawBody)).toMatchObject({
        type: "payment.succeeded",
        providerRef: a.providerRef,
        amountCents: 1234,
      });

      const r1 = await provider.refund({ providerRef: a.providerRef, amountCents: 1234, reason: "test", idempotencyKey: "refund_o1_1" });
      const r2 = await provider.refund({ providerRef: a.providerRef, amountCents: 1234, reason: "test", idempotencyKey: "refund_o1_1" });
      expect(r2.refundRef).toBe(r1.refundRef);

      await succeedRefund(r1.refundRef);
      expect(provider.parseWebhook(captured.at(-1)!.rawBody)).toMatchObject({
        type: "refund.succeeded",
        refundRef: r1.refundRef,
      });
    });
  });
}
