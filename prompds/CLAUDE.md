---
id: claude-md
name: CLAUDE.md project instructions for Claude Code
description: "Instructions specifically for Claude Code. When AGENTS.md is also in the pack, defers to it entirely and acts as a thin marker file."
version: 1.0.0
parameters:
  - name: profile
    type: object
    description: Enriched repo profile.
    required: true
  - name: hasAgentsMd
    type: boolean
    description: "True when AGENTS.md is also being generated. When true, this file becomes a pointer to AGENTS.md with no duplicated instructions."
    default: false
  - name: subagents
    type: json
    default: []
    description: "List of { slug, description } for the specialist sub-agents that actually shipped this compile."
---
# CLAUDE.md

{% if hasAgentsMd %}
See [AGENTS.md](./AGENTS.md) for the full instructions every AI assistant working in this repo should follow — project context, working rules, code style, testing notes, sub-agent index, tone, workflow, and out-of-scope items.

This file exists so Claude Code detects a Prompd-managed project; the substance lives in `AGENTS.md`.
{% else %}
Project guidance for Claude Code.

## Project

- Name: {{ profile.name }}
{% if profile.description %}- Description: {{ profile.description }}
{% endif %}{% if profile.primaryLanguage %}- Primary language: {{ profile.primaryLanguage }}
{% endif %}{% if profile.languages and profile.languages | length > 0 %}- Languages: {{ profile.languages | join(', ') }}
{% endif %}{% if profile.frameworks and profile.frameworks | length > 0 %}- Frameworks: {{ profile.frameworks | join(', ') }}
{% endif %}{% if profile.packageManager %}- Package manager: `{{ profile.packageManager }}`
{% endif %}{% if profile.license %}- License: {{ profile.license }}
{% endif %}

{% if subagents and subagents | length > 0 %}## Sub-agents

Specialist sub-agents live under `.claude/agents/`:

{% for agent in subagents %}- `{{ agent.slug }}` — {{ agent.description }}
{% endfor %}

Delegate to a sub-agent when the task fits its scope. Use the main thread for cross-cutting work and final synthesis.
{% endif %}

## Tone

- Be direct and terse. Skip unnecessary explanation when context makes it obvious.
- Point out problems proactively, including risks and edge cases.
- Prefer working code and concrete file references over lengthy commentary.
- Do not say "you're absolutely right" or similar filler.

## Workflow

- Plan before editing for non-trivial changes. Confirm the approach if it is ambiguous.
- After editing, run the relevant tests or typecheck and report the result honestly.
- Do not claim a task is done if tests fail, types break, or you skipped a step.

## Out of scope

- Do not introduce new frameworks without alignment.
- Do not rewrite working architecture without asking.
- Do not commit secrets or API keys, ever.
{% endif %}
