# Testing and Tuning

## Testing

- Run backend tests with `pytest`.
- Verify the chat endpoint, auth flow, and safety checks.
- Confirm the frontend starts cleanly in Next.js.

## Tuning

- Adjust the number of turns before suggestions appear.
- Review memory and retrieval behavior if responses become repetitive.
- Check prompt settings if the tone feels too rigid or too verbose.

## Good checks before release

- Login and signup work.
- Chat responses are returned from the backend.
- Crisis detection short-circuits unsafe requests.
- Docker Compose brings up the full stack.
