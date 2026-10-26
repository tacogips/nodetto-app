# breadboard-pcb-06-docs

- planId: breadboard-pcb-06-docs
- planPath: impl-plans/active/breadboard-pcb-06-docs.md
- wave: 1; dependsOn: none (all behaviour and wording are pinned in the
  design and in plan 03's "Pinned contract changes")
- design: design-docs/specs/design-breadboard-pcb.md sections 4, 5, 6,
  7.1, 7.2 and 9 (docs)
- progress log: impl-plans/progress/breadboard-pcb-06-docs.md
- session: opus-luna-design-and-implement-review-loop-session-501; issue
  local-input:feat/breadboard-gerber@431bfdb
- Wave map: see impl-plans/active/breadboard-pcb-01-validator.md.

## Intent

Update the user documentation for the hardened PCB export:

- the silkscreen clearance
- the `--outline board|used` option
- the drill coordinate format
- the new polarity-mark warning

## Repository context

- `docs/breadboard/pcb.md`, from 431bfdb. Its sections are "What the PCB
  contains", the file table, "Ordering", "Warnings" and "Choosing a board".
- `README.md`: the breadboard CLI examples near line 129, and the
  breadboard paragraph near lines 681-695.
- `packages/core/src/breadboard/docs.test.ts` does not check `pcb.md`. Do
  not add a test there.

## Non-goals

- Do not edit `examples/breadboard/README.md` (plan 05) or `help.ts`
  (plan 04).
- Do not restructure the docs or describe internals such as the clipping
  algorithm or keepout formulas beyond what users need.

## writePaths

- docs/breadboard/pcb.md
- README.md
- impl-plans/progress/breadboard-pcb-06-docs.md (new)

## sharedPaths

none

## File-level changes

### docs/breadboard/pcb.md

- Outline bullet: keep the board sizes. Add that `--outline used` trims the
  outline to the used area plus 1 mm (never beyond the breadboard), drops
  row and column labels outside it, and keeps the origin at the bottom-left
  corner. Say that small circuits can then fit a 100 x 100 mm price tier.
  Say that the desktop export always uses the full board.
- Silkscreen bullet: add that silkscreen is kept 0.15 mm from every solder
  mask opening and 0.2 mm from the board edge. Lines and text that would
  print on a pad are cut back around it. A reference that has no free spot
  may be partly cut.
- Add a sentence to the polarity marks: a mark is placed beside the pin
  clear of the pads, or left off with a warning.
- File table: add to the `.DRL` row "coordinates in millimetres with three
  decimals".
- Show the CLI example with `--outline used` as a second command.
- Ordering: update the minimums sentence to include the silkscreen to pad
  clearance (0.15 mm).
- Warnings: add a bullet for "The `<mark>` mark at `<ref>` pin `<pin>` has
  no room clear of the pads and is left off the silkscreen." with the
  advice to move the part or the neighbouring parts by one hole.
- Link the golden files: "See examples/breadboard for the example's
  Gerber and drill files."

### README.md

- After the existing `nodetto-cli breadboard gerber board.jsonl --output board-pcb.zip`
  line, add `nodetto-cli breadboard gerber board.jsonl --outline used --output board-pcb.zip`.
- In the breadboard paragraph, add one sentence after "...silkscreen
  jumper lines.": "`--outline used` trims the board to the used area so
  small circuits fit cheaper size tiers."

Pitfalls:

- No emojis. Use the exact warning wording from plan 03's pinned contract.
- Do not change any other README section. Keep the line wrapping style of
  the surrounding text.

## Invariants

- No file outside writePaths is changed.
- Every number in the docs matches design section 4: 0.15, 0.2, 1.0, 1.0
  drill, 1.8 pad, 0.8 strip, 0.5 wire, 0.3 clearance, 0.18 line, 1.0 text.

## Verification (record in the progress log)

1. `grep -n "outline used" docs/breadboard/pcb.md README.md` shows both
   files.
2. `grep -n "0.15 mm" docs/breadboard/pcb.md` shows the clearance.
3. `grep -n "has no room clear of the pads" docs/breadboard/pcb.md` shows
   one line.
4. `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/breadboard/docs.test.ts`
   must exit 0, unaffected.
5. Run `git diff --stat -- docs/breadboard/pcb.md README.md` (read-only)
   and record the changed line counts.

## Per-worker protocol

Same as plan 01:

- read each file fresh before you edit it, and record its sha256 before and
  after
- write an intent snapshot first
- on drift, stop and record it
- run no state-changing git commands
- edit only your own progress log

## Done criteria (mechanical)

- Verification checks 1-4 pass as stated, and check 5 is recorded.
