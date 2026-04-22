from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_token
from app.models.models import User, UserProfile
from app.schemas.schemas import SignupReq, LoginReq, TokenRes
from app.services.memory_service import increment_session

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/signup", response_model=TokenRes, status_code=201)
async def signup(data: SignupReq, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    user = User(email=data.email, username=data.username, password_hash=hash_password(data.password))
    db.add(user)
    await db.flush()
    db.add(UserProfile(user_id=user.id, username=data.username))
    await db.commit()
    await db.refresh(user)
    return TokenRes(access_token=create_token(user.id), user_id=user.id, username=user.username)


@router.post("/login", response_model=TokenRes)
async def login(data: LoginReq, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    await increment_session(user.id, db)
    await db.commit()
    return TokenRes(access_token=create_token(user.id), user_id=user.id, username=user.username)
