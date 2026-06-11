"""Session token management using itsdangerous signed tokens."""
import os
import time
import uuid
import logging
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

logger = logging.getLogger(__name__)

def get_session_secret() -> str:
    """Get session secret. Hard-fail in prod (RENDER env present), warn in dev."""
    secret = os.environ.get("SESSION_SECRET")
    if secret:
        return secret
    if os.environ.get("RENDER"):
        raise RuntimeError("SESSION_SECRET must be set in production")
    import secrets
    dev_secret = secrets.token_hex(32)
    logger.warning("SESSION_SECRET not set — using auto-generated dev secret")
    return dev_secret

SESSION_SECRET = get_session_secret()
SESSION_MAX_AGE = int(os.environ.get("SESSION_MAX_AGE", "3600"))  # 1 hour
_serializer = URLSafeTimedSerializer(SESSION_SECRET)

def create_session_token() -> str:
    payload = {"sid": str(uuid.uuid4()), "iat": int(time.time())}
    return _serializer.dumps(payload)

def validate_session_token(token: str) -> dict | None:
    try:
        return _serializer.loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
