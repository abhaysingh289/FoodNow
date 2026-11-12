import { InvalidTransition } from "@/lib/errors";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_FAILED"
  | "PLACED"
  | "ACCEPTED"
  | "RIDER_ASSIGNED"
  | "PICKED_UP"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REFUND_FAILED";

export type Actor = "CUSTOMER" | "OPS" | "AUTO" | "PROVIDER" | "SYSTEM";

export type FailureReason =
  | "RESTAURANT_REJECTED"
  | "CUSTOMER_CANCELLED"
  | "NO_RIDER"
  | "DELIVERY_FAILED"
  | "PAYMENT_ABANDONED";

export type OrderAction =
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "RETRY_PAYMENT"
  | "ABANDON"
  | "ACCEPT"
  | "REJECT"
  | "CANCEL"
  | "ASSIGN_RIDER"
  | "NO_RIDER"
  | "PICK_UP"
  | "DELIVER"
  | "FAIL_DELIVERY"
  | "REFUND_SUCCEEDED"
  | "REFUND_FAILED"
  | "RETRY_REFUND";

export const ALL_STATUSES: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "PLACED",
  "ACCEPTED",
  "RIDER_ASSIGNED",
  "PICKED_UP",
  "DELIVERED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "REFUND_FAILED",
];

export const ALL_ACTORS: readonly Actor[] = ["CUSTOMER", "OPS", "AUTO", "PROVIDER", "SYSTEM"];

export const ALL_ACTIONS: readonly OrderAction[] = [
  "PAYMENT_SUCCEEDED",
  "PAYMENT_FAILED",
  "RETRY_PAYMENT",
  "ABANDON",
  "ACCEPT",
  "REJECT",
  "CANCEL",
  "ASSIGN_RIDER",
  "NO_RIDER",
  "PICK_UP",
  "DELIVER",
  "FAIL_DELIVERY",
  "REFUND_SUCCEEDED",
  "REFUND_FAILED",
  "RETRY_REFUND",
];

// Spec section 10.2, exhaustive. Anything not listed is rejected with InvalidTransition.
export const TRANSITIONS: readonly {
  action: OrderAction;
  from: OrderStatus;
  to: OrderStatus;
  actors: readonly Actor[];
  failureReason?: FailureReason;
}[] = [
  { action: "PAYMENT_SUCCEEDED", from: "PENDING_PAYMENT", to: "PLACED", actors: ["PROVIDER"] },
  { action: "PAYMENT_FAILED", from: "PENDING_PAYMENT", to: "PAYMENT_FAILED", actors: ["PROVIDER"] },
  { action: "RETRY_PAYMENT", from: "PAYMENT_FAILED", to: "PENDING_PAYMENT", actors: ["CUSTOMER"] },
  {
    action: "ABANDON",
    from: "PAYMENT_FAILED",
    to: "CANCELLED",
    actors: ["CUSTOMER"],
    failureReason: "PAYMENT_ABANDONED",
  },
  { action: "ACCEPT", from: "PLACED", to: "ACCEPTED", actors: ["OPS", "AUTO"] },
  {
    action: "REJECT",
    from: "PLACED",
    to: "REFUND_PENDING",
    actors: ["OPS"],
    failureReason: "RESTAURANT_REJECTED",
  },
  {
    action: "CANCEL",
    from: "PLACED",
    to: "REFUND_PENDING",
    actors: ["CUSTOMER"],
    failureReason: "CUSTOMER_CANCELLED",
  },
  { action: "ASSIGN_RIDER", from: "ACCEPTED", to: "RIDER_ASSIGNED", actors: ["OPS", "AUTO"] },
  {
    action: "NO_RIDER",
    from: "ACCEPTED",
    to: "REFUND_PENDING",
    actors: ["OPS"],
    failureReason: "NO_RIDER",
  },
  { action: "PICK_UP", from: "RIDER_ASSIGNED", to: "PICKED_UP", actors: ["OPS", "AUTO"] },
  {
    action: "FAIL_DELIVERY",
    from: "RIDER_ASSIGNED",
    to: "REFUND_PENDING",
    actors: ["OPS"],
    failureReason: "DELIVERY_FAILED",
  },
  {
    action: "FAIL_DELIVERY",
    from: "PICKED_UP",
    to: "REFUND_PENDING",
    actors: ["OPS"],
    failureReason: "DELIVERY_FAILED",
  },
  { action: "DELIVER", from: "PICKED_UP", to: "DELIVERED", actors: ["OPS", "AUTO"] },
  { action: "REFUND_SUCCEEDED", from: "REFUND_PENDING", to: "REFUNDED", actors: ["PROVIDER"] },
  { action: "REFUND_FAILED", from: "REFUND_PENDING", to: "REFUND_FAILED", actors: ["PROVIDER", "SYSTEM"] },
  { action: "RETRY_REFUND", from: "REFUND_FAILED", to: "REFUND_PENDING", actors: ["OPS", "AUTO"] },
];

export function resolveTransition(
  from: OrderStatus,
  action: OrderAction,
  actor: Actor,
): { to: OrderStatus; failureReason?: FailureReason } {
  const row = TRANSITIONS.find((t) => t.from === from && t.action === action && t.actors.includes(actor));
  if (!row) throw new InvalidTransition(`Cannot ${action} an order that is ${from}`);
  return row.failureReason ? { to: row.to, failureReason: row.failureReason } : { to: row.to };
}

export function allowedActions(status: OrderStatus, actor: Actor): OrderAction[] {
  const actions = TRANSITIONS.filter((t) => t.from === status && t.actors.includes(actor)).map((t) => t.action);
  return [...new Set(actions)];
}

export const ACTION_LABELS: Record<OrderAction, string> = {
  PAYMENT_SUCCEEDED: "Payment succeeded",
  PAYMENT_FAILED: "Payment failed",
  RETRY_PAYMENT: "Retry payment",
  ABANDON: "Cancel",
  ACCEPT: "Accept",
  REJECT: "Reject",
  CANCEL: "Cancel order",
  ASSIGN_RIDER: "Assign rider",
  NO_RIDER: "No rider",
  PICK_UP: "Picked up",
  DELIVER: "Delivered",
  FAIL_DELIVERY: "Delivery failed",
  REFUND_SUCCEEDED: "Refund succeeded",
  REFUND_FAILED: "Refund failed",
  RETRY_REFUND: "Retry refund",
};

// Customer copy from spec section 10.1 (column "Customer message").
export const STATUS_MESSAGES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Processing payment…",
  PAYMENT_FAILED: "Payment declined",
  PLACED: "Waiting for restaurant to confirm",
  ACCEPTED: "Restaurant is preparing your food",
  RIDER_ASSIGNED: "{rider} ({vehicle}) is heading to the restaurant",
  PICKED_UP: "On the way",
  DELIVERED: "Delivered",
  CANCELLED: "Order cancelled",
  REFUND_PENDING: "Order cancelled: {reason}. Refund in progress",
  REFUNDED: "Order cancelled: {reason}. Refunded {amount}",
  REFUND_FAILED: "Order cancelled: {reason}. Refund delayed — we're on it",
};

export const FAILURE_REASON_LABELS: Record<FailureReason, string> = {
  RESTAURANT_REJECTED: "Restaurant declined the order",
  CUSTOMER_CANCELLED: "You cancelled the order",
  NO_RIDER: "No rider was available",
  DELIVERY_FAILED: "Delivery could not be completed",
  PAYMENT_ABANDONED: "Payment not completed",
};
