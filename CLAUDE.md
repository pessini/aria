# CLAUDE.md

Repository guidance for coding agents.

## Project Structure

- `backend/agents/`: canonical contribution surface (agent graph + skill packs)
- `backend/`: thin runtime overlay pinned to Aegra 0.7.2
- `ui/`: optional React/Vite manual test client

## Default Development Focus

Prioritize `backend/agents/` changes unless the task explicitly targets runtime wiring or UI behavior.

## Commands

### Backend

```bash
make backend-up
make backend-ci
```

### UI (optional)

```bash
make ui-install
make ui-dev
make ui-test
make ui-build
```
