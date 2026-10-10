---
description: Port relevant ECC / OpenSpec upstream changes into this harness and bump upstream.lock.json, on a branch with a PR.
argument-hint: "[issue-number]"
---

# /upstream-sync

Our files are **adaptations**, not copies. Never overwrite them with upstream
content; port only what improves them and fits this harness's design
(OpenSpec as the single source of truth, small stack-agnostic prompts).

1. **Detect.** Run `node scripts/upstream-check.mjs --json /tmp/upstream.json`.
   If `$ARGUMENTS` names an `upstream-sync` issue, read it too (it also carries
   the latest-OpenSpec compatibility result). If nothing changed and
   compatibility passes, report "up to date" and stop.
2. **Branch.** `git checkout -b upstream-sync/<yyyy-mm-dd>` from up-to-date `main`.
3. **Read each change.** For every tracked file in the report, read the
   upstream diff:
   `git -C /tmp/sdd-harness-upstreams/<name> diff <from> <to> -- <paths>`.
   Classify each hunk:
   - **port** — fixes a real problem or adds guidance our version lacks
     (review false positives, OpenSpec format/CLI changes, new validation rules)
   - **skip** — stack-specific, tied to ECC's own runtime, profiles or
     installer, cosmetic, or conflicting with our design
   OpenSpec changes to schema format, CLI commands/flags, `config.yaml` keys or
   `/opsx:*` command names are always **port**: they can break the harness.
4. **Port.** Edit our files in their own style. Keep agent and skill prompts
   short; prefer one precise sentence over a pasted section.
5. **Compatibility.** If OpenSpec moved, install that version
   (`npm i -g @fission-ai/openspec@<version>`), run
   `OPENSPEC_REQUIRED=1 npm test`, and fix what fails. Update the pinned version
   in the lock (step 6) so CI tests against it.
6. **Bump the lock.** `node scripts/upstream-check.mjs --update-lock`. If an
   upstream path we track was removed or moved, update `tracks` in
   `upstream.lock.json` to its new location (or drop it, saying why).
7. **Validate.** `npm test` and `claude plugin validate .` must pass. Update
   `THIRD_PARTY_NOTICES.md` if the ECC commit or OpenSpec version changed.
8. **PR.** Push the branch and open a PR titled
   `chore(upstream): sync ECC <short-sha>, OpenSpec <version>`. Body: a table of
   upstream changes with port/skip and a one-line reason each, test results,
   and `Closes #<issue>` when an issue exists. Do not merge it yourself.
