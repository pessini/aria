# Contributing to Aria Workflow Assistant

Thanks for contributing.

## Scope

This repository is **agents first**:

- Primary contribution area: `backend/agents/`
- Secondary/optional area: `ui/`
- Runtime overlay area: `backend/`

If editing `backend/`, follow root governance policy and keep runtime overlay changes minimal.

## Development Setup

### Backend Runtime

Install pinned CLI once:

```bash
make backend-cli-install
```

Then run backend:

```bash
make backend-up
```

This uses pinned upstream `aegra-cli` tag `v0.7.2` from `backend/aegra-cli-version.txt`.

### Optional UI

```bash
make ui-install
```

## Quality Gate

Before opening a PR, run:

```bash
make backend-ci
```

If your changes touch `ui/`, also run:

```bash
make ui-test
make ui-build
```

## Pull Requests

- Keep PRs focused and small when possible.
- Include tests for behavior changes.
- Update docs when commands/configs/paths change.
- Use clear commit messages (Conventional Commits preferred).

## Project-Specific Docs

- Architecture and ownership: `ARCHITECTURE.md`
- Runtime pin/upgrade policy: `backend/UPSTREAM.md`

## Where to Change What

- Skills-agent logic: `backend/agents/`
- Runtime wiring + docker config: `backend/`
- UI/manual test harness: `ui/`
- Policy/governance docs: repository root
