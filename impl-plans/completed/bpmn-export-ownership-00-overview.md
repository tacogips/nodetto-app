# bpmn-export-ownership-00-overview

- Workflow: opus-terra-design-and-implement-review-loop-session-550
  (issue-resolution). This rerun reuses the design and plans written and
  reviewed in session-549 (intake comm-010408; design review DR-1), which
  stopped before committing. Session-550 intake: comm-010417/comm-010418.
- Issue: none (no GitHub issue). The workflow input `requestedOutcome` is
  the issue text.
- Design: `design-docs/specs/design-bpmn.md`, the "export ownership run"
  revision. Sections 5.2 (collaboration artifacts), 5.3 Order item 1, 5.3.1
  (ownership and placement, duplicate-id safeguard), 8 (`--strict` exit
  code), 11 (export ownership tests) and 14 (risks). Plans cite design
  sections, not decision numbers.
- Branch: `main` at a9728e6. No push (`gitPush=false`). The design and these
  plans are committed before fanout. Workers make no git operations.
- Scratch and logs: `tmp/bpmn-export-ownership-s550/<planId>/` (git-ignored).

## Problem in one paragraph

A `bpmn.boundaryEvent` with `attachedTo` but no `parent` is exported into an
extra `Process_orphan_<pageId>` with the warning "Pool-less elements were
exported in an extra unreferenced process." This is N1. Parentless groups
and text annotations also force that orphan process. A sequence flow whose
source is such a boundary event is emitted in two processes with the same
id. This is N2: `importBpmnXml` then throws `duplicate BPMN id <id>`. The fix
does four things:
- Resolves ownership through `attachedTo` (core `bpmn/model.ts` parentOf).
- Moves unowned artifacts into `bpmn:collaboration`.
- Emits each sequence flow once, in its source's container.
- Imports collaboration artifacts.
- Adds a duplicate-id warning over BPMN model and BPMNDI ids.

Reproduction recorded in design step 2: the export put B and G in
`Process_orphan_bpmn-page`, emitted `sequenceFlow F` twice, and re-import
threw "line 1: duplicate BPMN id F".

## Plans and waves

| Wave | planId | Owns (writePaths) | dependsOn |
|---|---|---|---|
| 1 | bpmn-export-ownership-01-import-collab-artifacts | `packages/io/src/bpmn/import.ts`, `packages/io/src/bpmn/import.test.ts` | none |
| 1 | bpmn-export-ownership-02-duplicate-id-guard | `packages/io/src/bpmn/export-duplicates.ts` (new), `packages/io/src/bpmn/export-duplicates.test.ts` (new) | none |
| 1 | bpmn-export-ownership-03-export-placement | `packages/io/src/bpmn/export-scope.ts`, `packages/io/src/bpmn/export-process.ts`, `packages/io/src/bpmn/export.ts`, `packages/io/src/bpmn/export.test.ts` | none |
| 2 | bpmn-export-ownership-04-roundtrip-integration | `packages/io/src/bpmn/roundtrip.test.ts`; shared `packages/io/src/bpmn/export.ts` (one wiring edit) | 01, 02, 03 |

Each plan also owns its progress log `impl-plans/progress/<planId>.md`.
No two plans in one wave share a write path. `export.ts` passes from plan 03
(wave 1) to plan 04 (wave 2) as a shared path for one wiring edit only.

## Rules for every worker

`nodetto-app/` in every plan means the repository root of this checkout.
Run all commands from there.

1. Repository: the public `nodetto-app`. No server code, secrets, version
   bumps, tags or releases. Never touch files outside `nodetto-app/`.
2. Write only your plan's `writePaths`. Edit `sharedPaths` only as that
   plan's shared-path note describes.
3. Before each edit, re-read the file fresh. Record `shasum -a 256 <file>`
   in your progress log before your first edit and after your last edit of
   each file. At the start, also record an intent snapshot: the list of
   symbols you will change. If an owned file's hash changed between your
   read and your write, stop editing it and record the drift. Serial repair
   happens after the wave joins.
4. No git operations: no commit, stash, checkout, reset, branch or worktree.
5. No dependency or lockfile changes (`package.json`, `bun.lock`).
6. Format and lint only your own files: `bunx biome format --write <files>`
   then `bunx biome check <files>`. Never run repo-wide `bun run format`.
7. Do not edit `packages/io/src/bpmn/export-diagram.ts`,
   `packages/io/src/bpmn/equivalence.ts`, `packages/io/src/bpmn/ids.ts`,
   `packages/io/src/bpmn/xml.ts`, `packages/io/src/bpmn/index.ts`, the
   fixtures under `packages/io/src/__fixtures__/bpmn/`, `packages/core/**`,
   `apps/**` or the design document.
8. Test data is self-authored and generic: "Review order", "Timeout",
   "Escalate order", "Note" and ids like `Task_Review`. No external issue,
   vendor, customer, organization or person names. Foreign test namespaces
   use `urn:example:ext` with prefix `ext`.
9. Progress log `impl-plans/progress/<planId>.md` must record:
   - start time
   - each task with its status (todo/doing/done/blocked)
   - file hashes
   - every verification command with its exit code and the path of its
     full log, `tmp/bpmn-export-ownership-s550/<planId>/<step>.log`
     (create the directory; capture with `> <log> 2>&1; echo exit=$?`)
   - any deviation, with its reason
10. Commands run in the foreground to completion. A check passes only when
    its exit code is 0 and its full log exists.
11. Repo-wide `bun run typecheck` during wave 1 may show diagnostics in
    files owned by sibling plans. Such diagnostics are non-blocking: list
    them in the progress log. Diagnostics in your own files block you.
12. Write no code the plan does not ask for: no extra options, no
    generalized frameworks, no unrelated refactors.

## Serial reconciliation and final verification (after wave 2)

Run from `nodetto-app/`, each with a full log under
`tmp/bpmn-export-ownership-s550/reconcile/`:
- `bun test packages/io/src/bpmn`: 0 fail. The pass count is at least the
  baseline 29 plus the new tests; `reference.test.ts` may skip.
- `bun test packages/io apps/cli/src/bpmn-commands.test.ts`: 0 fail. This
  covers jsonl goldens and the CLI BPMN commands, which call the exporter.
- `mise run lint-ts`: exit 0. It runs biome and `tsc --noEmit`.
- `mise run check`: exit 0. It runs typecheck and
  `CARGO_TERM_QUIET=true cargo check --workspace`.
- `git status --short`: only the planned paths plus the progress logs.
- `mise run test-cli` is not required, because no native CLI code changes:
  `crates/native` and `apps/cli/native` contain no BPMN exporter (intake
  grep), so there is no native parity work.

Plan archiving and the `impl-plans/README.md` index update are done by the
workflow's serial finalization, not by workers.
