# Breadboard PCB Export

Status: design record, revision 1, for branch `feat/breadboard-gerber`.
Issue: "Breadboard PCB export: design record, adversarial review and
hardening for JLCPCB-class board houses" (workflow input only, no GitHub
issue number; intake session 501).

Baseline: commit `431bfdb` ("Export breadboard boards as PCB Gerber and drill
ZIPs"). This document records the model that commit implements (sections
2-6), the adversarial review of it (section 8), and the changes this revision
makes (section 7). It does not replace `431bfdb`; every section 7 change is an
incremental edit of it.

Related: `design-docs/specs/design-breadboard.md` (breadboard page kind,
connectivity, board layouts). Its section 2 lists "Schematic or PCB views" as
a non-goal. The export described here produces fabrication files and adds no
PCB view or editor. Open user decisions, each with a default, are in
`design-docs/user-qa/breadboard-pcb.md`.

## 1. Context and baseline

Facts observed at `431bfdb`:

- `packages/core/src/breadboard/pcb.ts`: `exportBreadboardPcb(document,
  pageId, { board?, name? })` returns `BreadboardPcb` (`boardId`, `width`,
  `height`, `files`, `warnings`, `notes`) or an error string.
  `encodeBreadboardPcbZip(pcb)` writes a stored ZIP. `BREADBOARD_PCB_RULES`
  holds the design rules.
- `packages/core/src/breadboard/gerber.ts`: `GerberLayer` (aperture table,
  flashes, round-aperture strokes, X2 header) and `excellonDrill`.
- `packages/core/src/breadboard/pcb-font.ts`: self-authored stroke font.
- `packages/core/src/zip.ts`: `encodeStoredZip`, shared with
  `html-bundle.ts`.
- CLI: `nodetto-cli breadboard gerber <doc> --output <file.zip> [--page]
  [--board] [--strict]` (`apps/cli/src/breadboard-command.ts`,
  `gerberCommand`). Help is in `apps/cli/src/help.ts`.
- Desktop: Export dialog, Breadboard tab, "PCB Gerber and drill (.zip)"
  (`apps/desktop/src/App.tsx`, `exportBreadboardGerber`;
  `packages/ui-solid/src/breadboard-export.ts`).
- Tests: `packages/core/src/breadboard/pcb.test.ts` (its `parseGerber`
  helper skips lines it does not recognise) and
  `apps/cli/src/breadboard-commands.test.ts` (two gerber tests).
- The native CLI (`apps/cli/native`, Boa 0.22) runs the same bundled
  TypeScript command code. `apps/cli/src/native-parity.test.ts` compares the
  two CLIs but has no breadboard case. It runs only under `mise run
  test-cli`, which sets `NODETTO_CLI_TEST_BINARY`. `mise run verify` skips it.
- `examples/breadboard/led-button.jsonl` exports with one warning: "Hole e7
  holds SW1 pin 3 and R1 pin 1" (asserted by the CLI test). Both wires
  become top-layer traces.

## 2. Scope

In scope:

1. This design record.
2. Silkscreen clearance around pads (section 7.1).
3. `--outline board|used` (section 7.2).
4. Example PCB golden files and a drift check (section 7.3).
5. A strict Gerber/Excellon validator for tests (section 7.4).
6. TS/native byte parity, with a test (section 7.5).
7. Fixes for the section 8 review findings, each with a regression test.

Out of scope: PCB editing or preview, autorouting beyond the existing
straight-wire rule, extra layers (paste, bottom silkscreen, inner layers),
pick-and-place or BOM for assembly, board-house APIs, changes to the
breadboard JSONL format or `SCHEMA_VERSION`, changes to the
BOM/netlist/SVG goldens, and a desktop outline setting (user QA Q1).

## 3. Model (as built in `431bfdb`, kept)

- **Board**: one `breadboard.board` element is selected: the page's only
  board, or the one given by `--board` (id or unique id prefix). On the
  desktop it is the selected board. The board frame is millimetres, y up,
  origin at the bottom-left corner as seen from the top. Board rotation on the
  page is undone, so a rotated board gives the same files.
- **Used holes only**: every hole that holds a part lead or a wire end
  becomes a plated through hole with a pad on both copper layers. Unused
  holes are omitted. Pin 1 of `breadboard.ic` and `breadboard.header` gets a
  square pad. All other pads are round.
