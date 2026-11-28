# Formal verification

The Lean models and statements are specified in [the formal verification design](../design-docs/specs/design-formal-verification.md). The kernel checks the statements; generated vectors provide evidence of model-to-code conformance, not a proof of it.

## Running

Run `mise install`, then `mise run prove`. The latter builds the Lean modules, audits statement signatures and dependencies, and checks vector freshness. The conformance tests run with `bun test`. To regenerate one vector file, use `cd formal && mise exec -- lake exe vectors-<file> > vectors/<file>.json` (for example, replace `<file>` with `fractional`).

## Statements

The specification column identifies the section and model; each theorem name describes its particular property. Proved means checked by the full audit.

| Statement | Specification section | Source function | Status |
| --- | --- | --- | --- |
| `keyBetween_between` | [6.1](../design-docs/specs/design-formal-verification.md) (Fractional) | `keyBetween` | proved |
| `keyBetween_below` | [6.1](../design-docs/specs/design-formal-verification.md) (Fractional) | `keyBetween` | proved |
| `keyBetween_above` | [6.1](../design-docs/specs/design-formal-verification.md) (Fractional) | `keyBetween` | proved |
| `keyBetween_unbounded` | [6.1](../design-docs/specs/design-formal-verification.md) (Fractional) | `keyBetween` | proved |
| `keyBetween_rejects_lower` | [6.1](../design-docs/specs/design-formal-verification.md) (Fractional) | `keyBetween` | proved |
| `keyBetween_rejects_upper` | [6.1](../design-docs/specs/design-formal-verification.md) (Fractional) | `keyBetween` | proved |
| `keyBetween_rejects_inverted` | [6.1](../design-docs/specs/design-formal-verification.md) (Fractional) | `keyBetween` | proved |
| `keyAfter_gt` | [6.1](../design-docs/specs/design-formal-verification.md) (Fractional) | `keyAfter` | proved |
| `keyAfter_valid` | [6.1](../design-docs/specs/design-formal-verification.md) (Fractional) | `keyAfter` | proved |
| `keyAfter_none_valid` | [6.1](../design-docs/specs/design-formal-verification.md) (Fractional) | `keyAfter` | proved |
| `targetOrder_perm` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `targetOrder` | proved |
| `targetOrder_selected_order` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `targetOrder` | proved |
| `targetOrder_unselected_order` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `targetOrder` | proved |
| `targetOrder_front_idem` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `targetOrder` | proved |
| `targetOrder_back_idem` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `targetOrder` | proved |
| `targetOrder_all_selected` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `targetOrder` | proved |
| `relativeOrder_perm` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `relativeOrder` | proved |
| `relativeOrder_moved_order` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `relativeOrder` | proved |
| `relativeOrder_unmoved_order` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `relativeOrder` | proved |
| `relativeOrder_no_anchor` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `relativeOrder` | proved |
| `relativeOrder_before` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `relativeOrder` | proved |
| `relativeOrder_after` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `relativeOrder` | proved |
| `reorderCommands_refuses` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `reorderCommands` | proved |
| `reorderCommands_unchanged` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `reorderCommands` | proved |
| `reorderCommands_spec` | [6.2](../design-docs/specs/design-formal-verification.md) (ZOrder) | `reorderCommands` | proved |
| `writeVarint_bytes` | [6.3](../design-docs/specs/design-formal-verification.md) (Nmesh) | `writeVarint` | proved |
| `readVarint_writeVarint` | [6.3](../design-docs/specs/design-formal-verification.md) (Nmesh) | `readVarint`, `writeVarint` | proved |
| `readVarint_canonical` | [6.3](../design-docs/specs/design-formal-verification.md) (Nmesh) | `readVarint` | proved |
| `readVarint_truncated` | [6.3](../design-docs/specs/design-formal-verification.md) (Nmesh) | `readVarint`, `writeVarint` | proved |
| `unzigzag_zigzag` | [6.3](../design-docs/specs/design-formal-verification.md) (Nmesh) | `unzigzag`, `zigzag` | proved |
| `zigzag_unzigzag` | [6.3](../design-docs/specs/design-formal-verification.md) (Nmesh) | `zigzag`, `unzigzag` | proved |
| `decodeIndices_encodeIndices` | [6.3](../design-docs/specs/design-formal-verification.md) (Nmesh) | `decodeIndices`, `encodeIndices` | proved |
| `encodeIndices_decodeIndices` | [6.3](../design-docs/specs/design-formal-verification.md) (Nmesh) | `encodeIndices`, `decodeIndices` | proved |
| `fromInline_toInline` | [6.3](../design-docs/specs/design-formal-verification.md) (Nmesh) | `fromInline`, `toInline` | proved |
| `decodeNmesh_encodeNmesh` | [6.3](../design-docs/specs/design-formal-verification.md) (Nmesh) | `decodeNmesh`, `encodeNmesh` | open |
| `parseTsv_serializeTsv` | [6.4](../design-docs/specs/design-formal-verification.md) (Tsv) | `parseTsv`, `serializeTsv` | proved |
| `tsv_trailing_empty_row_lost` | [6.4](../design-docs/specs/design-formal-verification.md) (Tsv) | `parseTsv`, `serializeTsv` | proved |
| `tsv_only_empty_row_lost` | [6.4](../design-docs/specs/design-formal-verification.md) (Tsv) | `parseTsv`, `serializeTsv` | proved |
| `tsv_inner_empty_row_reads_as_empty_field` | [6.4](../design-docs/specs/design-formal-verification.md) (Tsv) | `parseTsv`, `serializeTsv` | proved |
| `rotate_anchor_snapped` | [6.5](../design-docs/specs/design-formal-verification.md) (Rotate) | `rotatePoint`, anchored rotation | proved |
| `rotate_anchor_fixed` | [6.5](../design-docs/specs/design-formal-verification.md) (Rotate) | `rotatePoint`, anchored rotation | proved |
| `rotate_pins_on_lattice` | [6.5](../design-docs/specs/design-formal-verification.md) (Rotate) | `rotatePoint`, anchored rotation | proved |
| `rotate_cw_ccw` | [6.5](../design-docs/specs/design-formal-verification.md) (Rotate) | `rotatePoint`, anchored rotation | proved |
| `rotate_ccw_cw` | [6.5](../design-docs/specs/design-formal-verification.md) (Rotate) | `rotatePoint`, anchored rotation | proved |
| `rotate_four` | [6.5](../design-docs/specs/design-formal-verification.md) (Rotate) | `rotatePoint`, anchored rotation | proved |
| `undo_then_redo` | [6.6](../design-docs/specs/design-formal-verification.md) (Undo) | `undo`, `redo` | proved |
| `redo_then_undo` | [6.6](../design-docs/specs/design-formal-verification.md) (Undo) | `undo`, `redo` | proved |
| `push_clears_redo` | [6.6](../design-docs/specs/design-formal-verification.md) (Undo) | `push` | proved |
| `push_empty` | [6.6](../design-docs/specs/design-formal-verification.md) (Undo) | `push` | proved |
| `abortBatch_keeps_stacks` | [6.6](../design-docs/specs/design-formal-verification.md) (Undo) | `abortBatch` | proved |
| `batch_one_step` | [6.6](../design-docs/specs/design-formal-verification.md) (Undo) | `beginBatch`, `endBatch` | proved |
| `batch_noop` | [6.6](../design-docs/specs/design-formal-verification.md) (Undo) | `beginBatch`, `endBatch` | proved |
| `abortBatch_reverts` | [6.6](../design-docs/specs/design-formal-verification.md) (Undo) | `abortBatch` | proved |
| `batch_inverts` | [6.6](../design-docs/specs/design-formal-verification.md) (Undo) | `beginBatch`, `endBatch` | proved |
| `applyCommands_undo` | [6.6](../design-docs/specs/design-formal-verification.md) (Undo) | `applyCommands` | proved |
| `mergeValue_unchanged_ours` | [6.7](../design-docs/specs/design-formal-verification.md) (Merge) | `mergeValue` | proved |
| `mergeValue_unchanged_theirs` | [6.7](../design-docs/specs/design-formal-verification.md) (Merge) | `mergeValue` | proved |
| `mergeValue_same_change` | [6.7](../design-docs/specs/design-formal-verification.md) (Merge) | `mergeValue` | proved |
| `mergeValue_symm` | [6.7](../design-docs/specs/design-formal-verification.md) (Merge) | `mergeValue` | proved |
| `mergeValue_conflict_iff` | [6.7](../design-docs/specs/design-formal-verification.md) (Merge) | `mergeValue` | proved |
| `mergeById_unchanged_ours` | [6.7](../design-docs/specs/design-formal-verification.md) (Merge) | `mergeById` | proved |
| `mergeById_unchanged_theirs` | [6.7](../design-docs/specs/design-formal-verification.md) (Merge) | `mergeById` | proved |
| `mergeById_same_change` | [6.7](../design-docs/specs/design-formal-verification.md) (Merge) | `mergeById` | proved |
| `mergeById_symm` | [6.7](../design-docs/specs/design-formal-verification.md) (Merge) | `mergeById` | proved |
| `mergeById_conflict_iff` | [6.7](../design-docs/specs/design-formal-verification.md) (Merge) | `mergeById` | proved |
| `sweep_visits_overlaps` | [6.8](../design-docs/specs/design-formal-verification.md) (Overlap) | `overlappingPairs` | proved |
| `overlappingPairs_sweep` | [6.8](../design-docs/specs/design-formal-verification.md) (Overlap) | `overlappingPairs` | proved |
| `treeSearch_visits_overlaps` | [6.8](../design-docs/specs/design-formal-verification.md) (Overlap) | `overlappingPairs` | open |
| `overlappingPairs_visits_overlaps` | [6.8](../design-docs/specs/design-formal-verification.md) (Overlap) | `overlappingPairs` | open |
| `cad_type_only_on_cad3d` | [6.9](../design-docs/specs/design-formal-verification.md) (CadEnclosure) | `pageAcceptsElementType` | proved |
| `cad3d_accepts_resource` | [6.9](../design-docs/specs/design-formal-verification.md) (CadEnclosure) | `pageAcceptsElementType` | proved |
| `cad3d_rejects_non_cad_non_resource` | [6.9](../design-docs/specs/design-formal-verification.md) (CadEnclosure) | `pageAcceptsElementType` | proved |
| `shell_inner_strictly_inside` | [6.9](../design-docs/specs/design-formal-verification.md) (CadEnclosure) | `computeShellSpec` | proved |
| `shell_wall_margins` | [6.9](../design-docs/specs/design-formal-verification.md) (CadEnclosure) | `computeShellSpec` | proved |
| `shell_cavity_bounds` | [6.9](../design-docs/specs/design-formal-verification.md) (CadEnclosure) | `computeShellSpec` | proved |
| `shell_radius_safe` | [6.9](../design-docs/specs/design-formal-verification.md) (CadEnclosure) | `computeShellSpec` | proved |
| `pcb_enclosure_clearance` | [6.9](../design-docs/specs/design-formal-verification.md) (CadEnclosure) | `computePcbEnclosureDims` | proved |
| `pcb_enclosure_vertical_stack` | [6.9](../design-docs/specs/design-formal-verification.md) (CadEnclosure) | `computePcbEnclosureDims` | proved |

