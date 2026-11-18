# Strict Repository Review Skill Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a reusable skill that makes repository preflight evidence, user approval, change isolation, and honest security verification the default for strict engineering reviews.

**Architecture:** Keep the runtime workflow in one concise `SKILL.md`. Keep the pressure scenarios and RED/GREEN observations in `validation/baseline-scenarios.md` so they are not loaded on every use. No helper script, UI metadata, dependency, or application file is needed.

**Tech Stack:** Markdown skill format, YAML frontmatter, Python skill validator.

**Spec:** User request in this task; baseline observations in `validation/baseline-scenarios.md`.

## Global Constraints

- Create files only under `.agents/skills/strict-repository-review/`.
- Do not edit application files, database state, repository configuration, dependencies, or existing user changes.
- Do not run destructive operations or claim checks passed without inspecting completed output.
- After validation, report the created files and stop; application repair requires a separate review and approval.

## Review Focus

- A dirty checkout still needs a task-start baseline; label it as the current checkout, not clean `HEAD`.
- Missing, hanging, or unsafe checks must be reported as unverified with the reason.
- The initial request to implement does not replace approval after the concrete preflight report.
- A request to edit application code does not authorize database mutation, dependency installation, or destructive work.
- Security conclusions must cite observed code/configuration and disclose limits.

## Execution Ruling

Ruling: Keep execution in the current checkout and write only under the
approved skill directory — a separate worktree and the executing-plans
workspace would create or modify files outside the user's explicit scope.
This gives up isolation from the already-dirty branch, so verify the exact
working-tree delta before completion and do not stage or commit anything.

---

### Task 1: Write and validate the skill

**Files:**
- Create: `.agents/skills/strict-repository-review/SKILL.md`
- Modify: `.agents/skills/strict-repository-review/validation/baseline-scenarios.md` with GREEN observations after testing
- No application files

**Interfaces:**
- Consumes the user's repository task and repository-provided instructions/configuration.
- Produces a preflight report and waits for explicit scoped approval before repository mutations.

- [x] Write `SKILL.md` with the complete preflight report contract, safe-check boundary, approval gate, post-approval scope controls, and evidence-based security review expectations.
- [x] Run each documented pressure scenario in a fresh context with the skill loaded; record decisions and any remaining gaps.
- [x] Tighten the first-action rule and rerun all three scenarios; the approval gate and disclosure behavior remained consistent.
- [ ] Run `quick_validate.py` and inspect the result. **Blocked:** the bundled Python runtime raises `ModuleNotFoundError: No module named 'yaml'`; the Windows Store Python is unavailable, and dependency installation was not authorized. Manual frontmatter/name/description/placeholder checks passed, but do not treat them as the official validator result.
- [x] Confirm Git status shows changes only under the approved skill directory, in addition to the user's pre-existing changes.
