---
description: Set up spec-driven development in the current project — install/initialize OpenSpec, add the sdd-harness config template, and optionally mine baseline specs.
argument-hint: "[capability-to-mine]"
---

# /sdd-init

Bootstrap OpenSpec + sdd-harness in the current repository. Ask before any
step that installs software or overwrites a file.

1. **OpenSpec CLI.** Run `openspec --version`. If missing, propose
   `npm install -g @fission-ai/openspec@latest` and wait for approval.
2. **Initialize.** If `openspec/` does not exist, run
   `openspec init --tools claude` (non-interactive). If it exists, run
   `openspec update` to refresh the generated `/opsx:*` commands and skills.
3. **Config.** If `openspec/config.yaml` has no `rules:` section, merge in
   `${CLAUDE_PLUGIN_ROOT}/templates/openspec/config.yaml` (keep any keys the
   project already set). Then fill `context:` from facts you verify in the
   repo — real build/test/lint commands from the task runner and CI, test
   layout, language versions. Never leave placeholders you could have filled;
   ask the user only for what the repo cannot tell you.
4. **CLAUDE.md.** If the project's `CLAUDE.md` does not mention OpenSpec, offer
   to append this section:

   ```markdown
   ## Spec-driven development
   Behavior is specified in `openspec/specs/`; changes go through
   `openspec/changes/`. Follow the `sdd-workflow` skill for every change:
   classify size, use `/opsx:propose` for standard+ changes, wait for proposal
   approval, implement with `tdd-from-scenarios`, run `/sdd-verify` before
   `/opsx:archive`.
   ```

5. **Baseline specs.** If `openspec/specs/` is empty: list candidate
   capabilities (top-level behaviors, 3–10 of them) and ask which to mine.
   If `$ARGUMENTS` names a capability, mine that one. Delegate mining to the
   `spec-miner` agent, one capability at a time.
6. **Validate and report.** Run `openspec validate --all --strict` and
   summarize what was created and what the user should review.
