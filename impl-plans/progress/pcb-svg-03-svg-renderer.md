# Progress: pcb-svg-03-svg-renderer

## Implementation

- Added `packages/core/src/svg-export/pcb-shapes.ts`; `renderPcbShape` serializes the shared `pcbViewModel` using `fmt`, preserves path/circle attribute order, splits 8-digit fills into `fill` and `fill-opacity`, and returns an empty string for an empty model.
- Added `pcb.*` dispatch immediately after the BPMN check in `packages/core/src/svg-export/shapes.ts`.
- Added collection of visible PCB boxes and one `data-layer="pcb-board"` rectangle after the optional page background in `packages/core/src/svg-export/document.ts`. Board bounds use the same visible boxes accumulated by `renderElementsSvg`; pages without a PCB box emit no board rectangle.
- Added self-authored fixture coverage in `packages/core/src/svg-export/pcb-shapes.test.ts` for PCB rendering, primitive parity, colors, alpha, board union/order/background/selection, hidden text/elements, determinism, and non-PCB pages.
- No CLI or desktop changes are part of this plan; all formats use the existing SVG string pipeline. Plan 04 owns CLI tests.

## Edit evidence

- `shapes.ts`: pre-edit SHA-256 `bb615f9557ca00427c7415ed8f53f9ae45b9ceda068ec25373dcd61036eee9fe`; fresh read and intended hunk recorded in `tmp/pcb-svg-s538/pcb-svg-03-svg-renderer/edit-01-source-intent.txt` and `edit-01-source-retry-intent.txt`.
- `document.ts`: pre-edit SHA-256 `44633da1389b91457eba4da4b7329141d13d7d0065b039eee59c26109d09de5a`; fresh read and intended hunk recorded in the same edit-intent files.
- `pcb-shapes.ts`: new file; intended behavior recorded in `edit-01-source-intent.txt`.
- `pcb-shapes.test.ts`: new file; intended behavior recorded in `edit-02-tests-intent.txt`. Attribute-order and empty-board dispatch assertions were added under `edit-05-coverage-intent.txt`; format-only changes were recorded in `edit-03-format-intent.txt` and `edit-06-format-intent.txt`, and applied to this file only.
- Current source SHA-256 values: `pcb-shapes.ts` `bbd3e4bc176b33b6c5140796df29ec1aaebd98b7753e33b6bbcbbeb2d40baf36`; `pcb-shapes.test.ts` `53de734760a493dd774d077fdbe6e39cc49a53d31ae56eb4c8d0b933215ff957`; `shapes.ts` `4b24e9ed54fd8128818a6231478de40b0248ff5a45e10814ee7adac5b88ef12a`; `document.ts` `83c301992f944a0412472cf0ff234c562f32d9966323423c1e1147acf19af9f6`.

## Verification

| Command | Exit | Result | Complete log |
| --- | ---: | --- | --- |
| `bun test packages/core/src/svg-export/pcb-shapes.test.ts` | 0 | 4 pass, 0 fail, 236 assertions; includes attribute order and empty board dispatch | `tmp/pcb-svg-s538/pcb-svg-03-svg-renderer/pcb-shapes-test-final2.log` |
| `bun test packages/core/src/svg-export.test.ts packages/core/src/breadboard/export-golden.test.ts packages/core/src/bpmn/svg-export-bpmn.test.ts packages/core/src/bpmn/svg-export-layers.test.ts packages/core/src/workspace-workflow.test.ts` | 0 | 67 pass, 0 fail, 343 assertions; protected golden/source files unchanged | `tmp/pcb-svg-s538/pcb-svg-03-svg-renderer/nonpcb-tests-final.log` |
| `git diff --exit-code packages/core/src/svg-export.test.ts packages/core/src/breadboard packages/core/src/bpmn packages/core/src/svg-export/basic-shapes.ts packages/core/src/svg-export/markup.ts packages/core/src/svg-export/theme.ts` | 0 | Protected files unchanged | `tmp/pcb-svg-s538/pcb-svg-03-svg-renderer/protected-diff-final.log` |
| `bun test packages/ui-solid/src/shapes/pcb-view.test.ts` | 0 | 4 pass, 0 fail, 15 assertions | `tmp/pcb-svg-s538/pcb-svg-03-svg-renderer/ui-pcb-test-final.log` |
| `bun run typecheck` | 0 | TypeScript check passed on the final test source | `tmp/pcb-svg-s538/pcb-svg-03-svg-renderer/typecheck-final2.log` |
| `bunx biome check packages/core/src/svg-export/pcb-shapes.ts packages/core/src/svg-export/pcb-shapes.test.ts packages/core/src/svg-export/shapes.ts packages/core/src/svg-export/document.ts` | 0 | Four changed source files clean on final source | `tmp/pcb-svg-s538/pcb-svg-03-svg-renderer/biome-final2.log` |
| `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess` | 2 | Existing workspace test/fixture diagnostics remain; this is not an unfiltered compiler pass. | `tmp/pcb-svg-s538/pcb-svg-03-svg-renderer/unchecked-tsc-final2.log` |
| Scoped grep for `svg-export/(pcb-shapes|shapes|document)` diagnostics in the full compiler log | 0 | No diagnostics in the changed SVG renderer files; the matched-errors log is empty. | `tmp/pcb-svg-s538/pcb-svg-03-svg-renderer/unchecked-owned-errors-final.log` |

The initial exact-file Biome check requested formatting for the new test file; it was format-corrected and all final behavioral, typecheck, and Biome gates above were rerun on the final source. The initial output is retained at `tmp/pcb-svg-s538/pcb-svg-03-svg-renderer/biome.log`. The second format-only update is documented in `edit-06-format-intent.txt`.

## Completion

- Renderer, dispatch, board rectangle, and assigned fixture tests are implemented.
- Plan 03 verification is complete. CLI export and native parity remain assigned to downstream plan `pcb-svg-04-cli-tests`.
