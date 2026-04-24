from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Message, UserProfile
from app.schemas.schemas import ChatReq, ChatRes, FeedbackReq, ProfileOut, HistoryMsg, SyncReq
from app.services.chat_service import run_pipeline, run_pipeline_stream
from app.services.memory_service import update_suggestion_pref
import logging
import json

log = logging.getLogger(__name__)
router = APIRouter(tags=["Chat"])

@router.post("/save")
async def save_chat(
    req: SyncReq,
    bg: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    """Save a chat turn generated elsewhere (e.g. Next.js API) to the database"""
    bg.add_task(
        _save_turn_and_profile,
        user_id=user.id,
        session_id=req.session_id,
        user_message=req.user_message,
        ai_response=req.response,
        emotion=req.emotion,
        flow_type=req.flow,
        flow_step=req.flow_step,
        suggestion="", # Suggestion logic can be added if needed
        is_crisis=not req.safe,
    )
    return {"status": "synced"}

@router.post("/chat/stream")
async def chat_stream(
    req: ChatReq,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Streaming chat endpoint that returns response chunks in real-time"""

    # Get current flow state from last AI message in session
    r = await db.execute(
        select(Message)
        .where(Message.user_id == user.id, Message.session_id == req.session_id)
        .order_by(Message.timestamp.desc()).limit(1)
    )
    last = r.scalar_one_or_none()
    flow_step = (last.flow_step + 1) if last else 0
    flow_type = last.flow_type if last else "venting"

    async def generate_stream():
        try:
            # Get streaming response from pipeline
            async for chunk in run_pipeline_stream(
                user_id=user.id,
                session_id=req.session_id,
                user_message=req.message,
                db=db,
                flow_step=flow_step,
                flow_type=flow_type,
            ):
                if isinstance(chunk, dict):
                    # Meta information (emotion, suggestion, etc.)
                    bg.add_task(
                        _save_turn_and_profile,
                        user_id=user.id,
                        session_id=req.session_id,
                        user_message=req.message,
                        ai_response=chunk["final_response"],
                        emotion=chunk["emotion"],
                        flow_type=chunk["flow"],
                        flow_step=chunk["flow_step"],
                        suggestion=chunk["suggestion"]["title"] if chunk.get("suggestion") else "",
                        is_crisis=not chunk["safe"]
                    )
                    yield f"data: {json.dumps(chunk)}\n\n"
                else:
                    # Text chunk
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"

            # End of stream
            yield "data: [DONE]\n\n"

        except Exception as e:
            log.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

async def _save_turn_and_profile(user_id, session_id, user_message, ai_response,
                                 emotion, flow_type, flow_step, suggestion, is_crisis):
    from app.core.database import AsyncSessionLocal
    from app.services import memory_service
    from app.services import variation_engine
    import asyncio
    import logging
    log = logging.getLogger(__name__)
    
    max_retries = 5
    for attempt in range(max_retries):
        async with AsyncSessionLocal() as db:
            try:
                db.add(Message(user_id=user_id, session_id=session_id, role="user",
                               content=user_message, emotion=emotion,
                               flow_type=flow_type, flow_step=flow_step))
                db.add(Message(user_id=user_id, session_id=session_id, role="assistant",
                               content=ai_response, flow_type=flow_type, flow_step=flow_step,
                               suggestion_given=suggestion, is_crisis=is_crisis))
                
                await memory_service.update_profile(
                    user_id=user_id, db=db, user_message=user_message,
                    emotion=emotion, flow_type=flow_type,
                    new_suggestion=suggestion if suggestion else None,
                    response_hash=variation_engine.fingerprint(ai_response)
                )
                await db.commit()
                break  # Successful save
            except Exception as e:
                await db.rollback()
                if "database is locked" in str(e).lower() and attempt < max_retries - 1:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                log.error(f"Save error after {attempt+1} attempts: {e}")
                break


@router.get("/history/{session_id}")
async def get_history(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(Message)
        .where(Message.user_id == user.id, Message.session_id == session_id)
        .order_by(Message.timestamp.asc())
    )
    msgs = r.scalars().all()
    return {"history": [{"role": m.role, "content": m.content,
                         "emotion": m.emotion, "timestamp": m.timestamp} for m in msgs]}


@router.post("/feedback")
async def feedback(
    req: FeedbackReq,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.models import FeedbackLog
    db.add(FeedbackLog(user_id=user.id, message_id=req.message_id,
                       rating=req.rating, suggestion_title=req.suggestion_title or ""))
    await db.commit()
    if req.suggestion_title:
        bg.add_task(update_suggestion_pref, user.id, db, req.suggestion_title, req.rating == 1)
    return {"success": True}


@router.get("/profile", response_model=ProfileOut)
async def profile(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    r = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    p = r.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Profile not found")
    return ProfileOut(user_id=p.user_id, username=p.username or user.username,
                      common_issues=p.common_issues or [], session_count=p.session_count or 0,
                      total_messages=p.total_messages or 0, dominant_emotion=p.dominant_emotion or "neutral")


@router.get("/health")
async def health():
    from app.services.llm_service import active_provider
    return {"status": "ok", "provider": active_provider()}
