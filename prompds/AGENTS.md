---
id: agents-md
name: AGENTS.md root agent instructions
description: "Master agent instructions for the project root. Read first by any AI coding assistant working in the repo."
version: 1.0.0
parameters:
  - name: profile
    type: object
    description: Enriched repo profile.
    required: true
  - name: subagents
    type: json
    default: []
    description: "List of { slug, description } for the specialist sub-agents that actually shipped this compile."
---
# AGENTS.md

{% if profile.summary %}{{ profile.summary }}
{% elif profile.description %}{{ profile.description }}
{% else %}AI coding assistant instructions for {{ profile.name }}.
{% endif %}

## Project overview

- Name: {{ profile.name }}
{% if profile.primaryLanguage %}- Primary language: {{ profile.primaryLanguage }}
{% endif %}{% if profile.languages and profile.languages | length > 0 %}- Languages: {{ profile.languages | join(', ') }}
{% endif %}{% if profile.frameworks and profile.frameworks | length > 0 %}- Frameworks: {{ profile.frameworks | join(', ') }}
{% endif %}{% if profile.testRunners and profile.testRunners | length > 0 %}- Test runners: {{ profile.testRunners | join(', ') }}
{% endif %}{% if profile.packageManager %}- Package manager: `{{ profile.packageManager }}`
{% endif %}{% if profile.license %}- License: {{ profile.license }}
{% endif %}- CI configured: {{ 'yes' if profile.hasCI else 'no' }}
{% if profile.architectureNotes %}- Architecture: {{ profile.architectureNotes }}
{% endif %}

## Working rules

- Keep changes small and focused. Prefer multiple small PRs over one large one.
- Inspect the repo before making assumptions. Read existing code and tests first.
- Match existing conventions, naming, and folder structure. Do not refactor unrelated code.
- Run the relevant build, lint, or tests after each change. Do not declare work done before they pass.
- Validate inputs at system boundaries (user input, external APIs). Trust internal code and framework guarantees.
- Never commit secrets, credentials, or API keys.

## Code style

{% if profile.primaryLanguage %}- Prefer idiomatic {{ profile.primaryLanguage }} throughout.
{% endif %}- Default to writing no comments. Only add one when the *why* is non-obvious.
- Use descriptive names. Avoid abbreviations unless they are domain standard.
- Surface errors with actionable messages. Do not swallow exceptions silently.
- Avoid dead code, commented-out blocks, and unused imports.

{% if profile.frameworks and profile.frameworks | length > 0 %}## Stack notes

The project uses {{ profile.frameworks | join(', ') }}. Stick to the idioms of these frameworks rather than introducing parallel patterns.

{% endif %}## Testing

{% if profile.testRunners and profile.testRunners | length > 0 %}- Test runners in use: {{ profile.testRunners | join(', ') }}.
- Add tests for new behavior. Update tests when changing behavior.
- Prefer integration tests over heavy mocking when the cost is reasonable.
{% else %}- No test runner is declared yet. If you introduce one, document the choice and add a `test` script.
{% endif %}

{% if subagents and subagents | length > 0 %}## Sub-agents

This pack ships specialist sub-agents under `.claude/agents/`:

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
- After editing, run the relevant build, lint, or tests and report the result honestly.
- Do not claim a task is done if tests fail, types break, or you skipped a step.

## Out of scope

- Do not introduce new frameworks, build tools, or major dependencies without an explicit ask.
- Do not rewrite working architecture without alignment.
- Do not bypass safety checks (linters, type checkers, hooks) to make a problem "go away".
