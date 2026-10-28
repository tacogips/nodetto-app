# appearance-01-preferences progress

## Intent snapshot
Implemented the persisted appearance preference fields and DOM-light resolution helpers for plans 01/06. The three preferences default to system/light/dark, each invalid stored key falls back independently, the storage key and prior parsing paths remain unchanged, and appearance helpers expose the pinned plan contract. Tests cover the plan's defaults, migration, malformed/blocked storage, round trip, resolution, root update, option ordering, and listener disposal cases.

Pre-edit hashes are recorded in `tmp/canvas-theme-s539/appearance-01-preferences/edit-intents.md`; the native pre-node snapshot is `tmp/riela-fanout/BD3B4159-DCEA-40B1-88A7-A01406898D87/D7DDE276-DE1A-4DE8-A25F-B6245E2BF23F.json`.

## Changes and hashes
- `apps/desktop/src/settings/appearance.ts`: created; post-edit SHA-256 `76da55dbbb1b0d141c88dda11f18f7e47e65ebe357ffb4798dfc35e82179054b`.
- `apps/desktop/src/settings/appearance.test.ts`: created; post-edit SHA-256 `4f2c4abd581ecf94e5096af66b8afd20e5c9e3f4bb082c8d142ee0e7c7bc0a78`.
- `apps/desktop/src/settings/preferences.ts`: pre-edit `89d9bcebfa4d29f4c499e8a2d2a7e779d811d935da922cf4d3887ba92b9c0b55`; post-edit `8e6e40f4b70d08f66fc035a28c34d38a34c9ac575014d1f52796e2e5cc544869`.
- `apps/desktop/src/settings/preferences.test.ts`: pre-edit `a46b443e496f24a6927025e69796b66fa562dea468099b894b745d54365d7a3d`; post-edit `542bb11632defd2a3a3fdec0f0e2467ea6bdc15aa035022da114f546ffb252a4`.
- `impl-plans/progress/appearance-01-preferences.md`: pre-update `57f4f461b3267c273d4eec709b418cb047cabac89090666129f86cc7fcd6e25d`; post-update hash recorded after this edit.
- New-file pre-edit state was absent in both the current tree and the dispatch snapshot. Per-edit intentions and exact behavior are in `tmp/canvas-theme-s539/appearance-01-preferences/edit-intents.md`.

## Verification
- `bun test apps/desktop/src/settings > tmp/canvas-theme-s539/appearance-01-preferences/test.log 2>&1`: exit 0; 14 pass, 0 fail, 65 assertions; complete log `tmp/canvas-theme-s539/appearance-01-preferences/test.log`.
- `bunx biome format --write apps/desktop/src/settings/appearance.ts apps/desktop/src/settings/appearance.test.ts apps/desktop/src/settings/preferences.ts apps/desktop/src/settings/preferences.test.ts > tmp/canvas-theme-s539/appearance-01-preferences/format.log 2>&1`: exit 0; targeted formatting only; complete log `tmp/canvas-theme-s539/appearance-01-preferences/format.log`.
- `bunx biome check apps/desktop/src/settings/appearance.ts apps/desktop/src/settings/appearance.test.ts apps/desktop/src/settings/preferences.ts apps/desktop/src/settings/preferences.test.ts --diagnostic-level=warn > tmp/canvas-theme-s539/appearance-01-preferences/biome.log 2>&1`: exit 0; four files checked, no fixes; complete log `tmp/canvas-theme-s539/appearance-01-preferences/biome.log`.
- `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/canvas-theme-s539/appearance-01-preferences/unchecked.log 2>&1`: exit 2 (expected repository-wide baseline errors); 92 errors versus 91 at baseline, none match `apps/desktop/src/settings/appearance|preferences`. The additional diagnostic is in plan-06-owned `apps/desktop/src/App.tsx:207` because its preference object has not yet been wired with the new fields. The settings-path filter passed; log `tmp/canvas-theme-s539/appearance-01-preferences/unchecked-settings-scope.log`.
- `bun run typecheck > tmp/canvas-theme-s539/appearance-01-preferences/typecheck.log 2>&1`: exit 2; pending-join for plan-06 wiring. The sole error is `apps/desktop/src/App.tsx:207` missing the three new preference fields; do not count as a pass until serial reconciliation reruns it. Complete log `tmp/canvas-theme-s539/appearance-01-preferences/typecheck.log`.
- Contract grep checks (four exported functions, one PCB dark default, and nonempty progress file): exit 0; complete log `tmp/canvas-theme-s539/appearance-01-preferences/contract-check.log`.
- An initial Biome check found formatting differences in two owned files (exit 1); both were fixed with the targeted formatter above and the final Biome check passes. The complete superseded diagnostic is preserved at `tmp/canvas-theme-s539/appearance-01-preferences/biome-initial.log`.

No Cargo commands were needed. No files outside the assigned write paths were edited by this plan.

STATUS: done

## Integration-review redispatch
- Verified the SHA-256 values of all four plan 01 source and test files still match the final hashes above; no source drift found.
- `bun test apps/desktop/src/settings > tmp/canvas-theme-s539/appearance-01-preferences/test-redispatch.log 2>&1`: exit 0; 14 pass, 0 fail, 65 assertions.
- `bun run typecheck > tmp/canvas-theme-s539/appearance-01-preferences/typecheck-redispatch.log 2>&1`: exit 2; the only diagnostic is `apps/desktop/src/App.tsx(207,7)` TS2345, a plan-06-owned call site. This remains pending-join for `appearance-06-desktop-wiring`, not a plan 01 blocker or passing typecheck.
- `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/canvas-theme-s539/appearance-01-preferences/unchecked-redispatch.log 2>&1`: exit 2; repository diagnostics remain outside plan 01. `test "$(grep -c 'apps/desktop/src/settings/' tmp/canvas-theme-s539/appearance-01-preferences/unchecked-redispatch.log)" -eq 0`: exit 0; no settings-scope diagnostics.
- Review evidence file: `tmp/canvas-theme-s539/appearance-01-preferences/intent-integration-review-redispatch.md`.

STATUS: done
