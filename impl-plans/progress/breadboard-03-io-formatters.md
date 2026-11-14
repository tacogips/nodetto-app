# breadboard-03-io-formatters progress

Plan: `impl-plans/active/breadboard-03-io-formatters.md`  
Workflow mode: issue-resolution  
Issue reference: no GitHub issue; workflow input "Circuit breadboard drawing mode (KiCad/Fritzing-inspired)".  
Codex agent reference: Step 6 implementation, plan `breadboard-03-io-formatters`.

## Implementation

- Added deterministic BOM CSV, KiCad S-expression and SPICE netlist formatters and exported the three functions plus the formatter result type from `@nodetto/io`.
- BOM output groups by type/value/description/footprint, sorts groups and references by `compareReferences`, and quotes CSV fields per RFC 4180.
- SPICE output maps GND to `0`, sanitizes node names, formats SI suffixes, supports potentiometer halves, transistor models, battery/IC/header output and open-button comments, and reports invalid values and reference warnings.
- D2 omits visible breadboard elements and emits exactly `Breadboard elements are not exported to D2.` once. A breadboard-only page does not also receive the generic empty-page warning. Mermaid keeps its empty-result convention for breadboard-only pages.
- Added the plan-required exact KiCad output assertion for two components and two multi-node nets, including both libsource records, footprints, nesting, and empty warnings. The separate escape and no-date assertions remain intact.
- No `@nodetto/core` imports were added. Existing files were changed additively.

## Completion criteria

- Three formatter functions and `BreadboardFormatterResult` are exported once from `packages/io/src/index.ts`: met.
- BOM contains components only through the `BreadboardNetlist` component model; BOM, KiCad, and SPICE output contracts have focused assertions: met.
- D2 uses the pinned warning exactly once; Mermaid has zero exported breadboard elements: met.
- Focused formatter tests, scoped G1, Biome, import-boundary, and ASCII checks pass: met.
- Current focused formatter and full `packages/io` suites pass. The latest workspace typecheck reports one sibling diagnostic in `packages/core/src/breadboard/editor-breadboard.test.ts`; plan 03 G1 is empty. That file is outside this plan's write paths and was not changed.

## Verification

All logs are complete and under `tmp/breadboard-mode-s485/breadboard-03-io-formatters/`.

| Command | Exit | Result / evidence |
| --- | ---: | --- |
| `bun test packages/io/src/breadboard` | 0 | 9 pass, 0 fail, 33 assertions; `focused-F03-TI-1.log` |
| `bun test packages/io` | 0 | 229 pass, 1 skip, 0 fail; `io-F03-TI-1.log` |
| `bun run typecheck` | 2 | One unused `element` import in sibling `packages/core/src/breadboard/editor-breadboard.test.ts`; `typecheck-F03-TI-1.log` |
| `! grep -E '^packages/io/src/breadboard/|^packages/io/src/d2/export\.ts' tmp/breadboard-mode-s485/breadboard-03-io-formatters/typecheck-F03-TI-1.log` | 0 | No plan-owned type diagnostics; `g1-F03-TI-1.log` |
| `bunx biome check packages/io/src/breadboard` | 0 | 6 files checked; `biome-F03-TI-1.log` |
| `! grep -rn '@nodetto/core' packages/io/src/breadboard` | 0 | No imports; `final-import-boundary.log` |
| `find packages/io/src/breadboard impl-plans/progress/breadboard-03-io-formatters.md -type f -print0 \| xargs -0 perl -ne 'if (/[^\\x00-\\x7F]/) { print "$ARGV:$.\\n"; $bad = 1 } close ARGV if eof; END { exit($bad ? 1 : 0) }'` | 0 | Owned source and progress files are ASCII; `final-ascii-owned-after-edit.log` |
| `git diff -U0 -- packages/io/src/d2/export.ts packages/io/src/index.ts \| perl -ne 'if (/^\\+(?!\\+\\+)/ && /[^\\x00-\\x7F]/) { print; $bad = 1 } END { exit($bad ? 1 : 0) }'` | 0 | Added lines are ASCII; `final-ascii-added.log` |
| `test "$(grep -c 'breadboard/index.ts' packages/io/src/index.ts)" -eq 1` | 0 | Export block appears once; `final-index-export.log` |
| `find packages/io/src/breadboard impl-plans/progress/breadboard-03-io-formatters.md -type f -print0 \| xargs -0 perl -ne 'if (/[^\\x00-\\x7F]/) { print "$ARGV:$.\\n"; $bad = 1 } close ARGV if eof; END { exit($bad ? 1 : 0) }'` | 0 | Current formatter and progress files are ASCII; `ascii-F03-TI-1.log` |

## Superseded attempt

The first focused run failed because D2 emitted its generic empty-page warning in addition to the breadboard warning. The warning condition was adjusted. Initial log: `focused.log` (exit 1, 7 pass, 1 fail). The earlier 8-test formatter run lacked the exact KiCad structure assertion and was superseded by `focused-F03-TI-1.log` (9 pass, 0 fail). The workspace typecheck failure is sibling-owned and remains visible above.
