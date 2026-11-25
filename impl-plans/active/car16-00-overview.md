# car16-00-overview: audit round 16 corrections

- Design: `design-docs/specs/design-ai-capture.md`, section 32
  (Revision 21).
  - Rules R16-1 to R16-3 (32.1), plan table and gates (32.2), decisions
    (32.3), intentional differences (32.4) and risks (32.5).
  - Section 32 wins over earlier sections.
  - Sections 24, 26.2 (timing), 28.2, 29 (ordinary-input rule), 30.2 and
    31.2 still apply.
- Issue:
  `round16-audit/feat-ai-capture@0a357086e71f252f35c6639f755d28551f772517`.
  This is the round-16 audit of `feat/ai-capture`, base `0a35708`, HEAD
  `3a00fb8736e013086f5364e08c246b1545b29ac0`, clean tree. No GitHub issue
  exists; the workflow input `requestedOutcome` is the issue body.
- The user problem has three medium findings:
  - `function-cad-fit-ignores-visible-sketches`: double-click Fit and the
    initial fit ignore visible sketch lines. A sketch-only page is framed
    on the origin, and the drawing is off-screen.
  - `performance-cad-shared-perforated-profile-depth-rescans`: every
    whole-sketch extrusion re-runs the even-depth search over the shared
    profile, so K extrusions of an H-hole plate cost K x (H + 1) visits.
  - `performance-capture-shared-depth-zero-profile-rescans`: capture
    charges an all-depth-zero scan 0 work, so the profile is never cached
    and M contours x K extrusions are rescanned.
- Out of scope, left unchanged: the low findings at
  `packages/ui-solid/src/cad/sketch-overlay.ts:306` and
  `packages/core/src/capture/cad-request.ts:209`.

## Plans and waves

| Plan | Rule | dependsOn | Wave |
| --- | --- | --- | --- |
| car16-p1-viewport-sketch-fit | R16-1 | - | 1 |
| car16-p2-cad-even-depth-search | R16-2 | - | 1 |
| car16-p3-capture-depth-zero-cache | R16-3 | - | 1 |

All three run at once. Their source files are disjoint:

- p1: `packages/ui-solid/src/cad/CadViewport.tsx`,
  `packages/ui-solid/src/test-dom/cad-viewport.dom.tsx`,
  `packages/ui-solid/src/cad/viewport.test.tsx`.
- p2: `packages/core/src/cad/history.ts`,
  `packages/core/src/cad/check.test.ts`.
- p3: `packages/core/src/capture/scene.ts`,
  `packages/core/src/capture/scene.test.ts`.

No file has more than one owner. `history.test.ts`, `construction.ts`,
`Canvas.tsx`, `apps/desktop/src/App.tsx`, `loops.ts`, `camera3d.ts`,
`sketch-authoring.ts` and `sketch-overlay.ts` are read-only for every
plan.

## Fail-before evidence

Every plan works in this order:

1. Write the regression. p2 and p3 first add only their counters, with no
   behaviour change.
2. Run the regression before the production edit. Save the complete
   failing log and its exit status as
   `tmp/car16-r16/<planId>/fail-before.log`.
3. Make the change, then save the passing gate log as
   `tmp/car16-r16/<planId>/gate.log`.

Never revert source, check out an older commit or build an old binary.

## Worker rules (every plan)

- Work only in this working tree, on `feat/ai-capture`.
  - Never push, commit, stash, reset, or create branches or worktrees.
  - Run no git command that writes.
  - English only, no emojis.
- Before each file edit:
  - Read the file fresh and record its SHA-256 in the progress log.
  - Snapshot your intended change in the progress log.
  - After editing, record the new SHA-256.
  - If the pre-edit hash differs from the hash last recorded for that
    file, stop and report the drift. Do not overwrite.
- Edit only the plan's `writePaths`.
  - The progress log is `impl-plans/progress/<planId>.md`.
  - Do not edit `impl-plans/README.md`, other plans, `package.json`,
    lockfiles, `docs/` or the design document.
- Evidence goes under `tmp/car16-r16/<planId>/`.
  - Never leave a file named `*.test.ts` or `*.test.tsx` under `tmp/` or
    `target/`.
  - Probe scripts use a plain `.ts` name.
- Each gate exports its own `CARGO_TARGET_DIR`: `target/r16-viewport-fit`,
  `target/r16-cad-depth` or `target/r16-capture-depth`. No plan builds
  Rust.
- Run at most two `bun test` processes at a time across all plans.
- Timing tests (26.2): under load, an existing timing or deadline test may
  fail in an aggregate gate. If it passes when rerun alone, it counts as
  passing; record both logs.
- Assert performance with work counters, never clocks.
- Never relax, rename or delete existing assertions or helpers.
- Indexed reads must type-check under `noUncheckedIndexedAccess`; use no
  non-null assertions.
- Biome must pass on touched files (one variable per declaration).
- Do not regenerate goldens. Add no dependency.
- Progress log content:
  - status (`in-progress`, `done` or `blocked`);
  - file hashes;
  - every command with its exit code and log path;
  - measured counters;
  - any deviation, with its reason.

## Integration (serial, after all plans land)

1. In order, under the 26.2 timing rule:
   - `bun run typecheck`
   - `bun run lint`
   - `CARGO_TERM_QUIET=true mise run verify` (goldens are checked and
     never regenerated)
2. No `*.test.ts` or `*.test.tsx` file may remain under `tmp/` or
   `target/`.

Plan archiving and the `impl-plans/README.md` index are done by the
workflow's archive and reconcile steps, not by workers.
