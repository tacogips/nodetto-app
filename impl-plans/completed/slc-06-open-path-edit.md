# slc-06-open-path-edit

- planId: slc-06-open-path-edit
- planPath: impl-plans/active/slc-06-open-path-edit.md
- wave: 3; dependsOn: slc-04-open-path-render
- design: section 4, "Other consumers", point-editing contract (DR-1 fix),
  plus the related Verification bullets
- progress log: impl-plans/progress/slc-06-open-path-edit.md
- scratch and logs: tmp/shape-lateral-s544/slc-06-open-path-edit/

## Intent

Today a canvas anchor drag or an inspector edit on an open `draw.path` line
fails in one of two ways:

- a 2-point contour is rejected;
- a 3+ point contour has `closed: false` dropped, so it becomes a filled
  closed shape.

Carry each contour's `closed` flag through the whole edit pipeline inside
the contour object. Write `closed: false` only for open contours and never
write `closed: true`.

## Repository context

- `packages/core/src/compound-path-edit.ts`:
  - `pathWorldContours(element): FreehandPoint[][]` (~24-40);
  - `planPathWorldContours(element, contours: readonly (readonly
    FreehandPoint[])[]): Command[]` (~43-130), which rejects
    `contour.length < 3` (~51) and rebuilds contours as `{ points }` only
    (~93-103);
  - `PathAnchorDrag` (~132-230): `active.contours: FreehandPoint[][]`,
    `preview(contours | null)`, and `finish`, which compares
    before/after and calls `planPathWorldContours`.
- `packages/core/src/index.ts:~519-521` exports `pathWorldContours`,
  `planPathWorldContours` and `PathAnchorDrag`.
- `packages/ui-solid/src/CompoundPathHandles.tsx`:
  - `preview` signal typed `readonly (readonly FreehandPoint[])[] | null`;
  - `source = pathWorldContours(...)`;
  - the preview outline uses `strokePath(contour, true)` (~62);
  - `<For each={source()}>` iterates points per contour.
- `packages/ui-solid/src/inspector/PathSection.tsx`:
  - `contours()` and `points()`;
  - `write(next)` (~31);
  - `replacePoints` (~34);
  - Split uses `splitStrokeSegment(points(), pointIndex(), true)` (~185);
  - Remove anchor is disabled at `points().length <= 3` (~195);
  - Add contour (~203-222) and Remove contour (~223-233).
- `packages/core/src/stroke-path.ts:splitStrokeSegment(points, index,
  closed, t)` returns `null` for an open contour at its last index.
- From slc-04, `compoundPathGeometry` accepts 2-point open contours and
  exposes `closed: boolean[]`.
- Test to imitate: `packages/core/src/compound-path.test.ts`, "rotated path
  anchor dragging preserves other world anchors and undo" (~112-143).

## File-level changes

1. `compound-path-edit.ts`:
   - export `interface PathWorldContour { readonly points: readonly
     FreehandPoint[]; readonly closed: boolean }`.
   - `pathWorldContours` returns `PathWorldContour[]`. `closed` comes from
     `(element.semantic as PathSemantic).contours[i]?.closed !== false`,
     and the points are world-mapped as today.
   - `planPathWorldContours(element, contours: readonly
     PathWorldContour[])`:
     - per-contour minimum: 2 points when `!closed`, 3 when closed;
     - contour count (1-1024) and the 20000 total-points check are
       unchanged;
     - each rebuilt contour is `{ points, ...(closed ? {} : { closed: false
       }) }`. Never write `closed: true`.
   - `PathAnchorDrag`:
     - `active.contours: PathWorldContour[]`;
     - `preview` callback type `(contours: readonly PathWorldContour[] |
       null) => void`;
     - `move` replaces only `points` of the active contour (spread the
       contour object so `closed` is copied);
     - `start`/`finish` read `contours[c]?.points[i]`.
2. `index.ts`: add `type PathWorldContour` to the existing export
   statement for `compound-path-edit.ts`.
3. `CompoundPathHandles.tsx`:
   - `preview` is typed `readonly PathWorldContour[] | null`;
   - the outline uses `strokePath(contour.points, contour.closed)`, so an
     open contour shows no closing segment;
   - the `For` loops iterate `contour.points`;
   - `at(contour, index)` reads `.points[index]`.
4. `PathSection.tsx`:
   - `contours()` holds `PathWorldContour[]`; `points()` is
     `contour().points`.
   - `replacePoints(next)` writes `{ ...current, points: next }`, keeping
     `closed`.
   - Split calls `splitStrokeSegment(points(), pointIndex(),
     current.closed)`. Disable the button, or no-op as today, when it
     returns `null`.
   - Remove anchor is disabled at `points().length <= (closed ? 3 : 2)`.
   - Add contour appends `{ points: [three points], closed: true }`.
   - Remove contour filters whole contour objects.
   - The `contours().flat()` total-point counts become
     `contours().flatMap((c) => c.points)`.
5. `compound-path.test.ts`: migrate the existing test to `.points` and add
   the tests below.

## Pitfalls and what not to do

- Never recover flags by index from the previous element (the DR-1 bug).
  The flag travels inside each `PathWorldContour`.
- Do not write `closed: true`. Edited closed contours must stay `{ points }`
  so existing documents remain byte-identical after an edit.
- Do not add an open/closed toggle (user-qa Q7) or any new inspector
  control.
- Do not edit `compound-path.ts` (slc-04) or `outline.ts` (slc-01).

## Tests (`compound-path.test.ts`)

- Drag one anchor of `{ contours: [{ points: [a, b], closed: false }] }`
  with `PathAnchorDrag` (start, move, finish) -> a command is applied. The
  stored contour has 2 points, `closed: false`, and the moved point.
- Drag an anchor of a 3-point open contour -> the stored contour keeps
  `closed: false`.
- `planPathWorldContours` with `pathWorldContours(el).slice(1)` on
  `[closed triangle, open line]` -> the stored contours have length 1 with
  `closed: false`.
- Editing a closed contour (drag) -> the stored contour has no `closed`
  key.
- Rejection: a 1-point open contour or a 2-point closed contour yields `[]`
  from `planPathWorldContours`.
- The existing rotated-drag test passes after the `.points` migration.

## Verification

```
mkdir -p tmp/shape-lateral-s544/slc-06-open-path-edit
BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/compound-path.test.ts packages/core/src/open-path.test.ts packages/core/src/pcb-import.test.ts > tmp/shape-lateral-s544/slc-06-open-path-edit/core.log 2>&1; echo "exit=$?"
BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid > tmp/shape-lateral-s544/slc-06-open-path-edit/ui.log 2>&1; echo "exit=$?"
bunx tsc -p tsconfig.json --noEmit > tmp/shape-lateral-s544/slc-06-open-path-edit/tsc.log 2>&1; echo "exit=$?"
bunx biome check packages/core/src/compound-path-edit.ts packages/core/src/index.ts packages/core/src/compound-path.test.ts packages/ui-solid/src/CompoundPathHandles.tsx packages/ui-solid/src/inspector/PathSection.tsx
grep -c 'export interface PathWorldContour' packages/core/src/compound-path-edit.ts
grep -c 'splitStrokeSegment(points(), pointIndex(), true)' packages/ui-solid/src/inspector/PathSection.tsx
```

Expected:

- `core` exits 0;
- `ui` and `tsc` exit 0 (rule-8 gates; sibling slc-07);
- biome exits 0;
- the greps print `1` and `0`.

## Done criteria

- Logged commands and exit codes.
- The last line is `STATUS: done`.
