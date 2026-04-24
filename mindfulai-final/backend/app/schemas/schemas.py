from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class SignupReq(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class TokenRes(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str


class ChatReq(BaseModel):
    message: str = Field(..., min_length=1, max_length=3000)
    session_id: str


class SuggestionOut(BaseModel):
    title: str
    description: str
    category: str


class ChatRes(BaseModel):
    response: str
    emotion: str
    emotion_emoji: str
    emotion_color: str
    risk: str
    suggestion: Optional[SuggestionOut] = None
    flow: str
    flow_step: int
    session_id: str
    message_id: Optional[int] = None
    safe: bool = True


class SyncReq(BaseModel):
    user_message: str
    response: str
    emotion: str
    flow: str
    flow_step: int
    session_id: str
    safe: bool = True


class FeedbackReq(BaseModel):
    message_id: int
    rating: int = Field(..., ge=-1, le=1)
    suggestion_title: Optional[str] = ""


class HistoryMsg(BaseModel):
    role: str
    content: str
    emotion: Optional[str] = None
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfileOut(BaseModel):
    user_id: int
    username: str
    common_issues: List[str]
    session_count: int
    total_messages: int
    dominant_emotion: str

    class Config:
        from_attributes = True
