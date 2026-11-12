export type ApiError = { code: string; message: string };

/** JSON request to an API route. Resolves { ok: true } or { ok: false, error }. */
export async function callApi(
  url: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: ApiError }> {
  try {
    // keepalive lets session switches finish even if the user navigates right away.
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { error?: ApiError } | null;
    return { ok: false, error: data?.error ?? { code: "INTERNAL", message: "Something went wrong" } };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Network error. Please try again." } };
  }
}
