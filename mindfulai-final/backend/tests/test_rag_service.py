"""
RAG Service Integration Test
Validates that the RAG system can load, embed, and retrieve examples correctly.
"""

import sys
from pathlib import Path

backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.core.config import settings
from app.services.rag_service import RAGService, get_few_shot_prompt, get_rag_service, retrieve_examples


def test_rag_initialization():
    print("Testing RAG Service Initialization...")
    rag = RAGService()
    success = rag.initialize()

    if success:
        print("RAG Service initialized successfully")
        print(f"  - Loaded {len(rag.examples)} examples")
        print(f"  - Embedding model: {settings.EMBEDDING_MODEL}")
        print(f"  - Embedding dimension: {rag.embedding_dim}")
        print(f"  - FAISS index size: {rag.faiss_index.ntotal}")
        return True

    print("RAG Service initialization failed")
    return False


def test_rag_retrieval():
    print("\nTesting RAG Retrieval...")

    rag = get_rag_service()
    if not rag.initialized:
        rag.initialize()

    test_queries = [
        ("I'm feeling really overwhelmed with work lately", "anxiety", "work stress"),
        ("I can't stop thinking about what happened", "sadness", "grief"),
        ("Why do I always mess things up?", "shame", "self-criticism"),
    ]

    for message, emotion, situation in test_queries:
        examples = rag.retrieve(message, emotion, situation, k=2)
        if examples:
            print(f"Retrieved {len(examples)} examples for: '{message[:40]}...'")
            for i, ex in enumerate(examples, 1):
                print(f"  - Example {i}: {ex['emotion']} - {ex['situation']}")
        else:
            print(f"Failed to retrieve examples for: '{message[:40]}...'")
            return False

    return True


def test_few_shot_formatting():
    print("\nTesting Few-Shot Formatting...")

    message = "I've been really struggling with my relationship"
    emotion = "fear"
    situation = "relationship anxiety"

    few_shot_text = get_few_shot_prompt(message, emotion, situation, k=2)

    if few_shot_text and len(few_shot_text) > 50:
        print("Few-shot prompt generated successfully")
        print(f"  - Prompt length: {len(few_shot_text)} characters")
        print("  - Preview:")
        for line in few_shot_text.split('\n')[:5]:
            if line.strip():
                print(f"    {line}")
        return True

    print("Failed to generate few-shot prompt")
    return False


def test_global_instance():
    print("\nTesting Global Instance Management...")

    rag1 = get_rag_service()
    rag2 = get_rag_service()

    if rag1 is rag2:
        print("Global instance correctly managed (same instance returned)")
        return True

    print("Global instance management failed (different instances)")
    return False


if __name__ == "__main__":
    print("=" * 60)
    print("RAG SERVICE INTEGRATION TEST SUITE")
    print("=" * 60)

    tests = [
        test_rag_initialization,
        test_rag_retrieval,
        test_few_shot_formatting,
        test_global_instance,
    ]

    results = []
    for test_func in tests:
        try:
            result = test_func()
            results.append(result)
        except Exception as e:
            print(f"Test failed with exception: {e}")
            import traceback

            traceback.print_exc()
            results.append(False)

    print("\n" + "=" * 60)
    print("TEST RESULTS")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")

    if passed == total:
        print("\nAll tests passed! RAG service is ready for production.")
    else:
        print(f"\n{total - passed} test(s) failed. Please review the implementation.")

    sys.exit(0 if passed == total else 1)
