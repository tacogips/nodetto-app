# Progress: breadboard-pcb-02-legend-clip

## Intent and scope

Implemented the plan's pure legend geometry module and focused tests only. The
module exports `LegendRect`, `LegendKeepout`, `clipLegendStroke`, and
`boxClearOfKeepouts`; it imports only the `PcbPoint` type from `gerber.ts`.
Rectangle clipping uses Liang-Barsky, circular open interiors are removed
with quadratic intervals and merged before subtraction, retained segments
rejoin only at original vertices, and the minimum-length filter applies only
to strokes with cut ends. Uncut polylines return the original input array
unchanged. Zero-length segments are retained only when clear and in bounds.

The tests cover untouched 1/6 mm glyph geometry, cuts and rejoining, minimum
length, rectangle borders, fully removed and zero-length segments, overlapping
keepouts, tangent cases, and box clearance boundaries.

## Source identity

Final SHA-256:

- `packages/core/src/breadboard/pcb-legend.ts`:
  `578925ef0a21c5684ee08b87f5176cce405135ceb85eb3ecddbcdced28871063`
- `packages/core/src/breadboard/pcb-legend.test.ts`:
  `9024a9ae93c8a26a8816ee1e2e684263bc029dfb2bfd607d00118c33f1900cdd`

## Verification

| Command | Exit | Evidence |
| --- | ---: | --- |
| `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/breadboard/pcb-legend.test.ts` | 0 | `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/test-final2.log`; 11 tests, 0 failures |
| `bunx biome check packages/core/src/breadboard/pcb-legend.ts packages/core/src/breadboard/pcb-legend.test.ts --diagnostic-level=warn` | 0 | `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/biome-final2.log` |
| `bun run typecheck` | 2 | `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/typecheck-final.log`; remaining diagnostic is sibling-owned `packages/core/src/breadboard/fabrication-validate.test.ts:40` (string passed where `FabricationOutline` is expected). No diagnostic references either owned legend file. |
| `bunx tsc -p tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/tsconfig.nuia.json` | 2 | `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/nuia-final.log`; repository test diagnostics remain in other files, and none reference `pcb-legend`. |
| `! grep -E '^packages/core/src/breadboard/pcb-legend' tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/typecheck-final.log && ! grep -n 'pcb-legend' tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/nuia-final.log && ! grep -nE 'Math\.(hypot|sin|cos|atan2|tan)' packages/core/src/breadboard/pcb-legend.ts && ! grep -nE 'from ["\x27](node:|.*dom)' packages/core/src/breadboard/pcb-legend.ts && git diff --quiet 431bfdb -- packages/core/src/breadboard/pcb.ts packages/core/src/breadboard/gerber.ts packages/core/src/breadboard/pcb-font.ts packages/core/src/breadboard/index.ts packages/core/src/geometry.ts` | 0 | `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/constraints.log`; combined scope/import/geometry/dependency drift checks. |

The initial focused test attempt exposed an out-of-segment circle interval and
zero-length handling issue; these were corrected. The next noUncheckedIndexedAccess
run exposed unchecked numeric reads in this plan's test expectation; those were
replaced with named points. Superseded logs: `test.log` (3 failures),
`biome.log` (formatting only), and `nuia.log` (one plan-owned test diagnostic
plus repository baseline diagnostics). Final-source verification is listed
above.

## Completion

The assigned geometry and test contract is implemented. Workspace typecheck
remains blocked only by sibling-owned validator test work in the shared wave;
this plan did not edit that path. The noUncheckedIndexedAccess compilation
also reports pre-existing diagnostics in unrelated repository tests, with no
diagnostic in the assigned module or tests. Serial reconciliation can rerun
the workspace gates after sibling integration.

## Current-source rerun (Step 6 continuation)

The files were re-hashed before this refresh; no source edits were made during
this continuation. Current evidence:

| Command | Exit | Evidence |
| --- | ---: | --- |
| `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/breadboard/pcb-legend.test.ts` | 0 | `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/test-current.log`; 11 tests, 0 failures |
| `bunx biome check packages/core/src/breadboard/pcb-legend.ts packages/core/src/breadboard/pcb-legend.test.ts --diagnostic-level=warn` | 0 | `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/biome-current.log` |
| `bun run typecheck` | 0 | `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/typecheck-current.log` |
| `bunx tsc -p tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/tsconfig.nuia.json` | 2 | `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/nuia-current.log`; diagnostics are in repository tests outside the assigned legend files, and the `pcb-legend` filter is empty. |

The workspace typecheck drift recorded above is resolved on the current shared
tree. The stricter whole-core `noUncheckedIndexedAccess` check still exposes
unrelated pre-existing test diagnostics; no diagnostic names either assigned
legend file. This plan's own acceptance checks remain met.
## Final static checks

- Command: `rg -n '^(export (interface|function)|import)' packages/core/src/breadboard/pcb-legend.ts` plus forbidden-math/import and NUIA-owned-diagnostic filters. Exit 0; evidence: `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/constraints-current.log`. The module has exactly the four pinned exports, only the type import from `gerber.ts`, no forbidden math or node/DOM imports, and no assigned-file NUIA diagnostic.
