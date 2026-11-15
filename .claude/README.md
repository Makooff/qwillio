# `.claude/` — Project Claude Code config

Shared across all Claude Code sessions (web, CLI, IDE). Versioned in git so
any new session on this repo starts with the same context and tooling.

## What's tracked

| Path | Purpose |
|---|---|
| `settings.json` | Project-level permissions and config (no secrets) |
| `agents/` | Project-specific custom agents |
| `skills/` | Project-specific custom skills |
| `commands/` | Slash commands available in this repo |
| `hooks/` | SessionStart / Stop / PreCommit hooks |
| `scripts/` | Helper scripts (Obsidian memory bridge, skill auto-router) |

## What's ignored (local-only)

- `settings.local.json` — your personal overrides
- `sessions/`, `session-env/`, `projects/`, `backups/`, `shell-snapshots/`
- `mcp-needs-auth-cache.json`, `policy-limits.json`

## Adding a custom agent

Drop a `.md` file in `agents/` with YAML frontmatter:
```md
---
name: my-agent
description: One-line description (when to use)
tools: [Read, Edit, Bash]
---
System prompt here.
```

## Adding a custom skill

Create `skills/<skill-name>/SKILL.md` with:
```md
---
name: skill-name
description: When and how to use this skill
---
Skill instructions here.
```

## Shared context for Claude and Codex

Read `AGENTS.md` as the shared working guide. `CLAUDE.md` imports it. The current design system is `DESIGN.md` with `frontend/src/design-system/tokens.json`; `docs/FONCTIONNALITES.md` distinguishes accessible features from code-only modules and prototypes. Historical agent notes must be checked against those references and the current code. No named plugin or local Obsidian service is a universal prerequisite.

## Project context files (repo root)

- `AGENTS.md` — shared guide for Claude and Codex
- `CLAUDE.md` — Claude entry point importing the shared guide
- `PRODUCT.md` — product spec
- `DESIGN.md` — design system reference
- `.env.example` — env var template (real `.env` is gitignored)
