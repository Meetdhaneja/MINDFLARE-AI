from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    messages = relationship("Message", back_populates="user", cascade="all, delete-orphan")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String(100), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    emotion = Column(String(50), default="neutral")
    flow_type = Column(String(50), default="venting")
    flow_step = Column(Integer, default=0)
    suggestion_given = Column(String(200), default="")
    is_crisis = Column(Boolean, default=False)
    quality_score = Column(Float, default=0.0)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="messages")


class UserProfile(Base):
    __tablename__ = "user_profile"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    username = Column(String(100), default="")
    common_issues = Column(JSON, default=list)
    mentioned_topics = Column(JSON, default=list)
    liked_suggestions = Column(JSON, default=list)
    rejected_suggestions = Column(JSON, default=list)
    recent_suggestions = Column(JSON, default=list)
    recent_response_hashes = Column(JSON, default=list)
    session_count = Column(Integer, default=0)
    total_messages = Column(Integer, default=0)
    dominant_emotion = Column(String(50), default="neutral")
    preferred_flow = Column(String(50), default="venting")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="profile")


class FeedbackLog(Base):
    __tablename__ = "feedback_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    rating = Column(Integer, nullable=False)
    suggestion_title = Column(String(200), default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
