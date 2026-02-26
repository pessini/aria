#!/usr/bin/env python3
"""Static smoke checks for backend/agents assets."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS_ROOT = ROOT / "backend/agents" / "n8n_agent" / "skills"
AGENT_FILE = ROOT / "backend/agents" / "n8n_agent" / "agent.py"
CONFIG_FILE = ROOT / "backend" / "aegra.json"


def validate_skills() -> None:
    skill_files = sorted(SKILLS_ROOT.rglob("SKILL.md"))
    if not skill_files:
        raise RuntimeError("No SKILL.md files found under backend/agents/n8n_agent/skills")

    for skill_file in skill_files:
        text = skill_file.read_text(encoding="utf-8")
        if not text.startswith("---\n"):
            raise RuntimeError(f"Missing YAML frontmatter in {skill_file}")
        if "name:" not in text or "description:" not in text:
            raise RuntimeError(f"Required frontmatter keys missing in {skill_file}")


def validate_graph_config() -> None:
    if not AGENT_FILE.exists():
        raise RuntimeError("backend/agents/n8n_agent/agent.py not found")

    agent_text = AGENT_FILE.read_text(encoding="utf-8")
    if "graph = builder.compile" not in agent_text:
        raise RuntimeError("Expected compiled graph declaration not found in agent.py")

    config = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    graph_target = config["graphs"]["aria"]
    graph_file = graph_target.split(":", 1)[0]
    if not (CONFIG_FILE.parent / graph_file).exists():
        raise RuntimeError(f"Configured graph target does not exist: {graph_target}")


if __name__ == "__main__":
    validate_skills()
    validate_graph_config()
    print("skills smoke passed")
