---
name: sdd-workflow
description: Routes any code change in an OpenSpec project through the right amount of ceremony. Classifies the request (trivial/small/standard/large), decides whether it needs an OpenSpec change, and enforces the two human gates (proposal approval, pre-archive verification). Use at the start of every feature, fix, tweak or refactor in a repository that has an openspec/ directory, and whenever the change-guard hook nudges you.
---

# SDD Workflow

OpenSpec is the source of truth for behavior. `openspec/specs/` describes what
the system does today; `openspec/changes/<id>/` describes what is about to
change. This skill decides **when** a request goes through OpenSpec and wires
the rest of the harness (TDD, review, verification) around the OpenSpec
commands. It never replaces `/opsx:*` commands; it sequences them.

## Step 0 — Classify size

Score the request on three signals and take the **highest** tier any signal
reaches. State the result in one line so the user can override it.

| Tier | Files touched | Observable behavior / contract | Design ambiguity |
|------|---------------|--------------------------------|------------------|
| trivial | 1, a few lines | none (typo, rename, log text, dead code) | none |
| small | 1 file / 1 function | none, or a bug fix that restores what an existing spec already says | clear once you read the code |
| standard | 2–5 files | adds or changes behavior a user or caller can observe | one real choice |
| large | many / cross-cutting | new public API, data model, external dependency, or security surface | several open questions |

Tie-breakers:
- Anything that changes **observable behavior** is at least **standard**, even if it is one line.
- Anything touching auth, secrets, permissions, payments, user input parsing or
  data deletion is at least **standard** and gets `security-reviewer`.
- A bug fix whose correct behavior is **not** written in any spec is
  **standard**: the spec gap is part of the bug.

## Step 1 — Route

| Tier | Route |
|------|-------|
| trivial | Edit directly → run the project's fast checks → done. No OpenSpec change. |
| small | Write or adjust a failing test first → fix → `code-reviewer` → done. No OpenSpec change, but if the fix restores a spec'd behavior, cite the requirement in the commit message. |
| standard | Full SDD loop below. |
| large | `/opsx:explore` first to shape the idea, then the full SDD loop. Always include `design.md`. |

If unsure between two tiers, pick the higher one. Ceremony is cheap compared
with behavior drifting away from the specs.

## Step 2 — The SDD loop (standard and large)

1. **Ground.** Before proposing, read what already exists:
   `openspec list --specs`, then `openspec show <spec> --type spec` for every
   capability that looks related. Reuse capability names; never invent a
   near-duplicate.
2. **Propose.** `/opsx:propose <change-name>` (or `/opsx:new` + `/opsx:continue`
   in the expanded profile). Every requirement gets at least one
   `#### Scenario:` written so that it can become a test.
3. **Validate.** `openspec validate <change-name> --strict`. Fix every error
   and warning before showing the proposal.
4. **GATE 1 — proposal approval.** Present proposal, delta specs, design
   (if any) and tasks. Do **not** write implementation code until the user
   approves. Edits to the change artifacts are fine.
5. **Apply.** `/opsx:apply`. Implement task by task using the
   `tdd-from-scenarios` skill: every scenario becomes a failing test before
   the code that satisfies it. Tick tasks in `tasks.md` only when their stated
   verification passes.
6. **Review.** Delegate to `code-reviewer`; add `security-reviewer` when a
   security trigger from Step 0 applies. Fix CRITICAL and HIGH findings.
7. **Verify.** Run `/sdd-verify` (verification loop + `spec-verifier`). It
   must end in `READY TO ARCHIVE`.
8. **GATE 2 — before archive and commit.** Show the verification report, the
   diff summary and proposed conventional-commit messages. Archive
   (`/opsx:archive`) and commit only after the user confirms.

Everything between the gates flows without stopping, unless a blocker or an
open question would change the specs, the approach or the task list. Then
stop and ask; never bake a guess into the implementation.

## Spec drift rules

- Implementation reveals that a scenario is wrong or incomplete → update the
  delta spec in the change first, re-validate, tell the user, then continue.
- Never change `openspec/specs/` by hand during a change; archive merges the
  deltas. The one exception is fixing a `TBD` Purpose placeholder.
- A requirement you cannot test automatically still needs a scenario; mark
  how it is verified (manual check, contract, monitoring) in tasks.md.

## Brownfield projects

If `openspec/specs/` is empty or missing for the area you are about to touch,
offer to run the `spec-miner` agent on that capability first so the change
has a baseline to write deltas against. Mine only what you are about to
change; do not mine the whole repository up front.

## What not to do

- Do not create PRDs, `.claude/plans/*.md` or other parallel planning
  documents. The OpenSpec change **is** the plan.
- Do not skip Gate 1 because the change "looks obvious"; reclassify it as
  small instead, if that is honestly true.
- Do not tick a task without running its verification.
