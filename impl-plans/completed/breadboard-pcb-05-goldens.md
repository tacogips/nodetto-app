# breadboard-pcb-05-goldens

- planId: breadboard-pcb-05-goldens
- planPath: impl-plans/active/breadboard-pcb-05-goldens.md
- wave: 3; dependsOn: breadboard-pcb-01-validator, breadboard-pcb-03-core-export
- design: design-docs/specs/design-breadboard-pcb.md section 7.3 (goldens
  and drift check), 7.1 Verification and 7.4 (applied to the example), and
  user QA Q2 (the example stays unchanged)
- progress log: impl-plans/progress/breadboard-pcb-05-goldens.md
- session: opus-luna-design-and-implement-review-loop-session-501; issue
  local-input:feat/breadboard-gerber@431bfdb
- Wave map: see impl-plans/active/breadboard-pcb-01-validator.md.

## Intent

Check in the example's PCB files as individual text goldens. Add a golden
test that fails on any byte drift and that validates the example output
with the strict validator and the clearance check. Document both in the
example README.

## Repository context

- `packages/core/src/breadboard/export-golden.test.ts` already pins the
  BOM, KiCad and SPICE goldens with `readText` and `toBe`. Imitate its
  module-level `document`, `page` and `pageId` setup and add tests below
  the existing ones.
- `examples/breadboard/README.md` lists the check commands for the
  existing goldens.
- The goldens are generated from `examples/breadboard/led-button.jsonl`
  only.

## Non-goals

- Do not edit `led-button.jsonl` (user QA Q2), the `.bom.csv`, `.net` or
  `.cir` goldens, or the existing tests in `export-golden.test.ts`.
- No used-mode goldens; plan 03 tests used mode. No ZIP golden.
- No CLI `--check` (design D6).

## writePaths

- examples/breadboard/led-button.GTL (new)
- examples/breadboard/led-button.GBL (new)
- examples/breadboard/led-button.GTS (new)
- examples/breadboard/led-button.GBS (new)
- examples/breadboard/led-button.GTO (new)
- examples/breadboard/led-button.GKO (new)
- examples/breadboard/led-button.DRL (new)
- packages/core/src/breadboard/export-golden.test.ts
- examples/breadboard/README.md
- impl-plans/progress/breadboard-pcb-05-goldens.md (new)

## sharedPaths

none

## File-level changes

### Golden generation

Generate the goldens with the CLI, which uses the default outline. The
CLI's `writeFileAtomic` (`apps/cli/src/write-atomic.ts`) does not create
parent directories, so create the scratch directory first:

- `mkdir -p tmp/breadboard-pcb-s501/breadboard-pcb-05-goldens`
- `bun apps/cli/src/main.ts breadboard gerber examples/breadboard/led-button.jsonl --output tmp/breadboard-pcb-s501/breadboard-pcb-05-goldens/led-button.zip`
- `unzip -o tmp/breadboard-pcb-s501/breadboard-pcb-05-goldens/led-button.zip -d examples/breadboard`

Record stderr, because it holds the expected warnings. Do not edit the
generated files by hand. They must end with a single `\n` and use LF line
endings.

### export-golden.test.ts

Add these imports:

- `exportBreadboardPcb` and `BREADBOARD_PCB_RULES` from `@nodetto/core`
- `validateGerber`, `validateExcellon` and `legendClearanceErrors` from
  `./fabrication-validate.ts`

Add these tests (input -> expected):

- `exportBreadboardPcb(document, pageId, { name: "led-button" })` -> 7
  files; each `file.text` is `toBe(readText(`examples/breadboard/${file.path}`))`.
  This is the drift check.
- The same PCB -> each Gerber file passes `validateGerber(text, pcb)` and
  the DRL passes `validateExcellon(text, pcb)`, all `[]`.
- The same PCB -> `legendClearanceErrors({ gto, gts, outline: pcb,
  padClearance: BREADBOARD_PCB_RULES.legendPadClearance, edgeClearance:
  BREADBOARD_PCB_RULES.legendEdgeClearance })` is `[]`.
- The warnings equal the exact list printed during generation. This
  includes `Hole e7 holds SW1 pin 3 and R1 pin 1; ...`, plus the R5 mark
  warning only if it was emitted.

Pitfalls:

- Use `readText` (utf8), not a normalised comparison. Bytes matter.
- Narrow the `exportBreadboardPcb` string result with a thrown error, as
  the file does for `page`.
- `noUncheckedIndexedAccess`: find files by path with `.find` and a guard;
  no `files[4]`.

### examples/breadboard/README.md

- Describe the seven PCB goldens: one line per file, or one sentence plus
  a list.
- Add the drift-check command:
  `bun test packages/core/src/breadboard/export-golden.test.ts`.
- Add the regeneration commands, in this order:
  `mkdir -p tmp`, then
  `bun apps/cli/src/main.ts breadboard gerber examples/breadboard/led-button.jsonl --output tmp/led-button.zip`,
  then `unzip -o tmp/led-button.zip -d examples/breadboard`.
- Note that the export reports the e7 two-leads warning, and say why the
  example keeps it (user QA Q2 default).
- Keep the existing BOM and netlist commands. Link `docs/breadboard/pcb.md`.

## Invariants

- `git diff --exit-code examples/breadboard/led-button.jsonl examples/breadboard/led-button.bom.csv examples/breadboard/led-button.net examples/breadboard/led-button.cir`
  exits 0.
- Existing tests in `export-golden.test.ts` are unchanged.
- No file outside writePaths is changed.

## Verification (record exit codes in the progress log)

1. `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/breadboard/export-golden.test.ts`
   must exit 0.
2. Drift proof. Copy `examples/breadboard/led-button.GTO` to
   `tmp/breadboard-pcb-s501/breadboard-pcb-05-goldens/GTO.bak`, append one
   character to the golden, rerun step 1, and confirm it exits non-zero.
   Then restore the golden from the backup, confirm with `cmp`, and rerun
   step 1 to confirm exit 0. Record all three exit codes.
3. The invariant `git diff --exit-code ...` above must exit 0.
4. `bunx biome check packages/core/src/breadboard/export-golden.test.ts --diagnostic-level=warn`
   must exit 0.
5. `bun run typecheck` must exit 0. If it fails only in files this plan
   does not own (for example plan 04's `apps/cli/src` files, edited in the
   same wave), record those files as sibling drift in the progress log.
   That is not this plan's failure, and you must not edit those files.
   Serial reconciliation runs the final gate.
6. `file examples/breadboard/led-button.*` shows ASCII text for the 7 new
   files, and `grep -c $'\r' examples/breadboard/led-button.G*` reports 0.

## Per-worker protocol

Same as plan 01:

- read each file fresh before you edit it, and record its sha256 before and
  after (for the generated goldens, record their hashes)
- write an intent snapshot first
- on drift, stop and record it
- run no state-changing git commands
- keep scratch only under `tmp/breadboard-pcb-s501/breadboard-pcb-05-goldens/`,
  and never put `*.test.ts` files under `tmp/`
- edit only your own progress log

## Done criteria (mechanical)

- The 7 golden files exist, and step 1 exits 0.
- The step 2 drift proof is recorded (non-zero, then 0).
- Step 3 exits 0.
