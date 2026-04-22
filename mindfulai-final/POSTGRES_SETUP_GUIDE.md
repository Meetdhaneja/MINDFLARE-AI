# PostgreSQL Setup Guide

## Local setup

1. Install PostgreSQL.
2. Create a database for the app.
3. Set the database URL in `mindfulai-final/backend/.env`.
4. Start the backend and frontend with `./start.sh`.

## Docker setup

If you use Docker Compose, PostgreSQL is started automatically with the rest of the stack.

## Environment variable

Use a connection string similar to:

```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/mindfulai
```

## Notes

- Make sure the database user has permission to create tables.
- If you switch environments, recreate the schema or rerun migrations as needed.
