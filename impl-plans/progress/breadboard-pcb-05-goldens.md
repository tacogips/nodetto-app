# Progress: breadboard-pcb-05-goldens

Completed outside the workflow after it stopped at the plan 03 evidence gate.

- `examples/breadboard/led-button.{GTL,GBL,GTS,GBS,GTO,GKO,DRL}` were
  generated from the self-authored `led-button.jsonl` with the default
  outline.
- `export-golden.test.ts` compares each file byte for byte. It also runs the
  strict validator, the independent reader and the legend clearance check on
  them, and pins the two expected two-lead warnings.
- The drift check was verified: changing one drill coordinate by 0.01 mm
  fails the test, and restoring it passes.
- `examples/breadboard/README.md` lists the goldens, the check command and the
  regeneration commands.
