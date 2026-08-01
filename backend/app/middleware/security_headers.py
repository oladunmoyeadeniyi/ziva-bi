"""Security headers middleware — Performance & Security Audit.

Adds standard security response headers to all API responses.
Headers applied:
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-XSS-Protection: 1; mode=block  (IE legacy — no-op in modern browsers)
  Cache-Control: no-store  (applied to API responses; static assets exempt)
  Strict-Transport-Security: max-age=31536000; includeSubDomains (production only)

Cross-Origin headers are NOT added here — CORS middleware handles them.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject security headers into every API response.

    Should be added AFTER CORSMiddleware in the middleware stack so that
    CORS headers (set by CORSMiddleware) are not overwritten.
    """

    async def dispatch(self, request: Request, call_next: callable) -> Response:
        """Process the request and inject security headers into the response."""
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Only cache-bust API endpoints (not static/openapi resources)
        path = request.url.path
        if path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

        # HSTS only in production (avoids breaking local HTTP dev)
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        return response
