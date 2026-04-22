# Backend Upgrade Notes

This project includes a FastAPI backend that is organized into:

- `app/core` for settings, database, and security
- `app/models` for ORM models
- `app/schemas` for request and response payloads
- `app/routers` for HTTP endpoints
- `app/services` for chat, memory, safety, RAG, and response generation logic

## What changed

- The backend is now structured around service modules instead of a single monolithic handler.
- Chat flow is split into smaller steps so memory, emotion, safety, and suggestion logic stay isolated.
- Database setup is handled centrally through the core database module.

## Validation

Run your normal backend checks after upgrading:

```bash
cd mindfulai-final/backend
python -m pytest
```
