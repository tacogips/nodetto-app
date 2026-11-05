# sef-06 progress

Implemented marker writes in visual-patch.ts and add.ts, with focused edit and native parity tests. Dependencies are accepted by dispatch. Formal reviews remain downstream.

Current-source gates: edit suite 46 passed; compatibility suite 6 passed; typecheck and scoped Biome passed. Logs: tmp/sef-s733/sef-06-edit-box-align-writes/{edit-final2,compat-final,typecheck-final,biome-final}.log.

Native release build succeeded, but the required native parity test failed (0 passed, 1 failed): independent add runs generate different fractional indexes, so written bytes differ before export assertions. See tmp/sef-s733/sef-06-edit-box-align-writes/native.log. Editor defaults to Math.random in packages/core/src/editor/facade/core.ts:131, outside this plan's write scope. Exact add-document byte parity requires an approved deterministic indexing approach or an amended acceptance contract. Remaining native SVG, PNG and PDF assertions have not run. The planned test matrix also needs completion and verification before acceptance. No deadline was changed.

## Amendment completion

The amended add parity contract resolves the index blocker. Add records compare in order with only element indexes normalized and node before shape checked; update-only uses one serialized seed and raw byte equality. SVG parity, top/bottom PNG and PDF signatures, Bun/native PNG differences and native PDF differences all pass. The Bun PDF difference is intentionally omitted per amendment. The 60000 ms deadline remains unchanged.

Test mapping: add generic top and shape-preset bottom, reload and SVG positions: `add writes the marker`; unbound update, legacy stroke-only SVG compatibility, marker removal and null clearing: `update preserves legacy`; bound bottom detachment, typography and later update, marker-only style following, `updateTextStyle`, and explicit textStyle plus verticalAlign: `bound box detaches`; bound note and unknown-key rejection: `notes retain binding`. `box-label-compat.test.ts` also exercises legacy SVG identity. Native parity covers both box types, invalid style and exports.

Final shared-tree verification: `edit-final5.log` (46 passed), `compat-final5.log` (6 passed), `typecheck-final5.log` and `biome-final5.log` (exit 0), `native-final5.log` (release build and 1 test passed, 0 skipped). Logs are in `tmp/sef-s733/sef-06-edit-box-align-writes/`. `withBoxLabelAlign` is imported and invoked in add.ts. Earlier failed attempts remain historical evidence. Formal reviews and final serial verification are downstream.

## Test-integrity revisions

SEF6-TI-UPDATE-NOOP: the update seed is cleared through Bun and checked for both absent keys. Both runtimes write the requested value and marker, produce bytes different from the seed and identical to each other, then clear both keys on separate copies with identical bytes. Marked copies still feed SVG, PNG and PDF assertions. SEF6-TI-NULL-MARKER: the focused test restores and asserts the marker before clearing verticalAlign, then checks both keys, empty style and centered layout; the marker-only removal assertions remain.

Final shared-tree gates: `ti2-edit.log` (46 passed), `ti2-compat.log` (6 passed), `ti2-typecheck.log`, `ti2-biome.log`, `ti2-biome-focused.log` and `ti2-native.log` (1 passed, 0 skipped); all exit 0. The earlier `ti-typecheck-final.log` reported a test-helper type error, corrected by narrowing the alignment type. Formal re-review and serial integration remain downstream.
