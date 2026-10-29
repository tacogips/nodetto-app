# slc-01-ir-drawing-contract

- planId: slc-01-ir-drawing-contract
- planPath: impl-plans/active/slc-01-ir-drawing-contract.md
- wave: 1; dependsOn: none
- design: `design-docs/specs/design-shape-lateral-consistency.md`. Section 2
  covers the IR enum and the picking rule. Section 4 covers Data and
  validation and the `elementOutlinePolygon` rule.
- progress log: impl-plans/progress/slc-01-ir-drawing-contract.md
- scratch and logs: tmp/shape-lateral-s544/slc-01-ir-drawing-contract/

## Intent

This plan pins the two IR contracts every later plan builds on.

- Contract 1: the geo kind `actor`.
- Contract 2: the optional contour key `closed`. `false` means an open
  polyline that needs at least 2 points.

It also adds the two "no outline polygon" rules in
`packages/core/src/shapes/outline.ts`:

- geo `actor`: the box is the interaction region;
- a single open `draw.path` contour: the bounds are the region.

Both rules depend only on these contracts, so they belong here and slc-03
and slc-04 never share `outline.ts`.

## Repository context

- `packages/ir/src/semantics/drawing.ts:GEO_KINDS` (ends with `"person",
  "package"`), `PathContour` (`points` only), `PathSemantic`.
- `packages/ir/src/registry/drawing.ts`:
  - `DRAW_PATH.keyOrder` (contours children `keys: ["points"]`);
  - `DRAW_PATH.validateSemantic`, which pushes `error("path.points", ...,
    "a closed contour requires at least three points")` when
    `points.length < 3`;
  - `checkBoolean` is already imported; see its use in
    `DRAW_FREEHAND.validateSemantic`.
- `packages/ir/src/registry/drawing.test.ts`: the existing draw.path tests
  to imitate.
- `packages/core/src/shapes/outline.ts`: `geoOutlinePolygon(kind, box,
  flip)` and `elementOutlinePolygon(element, context)`. The `draw.path`
  branch returns a polygon only when `semantic.contours.length === 1`.
- The io round-trip pattern is `packages/io/src/jsonl/golden.test.ts`, which
  uses `parseDocument` and `serializeDocument`.

## File-level changes

1. `packages/ir/src/semantics/drawing.ts`:
   - Append `"actor"` after `"package"` in `GEO_KINDS`.
   - Add `readonly closed?: boolean;` to `PathContour`, with a one-line doc:
     `false` is an open stroke with no fill; absent or `true` is closed.
   - Update the `PathContour` doc comment, which currently says "closed
     contour".
2. `packages/ir/src/registry/drawing.ts`, `DRAW_PATH`:
   - Change the contours children `keys` to `["points", "closed"]`. Keep
     the nested `points` child order unchanged.
   - In `validateSemantic`, per contour:
     - call `checkBoolean(out, contour["closed"], `${contourPath}.closed`,
       { optional: true })`;
     - let `open = contour["closed"] === false`;
     - closed (not open) with fewer than 3 points: keep the existing error
       with its exact message;
     - open with fewer than 2 points: `error("path.points",
       `${contourPath}.points`, "an open contour requires at least two
       points")`.
   - Totals and the contour-count check are unchanged.
3. `packages/core/src/shapes/outline.ts`:
   - `geoOutlinePolygon`: return `null` when `kind === "actor"`, before
     calling `geoOutline`. Add a one-line comment: the stick figure is
     picked and connected by its box, like draw.io's rectangle perimeter.
   - `elementOutlinePolygon`, `draw.path` branch: return `null` when the
     single contour has `closed === false`. Read it from
     `(element.semantic as PathSemantic).contours[0]`.
4. `packages/ir/src/registry/drawing.test.ts`: add the tests below.
5. `packages/io/src/jsonl/open-path.test.ts` (new): round trip, see Tests.
6. `packages/core/src/shapes/outline-rules.test.ts` (new): see Tests.

