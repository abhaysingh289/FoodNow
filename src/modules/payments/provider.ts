export type ClientAction =
  | { type: "fake_sheet"; providerRef: string }
  | { type: "redirect"; url: string }
  | { type: "sdk"; sdk: string; params: Record<string, string> };

export type ProviderEvent =
  | {
      eventId: string;
      type: "payment.succeeded" | "payment.failed";
      providerRef: string;
      amountCents: number;
      reason?: string;
    }
  | {
      eventId: string;
      type: "refund.succeeded" | "refund.failed";
      refundRef: string;
      amountCents: number;
      reason?: string;
    };

export interface PaymentProvider {
  name: string;
  createPayment(input: {
    orderId: string;
    amountCents: number;
    currency: "HKD" | "SGD";
    idempotencyKey: string;
  }): Promise<{ providerRef: string; clientAction: ClientAction }>;

  refund(input: {
    providerRef: string;
    amountCents: number;
    reason: string;
    idempotencyKey: string;
  }): Promise<{ refundRef: string }>;

  verifyWebhook(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string): ProviderEvent;
}

export type WebhookTransport = (rawBody: string, headers: Record<string, string>) => Promise<void>;
