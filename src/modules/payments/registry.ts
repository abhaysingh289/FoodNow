import { createFakeProvider, type FakeControls } from "./fake/fakeProvider";
import type { PaymentProvider, WebhookTransport } from "./provider";

type FakeInstance = PaymentProvider & FakeControls;

const defaultTransport: WebhookTransport = async (rawBody, headers) => {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/webhooks/payments/fake`, { method: "POST", headers, body: rawBody });
  // 400 is the expected answer to a bad-signature delivery.
  if (!res.ok && res.status !== 400) {
    throw new Error(`Webhook delivery failed with status ${res.status}`);
  }
};

let transport: WebhookTransport = defaultTransport;
let instance: { name: string; provider: PaymentProvider } | null = null;

export function setWebhookTransport(t: WebhookTransport): void {
  transport = t;
}

export function getProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "fake";
  if (instance && instance.name === name) return instance.provider;
  if (name !== "fake") throw new Error(`Unknown payment provider: ${name}`);
  const secret = process.env.FAKE_WEBHOOK_SECRET;
  if (!secret) throw new Error("FAKE_WEBHOOK_SECRET is not set");
  // Delegate through `transport` at call time so setWebhookTransport applies to the existing singleton.
  const provider = createFakeProvider({ secret, transport: (b, h) => transport(b, h) });
  instance = { name, provider };
  return provider;
}

export function getFakeControls(): FakeControls {
  const provider = getProvider();
  if (provider.name !== "fake") throw new Error("Active payment provider is not the fake provider");
  return provider as FakeInstance;
}
