# MindfulAI

Full-stack AI mental health chatbot with a FastAPI backend and Next.js frontend.

## Structure

- `mindfulai-final/backend` - FastAPI app, models, services, and API routes
- `mindfulai-final/frontend` - Next.js chat UI and auth pages
- `mindfulai-final/docker-compose.yml` - Local multi-service stack

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

- The repository includes the application source and UI.
- Generated local artifacts such as caches, build output, and node modules are ignored.