- **Strip traces**: for each breadboard strip (five-hole column half or
  power rail, as defined by `boardLayout` and `computeBreadboardConnectivity`)
  with two or more used holes, the bottom layer gets one straight trace
  from the first to the last used hole. All holes of a strip are collinear,
  so the trace touches only that strip's holes. The nets are therefore the
  breadboard's nets by construction. Rails are continuous, as the
  connectivity model defines them (design-breadboard user QA Q2).
- **Wire routing rule**: wires are tried in page order. A wire becomes a
  top-layer trace of `wireTrace` width along its own points when every
  vertex keeps `edgeKeepout + wireTrace/2` from the board edge, and every
  segment keeps `clearance` from every used pad and every already-routed
  trace on another net. A wire's own end pads and pads on its own breadboard
  net are exempt. The net comes from breadboard connectivity, so a trace can
  only join copper that the breadboard already joins.
- **Jumper fallback**: a wire that fails the rule keeps its end holes as
  pads. It is drawn on the silkscreen along its path and counts as a lead in
  each end hole.
- **Off-board items**: a part with no pin in this board's holes, or with
  some pins outside them, is left off with a warning. So is a wire with an
  end off this board. If nothing is seated, the export returns an error.
- **Two leads in one hole**: a hole holding more than one part lead or
  jumper end gets one pad and a warning. A routed wire end is not a lead.
- **Legend**: the board's row letters, column numbers and rail polarity
  signs; each placed part's rotated body outline; its reference (transistors
  add the pinout, for example `Q1 EBC`), placed in the first free spot of
  above, below, right, left; polarity marks (`+` at LED anodes and the
  positive pin of capacitors and batteries, `K` at diode cathodes); and every
  jumper path. Characters the stroke font lacks are omitted, with a warning.

## 4. Design rules

All values are in millimetres. Each is chosen to be no tighter than the
standard-service minimums commonly published by JLCPCB, PCBWay and Elecrow.
Rows marked "new" are added to `BREADBOARD_PCB_RULES` by this revision. The
additions only add keys.

| Key | Value | Meaning |
| --- | --- | --- |
| `pitch` | 2.54 | Hole pitch (0.1 inch) |
| `drill` | 1.0 | Plated hole diameter |
| `pad` | 1.8 | Copper pad diameter or side; annular ring 0.4 |
| `maskOpening` | 1.9 | Solder mask opening; 0.05 expansion, 0.64 mask dam at pitch |
| `stripTrace` | 0.8 | Bottom strip trace width |
| `wireTrace` | 0.5 | Top wire trace width |
| `clearance` | 0.3 | Copper to copper on different nets |
| `legendLine` | 0.18 | Silkscreen stroke width |
| `legendText` | 1.0 | Silkscreen text height |
| `edgeLine` | 0.1 | Outline stroke width |
| `edgeKeepout` | 0.5 | Routed trace to board edge |
| `legendPadClearance` (new) | 0.15 | Silkscreen ink to solder mask opening edge |
| `legendEdgeClearance` (new) | 0.2 | Silkscreen ink to board edge (the value `431bfdb` already used for reference text) |
| `usedMargin` (new) | 1.0 | `--outline used`: margin around the used area |

Derived values (not exported):

- Pad keepout radius for silkscreen stroke centrelines:
  `maskRadius + legendPadClearance + legendLine/2`. `maskRadius` is
  `maskOpening/2` for round pads and `maskOpening/2 * sqrt(2)` (the
  circumscribed circle) for square pads. That gives 1.19 for round pads and
  about 1.5835 for square pads.
- Legend rectangle for stroke centrelines: the board outline inset by
  `legendEdgeClearance + legendLine/2` (0.29).

## 5. File set and naming

| File | X2 `FileFunction` | Content |
| --- | --- | --- |
| `<name>.GTL` | `Copper,L1,Top` | Pads, wire traces |
| `<name>.GBL` | `Copper,L2,Bot` | Pads, strip traces |
| `<name>.GTS` | `Soldermask,Top` (polarity Negative) | Mask openings |
| `<name>.GBS` | `Soldermask,Bot` (polarity Negative) | Mask openings |
| `<name>.GTO` | `Legend,Top` | Silkscreen |
| `<name>.GKO` | `Profile,NP` | Outline rectangle, 0.1 stroke |
| `<name>.DRL` | (comment attribute `Plated,1,2,PTH`) | Excellon drill |

The archive holds the files in that order. `<name>` is the sanitised
`options.name`: the output file name without `.zip` in the CLI, and the page
name on the desktop.

