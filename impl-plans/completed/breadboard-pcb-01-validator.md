# breadboard-pcb-01-validator

- planId: breadboard-pcb-01-validator
- planPath: impl-plans/active/breadboard-pcb-01-validator.md
- wave: 1; dependsOn: none
- design: design-docs/specs/design-breadboard-pcb.md, sections 7.4
  (validator) and 7.1 Verification (clearance check)
- progress log: impl-plans/progress/breadboard-pcb-01-validator.md
- session: opus-luna-design-and-implement-review-loop-session-501; issue
  local-input:feat/breadboard-gerber@431bfdb

## Wave map (all plans of this run)

| Wave | Plan | Depends on |
| --- | --- | --- |
| 1 | breadboard-pcb-01-validator | - |
| 1 | breadboard-pcb-02-legend-clip | - |
| 1 | breadboard-pcb-06-docs | - |
| 2 | breadboard-pcb-03-core-export | 01, 02 |
| 3 | breadboard-pcb-04-cli-parity | 03 |
| 3 | breadboard-pcb-05-goldens | 01, 03 |

## Intent

Add a strict syntax and geometry checker for the Gerber and Excellon files
the breadboard PCB export writes. Later plans use it in tests, and every
generated file must pass it. It is test support only. It also provides the
silkscreen clearance check that plans 03 and 05 run on generated files.

## Repository context

- The writers are in `packages/core/src/breadboard/gerber.ts`:
  `GerberLayer.text` and `excellonDrill`. Read them to see the exact
  output shape. Do not edit them; plan 03 owns them.
- `packages/core/src/breadboard/pcb.test.ts:parseGerber` is a lenient
  parser that ignores unknown lines. It is the weakness this plan replaces
  (finding R7). Do not edit `pcb.test.ts`; plan 03 owns it.
- Imitate the named-group style of `pcb.test.ts:parseGerber`, for example
  `/^%ADD(?<code>\d+)(?<shape>.+)\*%$/.exec(line)?.groups`.

## Non-goals

- Do not export the module from `packages/core/src/breadboard/index.ts` or
  `packages/core/src/index.ts`.
- Do not write a general Gerber parser. Accept only what the writer emits
  (allow-list).
- Do not validate real export output in this plan's tests. Plans 03 and 05
  do that after they change the writers.
- No `AM`, `SR`, arcs (`G02`/`G03`/`G75`), `LPC`, or inch support.

## writePaths

- packages/core/src/breadboard/fabrication-validate.ts (new)
- packages/core/src/breadboard/fabrication-validate.test.ts (new)
- impl-plans/progress/breadboard-pcb-01-validator.md (new)

## sharedPaths

none

## Contract (pinned, used by plans 03 and 05)

```ts
export interface FabricationOutline { readonly width: number; readonly height: number }
export function validateGerber(text: string, outline: FabricationOutline): readonly string[];
export function validateExcellon(text: string, outline: FabricationOutline): readonly string[];
export function legendClearanceErrors(input: {
  readonly gto: string; readonly gts: string; readonly outline: FabricationOutline;
  readonly padClearance: number; readonly edgeClearance: number; readonly tolerance?: number;
}): readonly string[];
```

Each function returns an empty array when the input is valid. Each error
is one string that starts with `line <n>: ` (1-based line number) or, for
whole-file errors, `file: `. Outline units are millimetres. The functions
take numbers as parameters and must not import `BREADBOARD_PCB_RULES`,
because the new rule keys do not exist until plan 03.

## File-level changes

### fabrication-validate.ts

`validateGerber` rules (design 7.4). Check each one and report a separate
error for each:

1. The text contains no `\r`, and it ends with `\n`. The last split element
   is `""`; ignore only that one. Any other empty line is an error.
2. A line that starts with `%` must match `^%(?<body>[^%*]+)\*%$`. The body
   is one of:
   - `TF.<anything without * or %>`
   - exactly `FSLAX46Y46`
   - exactly `MOMM`
   - exactly `LPD`
   - `ADD(?<code>\d+)(?<template>C,(?<d>\d+\.\d+)|R,(?<w>\d+\.\d+)X(?<h>\d+\.\d+))`
     with code >= 10 and not defined before (no duplicate definitions)

   Anything else is an error.
