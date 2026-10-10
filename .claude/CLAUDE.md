# CLAUDE.md

This repository is **sdd-harness**, a Claude Code plugin: an OpenSpec-centered
spec-driven development workflow with agents, skills and hooks adapted from ECC.
See `README.md` for the user-facing description.

## Layout

- `.claude-plugin/` — plugin and marketplace manifests
- `agents/`, `skills/`, `commands/` — plugin content (prompts in English)
- `hooks/hooks.json` + `scripts/*.mjs` — hooks; plain Node ≥ 20, no dependencies
- `templates/openspec/config.yaml` — config that `/sdd-init` installs into projects
- `upstream.lock.json` + `scripts/upstream-check.mjs` — upstream tracking
- `.claude/` — this file and `commands/upstream-sync.md`, the maintainer command that ports upstream changes (not shipped in the plugin)

## Checks

```bash
npm test                     # hook tests, upstream-check tests, OpenSpec compat (skipped without the CLI)
OPENSPEC_REQUIRED=1 npm test # what CI runs, with the pinned OpenSpec installed
claude plugin validate .
```

## Rules

- Hooks must never break a session: catch everything, exit 0, allow on error.
- Keep prompts short and stack-agnostic; no language-specific rule packs.
- OpenSpec stays the only planning artifact; do not add PRD/plan formats.
- Files adapted from ECC or OpenSpec are listed in `upstream.lock.json` `tracks`
  and `THIRD_PARTY_NOTICES.md`; keep both in sync when adding or removing one.
- README is in Russian; everything Claude reads (agents, skills, commands) is in English.
