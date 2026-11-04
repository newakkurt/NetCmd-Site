"""NetCmd SaaS API foundation.

This service only accepts authenticated, allow-listed jobs and stores them for
an isolated worker. It deliberately does not execute user-supplied shell/code.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Literal

import httpx
import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from jwt import PyJWKClient
from pydantic import BaseModel, Field, ConfigDict

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
API_KEY_PEPPER = os.getenv("NETCMD_API_KEY_PEPPER", "")
ALLOWED_ORIGINS = [
    item.strip() for item in os.getenv(
        "ALLOWED_ORIGINS", "https://netcmd-site.onrender.com"
    ).split(",") if item.strip()
]
ISSUER = f"{SUPABASE_URL}/auth/v1" if SUPABASE_URL else ""
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else ""

app = FastAPI(
    title="NetCmd Cloud API",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)

JOB_PRODUCT = {
    "config_audit": "config-auditor-pro",
    "topology_discovery": "topology-discovery-pro",
    "troubleshooting": "troubleshooting-pro",
    "bulk_automation": "bulk-automation-pro",
    "network_report": "network-intelligence-reports-pro",
    "snmp_poll": "network-intelligence-reports-pro",
}

JobKind = Literal[
    "config_audit",
    "topology_discovery",
    "troubleshooting",
    "bulk_automation",
    "network_report",
    "snmp_poll",
]


class ApiKeyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=3, max_length=80)
    scopes: list[Literal["jobs:read", "jobs:write"]] = Field(
        default_factory=lambda: ["jobs:read", "jobs:write"], max_length=2
    )


class JobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: JobKind
    payload: dict[str, Any]
    request_id: str | None = Field(default=None, max_length=80)


@lru_cache(maxsize=1)
def jwks_client() -> PyJWKClient:
    if not JWKS_URL:
        raise HTTPException(status_code=503, detail="auth_not_configured")
    return PyJWKClient(JWKS_URL, cache_keys=True, lifespan=300)


async def supabase_request(
    method: str, path: str, *, params: dict[str, str] | None = None,
    body: dict[str, Any] | None = None
) -> Any:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="database_not_configured")
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if method in {"POST", "PATCH"}:
        headers["Prefer"] = "return=representation"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.request(
            method, f"{SUPABASE_URL}/rest/v1/{path}",
            headers=headers, params=params, json=body
        )
    if response.status_code >= 400:
        # Keep database/provider details out of client responses.
        raise HTTPException(status_code=502, detail="database_operation_failed")
    if not response.content:
        return None
    return response.json()


async def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    token = authorization[7:].strip()
    try:
        signing_key = jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=ISSUER,
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
        user_id = str(uuid.UUID(claims["sub"]))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_access_token")
    return {"id": user_id, "email": claims.get("email")}


def premium_is_active(profile: dict[str, Any] | None) -> bool:
    if not profile or not profile.get("is_premium"):
        return False
    until = profile.get("premium_until")
    if not until:
        return True
    try:
        expiry = datetime.fromisoformat(str(until).replace("Z", "+00:00"))
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        return expiry > datetime.now(timezone.utc)
    except (TypeError, ValueError):
        return False


async def require_active_premium(user_id: str) -> None:
    rows = await supabase_request(
        "GET", "profiles",
        params={"select": "is_premium,premium_until", "id": f"eq.{user_id}", "limit": "1"},
    )
    if not rows or not premium_is_active(rows[0]):
        raise HTTPException(status_code=403, detail="active_premium_required")


def key_digest(raw_key: str) -> str:
    if not API_KEY_PEPPER:
        raise HTTPException(status_code=503, detail="api_key_service_not_configured")
    return hmac.new(
        API_KEY_PEPPER.encode(), raw_key.encode(), hashlib.sha256
    ).hexdigest()


async def api_key_context(x_api_key: str | None = Header(default=None)) -> dict[str, Any]:
    if not x_api_key or not x_api_key.startswith("nc_live_") or len(x_api_key) > 100:
        raise HTTPException(status_code=401, detail="invalid_api_key")
    digest = key_digest(x_api_key)
    rows = await supabase_request(
        "GET", "netcmd_api_keys",
        params={
            "select": "id,user_id,name,scopes,revoked_at",
            "key_hash": f"eq.{digest}",
            "limit": "1",
        },
    )
    if not rows or rows[0].get("revoked_at") is not None:
        raise HTTPException(status_code=401, detail="invalid_api_key")
    await require_active_premium(str(rows[0]["user_id"]))
    return rows[0]


def require_scope(context: dict[str, Any], scope: str) -> None:
    if scope not in (context.get("scopes") or []):
        raise HTTPException(status_code=403, detail="insufficient_scope")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "netcmd-cloud-api"}


@app.get("/v1/me")
async def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return {"user_id": user["id"], "email": user.get("email")}


@app.post("/v1/api-keys", status_code=status.HTTP_201_CREATED)
async def create_api_key(
    data: ApiKeyCreate, user: dict[str, Any] = Depends(current_user)
) -> dict[str, str]:
    await require_active_premium(user["id"])
    raw = "nc_live_" + secrets.token_urlsafe(32)
    prefix = raw[:16]
    rows = await supabase_request(
        "POST", "netcmd_api_keys?select=id",
        body={
            "user_id": user["id"],
            "name": data.name.strip(),
            "key_prefix": prefix,
            "key_hash": key_digest(raw),
            "scopes": sorted(set(data.scopes)),
        },
    )
    if not rows:
        raise HTTPException(status_code=502, detail="api_key_creation_failed")
    # The raw key is returned once only; only its HMAC digest is persisted.
    return {"id": str(rows[0]["id"]), "name": data.name.strip(), "api_key": raw}


@app.post("/v1/jobs", status_code=status.HTTP_202_ACCEPTED)
async def create_job(
    data: JobCreate, key: dict[str, Any] = Depends(api_key_context)
) -> dict[str, str]:
    require_scope(key, "jobs:write")
    if len(str(data.payload).encode("utf-8")) > 24_000:
        raise HTTPException(status_code=413, detail="payload_too_large")
    product_slug = JOB_PRODUCT[data.kind]
    # api_key_context already requires an active NetCmd PRO membership.
    # Membership grants the full PRO suite; individual product entitlements
    # are handled by the Edge Function path for separately sold add-ons.
    rows = await supabase_request(
        "POST", "netcmd_automation_jobs?select=id,status",
        body={
            "user_id": key["user_id"],
            "api_key_id": key["id"],
            "job_kind": data.kind,
            "product_slug": product_slug,
            "payload": data.payload,
            "request_id": data.request_id,
            "status": "queued",
        },
    )
    if not rows:
        raise HTTPException(status_code=502, detail="job_submission_failed")
    return {"job_id": str(rows[0]["id"]), "status": str(rows[0]["status"])}


@app.get("/v1/jobs/{job_id}")
async def get_job(
    job_id: uuid.UUID, key: dict[str, Any] = Depends(api_key_context)
) -> dict[str, Any]:
    require_scope(key, "jobs:read")
    rows = await supabase_request(
        "GET", "netcmd_automation_jobs",
        params={
            "select": "id,job_kind,status,result,error,created_at,started_at,finished_at",
            "id": f"eq.{job_id}",
            "user_id": f"eq.{key['user_id']}",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="job_not_found")
    return rows[0]


@app.delete("/v1/api-keys/{key_id}", status_code=status.HTTP_200_OK)
async def revoke_api_key(
    key_id: uuid.UUID, user: dict[str, Any] = Depends(current_user)
) -> None:
    await supabase_request(
        "PATCH", "netcmd_api_keys",
        params={"id": f"eq.{key_id}", "user_id": f"eq.{user['id']}", "revoked_at": "is.null"},
        body={"revoked_at": datetime.now(timezone.utc).isoformat()},
    )
