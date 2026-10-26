# LED and button breadboard example

This original circuit uses a half board, a 5V battery (BT1), a normally open push button (SW1), a 220 ohm resistor (R1), and a red LED (D1). Red and blue jumpers connect the supply rails to the circuit. Its nets are `GND`, `VCC`, `N_D1_1`, and `N_R1_1`.

Check the document and compare generated files with their goldens:

```sh
bun apps/cli/src/main.ts lint examples/breadboard/led-button.jsonl
bun apps/cli/src/main.ts breadboard bom examples/breadboard/led-button.jsonl --check examples/breadboard/led-button.bom.csv
bun apps/cli/src/main.ts breadboard netlist examples/breadboard/led-button.jsonl --format kicad --check examples/breadboard/led-button.net
bun apps/cli/src/main.ts breadboard netlist examples/breadboard/led-button.jsonl --format spice --check examples/breadboard/led-button.cir
```

The PCB Gerber and drill goldens are `led-button.GTL`, `.GBL`, `.GTS`, `.GBS`,
`.GTO`, `.GKO` and `.DRL` (see [PCB export](../../docs/breadboard/pcb.md)).
They are checked by the golden test, which fails on any byte change:

```sh
bun test packages/core/src/breadboard/export-golden.test.ts
```

After an intended change, regenerate them and review the diff:

```sh
bun apps/cli/src/main.ts breadboard gerber examples/breadboard/led-button.jsonl --output tmp/led-button.zip
unzip -o tmp/led-button.zip -d examples/breadboard
```

The export warns that holes e7 and e11 each hold two leads. The example
keeps that layout, which is fine on a breadboard; on a PCB, move one lead to
another hole in the same strip.

The BOM contains four component rows. Lint reports no findings. See [format details](../../docs/breadboard/format.md), [ERC rules](../../docs/breadboard/erc-rules.md), and [KiCad import](../../docs/breadboard/kicad-import.md).
