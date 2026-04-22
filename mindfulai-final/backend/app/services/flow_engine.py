from enum import Enum
from typing import Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import UserProfile

class FlowStage(Enum):
    VENTING = "venting"
    EXPLORING = "exploring"
    GUIDING = "guiding"
    SUGGESTING = "suggesting"

class FlowEngine:
    def __init__(self):
        self.stage_transitions = {
            FlowStage.VENTING: {"turns": 2, "next": FlowStage.EXPLORING},
            FlowStage.EXPLORING: {"turns": 3, "next": FlowStage.GUIDING},
            FlowStage.GUIDING: {"turns": 5, "next": FlowStage.SUGGESTING},
            FlowStage.SUGGESTING: {"turns": float('inf'), "next": None}
        }

    async def get_flow_state(self, user_id: int, session_id: str, db: AsyncSession) -> Dict:
        """Get current flow stage and turn count for session"""
        profile = await db.execute(
            UserProfile.__table__.select().where(UserProfile.user_id == user_id)
        )
        p = profile.scalar_one_or_none()

        if not p:
            return {"stage": FlowStage.VENTING.value, "turn_count": 0}

        turn_count = getattr(p, 'session_count', 0) or 0

        current_stage = FlowStage.VENTING
        cumulative_turns = 0

        for stage, config in self.stage_transitions.items():
            cumulative_turns += config["turns"]
            if turn_count < cumulative_turns:
                current_stage = stage
                break

        return {
            "stage": current_stage.value,
            "turn_count": turn_count,
            "can_suggest": current_stage in [FlowStage.GUIDING, FlowStage.SUGGESTING]
        }

    async def advance_flow(self, user_id: int, session_id: str, db: AsyncSession):
        """Increment turn count and potentially advance stage"""
        profile = await db.execute(
            UserProfile.__table__.select().where(UserProfile.user_id == user_id)
        )
        p = profile.scalar_one_or_none()

        if p:
            p.session_count = (getattr(p, 'session_count', 0) or 0) + 1
            await db.commit()

    def get_stage_instructions(self, stage: str) -> str:
        """Get behavioral instructions for current stage"""
        instructions = {
            FlowStage.VENTING.value: """
            STAGE: VENTING (turns 1-2)
            - Only validate and acknowledge feelings
            - No questions, no suggestions, no advice
            - Just be present and empathetic
            - Mirror their emotional state
            """,

            FlowStage.EXPLORING.value: """
            STAGE: EXPLORING (turns 3-5)
            - Start asking gentle, open questions
            - Help them explore their feelings
            - No suggestions yet
            - Build understanding
            """,

            FlowStage.GUIDING.value: """
            STAGE: GUIDING (turns 6-10)
            - Offer gentle reflections
            - Help them see patterns
            - Can suggest if it flows naturally
            - Guide toward insight
            """,

            FlowStage.SUGGESTING.value: """
            STAGE: SUGGESTING (turns 11+)
            - Full suggestions available
            - Help them take action
            - Be more directive when appropriate
            - Focus on growth and coping
            """
        }
        return instructions.get(stage, "")
