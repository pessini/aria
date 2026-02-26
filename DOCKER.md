# Docker Usage

## Backend

Run from repository root (Terminal 1 — stays in foreground):

```bash
make backend-up
```

Starts `n8n-mcp` from `backend/n8n-mcp.yml` and runs `aegra dev` with skills loaded.

Services started:

- `n8n-mcp` at port `4244`
- `aegra dev` at port `4242`

## UI (optional)

Run from repository root (Terminal 2):

```bash
make ui-docker-up
```

Compose file: `ui/docker-compose.yml`

UI available at **http://localhost:4241**
