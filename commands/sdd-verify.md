---
description: Pre-archive gate for an OpenSpec change — runs the verification loop and the spec-verifier agent, then reports READY TO ARCHIVE or the blockers.
argument-hint: "[change-name]"
---

# /sdd-verify

Gate 2 of the `sdd-workflow`. Prove the change is done before `/opsx:archive`.

1. **Pick the change.** Use `$ARGUMENTS` if given; otherwise `openspec list`
   and take the only active change. If there are several, ask which one.
2. **Verification loop.** Run the `verification-loop` skill over the working
   tree. Stop and report if Build fails.
3. **Spec conformance.** Delegate to the `spec-verifier` agent with the change
   name. Run it in parallel with step 4.
4. **Review.** If `code-reviewer` has not reviewed the current diff in this
   session, delegate to it now (and to `security-reviewer` when the change
   touches a security surface listed in its proposal).
5. **Report.** Combine into one summary:

   ```
   /sdd-verify <change>
   Verification loop: READY | NOT READY
   Spec conformance:  READY TO ARCHIVE | NOT READY (n blockers)
   Review:            APPROVE | WARNING | BLOCK
   ----
   Overall: READY TO ARCHIVE | NOT READY
   Blockers: ...
   ```

6. **Gate.** If READY, show the diff summary and proposed conventional-commit
   message(s) and ask the user to confirm before running `/opsx:archive` and
   committing. If NOT READY, list the blockers and offer to fix them; do not
   archive.
