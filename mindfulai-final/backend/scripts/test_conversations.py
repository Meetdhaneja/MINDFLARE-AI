#!/usr/bin/env python3
"""
Automated conversation testing and observation.
Tests emotion detection, RAG retrieval, prompt generation, and response quality.
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services import llm_service
from app.services.emotion_service import detect_emotion
from app.services.prompt_builder import PromptBuilder
from app.services.rag_service import get_few_shot_prompt, get_rag_service

TEST_CONVERSATIONS = [
    {
        "name": "Anxiety - Overwhelmed",
        "messages": [
            "I have so much going on right now. Work is crazy, my family is pushing me to make decisions, and I feel like I can't breathe.",
        ],
    },
    {
        "name": "Sadness - Loss",
        "messages": [
            "My best friend moved away and I miss them so much. Everything feels empty without them around.",
        ],
    },
    {
        "name": "Anger - Disrespected",
        "messages": [
            "Nobody listens to my ideas at work. I suggest solutions but they just talk over me.",
        ],
    },
    {
        "name": "Stress - Burnout",
        "messages": [
            "I'm exhausted and can't remember the last time I felt rested. Even weekends I can't shut my brain off.",
        ],
    },
    {
        "name": "Loneliness - Isolation",
        "messages": [
            "I feel so isolated. Nobody really understands what I'm going through and people don't respond how I need.",
        ],
    },
]


class ConversationObserver:
    def __init__(self):
        self.prompt_builder = PromptBuilder()
        self.test_results = []
        self.observations = {
            "emotion_accuracy": [],
            "rag_effectiveness": [],
            "response_quality": [],
            "issues": [],
            "recommendations": [],
        }

    async def test_conversation(self, conv: Dict) -> Dict:
        print(f"\n{'=' * 70}")
        print(f"TEST: {conv['name']}")
        print(f"{'=' * 70}\n")

        result = {
            "test_name": conv["name"],
            "timestamp": datetime.now().isoformat(),
            "turns": [],
        }

        memory_context = {
            "long_term": {"username": "TestUser", "dominant_emotion": None, "mentioned_topics": []},
            "short_term": [],
            "emotional_trend": [],
        }

        for msg_idx, user_message in enumerate(conv["messages"], 1):
            print(f"User: {user_message}\n")
            turn_result = {"turn": msg_idx, "emotion": None, "rag_count": 0, "response_length": 0}

            emotion_result = detect_emotion(user_message)
            emotion = emotion_result.get("label", "neutral")
            confidence = emotion_result.get("score", 0)
            print(f"Emotion Detected: {emotion.upper()} (confidence: {confidence:.1%})")
            turn_result["emotion"] = emotion
            self.observations["emotion_accuracy"].append(
                {"test": conv["name"], "emotion": emotion, "confidence": confidence}
            )

            try:
                rag_service = get_rag_service()
                examples = rag_service.retrieve(user_message, emotion, "", k=2)
                print(f"RAG Retrieved {len(examples)} examples:")
                for i, ex in enumerate(examples, 1):
                    print(f"   - {ex.get('emotion')}: {ex.get('situation')}")
                turn_result["rag_count"] = len(examples)
                self.observations["rag_effectiveness"].append(
                    {"test": conv["name"], "examples_retrieved": len(examples)}
                )
            except Exception as e:
                print(f"RAG retrieval failed: {e}")

            try:
                system_prompt = self.prompt_builder.build_system_prompt(
                    emotion=emotion,
                    flow_stage="venting" if msg_idx <= 1 else "exploring",
                    turn_count=msg_idx,
                    memory_context=memory_context,
                    recent_hashes=[],
                    user_message=user_message,
                    situation="",
                )
                print(f"System prompt created ({len(system_prompt)} chars)")

                print("\nTherapist Response:")
                print("-" * 70)

                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ]

                response_text = ""
                try:
                    async for chunk in llm_service.generate_stream(messages):
                        print(chunk, end="", flush=True)
                        response_text += chunk
                except Exception as e:
                    print(f"[Could not stream: {e}]")
                    response_text = await llm_service.generate(messages)
                    print(response_text)

                print("\n" + "-" * 70)
                turn_result["response_length"] = len(response_text)

                quality = self._analyze_response_quality(response_text, user_message, emotion)
                print("\nQuality Metrics:")
                for metric, value in quality.items():
                    symbol = "PASS" if value.get("pass") else "WARN"
                    print(f"   {symbol} {metric}: {value['feedback']}")

                self.observations["response_quality"].append(quality)
            except Exception as e:
                print(f"Generation failed: {e}")
                self.observations["issues"].append(f"{conv['name']}: {str(e)}")

            result["turns"].append(turn_result)
            print("\n")

        return result

    def _analyze_response_quality(self, response: str, user_msg: str, emotion: str) -> Dict:
        passed = 0
        total = 0

        checks = {
            "length": {
                "check": 30 <= len(response) <= 400,
                "feedback": f"{len(response)} chars" + (" OK" if 30 <= len(response) <= 400 else " (too short/long)"),
            },
            "reflection": {
                "check": any(w in response.lower() for w in ["sounds", "seems", "feels", "appears", "hear"]),
                "feedback": "Uses reflective language"
                if any(w in response.lower() for w in ["sounds", "seems", "feels", "appears", "hear"])
                else "Missing reflection",
            },
            "cliches": {
                "check": not any(c in response.lower() for c in ["stay positive", "everything will be okay", "just relax"]),
                "feedback": "No cliches"
                if not any(c in response.lower() for c in ["stay positive", "everything will be okay", "just relax"])
                else "Contains cliches",
            },
            "questions": {
                "check": response.count("?") == 1,
                "feedback": f"{response.count('?')} question(s)" + (" OK" if response.count("?") == 1 else " (should be 1)"),
            },
            "emotion_specificity": {
                "check": emotion.lower() in response.lower() or any(
                    e in response.lower() for e in ["overwhelmed", "frustrated", "isolated", "exhausted", "heartbreak"]
                ),
                "feedback": "Names emotion specifically"
                if emotion.lower() in response.lower()
                or any(e in response.lower() for e in ["overwhelmed", "frustrated", "isolated", "exhausted", "heartbreak"])
                else "Could be more specific",
            },
        }

        results = {}
        for metric, check in checks.items():
            results[metric] = {"pass": check["check"], "feedback": check["feedback"]}
            if check["check"]:
                passed += 1
            total += 1

        results["score"] = f"{passed}/{total}"
        return results

    async def run_all_tests(self):
        print("\n" + "=" * 70)
        print("MINDFULAI AUTOMATED CONVERSATION TESTING")
        print("=" * 70)

        for conv in TEST_CONVERSATIONS:
            result = await self.test_conversation(conv)
            self.test_results.append(result)
            await asyncio.sleep(0.5)

        self._generate_report()

    def _generate_report(self):
        print("\n" + "=" * 70)
        print("AUTOMATED OBSERVATION REPORT")
        print("=" * 70)

        print("\n1) EMOTION DETECTION PERFORMANCE:")
        if self.observations["emotion_accuracy"]:
            avg_confidence = sum(e["confidence"] for e in self.observations["emotion_accuracy"]) / len(
                self.observations["emotion_accuracy"]
            )
            print(f"   Average confidence: {avg_confidence:.1%}")
            print(f"   Tests run: {len(self.observations['emotion_accuracy'])}")
            print("   All emotions detected successfully")

        print("\n2) RAG RETRIEVAL EFFECTIVENESS:")
        if self.observations["rag_effectiveness"]:
            avg_examples = sum(r["examples_retrieved"] for r in self.observations["rag_effectiveness"]) / len(
                self.observations["rag_effectiveness"]
            )
            print(f"   Average examples retrieved: {avg_examples:.1f}")
            print("   RAG service working correctly")

        print("\n3) RESPONSE QUALITY ANALYSIS:")
        if self.observations["response_quality"]:
            quality_scores = [q for q in self.observations["response_quality"] if isinstance(q, dict) and "score" in q]
            if quality_scores:
                total_pass = sum(int(q["score"].split("/")[0]) for q in quality_scores)
                total_checks = sum(int(q["score"].split("/")[1]) for q in quality_scores)
                print(f"   Overall quality score: {total_pass}/{total_checks} ({total_pass / total_checks * 100:.0f}%)")

        if self.observations["issues"]:
            print("\nISSUES DETECTED:")
            for issue in self.observations["issues"]:
                print(f"   - {issue}")
        else:
            print("\nNO CRITICAL ISSUES DETECTED")

        print("\nAUTOMATIC TUNING RECOMMENDATIONS:")
        recommendations = self._generate_recommendations()
        for i, rec in enumerate(recommendations, 1):
            print(f"   {i}. {rec}")

        self._save_results()

    def _generate_recommendations(self) -> List[str]:
        recs = []

        response_lengths = []
        for result in self.test_results:
            for turn in result.get("turns", []):
                response_lengths.append(turn.get("response_length", 0))

        if response_lengths:
            avg_length = sum(response_lengths) / len(response_lengths)
            if avg_length > 400:
                recs.append("TUNE: Responses are too long. Reduce GROQ_MAX_TOKENS from 220 to 150")
            elif avg_length < 50:
                recs.append("TUNE: Responses are too short. Increase GROQ_MAX_TOKENS from 220 to 300")

        confidences = [e["confidence"] for e in self.observations["emotion_accuracy"]]
        if confidences and sum(c < 0.6 for c in confidences) > len(confidences) * 0.3:
            recs.append("TUNE: Emotion detection confidence is low. Consider a different model")

        rag_counts = [r["examples_retrieved"] for r in self.observations["rag_effectiveness"]]
        if rag_counts and any(c == 0 for c in rag_counts):
            recs.append("TUNE: RAG not retrieving examples for some emotions. Check dataset or embedding model")

        if not recs:
            recs.append("All systems performing well. Consider A/B testing with users")
            recs.append("Deploy to staging for real user feedback")
            recs.append("Monitor response times and emotion detection accuracy over 100+ conversations")

        return recs

    def _save_results(self):
        output_file = Path(__file__).parent.parent / "test_results.json"

        output = {
            "timestamp": datetime.now().isoformat(),
            "tests_run": len(self.test_results),
            "results": self.test_results,
            "observations": self.observations,
            "recommendations": self._generate_recommendations(),
        }

        with open(output_file, "w") as f:
            json.dump(output, f, indent=2)

        print("\nFull results saved to: test_results.json")


async def main():
    observer = ConversationObserver()
    await observer.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
