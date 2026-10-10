---
name: tdd-from-scenarios
description: Turns OpenSpec delta-spec scenarios into failing tests before implementation, then drives red → green → refactor task by task during /opsx:apply. Use while implementing any OpenSpec change, or when asked to write tests for a requirement or scenario.
---

# TDD from Scenarios

Each `#### Scenario:` in a change's delta specs is a test case waiting to be
written. This skill makes that mapping explicit and keeps it traceable.

## Inputs

- `openspec/changes/<change>/specs/**/spec.md` — the ADDED and MODIFIED
  requirements and their scenarios
- `openspec/changes/<change>/tasks.md` — the order of work
- `openspec/changes/<change>/design.md` — where the code goes, if present

## Loop (per task in tasks.md)

1. **Pick scenarios.** List the scenarios this task is responsible for.
   A task with none is scaffolding; implement it and run its stated check.
2. **Find the test home.** Mirror the project's existing test layout, framework
   and assertion style. Search for the nearest similar test before creating a
   new file. Do not introduce a new test framework.
3. **Red.** Write one test per scenario. Name it after the scenario and put a
   trace comment on the line above it:

   ```
   // spec: <capability>/<Requirement name>/<Scenario name>
   ```

   Translate WHEN into arrange/act and THEN (plus each AND) into assertions.
   Run the tests and confirm they fail **for the expected reason** (missing
   behavior, not a typo or import error).
4. **Green.** Write the minimal code that makes those tests pass. Run the
   focused tests, then the affected package's suite.
5. **Refactor.** Clean up with all tests green. No behavior changes here.
6. **Tick.** Mark the task `- [x]` in tasks.md only after its stated
   verification passes.

## MODIFIED and REMOVED requirements

- **MODIFIED**: find the existing tests for the requirement (search for its
  `spec:` trace comment or its name). Update their assertions to the new
  behavior first, watch them fail, then change the code.
- **REMOVED**: delete or rewrite the tests for the removed behavior in the same
  task that removes the code, and check the **Migration** note is honored.

## Scenarios that cannot be automated

Some scenarios (visual, third-party, timing) cannot be tested cheaply. Do not
skip them silently. Add the verification method next to the task in
tasks.md (for example "manual: open /settings, toggle theme, reload") and
report it in the final summary.

## Rules

- Never weaken an assertion to get green. If the scenario is wrong, update the
  delta spec first (see `sdd-workflow` → Spec drift rules).
- Never skip, disable or quarantine an existing test.
- Prefer real collaborators over mocks unless the dependency is slow,
  nondeterministic or external.
