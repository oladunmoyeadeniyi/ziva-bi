/**
 * ZivaBI API client.
 *
 * Thin wrapper around fetch that:
 *   - Prepends NEXT_PUBLIC_API_URL to every path
 *   - Injects the Authorization header when a token is provided
 *   - Normalises error responses into thrown Error objects
 *
 * Token storage strategy (MVP):
 *   - Access token:  React state (memory only — clears on page refresh)
 *   - Refresh token: localStorage — persists across refreshes
 *
 * Security note: storing the refresh token in localStorage is a pragmatic
 * choice for development. Before production, migrate to httpOnly cookies via
 * a Next.js API route proxy so the token is never accessible to JavaScript.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ApiError {
  detail: string | { msg: string; loc: string[] }[];
}

function extractMessage(body: ApiError): string {
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail) && body.detail.length > 0) {
    return body.detail.map((e) => e.msg).join("; ");
  }
  return "An unexpected error occurred.";
}

export async function apiFetch<T>(
  path: string,
  options: Omit<RequestInit, "body"> & { token?: string; isFormData?: boolean; body?: unknown; formData?: FormData } = {}
): Promise<T> {
  const { token, isFormData, formData, body, headers: extraHeaders = {}, ...rest } = options;

  // Don't set Content-Type for FormData — the browser sets it with the multipart boundary.
  const hasForm = isFormData || formData instanceof FormData;
  const headers: Record<string, string> = hasForm
    ? { ...(extraHeaders as Record<string, string>) }
    : { "Content-Type": "application/json", ...(extraHeaders as Record<string, string>) };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const fetchBody = formData instanceof FormData ? formData
    : body instanceof FormData ? body
    : body !== undefined
      ? (typeof body === "string" ? body : JSON.stringify(body))
      : undefined;

  const res = await fetch(`${BASE}${path}`, { ...rest, body: fetchBody, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body: ApiError = await res.json();
      message = extractMessage(body);
    } catch {
      // body wasn't JSON — keep the default message
    }
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
