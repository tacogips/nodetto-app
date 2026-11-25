# car10-p6-loop-forest progress

Status: done (implementation phase).

Implemented the deterministic exact-grid sweep and independent BigInt oracle
fixtures. Nested-chain work for 256, 512 and 1024 loops was 24725, 52197 and
113710 events plus steps. Focused Biome and Bun test verification passed with
four tests, including zero winding. Integration in p7 and formal reviews remain downstream.

Integration repair in progress: replace only `priority(id)`'s Math.imul mix
with deterministic seeded xorshift32 operations to satisfy the CAD arithmetic
guard. Pre-edit `loop-forest.ts` SHA-256:
`30e4fac9bcaa0aa655cad1ce414ec5457fa39669d545205d685d6f4673333fce`.
Reproduction: `tmp/car10-r10/car10-p6-loop-forest/repair-before-2.log`.

Integration repair: done. `priority(id)` now uses a seeded shift/add/xor
avalanche mix; no other module lines changed. Post-edit SHA-256:
`aeb35751e4e2cc4803cc89ffdeab8f32750926793d0fe95c7af519db86f6d5f1`.
Scope and zero Math references: `tmp/car10-r10/car10-p6-loop-forest/repair-scope.log`.
Final Biome: `tmp/car10-r10/car10-p6-loop-forest/repair-biome-2.log`.
Final combined six-file test: `tmp/car10-r10/car10-p6-loop-forest/repair-tests-2.log`
(86 pass, 0 fail); the plan gate is `tmp/car10-r10/car10-p6-loop-forest/repair-plan-gate.log`
(4 pass, 0 fail; work 22591, 52168, 113967). The initial xorshift mix
failed the growth checks, recorded in `tmp/car10-r10/car10-p6-loop-forest/repair-tests.log`,
and was replaced. Formal review and integration gates remain downstream.
