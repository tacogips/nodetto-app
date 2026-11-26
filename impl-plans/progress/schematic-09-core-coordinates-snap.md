# schematic-09-core-coordinates-snap progress

## Start (UTC)
2026-11-25T19:51:16.275197+00:00
Dependencies 03 and 08 accepted by dispatch; design sections 3.3 and 4.2 align. All four source paths absent before edit.

## Files
All four source files were absent before creation. Post-format hashes are recorded in `tmp/schematic-s933/schematic-09-core-coordinates-snap/post-format.sha256`; snap.ts was subsequently corrected with pre/post hashes in edit-006. Final hashes:

```text
0958a5ca3145f0a5f04bb571aeec11956ae12ba742dd7b676508f24de2a6890e  packages/core/src/schematic/coordinates.ts
311e2e56ee627c503e3bd55937795c5e690c15979563521757e143e25eb6a356  packages/core/src/schematic/coordinates.test.ts
d27d1342b593c0652123fbbc16ba1136ab8877023f787ca2b8bf23753917caa9  packages/core/src/schematic/snap.ts
439ca178ad51b04a720836918cddb0476743ea174d1f7af91327559e62ae4108  packages/core/src/schematic/snap.test.ts
```

## Commands
- `bun test packages/core/src/schematic/coordinates.test.ts packages/core/src/schematic/snap.test.ts`: exit 0, 5 passed, 0 failed; `tmp/schematic-s933/schematic-09-core-coordinates-snap/tests-final.log`.
- `bunx biome check packages/core/src/schematic/coordinates.ts packages/core/src/schematic/coordinates.test.ts packages/core/src/schematic/snap.ts packages/core/src/schematic/snap.test.ts`: exit 0; `tmp/schematic-s933/schematic-09-core-coordinates-snap/biome-final.log`.
- `bunx biome check --write` on the same four files: output in `tmp/schematic-s933/schematic-09-core-coordinates-snap/format.log`; shell status capture failed because zsh reserves `status`, but the final read-only Biome check passed.

## Drift
No concurrent edits observed in owned files; final hashes recorded above.

## Sibling diagnostics
No sibling gate was required by this plan. Dependencies 03 and 08 were accepted by dispatch.

## Open issues
None within this plan. Formal review and integration are downstream.

## Done checklist
- [x] Canonical move targets and per-field electrical keys implemented and tested.
- [x] Canonical anchors and schematic snap delta implemented and tested.
- [x] Focused tests and Biome passed on final source.
