# ipd-23 parity shapes progress

Plan blob before work: `0b89452d95ea0d7b767cfbdb1f10bb550d705ea9`. Evidence: `tmp/ipd-s772/ipd-23-parity-shapes/`. The initial attempt was incomplete; the continuation results below supersede it.

The engine build exited 0; `wc -c` exited 0 and measured 1,939,168 bytes, compared with the ipd-00 baseline of 1,007,675 bytes: **+931,493 bytes**. Logs: `final/engine.log`, `final/size.log`.

| Case | Result |
| --- | --- |
| Text layer | First edit byte comparison failed; remaining assertions not reached. |
| Geo | Not reached. |
| Controls | Not implemented. |
| Icons | Not reached. |
| Frames | Not implemented. |
| Layout operations | Not implemented. |

The first native parity run (`final/parity-attempt.log`, 0 pass, 1 fail) finds different serialized bytes after equivalent add operations. Random ordering keys are the likely cause; the assertion log does not identify the differing fields. `packages/core/src/editor/facade/core.ts` defaults the editor RNG to `Math.random` and creates a randomized fractional index for each element; `apps/cli/src/edit/operations/add.ts` does not pass an explicit index. The plan requires byte-identical output, forbids source fixes and changes to the harness, and these paths are outside its write scope. Reconciliation must decide how deterministic creation parity is to be achieved, then the complete matrix and final verification must be run. The test remains as a reproducer; no assertion was weakened. Formal review and integration are downstream.

The native release build exited 0 (`final/build.log`). The existing performance/export/MCP aggregate exited 0 (12 pass, 0 fail; `final/regression.log`); `bun run typecheck` and Biome check each exited 0 (`final/typecheck.log`, `final/biome.log`).

## Integration repair attempt

The test now runs add operations independently in Bun and native, checks sibling order using code-unit index order, normalizes only element indexes, and compares the remaining records. It adds underline and pill tab and multiline icon button fixtures. The focused test passes, but this does not complete the required matrix.

| Case | Current result and comparison mode |
| --- | --- |
| Text | Partial: normalized creation and same-seed SVG pass; linked-note warning and truncation remain. |
| Geo | Partial: normalized one-unit divider creation and SVG pass; stroke alignment, sides and PNG dimensions remain. |
| Controls | Partial: normalized creation and same-seed SVG pass; explicit rendered style assertions remain. |
| Icons | Partial: normalized search icon creation and lookup pass; draw and unknown-icon validation remain. |
| Frames | Not implemented. |
| Layout | Not implemented. |

Current repair logs: `final/build-repair.log` exit 0; `final/parity-repair-final2.log` 1 pass, 0 fail; `final/regression-repair.log` 12 pass, 0 fail; `final/biome-repair.log` and `final/typecheck-repair.log` exit 0. The earlier `final/parity-repair-final.log` failed because locale collation does not match fractional-index ordering; code-unit ordering corrected that issue. The original `final/parity-attempt.log` remains historical evidence. Bundle size remains 1,939,168 bytes, +931,493 versus baseline 1,007,675. Formal review is downstream.

## Continuation case results

| Case | Result and comparison mode |
| --- | --- |
| 1 Text | Pass: both draw hosts checked against expected element; same-seed SVG compares and includes ellipsis; linked-style update compares written bytes and warning. |
| 2 Geo | Pass: creation compares parsed records with only indexes normalized; same-seed SVG covers one-unit divider, inside/outside stroke and per-side stroke; scale-2 PNG dimensions match. Existing export parity checks PNG signatures rather than cross-host bytes. |
| 3 Controls | Pass: normalized creation and same-seed SVG cover underline and pill tabs, accent, start-aligned multiline icon button and badge. |
| 4 Icons | Pass: both draw hosts checked against expected search icon; same-seed SVG and lookup compare; unknown-icon validation warning compares. |
| 5 Frames | Pass: normalized creation compares explicit parent and containment auto-join; inspect relative coordinates and outside-title SVG compare. |
| 6 Layout | Pass: same-seed written bytes compare after parent and safe-area alignment, distribution, snap, layout and fill sizing; resulting geometry and sizing are asserted. |

Draw assigns random element IDs as well as indexes. Each host's generated element is checked against its expected type, semantic fields and position; SVG is compared from the same Bun-generated document. No ID is normalized in a document comparison. The add fixtures have explicit IDs and normalize only index while checking sibling order. The bundle remains 1,939,168 bytes, +931,493 versus 1,007,675 bytes at ipd-00 (`final/engine.log`, `final/size.log`).

Final continuation verification: `final/build-continuation.log` exit 0; `final/parity-continuation.log` 3 pass, 0 fail and 0 skip; `final/regression-continuation.log` 12 pass, 0 fail for the performance/export/MCP aggregate; `final/biome-continuation.log` and `final/typecheck-continuation.log` exit 0. Earlier failed experiments are retained under `final/matrix-attempt*.log`. Review and integration remain downstream.

Visual inspection: native CLI exported `final/visual.png` at 424x184 pixels (`final/visual-export.log`, exit 0). The thin divider is visible and the selected tab has the orange underline; labels A and B are legible. The generic fixture was created with the CLI (`final/visual-edit.log`, exit 0).