3. `FSLAX46Y46`, `MOMM`, `TF.FileFunction,...` and `TF.FilePolarity,...` each
   appear exactly once, before the first `ADD`. A missing one is a `file:`
   error.
4. Every other non-empty line is a data block. It ends with `*`, has exactly
   one `*`, and is one of `G01*`, `D(?<code>\d+)\*` (code >= 10),
   `X(?<x>-?\d+)Y(?<y>-?\d+)D0(?<op>[123])\*`, or `M02*`.
5. A `D<code>*` select must refer to an aperture already defined by `ADD`.
6. `D01` and `D03` need a current aperture. `D01` also needs `G01` seen
   before it and a current point, which a D01, D02 or D03 sets. `D02` may
   come before any select.
7. Coordinates: at most 10 digits after an optional `-` (format 4.6), and
   `0 <= x <= round(width * 1e6)` and `0 <= y <= round(height * 1e6)` as
   integers. Compare integers, not floats.
8. `M02*` appears exactly once, as the last non-empty line.

`validateExcellon` rules:

1. Same newline rules as Gerber.
2. The first line is `M48`.
3. Header lines until the first `%` line: `;` comments, `FMAT,2`, `METRIC`,
   and `T(?<tool>\d+)C(?<d>\d+\.\d+)`. `INCH`, or any other line, is an error.
   `METRIC` is required, and a missing one is a `file:` error. A duplicate tool
   number is an error.
4. A missing `%` is a `file:` error.
5. Body lines: `G90`, `G05`, `T(?<tool>\d+)` (must be defined in the
   header), `X(?<x>-?\d+\.\d+)Y(?<y>-?\d+\.\d+)` (a decimal point is
   required; a hit before any tool select is an error; must lie within
   `[0, width] x [0, height]` with a float tolerance of 1e-9), and `M30`.
   Anything else is an error.
6. `M30` appears exactly once, as the last non-empty line.

`legendClearanceErrors` (design 7.1 Verification):

- Parse `gts` flashes (D03). The aperture `C,d` is a circle of radius d/2;
  `R,wXh` is an axis-aligned rectangle with half sizes w/2 and h/2. Ignore
  strokes in GTS; the writer emits none.
- Parse `gto` strokes: a D02 starts a polyline and each D01 adds a segment.
  The ink half-width is the diameter/2 of the current `C` aperture. A D03 in
  GTO is an error, `unexpected flash`.
- For each GTO segment and each mask opening: the clearance is the exact
  distance minus the half-width.
  - Circle: the distance from the circle centre to the segment, minus the
    radius.
  - Rectangle: 0 if the segment intersects or lies inside the rectangle.
    Otherwise it is the minimum of the distances from the four corners to
    the segment and from the two segment endpoints to the rectangle.
  - The clearance must be at least `padClearance - tolerance` (default
    tolerance 1e-5). Report the line, the opening centre and the measured
    value with 4 decimals.
- Each GTO coordinate must satisfy `x - half >= edgeClearance - tolerance`,
  and likewise for `width - x - half`, `y` and `height - y`.

Pitfalls:

- `noUncheckedIndexedAccess`: guard every array or regex access. Use
  `?.groups`, destructuring and `const [first] = ...` with an undefined
  check. No `match[1]` or `parts[0]` (repository constraint).
- `segment` distance must handle zero-length segments, where a D02 is
  followed by a D01 at the same point.
- Do not use `Number.parseFloat` on whole lines. Match the named groups
  first.
- Keep the functions pure. No `node:` imports in the module, which is core
  source.

### fabrication-validate.test.ts

Build every input as small inline template strings. Use a helper that
builds a minimal valid Gerber and a minimal valid Excellon file, then
mutates one line per negative case. Test cases (input -> expected):

- minimal valid Gerber, with a header, `ADD10C,0.180000`, `D10*`, D02,
  D01, D03 and `M02*` -> `[]`
