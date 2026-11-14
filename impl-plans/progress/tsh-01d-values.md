# tsh-01d-values progress

- Mode: issue-resolution, session 780. Issue: runtime workflow input; no issue reference.
- Plan snapshot: `4627bfa6fadfd285cb015700af186ab044103a31`. No dependencies; design sections 6 and 8 match the plan.
- Implemented typed coercion, stored-value clipboard, immutable cell edits and retyping, column naming and insertion, atomic grid paste and strict grid import. The six owned source and test files are complete.
- Edit intentions, fresh snapshots, and hashes are retained under `tmp/tsh-s780/tsh-01d-values/`. Formatting was scoped to owned files. The hash records below are pre/post, with format hashes listed in file order.

- `coerce.test.ts.hash`: `absent 97bc00ba6898d05f8081911d10af3ae85bd27534`
- `coerce.ts.hash`: `absent 1c539e61c1c5445142935f3accc98f3c90515011`
- `columns.test.ts.hash`: `absent af08b7e426c64fd7422523b78119e262c50e2dcd`
- `columns.ts.hash`: `absent 0d84b3ab07c60aacac310d1c9bcf5aad6e3c62a1`
- `grid.test.ts.hash`: `absent 421b31d4ad8caf2b1a49ba20c264aba0d8822934`
- `grid.ts.hash`: `absent 2a968f255b556b6dda7207786fdb139ac6a0a17c`
- `format-hashes.log`: `1c539e61c1c5445142935f3accc98f3c90515011 / 97bc00ba6898d05f8081911d10af3ae85bd27534 / 0d84b3ab07c60aacac310d1c9bcf5aad6e3c62a1 / af08b7e426c64fd7422523b78119e262c50e2dcd / 2a968f255b556b6dda7207786fdb139ac6a0a17c / 421b31d4ad8caf2b1a49ba20c264aba0d8822934 / 06531b0eb060c7940f7d2d32359ff4fd981f3a5a / 87cfe2d2c0cbb43e929c6f6036cc6ee9099febfe / d4a7e42295a0ab1f9b6795e30382f2428d9d3547 / 2eda90f85874ab700b9f50f55ceb874d442434a4 / 8840110dbadd8e3a47950a526e7d003be00ddf1f / 0b86091137cb5169ac54f3f435b3225f5d262e4f`
- `coerce-repair-hash`: `06531b0eb060c7940f7d2d32359ff4fd981f3a5a / d960364ebaa0609c24e55ba9421d1f0edba51602`
- `coerce-type-hash`: `2d666a0b5525239b3a32736d48a02ccad9c32418 / 668423f7809d8d1e6d72bc3b5f92a4059b1cb73d`
- `grid-repair-hash`: `8840110dbadd8e3a47950a526e7d003be00ddf1f / dc88923659a754a60323eb68c9eef73dec8ad586`

## Completion criteria

- [x] Pinned exports and Column N behavior implemented.
- [x] `bun test ./packages/core/src/table-sheet/coerce.test.ts ./packages/core/src/table-sheet/columns.test.ts ./packages/core/src/table-sheet/grid.test.ts`: exit 0, 28 passed, 0 failed, 0 skipped; `final/values.log`.
- [x] `grep -n 'from "\./' packages/core/src/table-sheet/coerce.ts packages/core/src/table-sheet/columns.ts packages/core/src/table-sheet/grid.ts`: exit 0; `final/imports.log`. Only sibling-owned imports are type-only `./types.ts`; `./coerce.ts` and `./columns.ts` belong to this plan.
- [x] `bunx biome check packages/core/src/table-sheet/coerce.ts packages/core/src/table-sheet/coerce.test.ts packages/core/src/table-sheet/columns.ts packages/core/src/table-sheet/columns.test.ts packages/core/src/table-sheet/grid.ts packages/core/src/table-sheet/grid.test.ts --diagnostic-level=warn`: exit 0; `final/biome.log`.
- [x] `bun run typecheck`: exit 0; `final/typecheck.log`.
- [x] Author self-check complete. Checks ran on a moving shared tree; final integration verification and independent reviews remain downstream.
