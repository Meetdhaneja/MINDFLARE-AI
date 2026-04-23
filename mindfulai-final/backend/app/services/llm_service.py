import asyncio, httpx, logging, json
from typing import List, Dict, AsyncGenerator
from app.core.config import settings

log = logging.getLogger(__name__)

async def call_groq_stream(messages: List[Dict]) -> AsyncGenerator[str, None]:
    """Stream response from Groq API"""
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set")

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "max_tokens": settings.GROQ_MAX_TOKENS,
        "temperature": settings.GROQ_TEMPERATURE,
        "stream": True
    }
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}

    for attempt in range(settings.GROQ_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=settings.GROQ_TIMEOUT) as client:
                async with client.stream("POST", f"{settings.GROQ_BASE_URL}/chat/completions",
                                       json=payload, headers=headers) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if line.strip():
                            if line.startswith("data: "):
                                data = line[6:]
                                if data == "[DONE]":
                                    break
                                try:
                                    chunk = json.loads(data)
                                    if chunk.get("choices") and chunk["choices"][0].get("delta", {}).get("content"):
                                        yield chunk["choices"][0]["delta"]["content"]
                                except json.JSONDecodeError:
                                    continue

            break  # Success, exit retry loop

        except Exception as e:
            log.warning(f"Groq stream attempt {attempt+1}: {e}")
            if attempt < settings.GROQ_MAX_RETRIES - 1:
                await asyncio.sleep(1.5 ** attempt)
            else:
                raise RuntimeError("Groq streaming failed")

async def call_local_stream(messages: List[Dict]) -> AsyncGenerator[str, None]:
    """Stream response from local LM Studio"""
    payload = {
        "model": "local-model",
        "messages": messages,
        "max_tokens": settings.GROQ_MAX_TOKENS,
        "temperature": settings.GROQ_TEMPERATURE,
        "stream": True
    }

    async with httpx.AsyncClient(timeout=30) as client:
        async with client.stream("POST", "http://localhost:1234/v1/chat/completions", json=payload) as response:
            response.raise_for_status()

            async for line in response.aiter_lines():
                if line.strip():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            if chunk.get("choices") and chunk["choices"][0].get("delta", {}).get("content"):
                                yield chunk["choices"][0]["delta"]["content"]
                        except json.JSONDecodeError:
                            continue

async def call_groq(messages: List[Dict]) -> str:
    """Non-streaming version for backward compatibility"""
    chunks = []
    async for chunk in call_groq_stream(messages):
        chunks.append(chunk)
    return "".join(chunks).strip()

async def call_local(messages: List[Dict]) -> str:
    """Non-streaming version for backward compatibility"""
    chunks = []
    async for chunk in call_local_stream(messages):
        chunks.append(chunk)
    return "".join(chunks).strip()

async def generate(messages: List[Dict]) -> str:
    """Non-streaming generation with 8s timeout and Elite Fallback"""
    fallback = "I'm here with you. I'm having a bit of trouble responding right now, but I still want to understand—can you tell me a little more?"
    
    try:
        # Strict 8s timeout for production stability
        return await asyncio.wait_for(call_groq(messages) if settings.GROQ_API_KEY else call_local(messages), timeout=8.0)
    except Exception as e:
        log.warning(f"LLM Generation failed or timed out: {e}")
        return fallback

async def generate_stream(messages: List[Dict]) -> AsyncGenerator[str, None]:
    """Streaming generation with Elite Fallback on failure"""
    fallback = "I'm here with you. I'm having a bit of trouble responding right now, but I still want to understand—can you tell me a little more?"
    
    try:
        if settings.GROQ_API_KEY:
            async for chunk in call_groq_stream(messages):
                yield chunk
        else:
            async for chunk in call_local_stream(messages):
                yield chunk
    except Exception as e:
        log.warning(f"LLM Streaming failed: {e}")
        for word in fallback.split():
            yield word + " "
            await asyncio.sleep(0.05)

def active_provider() -> str:
    return "groq" if settings.GROQ_API_KEY else "local"
