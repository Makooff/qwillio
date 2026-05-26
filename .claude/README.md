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

## Project context files (repo root)

- `CLAUDE.md` — project guide, skill routing rules, design system
- `PRODUCT.md` — product spec
- `DESIGN.md` — design system reference
- `.env.example` — env var template (real `.env` is gitignored)
