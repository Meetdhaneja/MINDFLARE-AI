# MindfulAI

MindfulAI is a full-stack AI mental health chatbot with a FastAPI backend and a Next.js frontend.

## Structure

- `mindfulai-final/backend` - API, models, services, and routes
- `mindfulai-final/frontend` - chat UI and auth pages
- `mindfulai-final/docker-compose.yml` - local multi-service stack

## Run locally

1. Add your backend environment variables in `mindfulai-final/backend/.env`.
2. Start the stack:

```bash
cd mindfulai-final
chmod +x start.sh
./start.sh
```

3. Open `http://localhost:3000`.

## Notes

- Generated build output, caches, and installed packages are intentionally ignored.
- The repository is organized so the backend and frontend can be run together or separately.
