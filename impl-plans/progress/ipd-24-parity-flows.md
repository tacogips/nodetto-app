# ipd-24 parity flows progress

Implementation is incomplete. The first successful compare PNG byte assertion fails between Bun and native; product code belongs outside this plan. The test retains the assertion for review. See `tmp/ipd-s772/ipd-24-parity-flows/final/parity-attempt-02.log` (1 pass, 1 fail, 43 assertions). The earlier 2-pass attempt predates that assertion and is not final verification.

| Case | Result | Remaining work |
| --- | --- | --- |
| Kit | Partial: discovery and detail parity pass; 16 rows asserted | Insert all 16, property update, and non-kit error parity |
| Prototype | Partial: shared CLI-created fixture, flow inspect and SVG parity pass; invalid element rejected | Independently exercise connect edits and compare documents |
| Lint | Not implemented | DR-02 text and hotspot context, clean kit |
| Frames export | Partial: both hosts export matching names and PNG dimensions | Compare associated SVGs and command outputs |
| Compare | Fails: single-file PNG bytes differ between hosts | Investigate owning implementation; verify directory mode and invalid band |
| HTML prototype | Pass: output file bytes equal between hosts | None |

`CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli` exited 0 (`final/build.log`); `bunx biome check apps/cli/src/native-parity/app-design-flows.test.ts` exited 0 (`final/biome.log`); `bun run typecheck` exited 0 (`final/typecheck.log`). The required native parity test exits 1 (`final/parity-attempt-02.log`). Final review and integration are downstream.

## Redispatch 2026-11-10: round-12 work remains incomplete

| Case | Current result |
| --- | --- |
| Kit | Discovery passes. Added 16 insertion cases and property cases, but the first insertion fails before completion because generated IDs differ across hosts in `compareFile` stdout. |
| Prototype | Added edit parity assertion; it fails because generated connector IDs differ across hosts. |
| Lint | DR-02 and clean-kit parity cases remain to implement. |
| Frames export | Decoded RGBA equality added; not reached in the latest run. |
| Compare | Decoded RGBA equality added for single and directory output; not reached in the latest run. |
| HTML prototype | Existing assertion remains; not reached in the latest run. |

The current parity test exits 1 with 1 pass and 2 failures (`final/parity-final.log`); generated identifiers prevent the specified exact `compareFile` contract from reaching the intended assertions. Reconcile deterministic or normalized comparison ownership before continuing. The release build, scoped Biome check and typecheck exit 0 (`final/build-rerun.log`, `final/biome-final.log`, `final/typecheck-final.log`). Formal reviews and integration remain downstream.

## Redispatch 2026-11-10: round-13 randomized index blocker

| Case | Result |
| --- | --- |
| ID normalization | Partial: ID-masked canonical records and reference edges implemented; self-check passes. Diagnostic ordinals and separate required self-check cases remain. |
| Kit and prototype edit parity | Blocked: generated fractional `index` values differ between hosts, even after generated IDs are masked. The round-13 contract requires every non-ID value to remain exact. |
| Lint | DR-02 and clean-kit cases remain. |
| Frames, compare, HTML | Existing assertions remain; final run cannot reach them. |

`final/parity-round13-final.log` records 2 pass, 2 fail, 0 skip. `packages/core/src/fractional.ts` documents randomized jitter and `packages/core/src/editor/facade/core.ts` uses it for new element indexes. These engine paths are outside this plan; the contract also prohibits masking non-ID fields. A checkpoint amendment must define a z-order-preserving comparison for random indexes or authorize an appropriate deterministic engine seam before the parity gate can pass. No three-run stability evidence is claimed. Formal reviews remain downstream.

## Redispatch 2026-11-10: round-14 page-order blocker

The local signature now removes only newly created element indexes and compares per-page index-sorted masked IDs; pre-existing element indexes remain exact. The required gate still fails: kit insertion independently creates the `iOS kit` page with different fractional `order` values (`s` versus `e`) in Bun and native. Unlike element indexes, page order is not exempted by the binding round-14 contract. The mismatch is visible in `final/parity-round14-attempt.log` (3 pass, 1 fail, 0 skip). Resolve the page-order contract or authorize the owning engine seam before resuming; do not mask it under the current contract.

| Case | Result |
| --- | --- |
| Normalizer self-check | Pass; additional z-order and diagnostic checks remain. |
| Prototype, frames, compare, HTML | Pass in the attempted gate; three consecutive complete runs remain. |
| Kit | Discovery passes; insertion fails on newly created page `order`. Exact property update remains. |
| Lint | DR-02 and clean-kit cases remain. |

`CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli` exited 0 (`final/build-round14.log`). Formal review and integration remain downstream.

## Redispatch 2026-11-10: round-15 partial implementation

The local comparison now retains input IDs, omits ordering keys created by the edit, assigns document ID ordinals while traversing ordered pages and elements, and compares page and per-page element ordering using code-unit ordering. This is not complete: stdout/stderr still collapse generated IDs to one token; generated IDs without a record need ordinal coverage; and ordering and fixed-ULID regression cases remain. DR-02 and clean-kit lint cases and an exact, no-create property update also remain. Do not accept this as the final normalizer.

| Case | Current result |
| --- | --- |
| Normalizer | Existing self-check passes; round-15 output and ordering regression coverage remains. |
| Kit | 16 insertions and property batch passed in one native run; standalone exact property update remains. |
| Prototype | Connect/back, inspect and SVG passed in one native run. |
| Lint | DR-02 and clean-kit cases remain. |
| Frames, compare, HTML | Decoded PNG and other assertions passed in one native run. |
| Stability | One successful native run only; three consecutive final-source runs are required. |

`final/parity-round15-sort.log` records 4 pass, 0 fail and 0 skip; the earlier `final/parity-round15-attempt.log` failed before the code-unit ordering correction. Build, Biome and typecheck exited 0 in `final/build-round15.log`, `final/biome-round15.log` and `final/typecheck-round15.log`. Formal review and integration remain downstream.

## Continuation 2026-11-10: implementation verification

| Case | Result |
| --- | --- |
| Normalization | Generated output IDs and unique printed prefixes use first-appearance ordinals; existing IDs remain exact. Document records and ordered pages/elements use ordinals and retain existing ordering keys. Self-checks cover permuted IDs, changed fields, memberships, page and element order, fixed IDs, prefixes and reference-only IDs. |
| Kit | All 16 insertions, discovery, property batch, standalone exact property update and non-kit error pass. |
| Prototype | Connect/back, flows inspection, SVG and invalid element cases pass. |
| Lint | CLI-created DR-02 instance overflow and 24-point hotspot pass text and JSON parity with screen/instance context; clean status-bar kit has zero findings. |
| Frames and compare | File names, command output and decoded RGBA dimensions/pixels match for frame export and single/directory comparisons; bad band error matches. |
| HTML prototype | Export bytes match. |

Three consecutive final-source parity runs (`continuation1/parity-final-a.log`, `-b.log`, `-c.log`) each exit 0 with 6 pass, 0 fail and 0 skip (188 assertions each). `continuation1/build-final.log`, `biome-final2.log` and `typecheck-final2.log` exit 0. Source hash: `3cb93cb03fef0b86606eec6881485dad028d89b3`. Earlier attempts and their logs remain for history. Formal review, integration and commit are downstream.
