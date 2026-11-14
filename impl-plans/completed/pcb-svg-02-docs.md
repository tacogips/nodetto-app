# pcb-svg-02-docs

- planId: pcb-svg-02-docs
- planPath: impl-plans/active/pcb-svg-02-docs.md
- wave: 1; dependsOn: none
- design: design-docs/specs/design-pcb-svg-export.md sections 5, 6, 8;
  user QA design-docs/user-qa/pcb-svg-export.md Q1-Q3
- progress log: impl-plans/progress/pcb-svg-02-docs.md
- scratch and logs: tmp/pcb-svg-s538/pcb-svg-02-docs/ (git-ignored)

## Intent

Document that PCB pages now export as SVG, PNG and PDF the way the canvas
draws them, on a dark board background. The docs describe the behaviour
fixed by the design. They do not depend on code from the other plans.

## Repository context

- `docs/pcb/kicad-pcb.md` headings: Supported content, The page, Editing,
  Saving, Gerber and drill export (line 95), Command reference (line 125),
  Limits. Imitate the tone and length of the "Gerber and drill export"
  section.
- `docs/cli.md` section "PCB boards (KiCad)" (line 46) has a bash block with
  `pcb import` and `pcb gerber`.
- `README.md` line 32-33 bullet: "**PCB boards**: open KiCad boards, edit
  parts and tracks, and export Gerber and drill files. See [KiCad PCB
  boards](docs/pcb/kicad-pcb.md)."

## File-level changes

1. `docs/pcb/kicad-pcb.md`: add a section `## SVG, PNG and PDF export`
   directly after the "Gerber and drill export" section and before
   "Command reference". Content (short paragraphs or bullets):
   - The Export dialog and `nodetto-cli export` export a PCB page as SVG,
     PNG or PDF, drawn as on the canvas: board outline, copper tracks and
     arcs, pads, vias with holes, zone fills, silkscreen and fabrication
     graphics and texts, with the canvas layer colours.
   - All layers are drawn; the Layers panel visibility affects only the
     canvas. Hidden texts and hidden elements are left out.
   - The board area is drawn on a dark board colour so the layer colours
     stay readable. The chosen export background (or transparency) fills
     the margin around it.
   - Line widths are true board widths, so they scale with the PNG scale.
   - Example:
     `nodetto-cli export board.jsonl --format svg --output board.svg` and
     `nodetto-cli export board.jsonl --format png --scale 2 --output board.png`.
   If "Command reference" lists commands, add one line for `export` with a
   pointer to `docs/cli.md`; otherwise leave it.
2. `docs/cli.md`, "PCB boards (KiCad)": change the intro sentence to
   mention drawing the board as an image too, and add the line
   `nodetto-cli export board.jsonl --format svg --output board.svg` to the
   existing bash block after `pcb gerber`.
3. `README.md`: change the PCB bullet to "open KiCad boards, edit parts and
   tracks, export Gerber and drill files, and export the board as SVG, PNG
   or PDF." Keep the link and line wrapping style.
4. `impl-plans/progress/pcb-svg-02-docs.md` (new): progress log.

## Key points and pitfalls

- Use only CLI flags that exist today: `--format`, `--output`, `--page`,
  `--scale`, `--background <#rrggbb>|transparent`, `--padding`. Do not
  invent flags (there is no `render` command and no board-colour flag).
- Do not state the hex value of the board colour (it may change per user QA
  Q3); say "dark board colour".
- English only, no emojis, ASCII punctuation as in the surrounding text.
- Do not mention ErgoDash in new text, and do not add or change images.
- Do not edit `docs/import-export.md`, design docs or other README
  sections.

## Tests

None (documentation). Checks are mechanical, below.

## Verification (each must meet the expected result; save outputs in the scratch dir)

- `grep -n "^## SVG, PNG and PDF export" docs/pcb/kicad-pcb.md` -> exactly
  one match, with a line number between those of "## Gerber and drill
  export" and "## Command reference".
- `grep -n "nodetto-cli export board.jsonl --format svg" docs/cli.md docs/pcb/kicad-pcb.md`
  -> at least one match in each file.
- `grep -n "SVG, PNG or PDF" README.md` -> one match in the PCB boards bullet.
- `LC_ALL=C grep -nP "[^\x00-\x7F]" docs/pcb/kicad-pcb.md docs/cli.md README.md > tmp/pcb-svg-s538/pcb-svg-02-docs/non-ascii.txt; git diff -U0 docs/pcb/kicad-pcb.md docs/cli.md README.md | LC_ALL=C grep -P "^\+.*[^\x00-\x7F]"`
  -> the second command prints nothing (no non-ASCII characters added).
- `git diff --stat -- docs README.md` -> only `docs/pcb/kicad-pcb.md`,
  `docs/cli.md` and `README.md` listed.

## Done criteria

- The three docs contain the changes above and nothing else changed in
  them (`git diff --stat` shows only these three files plus the progress log
  for this plan).
- The progress log lists each check with its result.

## Non-goals

- No code, test or design-doc changes.
- No screenshots.

## Worker protocol

- Before each edit, read the file fresh and record its SHA-256 in the
  progress log; after the edit, record the new SHA-256. If a file changed
  since your last read and you did not make the change, record the drift
  and stop editing that file.
- Edit only the writePaths of this plan; write only your own progress log;
  no git commit, branch, stash or worktree commands; no workspace-wide
  formatting.