## Pitfalls and what not to do

- Do not change the closed-contour error message or its code.
- Do not make `closed: true` an error. It is valid and equivalent to
  absent.
- Do not touch `geo-outline.ts`, `compound-path.ts`, `tools.ts`, or any
  fixture. Rendering is slc-03 and slc-04.
- Appending `actor` at the end of `GEO_KINDS` is required: inspector option
  order and existing iteration order stay stable.
- Expected transient failures after this plan (overview rule 9): core
  `svg-export.test.ts` and `shapes/geo-outline.test.ts` for kind `actor`.
  Do not run or fix them here.

## Tests

- `drawing.test.ts`:
  - `{ contours: [{ points: [a, b], closed: false }], fillRule: "nonzero" }`
    -> no errors;
  - open contour with 1 point -> exactly one `path.points` error with "an
    open contour requires at least two points";
  - closed contour (no key) with 2 points -> the existing "a closed contour
    requires at least three points" error;
  - `closed: true` with 3 points -> no errors;
  - `closed: "no"` -> a type error at `...contours[0].closed`;
  - `SHAPE_GEO` with `geo: "actor"` -> no errors.
- `open-path.test.ts`:
  - a hand-written JSONL document whose draw.path element has
    `{"points":[{"x":0,"y":0},{"x":80,"y":30}],"closed":false}` parses with
    no error issues;
  - `serializeDocument(parseDocument(text)) === text` (byte-identical, with
    `closed` written after `points`);
  - a closed-contour line with no `closed` key also round-trips
    byte-identically and gains no `closed` key.
  - Use invented ids and names.
- `outline-rules.test.ts`:
  - `geoOutlinePolygon("actor", box)` -> `null`;
  - `geoOutlinePolygon("person", box)` -> non-null (unchanged);
  - `elementOutlinePolygon` for a draw.path whose single 3-point contour has
    `closed: false` -> `null`;
  - the same path without `closed` -> a polygon.
  - Build elements with `new Editor()` and `createElement`, as
    `packages/core/src/shapes/connection-points.test.ts` does.

## Verification

```
mkdir -p tmp/shape-lateral-s544/slc-01-ir-drawing-contract
BUN_OPTIONS=--jsx-runtime=classic bun test packages/ir > tmp/shape-lateral-s544/slc-01-ir-drawing-contract/ir.log 2>&1; echo "exit=$?"
BUN_OPTIONS=--jsx-runtime=classic bun test packages/io/src/jsonl > tmp/shape-lateral-s544/slc-01-ir-drawing-contract/io-jsonl.log 2>&1; echo "exit=$?"
BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/shapes/outline-rules.test.ts packages/core/src/shapes/connection-points.test.ts > tmp/shape-lateral-s544/slc-01-ir-drawing-contract/outline.log 2>&1; echo "exit=$?"
bunx tsc -p tsconfig.json --noEmit > tmp/shape-lateral-s544/slc-01-ir-drawing-contract/tsc.log 2>&1; echo "exit=$?"
bunx biome check packages/ir/src/semantics/drawing.ts packages/ir/src/registry/drawing.ts packages/ir/src/registry/drawing.test.ts packages/io/src/jsonl/open-path.test.ts packages/core/src/shapes/outline.ts packages/core/src/shapes/outline-rules.test.ts
grep -c '"actor"' packages/ir/src/semantics/drawing.ts
grep -c 'an open contour requires at least two points' packages/ir/src/registry/drawing.ts
```

Expected:

- the first three test commands exit 0;
- tsc exits 0 (shared-input gate, rule 8);
- biome exits 0;
- each grep prints `1`.

## Done criteria

- All verification commands show the expected results, logged in the
  progress log with exit codes and log paths.
- `git diff --stat` touches only this plan's writePaths.
- The progress log's last line is `STATUS: done`.
