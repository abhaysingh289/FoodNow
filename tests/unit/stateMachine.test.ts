import { describe, expect, it } from "vitest";
import { InvalidTransition } from "@/lib/errors";
import {
  ALL_ACTIONS,
  ALL_ACTORS,
  ALL_STATUSES,
  TRANSITIONS,
  allowedActions,
  resolveTransition,
} from "@/modules/orders/stateMachine";

describe("order state machine", () => {
  it("resolves every table row for each listed actor", () => {
    for (const t of TRANSITIONS) {
      for (const a of t.actors) {
        expect(resolveTransition(t.from, t.action, a)).toEqual({
          to: t.to,
          ...(t.failureReason && { failureReason: t.failureReason }),
        });
      }
    }
  });

  it("rejects every (status, action, actor) combination not in the table", () => {
    for (const s of ALL_STATUSES) {
      for (const act of ALL_ACTIONS) {
        for (const a of ALL_ACTORS) {
          const ok = TRANSITIONS.some((t) => t.from === s && t.action === act && t.actors.includes(a));
          if (!ok) expect(() => resolveTransition(s, act, a)).toThrow(InvalidTransition);
        }
      }
    }
  });

  it("uses the exact InvalidTransition message format", () => {
    expect(() => resolveTransition("PLACED", "DELIVER", "OPS")).toThrow(
      "Cannot DELIVER an order that is PLACED",
    );
  });

  it("lists allowed actions per status and actor in table order", () => {
    expect(allowedActions("PLACED", "CUSTOMER")).toEqual(["CANCEL"]);
    expect(allowedActions("PLACED", "OPS")).toEqual(["ACCEPT", "REJECT"]);
    expect(allowedActions("ACCEPTED", "OPS")).toEqual(["ASSIGN_RIDER", "NO_RIDER"]);
    expect(allowedActions("PICKED_UP", "OPS")).toEqual(["FAIL_DELIVERY", "DELIVER"]);
    expect(allowedActions("REFUND_FAILED", "OPS")).toEqual(["RETRY_REFUND"]);
    expect(allowedActions("ACCEPTED", "CUSTOMER")).toEqual([]); // cancel blocked after accept
    for (const s of ["DELIVERED", "CANCELLED", "REFUNDED"] as const) {
      for (const a of ALL_ACTORS) expect(allowedActions(s, a)).toEqual([]);
    }
  });
});
