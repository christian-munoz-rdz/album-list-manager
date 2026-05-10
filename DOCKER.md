# Docker

This Compose setup runs the full app:

- `client`: built React app served by Nginx on `http://localhost:3000`
- `server`: Express API on `http://localhost:3001`
- `postgres`: PostgreSQL 16 with the schema mounted from `server/src/db/schema.sql`

## Run

```bash
docker compose up --build
```

Then open `http://localhost:3000`.

## Environment

Compose reads values from a root `.env` file for these optional integrations:

```bash
SESSION_SECRET=change-this-to-a-long-random-string
LASTFM_API_KEY=your_lastfm_api_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3001/api/auth/spotify/callback
```

The database URL is set by Compose so the API connects to the `postgres` service inside the Docker network.

## Common Commands

```bash
# Start in the background
docker compose up --build -d

# Show logs
docker compose logs -f

# Stop containers
docker compose down

# Stop containers and remove database data
docker compose down -v
```