Gerber files contain the X2 header (`TF.GenerationSoftware`,
`TF.SameCoordinates`, `TF.FileFunction`, `TF.FilePolarity`), then
`%FSLAX46Y46*%`, `%MOMM*%`, `%LPD*%` and `G01*`. Next comes the aperture
table (`ADD10` upward, C or R templates), then the body (`Dnn*` selects, and
`X..Y..D01/D02/D03*` with integer nanometres), ending in `M02*` and a newline.
Lines end in LF.

Excellon (after this revision, see R3 and R4): `M48`, self-authored comment
lines, `; #@! TF.FileFunction,Plated,1,2,PTH`, `FMAT,2`, `METRIC`, tool
table `T<n>C<d.ddd>`, `%`, `G90`, `G05`, and then for each tool its select
and its hits as `X<x>Y<y>`. Coordinates are always written with three
decimals and a decimal point. The file ends with `M30` and a newline.

The ZIP is stored (no compression) with fixed timestamps, so equal input
gives equal bytes.

## 6. Warnings and notes

Warnings (CLI `warning:` lines; `--strict` exits 3; desktop export notes)
from `431bfdb`, unchanged in wording:

- `<ref> is not seated on this board and is left off the PCB.`
- `<ref> has pin <names> outside the board holes and is left off the PCB.`
- `The wire from <hole> leaves this board and is left off the PCB.`
- `A wire with no end on this board is left off the PCB.`
- `Hole <hole> holds <a> and <b>; a PCB hole takes one lead, so move one of them to another hole in the same strip.`
- `<label> has characters the silkscreen font cannot draw; they are omitted.`

New in this revision (R5):

- `The <mark> mark at <ref> pin <pin> has no room clear of the pads and is left off the silkscreen.`

Notes: `Board <w> x <h> mm, 2 layers, <n> plated holes of 1 mm, <k> part(s).`
plus the wire trace or jumper summary. `<w> x <h>` is the emitted outline
size, so it is the trimmed size under `--outline used`.

## 7. Changes in this revision

### 7.1 Silkscreen clear of pads

Every silkscreen stroke keeps `legendPadClearance` from every solder mask
opening and `legendEdgeClearance` from the board edge. The legend is placed
to avoid the pads, and every stroke is clipped as the final guarantee:

1. **Keepouts**: one circle per used pad, with the pad keepout radius from
   section 4.
2. **Clipping** (applies to all legend strokes: labels, part outlines,
   references, marks, jumper lines) runs in three steps, in this order:
   1. Cut: each segment of each polyline is cut to the legend rectangle,
      and the parameter intervals inside any keepout circle are removed. An
      end point a cut creates (on the rectangle or a keepout circle) is a
      "cut end". Original vertices and segment end points are never cut
      ends.
   2. Rejoin: consecutive kept pieces that meet at an original polyline
      vertex form one stroke.
   3. Filter: a rejoined stroke with at least one cut end is dropped when
      its total length is under `legendLine`. A stroke with no cut end is
      emitted unchanged, whatever its length or the length of its segments.
      For example, the 1/6 mm glyph segments of `2`, `3`, `5` and `6` at
      `legendText` 1.0 survive whole.

   Clipping only removes ink; it never moves a point. A polyline that no cut
   touches is emitted exactly as given.
3. **Reference placement**: a candidate spot is free when its text bounds lie
   in the legend rectangle, do not overlap text already placed, and do not
   intersect any keepout circle. The circle check replaces the
   `pad + 0.2` boxes. The candidate order (above, below, right, left) and the
   fallback to the first candidate are unchanged. The fallback is clipped
   and raises no warning.
4. **Polarity marks** (R5): candidate centres lie at distance
   `keepoutRadius(pad) + halfDiagonal(markBounds)` from the pin. The
   directions are the current "away from the other pins" direction rotated
   by 0, +45, -45, +90 and -90 degrees, in that order. The first candidate
   whose bounds avoid every keepout circle and lie in the legend rectangle
   is used. If none does, the mark is omitted with the section 6 warning,
   because a clipped `+` could read as `-`.
