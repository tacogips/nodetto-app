# slt-02-plan-contract

- planId: slt-02-plan-contract; wave 1; dependsOn: none
- Design: section 4 (contract changes) and 5.2 (`slideTiming`, stagger) of
  `design-docs/specs/design-slide-transition-settings.md`.
- writePaths: `packages/core/src/presentation/slide-transition-types.ts`,
  `packages/core/src/presentation/slide-transition-types.test.ts`,
  progress file, `tmp/slt-s856/slt-02-plan-contract`, `target`
- artifactRoots: `target`.

## Intent and context

Widen the serialisable plan contract so the planner (slt-04) and the
runner (slt-05) can work in parallel in wave 2. Everything is additive:
Phase 1 values keep their exact meaning, and new fields appear only on new
step kinds. The file already exports the Phase 1 contract and is
re-exported by `packages/core/src/presentation/index.ts` (`export *`), so
no barrel edit is needed.

## Non-goals

- No planner logic (slt-04), no runner code (slt-05).
- Do not edit `slide-transition.ts`, `index.ts`, or any `ui-solid` file.
- Do not rename or change any Phase 1 export or constant value.

## File-level changes (`slide-transition-types.ts`)

1. `SlideStepKind`: append `"undraw" | "scale-in" | "scale-out" |
   "slide-in" | "slide-out" | "appear" | "disappear" | "swap" |
   "slide-fade"`.
2. `SlideTransitionStep`: add `readonly offset?: { readonly x: number;
   readonly y: number }` (slide units, slide-in/slide-out only). Keep the
   existing field order and add the new field last.
3. Cut plan reason: `"size-mismatch" | "empty" | "setting"`.
4. `export type SlideNavigation = "forward" | "backward";`
5. `export interface SlideTiming { readonly move: number; readonly fadeOut:
   number; readonly entrance: number; readonly entranceOffset: number;
   readonly stagger: number; readonly staggerBudget: number }`
6. `export const PHASE1_TIMING: SlideTiming`, built from the existing
   constants (`SLIDE_MOVE_MS`, `SLIDE_FADE_OUT_MS`, `SLIDE_ENTRANCE_MS`,
   `SLIDE_ENTRANCE_OFFSET_MS`, `SLIDE_STAGGER_MS`, `SLIDE_STAGGER_BUDGET_MS`).
7. `staggerStart(rank, count, timing = PHASE1_TIMING)`: the same formula,
   using `timing.stagger` and `timing.staggerBudget`.
   - Pitfall: with no third argument the arithmetic must be exactly
     `rank * Math.min(SLIDE_STAGGER_MS, SLIDE_STAGGER_BUDGET_MS / (count - 1))`,
     the same operations in the same order, so floating-point results are
     bit-identical to Phase 1.

## Invariants

- Every existing Phase 1 test passes unchanged, in particular
  `slide-transition.test.ts`, `slide-transition-types.test.ts` and the
  ui-solid presentation tests.
- `scopeSvgIds` and `svgViewBox` are untouched.

## Tests (append to `slide-transition-types.test.ts`; do not alter existing cases)

- `staggerStart(r, c)` equals `staggerStart(r, c, PHASE1_TIMING)` and the
  Phase 1 formula for (0,1), (1,2), (3,9), (5,20) -> `Object.is` equality;
- a custom timing `{ stagger: 120, staggerBudget: 960, ... }` doubles the
  start for (1,2) and caps at 960 over many items;
- a step with `kind: "slide-in", offset: { x: -10, y: 0 }` and a plan
  `{ kind: "cut", reason: "setting" }` survive
  `JSON.parse(JSON.stringify(x))` unchanged (type-level coverage plus a
  runtime check).

## Verification (exit 0; logs in `tmp/slt-s856/slt-02-plan-contract/`)

1. `bun test packages/core/src/presentation`
2. `bun run typecheck`
3. `bunx biome check --diagnostic-level=warn packages/core/src/presentation/slide-transition-types.ts packages/core/src/presentation/slide-transition-types.test.ts`
4. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slt-02-plan-contract.log -- packages/core/src/presentation/slide-transition-types.ts packages/core/src/presentation/slide-transition-types.test.ts`

## Done criteria

- The new names are importable from `@nodetto/core`.
- All Phase 1 presentation tests pass unchanged.
- Only the two writePaths files changed.
