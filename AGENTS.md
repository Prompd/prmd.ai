\# AGENTS.md



\## Project Overview



This project is a TypeScript monorepo-style web application.



\- Frontend: React + Vite + TypeScript

\- API: Node.js + TypeScript

\- Package manager: npm unless the repo indicates otherwise

\- Primary goal: build a web MVP for generating downloadable AI agent instruction packs from repo input



\## Working Rules



\- Prefer TypeScript throughout.

\- Keep changes small and focused.

\- Do not introduce large frameworks unless necessary.

\- Do not rewrite working architecture without asking.

\- Preserve existing naming, folder structure, and coding style.

\- When uncertain, inspect the repo before making assumptions.

\- Before changing behavior, explain the plan briefly.

\- After changes, run the relevant build, lint, or tests if available.



\## Frontend Guidance



\- Use React functional components.

\- Use Vite conventions.

\- Keep UI simple and fast.

\- Monaco editor may be used for previewing generated Markdown and JSON files.

\- Prefer plain, maintainable components before adding UI libraries.

\- Avoid overbuilding state management. Use local state first unless complexity proves otherwise.



\## API Guidance



\- Use Node.js with TypeScript.

\- Keep API routes small and explicit.

\- Separate repo scanning, LLM enrichment, Prompd compilation, and packaging/download logic.

\- Do not send full repository source to the LLM by default.

\- Prefer deterministic repo scanning before model calls.



\## Target MVP Flow



The app should support this flow:



1\. User provides repo information, initially a GitHub URL or manual project details.

2\. Server scans the repo or uses supplied metadata.

3\. Server creates a compact repo profile.

4\. LLM fills missing project details from the compact profile only.

5\. Server passes the normalized profile as parameters into internal `.prmd` templates.

6\. Prompd TypeScript compiler compiles templates into plain `.md` and `.json` files.

7\. Frontend shows generated files in Monaco editor tabs.

8\. User can edit generated files.

9\. User downloads a zip package.

10\. No `.prmd` files leave the server.



\## Generated Output Examples



Possible downloadable files:



\- `AGENTS.md`

\- `CLAUDE.md`

\- `.cursor/rules/project.mdc`

\- `.github/copilot-instructions.md`

\- `.claude/agents/architect.md`

\- `.claude/agents/frontend.md`

\- `.claude/agents/backend.md`

\- `.claude/agents/code-reviewer.md`

\- `.claude/agents/test-engineer.md`

\- `.claude/agents/security-reviewer.md`



\## Cost Control Rules



\- Never send the entire repo to an LLM.

\- Parse known config files directly.

\- Use deterministic scanners for package/framework/test detection.

\- Send only compact structured summaries to the model.

\- Ask the user for clarification when confidence is low instead of spending tokens.



\## Suggested First Task



Inspect the repository and propose a small implementation plan for the MVP skeleton:



\- frontend route/page for repo input

\- API endpoint for generating an agent pack

\- shared TypeScript types for repo profile and generated files

\- placeholder scanner

\- placeholder compiler adapter

\- Monaco preview tabs

\- download zip endpoint

