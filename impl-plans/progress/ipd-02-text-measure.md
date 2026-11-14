# ipd-02 text measurement progress

Decision 1.2/1.4 implemented: standalone opt-in Liberation Sans proportional metrics, legacy estimate, word/grapheme wrapping, single-line ellipsis, and append-only API exports. Renderer integration belongs to downstream plans ipd-09 and ipd-12. Formal review and final integration remain downstream.

## Download audit

- Version: Liberation Fonts 2.1.5; official release URL: https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz
- Command: `curl -fL https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz -o tmp/ipd-s772/ipd-02-text-measure/fonts/liberation.tar.gz` (exit 0); SHA-256 `7191c669bf38899f73a2094ed00f7b800553364f90e2637010a69c0e268f25d0`.
- Initial guessed releases/download URL returned 404 (curl exit 56); the official release metadata identified the URL above.
- License: SIL OFL 1.1; attribution for ipd-03: Liberation Sans 2.1.5, copyright Red Hat, Inc. and Google Corporation, distributed under SIL Open Font License 1.1; license is in `packages/core/src/text-metrics/LICENSE-liberation-sans.txt`.

## Verification

- Focused Bun tests: 3 pass, 0 fail, 18 assertions; `final/test.log`.
- Two generator runs produce SHA-256 `d6b22038220d1ed0b83b8cb64a7279d096166d57136482d0b334f8a0fdc439c8`; `final/determinism.log`.
- Biome check exit 0; `final/biome.log`.
- License exists, generated file is 2372 bytes, and index has three matching export lines; `final/acceptance.log`.
- Workspace typecheck exit 2: `apps/cli/src/edit/operations/add.ts:130` has an incompatible visual argument, outside this plan's write scope; no diagnostic names this plan's files. `final/typecheck.log`. Requires sibling reconciliation and rerun.

Evidence paths above are relative to `tmp/ipd-s772/ipd-02-text-measure/`. Plan hash, per-edit intent, snapshots and source hashes are recorded there.

## Continuation 1

`bun run typecheck` passed (exit 0) on the current shared tree; complete log: `tmp/ipd-s772/ipd-02-text-measure/final/typecheck-continuation-1.log`. The earlier failed attempt remains recorded above as historical evidence. The required implementation checks have passed; formal review and stable integration verification remain downstream.
