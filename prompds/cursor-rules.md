---
id: cursor-rules
name: Cursor IDE project rules
description: "Project-wide rules for Cursor (.cursor/rules/project.mdc). Always applied across the codebase."
version: 1.0.0
parameters:
  - name: profile
    type: object
    description: Enriched repo profile.
    required: true
---
---
description: Project-wide rules for {{ profile.name }}.
globs:
  - "**/*"
alwaysApply: true
---

# {{ profile.name }} — project rules

{% if profile.summary %}{{ profile.summary }}
{% elif profile.description %}{{ profile.description }}
{% endif %}

## Stack

{% if profile.primaryLanguage %}- Primary language: {{ profile.primaryLanguage }}
{% endif %}{% if profile.languages and profile.languages | length > 0 %}- Languages: {{ profile.languages | join(', ') }}
{% endif %}{% if profile.frameworks and profile.frameworks | length > 0 %}- Frameworks: {{ profile.frameworks | join(', ') }}
{% endif %}{% if profile.testRunners and profile.testRunners | length > 0 %}- Test runners: {{ profile.testRunners | join(', ') }}
{% endif %}{% if profile.packageManager %}- Package manager: `{{ profile.packageManager }}`
{% endif %}

## Conventions

- Match the existing folder structure, naming, and module organization.
- Keep changes small and focused. Do not refactor unrelated code.
- Default to no comments. Only add one when the *why* is non-obvious.
- Use descriptive names — no abbreviations unless they are domain standard.
- Surface errors with actionable messages. Do not swallow exceptions.

## When generating code

- {% if profile.primaryLanguage %}Prefer idiomatic {{ profile.primaryLanguage }}.{% else %}Prefer idiomatic code for the file's language.{% endif %}
- Match the surrounding file's style — spacing, imports, error handling.
- If you introduce a dependency, pin a specific version and explain why in the commit.
- Validate inputs at system boundaries (user input, external APIs).

## When fixing bugs

- Reproduce the bug first if possible.
- Write or update a test that captures the bug before fixing it.
- Keep the fix minimal. Note any unrelated issues as follow-ups; do not bundle.

{% if profile.testRunners and profile.testRunners | length > 0 %}## Tests

- Run {{ profile.testRunners | join(' / ') }} after meaningful changes.
- Add tests for new behavior. Update tests when changing behavior.
- Assert on observable behavior, not implementation details.

{% endif %}## Out of scope

- Do not introduce new frameworks without alignment.
- Do not commit secrets, credentials, or API keys.
- Do not bypass linters, type checkers, or hooks to make a problem "go away".
