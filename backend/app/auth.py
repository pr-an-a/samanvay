"""Demo-grade auth: a random bearer token per sign-in (several per user allowed). Not production auth."""

import secrets

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import AuthToken, Role, User


def issue_token(db: Session, user: User) -> str:
    """Add a new session; earlier sessions for the same user stay valid."""
    token = secrets.token_urlsafe(24)
    db.add(AuthToken(token=token, user_id=user.id))
    db.commit()
    return token


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    user = db.scalar(select(User).join(AuthToken, AuthToken.user_id == User.id).where(AuthToken.token == token))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return user


def require_roles(*roles: Role):
    allowed = {r.value for r in roles}

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Role not permitted")
        return user

    return checker


OFFICER_ROLES = (Role.RB_OFFICER, Role.PGRC_OFFICER, Role.REGIONAL, Role.ADMIN)