5. **Determinism**: geometry this revision adds (clipping, keepout tests,
   mark and reference candidates, outline trimming) uses only `+ - * /` and
   `Math.sqrt` for values that become emitted coordinates, not `Math.hypot`
   or trigonometry. Rotations by multiples of 45 degrees use the constant
   `Math.SQRT1_2`. This keeps the Bun (JSC) and Boa results bit-identical
   before nanometre rounding (section 7.5). The kept `431bfdb` frame
   transforms (`boardFrame` and the part outline corners) still call
   `rotatePoint` in `packages/core/src/geometry.ts`, which uses
   `Math.cos`/`Math.sin` for non-zero rotation. That is an accepted
   exception, and `geometry.ts` is not edited. The parity example has
   rotation 0 only.

Verification: a test reads the pads from the GTS mask flashes (shape and
size from the aperture). It measures each GTO stroke segment's exact
distance to each mask opening (a circle, or an axis-aligned square), minus
`legendLine/2`, and requires at least `legendPadClearance - 1e-5`. It also
requires every GTO coordinate to lie within the legend rectangle. It runs
over every `pcb.test.ts` fixture and the example, in both outline modes.

Clipping regression test: a board label clear of all keepouts and of the
legend rectangle edge (column labels `25` and `5` of a half board, whose
glyphs contain 1/6 mm segments) appears in the GTO exactly as the
`strokeText` output for that label, at the same position, rounded to 1 nm.
No segment is removed and no stroke is split. A label or outline partly
inside a keepout loses only the cut pieces (step 3 filter).

### 7.2 Outline modes

`BreadboardPcbOptions.outline?: "board" | "used"` (default `"board"`); CLI
`--outline board|used`.

- All geometry (pads, routing decisions, strip traces, legend placement and
  clipping) is computed in the full-board frame first, the same way in both
  modes. The outline mode only affects emission.
- `board`: emission is unchanged. The outline is the full board.
- `used`: the used box is the union of the pad mask openings, the copper
  traces with half their width, and every clipped legend stroke with half
  its width, except row/column/rail labels. The box is expanded by
  `usedMargin`, intersected with the full board rectangle, and rounded
  outward to 0.01 mm (min down, max up), then clamped to the board again.
  Every coordinate is translated by minus the box's min corner and rounded
  to 1 nm, so the origin stays at the bottom-left. A board label is kept only
  if its strokes, translated, lie inside the trimmed legend rectangle;
  otherwise the whole label is dropped. `width` and `height` are the trimmed
  size.
- Containment guarantee: every pad, trace and kept legend stroke lies inside
  the trimmed outline. Its distance to the outline edge is at least
  `min(usedMargin, its distance to the full board edge)`.
- The desktop stays on `board` (user QA Q1).
- CLI validation: any other value fails with exit 2:
  `--outline must be board or used.` followed by the breadboard help, as
  `netlist --format` does.

Tests: default equals explicit `board` (core and CLI); `used` is strictly
smaller for the example; the containment guarantee holds for the example and
the fixtures; no GTO coordinate is below 0; labels outside the trimmed outline
are absent; the copper is the board-mode copper translated by the same
offset.

### 7.3 Golden files and drift check

- Goldens: `examples/breadboard/led-button.{GTL,GBL,GTS,GBS,GTO,GKO,DRL}`,
  generated with `name: "led-button"`, default outline. They are text files
  with LF line endings, generated from the self-authored
  `led-button.jsonl` only.
- Drift check: a golden test in
  `packages/core/src/breadboard/export-golden.test.ts`. It compares each file
  text to its golden with `toBe`, so any byte change fails `bun test`. The
  same test runs the validator (7.4) and the clearance check (7.1) on the
  example. A CLI `gerber --check` is not added: the golden test meets the
  acceptance criterion with less surface.
- `examples/breadboard/README.md` lists the files and the check command
  (`bun test packages/core/src/breadboard/export-golden.test.ts`). It also
  gives the regeneration command: `breadboard gerber ... --output
  tmp/led-button.zip`, then `unzip -o tmp/led-button.zip -d
  examples/breadboard`. The expected e7 warning is mentioned (user QA Q2).

### 7.4 Strict validator

`packages/core/src/breadboard/fabrication-validate.ts` (test support, not
exported from `index.ts`, type-clean under `noUncheckedIndexedAccess`, named
regex groups only):

- `validateGerber(text, outline: { width, height }): readonly string[]`
- `validateExcellon(text, outline: { width, height }): readonly string[]`

Each returns errors as `line <n>: <rule>`. An empty array means valid.

Gerber rules:

- LF only, and the file ends with a newline.
- Every non-empty line is either one extended command `%<cmd>*%` or one
  data block ending in `*` with no other `*`.
