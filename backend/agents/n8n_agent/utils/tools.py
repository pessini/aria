"""Tool definitions for the skills agent.

This module creates the two LangChain tools that let the LLM interact with
the local skill store:

- ``load_skill(skill_name)`` — returns the full SKILL.md content plus a list
  of available supporting files.
- ``read_skill_file(skill_name, filename)`` — returns the content of a
  specific supporting file from a skill's directory.

**Why are these tools and not just system-prompt context?**  Loading all skills
into the system prompt would consume too many tokens and dilute the LLM's
attention.  By exposing skills as tools, the LLM can selectively load only the
knowledge it needs for the current task (progressive disclosure).

**Why a factory function?**  The tools need a reference to the ``SkillStore``
instance, which is created at runtime.  The ``create_skill_tools()`` factory
captures the store via closure, so each tool invocation reads from the same
cached store.

**Tool construction**: Tools are built with ``StructuredTool.from_function()``
so that descriptions (including the list of available skill names) are set at
construction time rather than via post-hoc docstring mutation.  This avoids a
fragile pattern where ``@tool`` may freeze the description before the
docstring overwrite takes effect.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from langchain_core.tools import BaseTool, StructuredTool

if TYPE_CHECKING:
    from n8n_agent.skills import SkillStore


def create_skill_tools(store: SkillStore) -> list[BaseTool]:
    """Create skill-loading tools bound to a store instance.

    Returns a list containing ``load_skill`` and ``read_skill_file`` tools
    whose docstrings enumerate the available skill names.  These tools are
    synchronous because the underlying store operations are filesystem
    reads (no async I/O needed).

    Both tools return **JSON strings** rather than raw text.  This gives the
    LLM a structured format to parse and also makes error responses
    distinguishable from success responses (via the ``"error"`` key).
    """
    available = ", ".join(store.get_skill_names()) or "none"

    def _load_skill(skill_name: str) -> str:
        """Load expert knowledge for a skill."""
        parsed = store.load(skill_name)
        if parsed is None:
            # Return the full list of valid names so the LLM can self-correct
            # (e.g. if it hallucinated a skill name or made a typo).
            names = ", ".join(store.get_skill_names())
            return json.dumps(
                {"error": f"Skill '{skill_name}' not found", "available_skills": names}
            )
        # The response includes:
        # - instructions: the full SKILL.md markdown body
        # - available_files: list of supporting filenames the LLM can request
        #   via read_skill_file() if it needs deeper reference material
        return json.dumps({
            "skill_name": skill_name,
            "description": parsed.metadata.description,
            "instructions": parsed.content,
            "available_files": store.list_supporting_files(skill_name),
        })

    def _read_skill_file(skill_name: str, filename: str) -> str:
        """Read a supporting file from a skill folder."""
        try:
            content = store.read_supporting_file(skill_name, filename)
            return json.dumps({
                "skill_name": skill_name,
                "filename": filename,
                "content": content,
            })
        except (FileNotFoundError, ValueError) as e:
            return json.dumps({"error": f"Error reading file: {e}"})

    load_skill_tool = StructuredTool.from_function(
        func=_load_skill,
        name="load_skill",
        description=(
            "Load expert knowledge for a skill. Returns JSON with the skill's "
            "instructions and a list of available supporting files.\n\n"
            f"Currently available skills: {available}\n\n"
            "Note: If this list seems outdated, the load_skill tool will return "
            "the current list of available skills in its error response if an "
            "invalid skill name is provided.\n\n"
            "Args:\n    skill_name: Exact name of the skill to load."
        ),
    )

    read_skill_file_tool = StructuredTool.from_function(
        func=_read_skill_file,
        name="read_skill_file",
        description=(
            "Read a supporting file from a skill folder. Returns JSON with the "
            "file content.\n\n"
            "Use this to access reference documents listed in the "
            "'available_files' field of a loaded skill.\n\n"
            f"Available skills: {available}\n\n"
            "Args:\n    skill_name: Name of the skill that owns the file.\n"
            "    filename: Name of the file to read (from the skill's available_files)."
        ),
    )

    return [load_skill_tool, read_skill_file_tool]
