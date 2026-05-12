---
id: copilot-instructions
name: GitHub Copilot project instructions
description: "Project-wide instructions for GitHub Copilot (.github/copilot-instructions.md)."
version: 1.0.0
parameters:
  - name: profile
    type: object
    description: Enriched repo profile.
    required: true
---
# Copilot instructions

{% if profile.summary %}{{ profile.summary }}
{% elif profile.description %}{{ profile.description }}
{% else %}Project-wide guidance for GitHub Copilot in {{ profile.name }}.
{% endif %}

## Stack

{% if profile.primaryLanguage %}- Primary language: {{ profile.primaryLanguage }}
{% endif %}{% if profile.languages and profile.languages | length > 0 %}- Languages: {{ profile.languages | join(', ') }}
{% endif %}{% if profile.frameworks and profile.frameworks | length > 0 %}- Frameworks: {{ profile.frameworks | join(', ') }}
{% endif %}{% if profile.testRunners and profile.testRunners | length > 0 %}- Test runners: {{ profile.testRunners | join(', ') }}
{% endif %}{% if profile.packageManager %}- Package manager: `{{ profile.packageManager }}`
{% endif %}

## What to do

- Match the existing file's conventions — naming, imports, error handling, spacing.
- Keep suggestions focused. Complete the immediate intent rather than expanding scope.
- {% if profile.primaryLanguage %}Prefer idiomatic {{ profile.primaryLanguage }} patterns.{% else %}Prefer idiomatic patterns for the file's language.{% endif %}
- When generating tests, assert on observable behavior, not implementation details.
- When generating a public API, validate inputs at the boundary.

## What not to do

- Do not introduce new frameworks, build tools, or major dependencies in a completion.
- Do not write commented-out code or "TODO" placeholders. Either implement, or surface the gap explicitly.
- Do not generate secrets, credentials, or API keys — use environment variables and document the keys needed.
- Do not silently swallow errors. Throw, return, or log with enough context to investigate.

{% if profile.frameworks and profile.frameworks | length > 0 %}## Framework notes

The project uses {{ profile.frameworks | join(', ') }}. Stick to these frameworks' idiomatic patterns; do not introduce parallel implementations.

{% endif %}{% if profile.testRunners and profile.testRunners | length > 0 %}## Testing

- Tests run via {{ profile.testRunners | join(' / ') }}.
- Add or update a test alongside the code change in the same PR.
- Prefer integration tests that exercise real boundaries over heavy mocking when the cost is reasonable.

{% endif %}## Style

- Default to no comments. Add one only when the *why* is non-obvious.
- Use descriptive names. Avoid abbreviations unless they are domain standard.
- Keep functions focused. If a function does multiple things, suggest splitting it.
