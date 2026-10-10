---
name: verification-loop
description: Runs a stack-agnostic verification pass over the working tree — build, types, lint, tests, secret scan, diff review, OpenSpec validation — and produces a PASS/FAIL report. Use before archiving an OpenSpec change, before opening a PR, or whenever quality gates must pass. Adapted from ECC's verification-loop.
---

# Verification Loop

Proves the current change is sound with commands, not opinions. Every phase
records the exact command it ran and the result.

## Phase 0 — Discover the project's own checks

Do not guess commands. Find what contributors already run, in this order:

1. `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `README.md` — documented commands
2. Task runners: `package.json` scripts, `Makefile`, `justfile`, `Taskfile.yml`,
   `pyproject.toml`, `Cargo.toml`, `build.zig`, `go.mod`, `mise.toml`
3. CI config: `.github/workflows/*.yml` — the commands CI runs are the
   commands that must pass
4. Git hooks: `.githooks/`, `.husky/`, `.pre-commit-config.yaml`

Map each phase below to a concrete command. Mark a phase `N/A` only when the
project genuinely has no such check, and say why.

## Phases

Run in order. If **Build** fails, stop and report; later phases are noise.

| # | Phase | Typical sources |
|---|-------|-----------------|
| 1 | Build | `npm run build`, `cargo build`, `go build ./...`, `zig build`, `make` |
| 2 | Types | `tsc --noEmit`, `pyright`/`mypy`, compiler (covered by build) |
| 3 | Lint & format | `npm run lint`, `ruff check`, `cargo clippy`, `golangci-lint`, `zig fmt --check`, formatter in check mode |
| 4 | Tests | the full suite CI runs; add coverage only if the project already measures it |
| 5 | Secret scan | see below |
| 6 | Diff review | see below |
| 7 | OpenSpec | `openspec validate --all --strict` (or the active change only) |

Pipe long output through `tail`/`head` but keep `set -o pipefail` so a
failing command is not hidden by the pipe.

### Phase 5 — Secret scan

Prefer a real scanner when present (`gitleaks detect --no-banner`,
`trufflehog git file://. --only-verified`). Otherwise grep the **changed**
files only:

```bash
git diff --name-only HEAD | xargs -r grep -nEi \
  '(api[_-]?key|secret|token|passwd|password)\s*[:=]\s*["'\''][^"'\'']{8,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY'
```

Every hit needs a verdict: real secret (FAIL), fixture/example (note it).

### Phase 6 — Diff review

```bash
git status --short
git diff --stat HEAD
```

Read each changed file's diff and check for: unintended changes, leftover
debug output, commented-out code, TODOs without an issue, files that belong
to a different change.

## Report

```
VERIFICATION REPORT
===================
Build:     PASS | FAIL | N/A   (<command>)
Types:     PASS | FAIL | N/A   (<command>, N errors)
Lint:      PASS | FAIL | N/A   (<command>, N warnings)
Tests:     PASS | FAIL         (<command>, X/Y passed)
Secrets:   PASS | FAIL         (<scanner or grep>, N hits)
Diff:      N files changed, <notes>
OpenSpec:  PASS | FAIL         (openspec validate ... --strict)

Overall:   READY | NOT READY

Issues to fix:
1. ...
```

`READY` requires every non-N/A phase to PASS. Do not round a FAIL up because
it "looks unrelated": either prove it fails identically on the base branch
(`git stash; <command>; git stash pop`) and say so, or fix it.
