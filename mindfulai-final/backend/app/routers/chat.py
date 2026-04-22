from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging
import json

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Message, UserProfile
from app.schemas.schemas import ChatReq, ChatRes, FeedbackReq, ProfileOut
from app.services.chat_service import run_pipeline, run_pipeline_stream
from app.services.memory_service import update_suggestion_pref

log = logging.getLogger(__name__)
router = APIRouter(tags=["Chat"])


@router.post("/chat", response_model=ChatRes)
async def chat(
    req: ChatReq,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message)
        .where(Message.user_id == user.id, Message.session_id == req.session_id)
        .order_by(Message.timestamp.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    flow_step = (last.flow_step + 1) if last else 0
    flow_type = last.flow_type if last else "venting"

    response_text, meta = await run_pipeline(
        user_id=user.id,
        session_id=req.session_id,
        user_message=req.message,
        db=db,
        flow_step=flow_step,
        flow_type=flow_type,
    )

    bg.add_task(
        _save_turn,
        user_id=user.id,
        session_id=req.session_id,
        user_message=req.message,
        ai_response=response_text,
        emotion=meta["emotion"],
        flow_type=meta["flow"],
        flow_step=meta["flow_step"],
        suggestion=meta["suggestion"].title if meta["suggestion"] else "",
        is_crisis=not meta["safe"],
    )

    return ChatRes(
        response=response_text,
        emotion=meta["emotion"],
        emotion_emoji=meta.get("emotion_emoji", "💭"),
        emotion_color=meta.get("emotion_color", "#6B7280"),
        risk=meta.get("risk", "low") if not meta["safe"] else "low",
        suggestion=meta["suggestion"],
        flow=meta["flow"],
        flow_step=meta["flow_step"],
        session_id=req.session_id,
        safe=meta["safe"],
    )


@router.post("/chat/stream")
async def chat_stream(
    req: ChatReq,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Streaming chat endpoint that returns response chunks in real time."""

    result = await db.execute(
        select(Message)
        .where(Message.user_id == user.id, Message.session_id == req.session_id)
        .order_by(Message.timestamp.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    flow_step = (last.flow_step + 1) if last else 0
    flow_type = last.flow_type if last else "venting"

    async def generate_stream():
        try:
            async for chunk in run_pipeline_stream(
                user_id=user.id,
                session_id=req.session_id,
                user_message=req.message,
                db=db,
                flow_step=flow_step,
                flow_type=flow_type,
            ):
                if isinstance(chunk, dict):
                    yield f"data: {json.dumps(chunk)}\n\n"
                else:
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"

            yield "data: [DONE]\n\n"
        except Exception as e:
            log.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


async def _save_turn(user_id, session_id, user_message, ai_response, emotion, flow_type, flow_step, suggestion, is_crisis):
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            db.add(
                Message(
                    user_id=user_id,
                    session_id=session_id,
                    role="user",
                    content=user_message,
                    emotion=emotion,
                    flow_type=flow_type,
                    flow_step=flow_step,
                )
            )
            db.add(
                Message(
                    user_id=user_id,
                    session_id=session_id,
                    role="assistant",
                    content=ai_response,
                    flow_type=flow_type,
                    flow_step=flow_step,
                    suggestion_given=suggestion,
                    is_crisis=is_crisis,
                )
            )
            await db.commit()
        except Exception as e:
            log.error(f"Save error: {e}")
            await db.rollback()


@router.get("/history/{session_id}")
async def get_history(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message)
        .where(Message.user_id == user.id, Message.session_id == session_id)
        .order_by(Message.timestamp.asc())
    )
    msgs = result.scalars().all()
    return {
        "history": [
            {"role": m.role, "content": m.content, "emotion": m.emotion, "timestamp": m.timestamp}
            for m in msgs
        ]
    }


@router.post("/feedback")
async def feedback(
    req: FeedbackReq,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.models import FeedbackLog

    db.add(
        FeedbackLog(
            user_id=user.id,
            message_id=req.message_id,
            rating=req.rating,
            suggestion_title=req.suggestion_title or "",
        )
    )
    await db.commit()
    if req.suggestion_title:
        bg.add_task(update_suggestion_pref, user.id, db, req.suggestion_title, req.rating == 1)
    return {"success": True}


@router.get("/profile", response_model=ProfileOut)
async def profile(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")
    return ProfileOut(
        user_id=profile.user_id,
        username=profile.username or user.username,
        common_issues=profile.common_issues or [],
        session_count=profile.session_count or 0,
        total_messages=profile.total_messages or 0,
        dominant_emotion=profile.dominant_emotion or "neutral",
    )


@router.get("/health")
async def health():
    from app.services.llm_service import active_provider

    return {"status": "ok", "provider": active_provider()}
