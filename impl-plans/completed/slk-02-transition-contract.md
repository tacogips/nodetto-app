# slk-02-transition-contract

- planId: slk-02-transition-contract
- planPath: impl-plans/active/slk-02-transition-contract.md
- progressPath: impl-plans/progress/slk-02-transition-contract.md
- wave: 1; dependsOn: none
- Design: sections 4.1, 5.1 and 9 of `design-docs/specs/design-slide-link-animation.md`.
- writePaths: `packages/core/src/presentation/slide-transition-types.ts` (new),
  `packages/core/src/presentation/slide-transition-types.test.ts` (new),
  `packages/core/src/presentation/index.ts`,
  `impl-plans/progress/slk-02-transition-contract.md`,
  `tmp/slk-s855/slk-02-transition-contract`, `target`
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

This plan pins the serialisable transition-plan contract and the timing
constants. It also adds two pure SVG string helpers that the runner needs:
unique def ids per inlined SVG, and reading the viewBox. The exact type
names and fields are in `impl-plans/completed/slk-overview.md` ("Pinned
contracts"); copy them verbatim. The core barrel already re-exports
`./presentation/index.ts` (`packages/core/src/index.ts:820`).

## Non-goals

- No planner (slk-04). No DOM.
- No change to `svg-export/*` or to the other presentation files.
- Do not declare a type named `SlideRect`: `slide-rect.ts` exports one, and
  the barrel would collide.

## File-level changes

1. `slide-transition-types.ts`:
   - the types and constants from the overview;
   - `staggerStart(rank, count)`: `count <= 1 ? 0 : rank * Math.min(SLIDE_STAGGER_MS, SLIDE_STAGGER_BUDGET_MS / (count - 1))`;
   - `scopeSvgIds(svg, prefix)`:
     - collect every value of an `id="..."` attribute. The match must
       require whitespace before `id=`, so `data-id=` and `data-layer` are
       never matched;
     - rewrite each declaration to `id="<prefix><value>"`;
     - rewrite references only to declared ids: `url(#v)`, `href="#v"`,
       `xlink:href="#v"`;
     - leave everything else byte-identical.
     Ids the exporter emits include `nodetto-clip-N`, `nodetto-shadow-N`,
     gradient ids, mask ids, marker ids and the inline
     `nd-strokes-...` clipPath of `rectStrokeMarkup`, which sits inside an
     element body, not in `<defs>`. Do not special-case any of them;
     scope every declared id. Escape regex metacharacters in ids.
   - `svgViewBox(svg)`: parse the root `<svg ... viewBox="x y w h">`.
     Return `null` unless all four are finite and `w > 0`, `h > 0`.
     Follow the attribute-reading style of
     `packages/core/src/presentation/source.ts:svgSize`.
2. `index.ts`: append `export * from "./slide-transition-types.ts";`.

## Pitfalls

- Do not scope undeclared references (for example external hrefs or
  `href` of `<image>` data URLs).
- Ids can appear several times, so use a set.
- The output must stay well-formed: only attribute values change.
- Make the code compatible with `noUncheckedIndexedAccess`: regex groups
  are `string | undefined`, so guard them.

## Tests (`slide-transition-types.test.ts`)

- `staggerStart`: (0, 1) -> 0; (3, 5) -> 180; (9, 21) -> 9 * 24 = 216
  (budget-limited); starts strictly increase for rank < count
- real export via `renderPageSvg` (use `makeEditor` / `element` /
  `document` from `packages/core/src/test-helpers.ts`). The page holds:
  - a geo rect with `style.fillGradient`;
  - a geo rect with `style.strokeAlign: "inside"`;
  - a shape with a shadow effect (if trivial to express; otherwise skip
    filter);
  - a connector with an end arrow (marker).
  Checks:
  - scope with `a-` and with `b-` -> the two declared-id sets are
    disjoint;
  - every `url(#x)` / `href="#x"` in each output refers to an id declared
    in the same output;
  - the multiset of `data-id="..."` values is unchanged.
- an SVG with no ids -> output is identical to the input
- `svgViewBox`:
  - `viewBox="100 -50 1920 1080"` -> `{x:100, y:-50, width:1920, height:1080}`
  - missing -> `null`; `w = 0` -> `null`; a NaN token -> `null`

## Verification (each must exit 0)

1. `bun test packages/core/src/presentation`: all pass (existing and new).
2. `bun run typecheck`
3. `bunx biome check --diagnostic-level=warn packages/core/src/presentation/slide-transition-types.ts packages/core/src/presentation/slide-transition-types.test.ts packages/core/src/presentation/index.ts`

Evidence: logs under `tmp/slk-s855/slk-02-transition-contract/`.

## Acceptance criteria

- All pinned names are exported from `@nodetto/core`.
- The tests above pass.
- `git diff ccac2d3 -- packages/core/src/svg-export` is empty.
