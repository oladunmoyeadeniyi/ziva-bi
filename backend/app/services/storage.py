"""
ZivaBI — Supabase Storage service (Milestone 6).

Thin wrapper around the supabase-py client for the three operations the
documents router needs: upload, signed-URL generation, and deletion.

The Supabase client is created once at import time using credentials from
app/config.py. All functions are synchronous because supabase-py does not
expose an async interface; they are called inside FastAPI's thread-pool via
asyncio.to_thread() at the router layer.

Bucket layout: {tenant_id}/{report_id}/{line_id or "report"}/{uuid}_{filename}
"""

from supabase import Client, create_client

from app.config import settings

_client: Client | None = None


def _get_client() -> Client:
    """Return the shared Supabase client, initialising it on first call."""
    global _client
    if _client is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use document storage."
            )
        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client


def upload_file(file_bytes: bytes, path: str, mime_type: str) -> str:
    """
    Upload bytes to the configured Supabase bucket.

    Args:
        file_bytes: raw file content.
        path: destination key inside the bucket (no leading slash).
        mime_type: MIME type string, e.g. "application/pdf".

    Returns:
        The storage path (same as the ``path`` argument) — stored in DB
        so that signed URLs can be regenerated later.

    Raises:
        RuntimeError: if the upload fails.
    """
    client = _get_client()
    result = client.storage.from_(settings.supabase_bucket).upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": mime_type, "upsert": "false"},
    )
    # supabase-py raises on error; if it doesn't, check for an error key.
    if hasattr(result, "error") and result.error:
        raise RuntimeError(f"Supabase upload failed: {result.error}")
    return path


def get_signed_url(storage_path: str, expires_in: int = 900) -> str:
    """
    Generate a time-limited signed URL for a private file.

    Security: default expiry is 15 minutes (900 s). Finance documents are
    accessed in-session; the UI re-fetches a fresh URL on each view. Shorter
    expiry limits exposure if a URL is leaked or cached.

    Args:
        storage_path: the key returned by upload_file().
        expires_in: URL lifetime in seconds (default 15 minutes).

    Returns:
        A signed HTTPS URL the client can use to download or view the file.

    Raises:
        RuntimeError: if URL generation fails.
    """
    client = _get_client()
    result = client.storage.from_(settings.supabase_bucket).create_signed_url(
        path=storage_path,
        expires_in=expires_in,
    )
    # storage3 0.9.0 returns {"signedURL": "...", ...}
    if isinstance(result, dict):
        url = result.get("signedURL") or result.get("signed_url") or result.get("signedUrl")
        if url:
            return url
        if result.get("error"):
            raise RuntimeError(f"Supabase sign URL failed: {result['error']}")
    raise RuntimeError(f"Unexpected Supabase response: {result}")


def delete_file(storage_path: str) -> bool:
    """
    Delete a file from the bucket.

    Args:
        storage_path: key to delete.

    Returns:
        True on success.

    Raises:
        RuntimeError: if the delete fails.
    """
    client = _get_client()
    result = client.storage.from_(settings.supabase_bucket).remove([storage_path])
    if hasattr(result, "error") and result.error:
        raise RuntimeError(f"Supabase delete failed: {result.error}")
    return True