## Trust assumptions

The trusted base is the Lean 4.36.0 kernel and `propext`, `Classical.choice`, and `Quot.sound`. Bridging assumptions, detailed in design section 3, are:

- B1: JavaScript strings use UTF-16 code units; list-of-unit or fixed-width hex encoding preserves equality and ordering, including lone surrogates.
- B2: Fractional random draws model every reachable offset; vector draws use exact multiples of 2^-20.
- B3: Rotation uses doubled integer coordinates within the stated half-pitch and magnitude domain; rounding agrees with the model.
- B4: NMESH bytes are below 256 and integer coordinates are within ±10^7.
- B5: Merge numbers are integers of magnitude below 2^53, arrays contain no undefined values, and own enumerable members and canonical equality match the model.
- B6: Overlap bounds are integers within half the JavaScript maximum safe integer.
- B7: JavaScript sort with a strict total comparator returns the same unique sorted order as the model.
- B8: Undo models ids and one integer value, with presence-dependent failures only; validation, references, cascades and pages are outside it.

## Findings and decisions

- D1: TSV zero-field rows do not round-trip. The specification is restricted to rows with fields; `packages/core/src/table-sheet/delimited.test.ts` characterizes the exceptions.
- D2: Merge equality and inherited member handling were corrected with canonical JSON and own-member reads and writes. Regressions are in `packages/core/src/document-merge.test.ts` and the merge conformance test.
- D3: Z-order now rejects duplicate target ids; `packages/core/src/z-order.test.ts` covers the refusal.
- D4: Rotation's inverse property requires a lattice anchor; the design states that hypothesis and the general snap behavior. Rotation conformance is in `packages/core/src/breadboard/rotate.formal.test.ts`.
- D5: An unchanged z-order emits no commands, so tied keys can remain tied. The specification separates unchanged and moved cases; z-order conformance is in `packages/core/src/z-order.formal.test.ts`.
- D6: A NaN random draw now selects the lowest offset; `packages/core/src/fractional.test.ts` covers valid, absent and foreign bounds.
- D7: Fractional midpoint descent is iterative to avoid stack overflow on long keys; `packages/core/src/fractional.test.ts` covers long bounds.

