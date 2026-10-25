# breadboard-13-ui-inspector progress

Status: implementation revision complete; assigned plan gates pass on the current shared source. Formal review, serial integration, exact-file staging and commit remain downstream workflow steps.

## Implemented

- Added E24 value suggestions and pure breadboard inspector helpers for pin/net rows and live/target cross-probes.
- Added the `BreadboardSection` for board size, wire color, part reference/value/parameters, resistor suggestions, rotation, pin probes, and the read-only target netlist card with part statuses and net nodes.
- Added the optional viewport callback to `InspectorProps`, type-specific inspector labels, and `breadboard.*` dispatch. `BpmnSection.tsx` is unchanged.
- Pin row probe buttons set the probe without changing selection. Select net, target part and target net actions use `focusBreadboardProbe`.
- Addressed `S7-13-WRITE-GUARD-01`: exported `writeBreadboardSemantic` catches only `CommandError` and returns false; other errors are rethrown. `BreadboardSection.write` retains its type guard and delegates semantic updates through the helper so rejected input returns to the stored value. Added a regression test for odd IC pin count, empty reference and a valid pin count update.

## Verification

Toolchain: `mise exec -- bun --version` -> `1.4.0` (exit 0; `tmp/breadboard-mode-s485/breadboard-13-ui-inspector/toolchain.log`).

- Pre-repair focused: `mise exec -- bun test packages/ui-solid/src/inspector/breadboard-edits.test.ts` -> 5 pass, 0 fail (exit 0; `tmp/breadboard-mode-s485/breadboard-13-ui-inspector/focused-current.log`).
- Pre-repair UI suite: `mise exec -- bun test packages/ui-solid` -> 505 pass, 0 fail (exit 0; `tmp/breadboard-mode-s485/breadboard-13-ui-inspector/ui-current.log`).
- Typecheck: `mise exec -- bun run typecheck` -> exit 0, no TypeScript diagnostics (`tmp/breadboard-mode-s485/breadboard-13-ui-inspector/typecheck-current.log`). G1 owner-scoped grep is clean.
- Biome: `mise exec -- bunx biome check packages/ui-solid/src/inspector/BreadboardSection.tsx packages/ui-solid/src/inspector/breadboard-edits.ts packages/ui-solid/src/inspector/breadboard-edits.test.ts packages/ui-solid/src/Inspector.tsx` -> exit 0 (`tmp/breadboard-mode-s485/breadboard-13-ui-inspector/biome-current.log`).
- `git diff --quiet -- packages/ui-solid/src/inspector/BpmnSection.tsx` -> exit 0 (unchanged).
- Inspector dispatch/label grep and ASCII sentinel, owned-file, and added-line gates are recorded under `tmp/breadboard-mode-s485/breadboard-13-ui-inspector/`.
- Repair reproduction: `mise exec -- bun -e '...updateBreadboardSemantic(D1, {...semantic, reference: ""})'` -> exit 1 with `CommandError` (expected pre-fix behavior; `tmp/breadboard-mode-s485/breadboard-13-ui-inspector/repro-before.log`).
- Current-source focused test: `mise exec -- bun test packages/ui-solid/src/inspector/breadboard-edits.test.ts` -> 6 pass, 0 fail, 20 expects (exit 0; `tmp/breadboard-mode-s485/breadboard-13-ui-inspector/focused-revision.log`).
- Current-source UI suite: `mise exec -- bun test packages/ui-solid` -> 506 pass, 0 fail, 3702 expects (exit 0; `tmp/breadboard-mode-s485/breadboard-13-ui-inspector/ui-revision.log`).
- Current-source typecheck: `mise exec -- bun run typecheck` -> exit 0, no TypeScript diagnostics (`tmp/breadboard-mode-s485/breadboard-13-ui-inspector/typecheck-revision.log`); G1 owner-scoped grep has no matches.
- Current-source Biome: exact four owned TS/TSX files checked -> exit 0 (`tmp/breadboard-mode-s485/breadboard-13-ui-inspector/biome-revision.log`).
- G1 guard: `if grep -E '^packages/ui-solid/src/inspector/(BreadboardSection\.tsx|breadboard-edits(\.test)?\.ts)|^packages/ui-solid/src/Inspector\.tsx|^error TS' tmp/breadboard-mode-s485/breadboard-13-ui-inspector/typecheck-revision.log; then exit 1; else echo 'G1 clean'; fi` -> exit 0 (`g1-revision.log`).
- Helper guard: `! grep -n 'updateBreadboardSemantic' packages/ui-solid/src/inspector/BreadboardSection.tsx` -> exit 0 (`guard-revision.log`).
- ASCII: whole-file Perl gate over the three owned TypeScript files and this progress log -> exit 0 (`fileascii-revision.log`); added-line Perl gate for `Inspector.tsx` -> exit 0 (`inspectorascii-revision.log`). Sentinel input `python3 -c "import sys; sys.stdout.buffer.write(bytes([43, 97, 194, 181, 10]))" | perl -ne 'if (/^\+(?!\+\+)/ && /[^\x00-\x7F]/) { print; $bad = 1 } END { exit($bad ? 1 : 0) }'` -> expected exit 1 (`sentinel-revision.log`).
- Repair source SHA-256 before -> after: `BreadboardSection.tsx` `089d3323ee96` -> `0dd826c4a572`; `breadboard-edits.ts` `b3b233db3a23` -> `33449469a62c`; `breadboard-edits.test.ts` `988e78be8797` -> `7f16d255fd38`. `BpmnSection.tsx` remains unchanged.

Earlier current-tree attempts found and resolved one unused type import, formatter output, and a misquoted ASCII harness. They are retained as `typecheck-final.log`, `biome-final.log`, and the first ASCII logs; the passing reruns above use the final source.

## Completion criteria

- `InspectorProps.viewport?: () => ViewportSize` is present and forwarded to `BreadboardSection`; viewport-aware host wiring remains with plan 17.
- The `breadboard.*` inspector match and labels for Breadboard, Part and Target netlist are present.
- The section edits allowed semantic fields, offers E24 suggestions, rotates parts, probes pin/net rows, and displays read-only target parts and nets.
- `BpmnSection.tsx` is unchanged; invalid semantic writes return false without changing stored values; valid pin count updates persist; focused tests pass with 6/0; G1 is clean; ASCII and progress-log gates pass.

## Deferred integration

Plan 17 owns passing the desktop viewport accessor to `Inspector`; this plan exposes the optional callback for that handoff. Serial integration still owns combined-tree gates and formal review.