- minimal valid Excellon -> `[]`
- Gerber with CRLF line endings -> error
- Gerber missing its final newline -> error
- a block without `*` (`G01`) -> error naming that line
- two `*` in one block -> error
- `%FSLAX46Y46*` (missing the closing `%`) -> error
- an unknown extended command `%AMX*%` -> error
- `FSLAX35Y35` -> error
- `MOIN` -> error
- a missing `TF.FileFunction` -> `file:` error
- `D11*` selected but only D10 defined -> error
- `ADD10` defined twice -> error
- `ADD9C,...` -> error (code below 10)
- `D01` before any select -> error
- `D01` with no `G01` before it -> error
- coordinate `X12345678901Y0D02*` (11 digits) -> error
- coordinate x = width + 1 nm -> error; x = width exactly -> ok
- negative coordinate -> error
- a block after `M02*` -> error
- no `M02*` -> error
- Excellon starting with something other than `M48` -> error
- Excellon with `INCH` -> error
- Excellon without `METRIC` -> error
- tool definition after `%` -> error
- `T2` selected but not defined -> error
- a hit before any tool select -> error
- `X127Y5.08` (no decimal point) -> error
- a hit outside the outline -> error
- no `M30`, or a line after `M30` -> error
- clearance: a GTO stroke of width 0.18 passing 0.1 mm from a 1.9 circle
  opening -> one error
- clearance: a stroke whose ink is exactly 0.15 from the opening -> `[]`
- clearance: a stroke crossing a square opening -> error
- clearance: a stroke near the corner of a square opening, with the true
  distance >= 0.15 but within the circumscribed circle -> `[]` (exact
  square distance, not a circle)
- edge: a stroke whose ink is 0.1 from the board edge with edgeClearance
  0.2 -> error

## Invariants

- No file outside writePaths is changed. `gerber.ts`, `pcb.ts` and
  `pcb.test.ts` are untouched.
- The module is not reachable from `@nodetto/core`.

## Acceptance criteria

- Every bullet above is a passing test, and each negative test asserts the
  error count and the reported line, not just `length > 0`.
- The three functions match the pinned signatures exactly.

## Verification (run from the repository root, record exit codes in the progress log)

1. `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/breadboard/fabrication-validate.test.ts`
   must exit 0. Record the pass count.
2. `bunx biome check packages/core/src/breadboard/fabrication-validate.ts packages/core/src/breadboard/fabrication-validate.test.ts --diagnostic-level=warn`
   must exit 0.
3. `bun run typecheck` must exit 0. If it fails only in files this plan
   does not own (sibling work in progress), record those files as sibling
   drift. They are not this plan's failure.
4. Check `noUncheckedIndexedAccess`. Create
   `tmp/breadboard-pcb-s501/breadboard-pcb-01-validator/tsconfig.nuia.json`
   with `{"extends": "../../../tsconfig.json", "compilerOptions": {"noUncheckedIndexedAccess": true}, "include": ["../../../packages/core/src"]}`.
   Run `bunx tsc -p tmp/breadboard-pcb-s501/breadboard-pcb-01-validator/tsconfig.nuia.json`
   and filter its output for `fabrication-validate`. That filtered output
   must be empty.

## Per-worker protocol

- Before each edit, read the file fresh. Record `shasum -a 256` before and
  after each edit in the progress log. If a file's current hash differs
  from your last recorded post-hash, stop. Record it as drift and leave the
  repair to serial reconciliation.
- First write an intent snapshot to the progress log: the plan id, the files
  you will touch, and the expected outcome.
- Run no git commands that change state (no commit, stash, checkout, reset
  or worktree).
- Use scratch only under `tmp/breadboard-pcb-s501/breadboard-pcb-01-validator/`.
  Never put a `*.test.ts` file under `tmp/`, because the repository-wide
  `bun test` would collect it.
- The progress log records the intent snapshot, the hashes, each
  verification command with its exit code, the pass counts, and any drift.
  Edit only your own progress log.

## Done criteria (mechanical)

- `packages/core/src/breadboard/fabrication-validate.ts` exports exactly the
  4 pinned names.
- `grep -c "fabrication-validate" packages/core/src/breadboard/index.ts`
  prints 0.
- Verification steps 1-4 are recorded with exit 0 (or with sibling drift
  documented for step 3).
