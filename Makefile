.PHONY: help backend-cli-install backend-up backend-down backend-logs backend-smoke skills-lint skills-test backend-ci n8n-up n8n-down ui-install ui-dev ui-test ui-build ui-docker-up ui-docker-down

help:
	@echo "Available commands:"
	@echo "  make backend-cli-install - Install pinned Aegra CLI (v0.7.2)"
	@echo "  make backend-up       - Start n8n-mcp and run 'aegra dev' with backend/aegra.json"
	@echo "  make backend-down     - Stop backend core stack"
	@echo "  make backend-logs     - Tail n8n-mcp logs"
	@echo "  make backend-smoke    - Run backend runtime smoke checks"
	@echo "  make skills-lint      - Run skills-agent lint checks"
	@echo "  make skills-test      - Run skills-agent smoke tests"
	@echo "  make backend-ci       - Run required backend checks"
	@echo "  make ui-install       - Install UI dependencies"
	@echo "  make ui-dev           - Run UI dev server"
	@echo "  make ui-test          - Run UI tests"
	@echo "  make ui-build         - Build UI"
	@echo "  make n8n-up           - Start local n8n instance (http://localhost:4245)"
	@echo "  make n8n-down         - Stop local n8n instance"
	@echo "  make ui-docker-up     - Start UI docker compose"
	@echo "  make ui-docker-down   - Stop and remove UI docker compose"

n8n-up:
	docker compose -f n8n/docker-compose.yml up -d

n8n-down:
	docker compose -f n8n/docker-compose.yml down

backend-cli-install:
	./scripts/install-aegra-cli.sh

backend-up:
	docker compose -f backend/n8n-mcp.yml up -d n8n-mcp
	uv tool run --from aegra-cli --with langchain-openai --with langchain-ollama --with langchain-mcp-adapters aegra dev --config backend/aegra.json --port 4242

backend-down:
	docker compose -f backend/n8n-mcp.yml down --remove-orphans
	docker compose -f backend/docker-compose.yml down --remove-orphans

backend-logs:
	docker compose -f backend/n8n-mcp.yml logs -f n8n-mcp

backend-smoke:
	./scripts/backend_smoke.sh

skills-lint:
	python3 -m compileall backend/agents

skills-test:
	python3 scripts/skills_smoke.py

backend-ci:
	./scripts/check-thin-runtime.sh
	$(MAKE) skills-lint
	$(MAKE) skills-test

ui-install:
	npm --prefix ui ci

ui-dev:
	npm --prefix ui run dev

ui-test:
	npm --prefix ui run test

ui-build:
	npm --prefix ui run build

ui-docker-up:
	cd ui && docker compose up --build

ui-docker-down:
	docker compose -f ui/docker-compose.yml down --remove-orphans
