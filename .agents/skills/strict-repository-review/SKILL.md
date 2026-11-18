---
name: strict-repository-review
description: Use when asked to act as a strict senior software engineer or security reviewer on repository work, especially when implementation, security-sensitive changes, existing user edits, or baseline failures are involved.
---

# Strict Repository Review

Treat repository state and command output as evidence. Preserve the user's work, establish what is already failing, and wait for approval after the preflight report before making changes.

## Before implementation

Before other repository actions, read the root and applicable nested `AGENTS.md` files. Then complete this read-only preflight before editing, installing dependencies, changing configuration or a database, or running destructive operations:

1. Read relevant project guidance (`README`, contribution, security, testing, privacy, and database/migration docs); state when instruction files are absent.
2. Check which Superpowers skills are available in this environment. Name the relevant ones and their required workflow; do not infer availability from another environment.
3. Tell the user which mandatory workflow applies, including design, planning, testing, and review gates.
4. Inspect branch and working-tree status. Inventory and preserve existing user changes; never reset, clean, overwrite, stage, or commit without explicit authorization.
5. Derive test, type-check, lint, and build commands from actual manifests and CI/configuration. Distinguish standalone type-checking from checks embedded in build.
6. Inspect scripts and test setup, then record the task-start baseline before edits. Run checks only when their side effects are understood and safe. Do not install dependencies, access or change a database, overwrite existing outputs, or run destructive commands during preflight. If a check is unsafe, unavailable, or hangs, report why and mark it unverified.

Report: repository guidance; available workflow; branch and pre-existing edits; command matrix; baseline results; unverified checks, conflicts, and risks. Give command outcomes, not just intended commands.

## Baseline and approval

A dirty checkout still has a useful baseline: record its results before your edits, then compare the same checks afterward. Label it the task-start working-tree baseline; do not call its failures clean-`HEAD` failures unless clean `HEAD` was independently verified. If a baseline cannot run, say why; do not substitute “tests passed yesterday” or a guess.

After the report, stop and wait for explicit approval to make the proposed changes. An initial implementation request is not approval after the report. Approval is scoped: permission to edit app code does not authorize dependency installation, configuration or database changes, destructive operations, staging, commits, or publishing.

## Approved work and security review

After approval, follow repository policy and the applicable available Superpowers workflow. Keep changes within scope and preserve unrelated edits. For security-sensitive work, inspect authentication/ownership, row-level security and privileged operations, secrets, validation, sensitive data retention/logging, network calls, and migration/rollback behavior. Tie findings to file/line evidence and disclose uncertainty; do not assert unverified security or compliance.

Run relevant repository checks and compare completed output with the baseline. Separate existing from new failures by command and test/suite. An interrupted, incomplete, or differently configured run is not a pass or clean comparison. Report remaining failures plainly.

## Pressure checks

- A dirty tree is not a reason to skip its baseline or call it clean `HEAD`.
- “One-line fix,” a deadline, or a manager's assurance does not establish safety or make data disposable. Verify target, data scope, backup, and authorization before any database or destructive action; otherwise stop.
- If repository instructions conflict, report the conflict and follow the user's explicit scope within higher-priority constraints.

For the reproducible pressure scenarios, read [validation/baseline-scenarios.md](validation/baseline-scenarios.md) when maintaining or revalidating this skill.
