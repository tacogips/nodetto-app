# Progress: pcb-svg-01-core-view-model

Status: implementation complete; ready for downstream review.

## Changes

- Added `packages/core/src/pcb-board/view.ts`, moving the pure PCB view model and layer colours into core. Added `PCB_BOARD_COLOR`, moved `isPcbLayerHidden`, and threaded the optional `num` formatter through all path-data number sites. Numeric primitive fields remain numbers.
- Added one explicit named export block in `packages/core/src/pcb-board/index.ts`; left `packages/core/src/index.ts` unchanged.
- Replaced `packages/ui-solid/src/shapes/pcb-view.ts` with core re-exports. `packages/ui-solid/src/pcb-state.ts` imports and re-exports core `isPcbLayerHidden` and otherwise retains its behavior.
- Canvas test and component files listed by the plan were not edited. The existing UI imports resolve through the adapters.

## Source hashes

| File | Pre-edit SHA-256 | Post-edit SHA-256 |
| --- | --- | --- |
| `packages/ui-solid/src/shapes/pcb-view.ts` | `5b89756514db991493de3a243bfedd28e0cb74918bb6d1491d931d09c91d6f49` | `8ac8a4783453975dabe3fd1db548d7c5e56def9eb2009b461dca7e11b039124b` |
| `packages/ui-solid/src/pcb-state.ts` | `7a322e5d474639bef230c972bdb8f878ab08de2deca9f6922b9f2a1fd14ccd70` | `2074c93c30e5cf3852edae691eb866df20162350fc2c73f3c417eac5009fcf76` |
| `packages/core/src/pcb-board/index.ts` | `b253060e7a662947070d63fb2f15070c4a559028cf7d5f8f7f2243fa44786e90` | `58c0ad864c775a229ec01b87b838b0160d40877ddc5a5e0c8b024cc53cbe7516` |
| `packages/core/src/pcb-board/view.ts` | moved from UI source hash above | `56428272b2600c3912a497b46533b3d17226b23c8e202955a7d81a1d93727ab1` |

Per-edit intentions and source identity are recorded in `tmp/pcb-svg-s538/pcb-svg-01-core-view-model/edit-intentions.md`.

## Verification

All logs are complete and stored under `tmp/pcb-svg-s538/pcb-svg-01-core-view-model/`.

| Command | Exit | Result / log |
| --- | ---: | --- |
| `bun test packages/ui-solid/src/shapes/pcb-view.test.ts packages/ui-solid/src/pcb-interaction.test.ts` | 0 | 15 passed, 0 failed; `ui-tests-final.log` (final-source rerun; 15 passed) |
| `bun test packages/core/src/pcb-board packages/core/src/pcb` | 0 | 121 passed, 0 failed; `core-tests-final.log` (final-source rerun; 121 passed) |
| `bun run typecheck` | 0 | passed; `typecheck-final.log` (final-source rerun; passed) |
| `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess` plus filter excluding test files and `apps/desktop/scripts/fixtures` | 2 (expected baseline diagnostics) | no remaining non-test/non-fixture TS errors; `tsc-unchecked.log` |
| `bunx biome check packages/core/src/pcb-board/view.ts packages/core/src/pcb-board/index.ts packages/ui-solid/src/shapes/pcb-view.ts packages/ui-solid/src/pcb-state.ts` | 0 | passed; `biome-final.log` |
| `git diff --exit-code packages/ui-solid/src/shapes/pcb-view.test.ts packages/ui-solid/src/shapes/PcbShapeView.tsx packages/ui-solid/src/pcb-overlay.ts packages/ui-solid/src/PcbLayersPanel.tsx packages/core/src/index.ts` | 0 | unchanged; `untouched-files.log` |
| `! grep -n 'ui-solid\\|solid-js\\|@nodetto/core' packages/core/src/pcb-board/view.ts` | 0 | no forbidden imports; `import-boundary.log` |
| `bun tmp/pcb-svg-s538/pcb-svg-01-core-view-model/num-scratch.ts` | 0 | fixture: 28 elements, 122 path strings, 0 values with more than one decimal; `num-scratch.log` |

The initial scoped Biome check found formatting differences, corrected with file-scoped Biome formatting, then the final scoped check passed. The scratch script had two setup errors (wrong import source and fixture-relative path), corrected before the passing current-source run. An initial shell wrapper used zsh's read-only `status` variable; it was superseded by the recorded passing focused run.

## Completion criteria

- Core exports all view-model symbols, including `PCB_BOARD_COLOR = "#2f4a3a"`; UI adapter re-exports the existing canvas API.
- Formatter applies to every generated path-data number; `cx`, `cy`, `r`, and `width` remain raw numeric fields.
- Canvas tests pass and specified UI files and `packages/core/src/index.ts` remain unedited.
- Typecheck, `noUncheckedIndexedAccess` non-test source filter, and scoped Biome checks meet the plan's expected results.

Open issues: none within Plan 01. Downstream renderer, docs, CLI, formal review and workflow finalization remain assigned to later workflow plans/steps.