## Open

- `decodeNmesh_encodeNmesh`: whole-payload NMESH encode/decode round trip.
- `treeSearch_visits_overlaps`: segment-tree search visits overlapping boxes.
- `overlappingPairs_visits_overlaps`: overlap enumeration visits all overlapping pairs in the tree branch.

## What is not proved

Everything outside the models, including the open statements above: `planZOrder` and `planElementOrder`; element validation, references and pages in `applyCommands`; `canonicalize`; `inspectNmesh`; IEEE conformance of `crc32` beyond the vector check `123456789` → `0xCBF43926`; `parseCsv`; floating-point behavior of `rotatePoint`; history listeners; and record filtering and integrity passes of `mergeDocuments`.

All of `mergeDocumentVersions`, including its recursive `value` and `records` routines, nested both-added policy and conflict reporting, is outside the proofs. For example, when both sides add page `q` with extensions `{ours: 1}` and `{theirs: 2}`, live `mergeDocuments` keeps ours and reports `both-changed`, whereas `mergeDocumentVersions` keeps both fields without conflict.

## Known limitations of the conformance evidence

- The `mergeById` conformance test compares records through a `Map`; output order and duplicate ids are not checked, though conflicts are compared exactly.
- NMESH vectors meet the minimum case counts but cover boundary categories with few cases each.