- Only the extended commands the writer emits are allowed: `TF.*`,
  `FSLAX46Y46`, `MOMM`, `LPD`, and `ADD<n>` with n >= 10 and a `C,<d>` or
  `R,<d>X<d>` template.
- `FS`, `MO`, `TF.FileFunction` and `TF.FilePolarity` appear exactly once,
  before the first aperture definition.
- Only these data blocks are allowed: `G01*`, `D<n>*`,
  `X<int>Y<int>D0[123]*` and `M02*`.
- A `D<n>` select must name an aperture already defined.
- No `D01` or `D03` may come before an aperture is selected. No `D01` may
  come before `G01` or before a current point exists.
- Coordinates have at most 10 digits (4.6), and their millimetre values lie
  in `[0, width] x [0, height]`.
- `M02*` appears once, as the last block.

Excellon rules:

- LF only, and the file ends with a newline.
- The first line is `M48`.
- The header allows only `;` comments, `FMAT,2`, `METRIC` (required; `INCH`
  rejected) and tool definitions `T<n>C<decimal>`. All tool definitions
  come before the `%` that ends the header.
- The body allows only `G90`, `G05`, tool selects of defined tools, and
  `X<decimal>Y<decimal>`. Each coordinate needs a decimal point, must come
  after a tool select, and must lie inside the outline.
- `M30` appears once, as the last line.

Negative tests in `fabrication-validate.test.ts` cover each rule (at least
one failing input each), plus a positive test on a minimal valid file. Every
Gerber and Excellon file produced in `pcb.test.ts`,
`export-golden.test.ts` and the outline tests is validated. The CLI gerber
test asserts that the written ZIP equals
`encodeBreadboardPcbZip(exportBreadboardPcb(...))` for the same inputs, so
the core validation covers the CLI output too.

### 7.5 Native and TypeScript parity

The native CLI runs the same bundle, so parity holds by construction except
where Boa and JSC differ in number formatting or `Math` functions. Section
7.1 item 5 avoids that risk. A new case in
`apps/cli/src/native-parity.test.ts` runs `breadboard gerber
<abs>/examples/breadboard/led-button.jsonl --output led-button.zip`, with and
without `--outline used`. Each CLI runs in its own temporary directory. The
case compares exit code, stdout, stderr and the ZIP bytes. It runs under
`CARGO_TERM_QUIET=true mise run test-cli`. That command is a required
verification step, separate from `mise run verify`.

### 7.6 Byte-change contract

For the same input with the default or `board` outline:

- GTL, GBL, GTS, GBS and GKO stay byte-identical to `431bfdb`. Width,
  height and notes are unchanged.
- GTO changes (7.1).
- DRL changes: the coordinate format (R3) and the header comments (R4).
- Warnings gain only the new mark warning (R5), when it applies.

The implementer records this once as evidence. They export the example and
the `pcb.test.ts` main fixture at `431bfdb` (a temporary `git worktree` under
`tmp/`) and at the result, then diff the files. The goldens pin the result
from then on.

## 8. Adversarial review of `431bfdb`

Review axes: board-house upload rules (RS-274X/X2 syntax, layer naming,
Excellon header and units, mask polarity, outline, silkscreen, drill and
annular minimums) and breadboard semantics (strip and rail connectivity, net
preservation, rotated boards, off-board items, two leads in one hole).

### 8.1 Findings

