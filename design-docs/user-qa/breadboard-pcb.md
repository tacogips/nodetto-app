# User QA: breadboard PCB export

These questions concern design-docs/specs/design-breadboard-pcb.md. Each has a
default. Implementation goes ahead with the default unless the user overrides
it.

## Q1. Outline setting on the desktop

- Default: the desktop Export dialog always exports the full board outline.
  `--outline used` is available only in the CLI.
- Alternative: add a single "Trim outline to used area" checkbox to the
  Breadboard tab of the Export dialog, passed as `outline: "used"`.

## Q2. Two leads in one hole in the example

- Default: leave `examples/breadboard/led-button.jsonl` unchanged. Its PCB
  export keeps the warning "Hole e7 holds SW1 pin 3 and R1 pin 1", and the
  PCB goldens are generated with that warning present. The BOM, netlist and
  SVG goldens stay untouched.
- Alternative: move R1 pin 1 to another hole in the same strip so the
  example exports with no warning. The nets stay the same, but the example
  JSONL changes and its goldens must be rechecked.
