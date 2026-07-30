/**
 * ZivaBI API client.
 *
 * Thin wrapper around fetch that:
 *   - Uses relative paths (e.g. /api/auth/login) so every request goes
 *     through the Next.js server proxy defined in next.config.ts rewrites.
 *     The proxy forwards to NEXT_PUBLIC_API_URL (the FastAPI backend).
 *   - Injects the Authorization header when a token is provided.
 *   - Normalises error responses into thrown Error objects.
 *
 * Token storage strategy (Phase 2 — httpOnly cookie migration):
 *   - Access token:  React state (memory only — clears on page refresh)
 *   - Refresh token: httpOnly cookie ``ziva_rt`` set by FastAPI on login /
 *     signup / token rotation. The cookie is invisible to JavaScript and is
 *     sent automatically by the browser on all same-origin requests to
 *     /api/auth/*. No manual cookie handling is required here.
 *
 * Routing note: using relative paths means all fetches are same-origin from
 * the browser's perspective. Next.js rewrites (next.config.ts) proxy
 * /api/:path* → NEXT_PUBLIC_API_URL/api/:path* server-side. This lets the
 * browser send the httpOnly cookie on auth calls without needing
 * credentials:'include' or CORS preflight gymnastics.
 */

const BASE = ""; // Relative paths — routed through Next.js server proxy

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