| ID | Severity | Finding | Resolution | Regression test |
| --- | --- | --- | --- | --- |
| R1 | high | Silkscreen prints on pads and mask openings. Part outlines run through their own pins, and jumper lines run from pad centre to pad centre. Marks sit at 1.6 from the pin centre, so their ink ends about 0.06 from the 0.95 mask radius. Some board houses clip such ink silently and others put the order on hold. | 7.1 keepouts, clipping, placement | Clearance test over fixtures and the example (7.1). The jumper assertion in `pcb.test.ts` changes from one stroke `c1-c5` to clipped pieces with gaps at c1, c3 and c5. |
| R2 | high | Silkscreen can fall outside the outline. When all four reference spots are taken, the fallback `candidates[0]` is not checked against the edge. Part outlines and marks are not checked either. This produces negative or out-of-board coordinates. | Clip to the legend rectangle (7.1) | Fixture: a part on the top rail whose four reference spots are blocked by neighbours, so the fallback runs. Assert all GTO coordinates are inside the legend rectangle; the validator also checks this. |
| R3 | mid | Excellon coordinates are `Number(v.toFixed(4))`, so a whole-millimetre value has no decimal point. On a full board, column 49 and some rail holes sit at x = 127 and are written `X127`. Under `METRIC` without a decimal point, a reader applies its zero-suppression default and can misplace the hole by orders of magnitude. | Always write three decimals (`X127.000`) | Full-board fixture with a part in column 49 asserts `X127.000Y`. The validator rejects coordinates without a decimal point (negative test). |
| R4 | mid | Two drill header comment lines (`; DRILL file ...` and `; FORMAT={-:-/ absolute / metric / decimal}`) copy another EDA tool's output wording. That conflicts with the provenance constraint. | Replace them with one self-authored line, `; Nodetto breadboard PCB drill file: plated holes, millimetres, absolute, decimal point coordinates`. Keep `; #@! TF.FileFunction,Plated,1,2,PTH`, the published convention for carrying X2 file attributes in drill files, which CAM tools use to classify the file. | `pcb.test.ts` asserts the exact header lines up to `%`. The golden pins them too. |
| R5 | mid | A polarity mark can land on a neighbouring used pad or be partly clipped, so `+` could read as `-`. | 7.1 item 4: candidate directions, then omit with a warning | Fixture: an LED whose anode has used neighbours in all candidate directions gets the warning and no mark. A plain LED gets its `+` clear of all keepouts. |
| R6 | mid | TS/native parity for `breadboard gerber` is untested. `markBeside` normalises with `Math.hypot`, whose last bit may differ between engines, and the result feeds emitted coordinates. | 7.1 item 5 and 7.5 | Native parity case (7.5) |
| R7 | low | The `parseGerber` test helper ignores lines it does not recognise, so malformed blocks pass silently. | Strict validator (7.4) | Validator negative tests. All generated files are validated. |

### 8.2 Reviewed without change

- **X2 attributes**: `FileFunction` values (`Copper,L1,Top`, `Copper,L2,Bot`,
  `Soldermask,Top/Bot`, `Legend,Top`, `Profile,NP`) and
  `GenerationSoftware`/`SameCoordinates` are well formed.
- **Mask polarity**: the mask files are Negative, which is correct because
  the image shows openings.
- **Format statements**: `FSLAX46Y46` with `MOMM` is correct. Coordinates
  are integer nm, at most 10 digits for these board sizes.
- **Layer naming**: the Protel-style extensions (GTL, GBL, GTS, GBS, GTO,
  GKO, DRL) are recognised by JLCPCB, PCBWay and Elecrow. No paste layers
  are needed for a bare through-hole board.
- **Drill and copper rules**: 1.0 drill, 0.4 annular ring, 0.05 mask
  expansion, 0.64 mask dam, 1.54 hole-to-hole, 0.3 copper clearance, 0.5
  edge keepout, 0.18 silkscreen line and 1.0 text all meet the section 4
  rule.
- **Outline**: the 0.1 stroke on the board rectangle in a `Profile,NP` file
  is correct.
- **Strips and rails**: each strip trace is collinear with its own holes
  only. Rails follow the connectivity model (continuous). The nets are
  preserved by construction.
- **Routing exemption**: same-net passes use breadboard connectivity, so a
  trace can only join copper the breadboard already joins. This holds even
  when parts or wires left off the PCB contributed to that net.
- **Rotated boards**: the frame undoes board rotation, and an existing test
  shows identical files.
- **Off-board parts and wires**: they are left off with warnings. A part
  with any pin off the board is left off whole.
- **Two leads in one hole**: a warning, with one pad. A PCB cannot seat two
  leads, and the export does not move parts. The example triggers this
  warning (user QA Q2).
- **ZIP**: stored entries, fixed DOS date, valid local, central and end
  records. It is shared with the HTML bundle export and is not changed.

## 9. Interfaces

- `BreadboardPcbOptions` gains `outline?: "board" | "used"`. The new
  `BREADBOARD_PCB_RULES` keys are listed in section 4. No other export
  changes signature. `GerberLayer` and `excellonDrill` stay internal.
- The CLI `breadboard gerber` gains `--outline <board|used>`. Help gets the
  usage `[--outline board|used]` and one option line. Existing options and
  messages are unchanged.
