import { DomainError, ValidationError } from "@/lib/errors";
import { ALL_ACTIONS, type OrderAction } from "@/modules/orders/stateMachine";

export function toErrorResponse(err: unknown): Response {
  if (err instanceof DomainError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
  }
  console.error(err);
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

export async function handle<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (err) {
    return toErrorResponse(err);
  }
}

type Body = Record<string, unknown>;

/** Parses a JSON object body; an empty body is treated as `{}`. */
export async function readJson(req: Request): Promise<Body> {
  const text = await req.text();
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  return parsed as Body;
}

export function reqString(body: Body, key: string): string {
  const v = body[key];
  if (typeof v !== "string" || v === "") throw new ValidationError(`${key} must be a non-empty string`);
  return v;
}

export function optString(body: Body, key: string): string | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new ValidationError(`${key} must be a string`);
  return v;
}

export function reqNumber(body: Body, key: string): number {
  const v = body[key];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ValidationError(`${key} must be a number`);
  return v;
}

export function optNumber(body: Body, key: string): number | undefined {
  return body[key] === undefined ? undefined : reqNumber(body, key);
}

export function optBoolean(body: Body, key: string): boolean | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v !== "boolean") throw new ValidationError(`${key} must be a boolean`);
  return v;
}

export function reqBoolean(body: Body, key: string): boolean {
  const v = optBoolean(body, key);
  if (v === undefined) throw new ValidationError(`${key} must be a boolean`);
  return v;
}

export function reqOneOf<T extends string>(body: Body, key: string, allowed: readonly T[]): T {
  const v = body[key];
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw new ValidationError(`${key} must be one of: ${allowed.join(", ")}`);
  }
  return v as T;
}

export function optStringArray(body: Body, key: string): string[] {
  const v = body[key];
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    throw new ValidationError(`${key} must be an array of strings`);
  }
  return v as string[];
}

export function reqAction(body: Body): OrderAction {
  return reqOneOf(body, "action", ALL_ACTIONS);
}

export function optOneOf<T extends string>(body: Body, key: string, allowed: readonly T[]): T | undefined {
  return body[key] === undefined ? undefined : reqOneOf(body, key, allowed);
}

export const DECISION_MODES = ["normal", "twice", "bad_signature"] as const;