- No desktop or `ui-solid` change.
- Docs: `docs/breadboard/pcb.md` gains the outline modes, silkscreen
  clearance, the drill coordinate format and the new warning.
  `README.md` mentions `--outline used` in one sentence.
  `examples/breadboard/README.md` gets the PCB goldens (7.3).

Suggested implementation split (for the plan): (a) validator and its tests,
which do not depend on the rest; (b) `pcb.ts`/`gerber.ts` changes
(R1-R5, outline modes) with core tests; (c) CLI option, help, parity case,
goldens and docs, which depend on (b) and are validated with (a).

## 10. Verification

- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/breadboard apps/cli/src/breadboard-commands.test.ts`
- `CARGO_TERM_QUIET=true mise run test-cli` (native parity, 7.5)
- `CARGO_TERM_QUIET=true BUN_OPTIONS=--jsx-runtime=classic mise run verify`
- A typecheck of `packages/core` with `noUncheckedIndexedAccess` enabled
  (for example a temporary tsconfig extending the root with that flag, under
  `tmp/`).
- The one-time 7.6 byte-diff evidence against `431bfdb`.

## 11. Completion notes

The workflow run stopped at the plan 03 gate that asks for recorded pre-fix
failures. Plans 04 and 05 and the changes below were then completed outside
the workflow on the same branch.

### 11.1 Module boundary

The generic fabrication code lives in `packages/core/src/pcb/`, separate from
breadboard semantics, so it can later become its own package:

| File | Role |
| --- | --- |
| `model.ts` | `PcbDesign`: outline, rules, pads, top and bottom traces, legend strokes (mm, y up) |
| `gerber.ts` | Gerber RS-274X / X2 layer writer |
| `excellon.ts` | Excellon drill writer |
| `fabrication.ts` | `PcbDesign` to the GTL/GBL/GTS/GBS/GTO/GKO/DRL file set |
| `trim.ts` | `--outline used` trimming of a `PcbDesign` |
| `font.ts`, `legend.ts` | Stroke font and silkscreen clipping |
| `validate.ts`, `oracle.test-support.ts` | Test support: strict validator and independent reader |
| `index.ts` | Public entry; test support is not exported |

`boundary.test.ts` fails if a file in the folder imports anything outside
it. Test files may also import `bun:test`, `node:fs`, `node:path` and
`gerber-parser`. `breadboard/pcb.ts` is the adapter that turns a board into
a `PcbDesign`: hole selection, strip traces, wire routing and legend layout.
The restructure was checked byte for byte against the pre-restructure output
for the example and a fixture in both outline modes.

The writer stays in TypeScript rather than a Rust crate such as
`gerber-types`, because the shared engine runs in the desktop webview, the
hosted web app and the Boa-embedded native CLI.

### 11.2 Independent reader

`gerber-parser` 4.2.7 (tracespace, MIT) is a dev dependency used only by
tests. Every generated file in the core, golden and fabrication tests is read
back with it. A test fails on any warning other than two expected ones: the
`%TF` X2 attributes the 2022 parser predates, and the note that the drill
header declares no zero suppression, which decimal-point coordinates do not
need. The tests also compare the parsed geometry with the design: pads and
tools, traces, outline and drill hits, and copper pads against drill hits.

`gerber-parser` declares `@types/node` 13 as a runtime dependency. A root
`overrides` entry keeps `@types/node` at `^26.2.0`; without it, the CLI's
`Buffer` types regress and typecheck fails.

### 11.3 Findings after the workflow

| ID | Finding | Resolution | Test |
| --- | --- | --- | --- |
| F2 | The R1 clearance test passed against `431bfdb`: the old rules lacked `legendPadClearance`, so the check compared against `NaN` and reported nothing | `legendClearanceErrors` throws on a non-finite clearance; the R1 test pins 0.15 and 0.2 | Validator test "rejects a missing clearance rule"; R1 now fails pre-fix |
| F3 | Outward rounding of the used outline floored `(17.9 - 1) * 100 = 1689.999...`, so trimmed outlines grew by a spurious 0.01 mm. The example's used width was 30.99 instead of 30.98 | Round to nanometres before taking 0.01 mm steps | `trim.test.ts` exact sizes; CLI `--outline used` asserts 30.98 |

Pre-fix evidence, with the plan 03 tests run against `431bfdb`'s `pcb.ts` and
`gerber.ts`: R1, R2, R3/R4, R5 (omitted mark) and the outline test fail. F1
and the R5 kept-mark case are guards and pass, as the plan allows.
