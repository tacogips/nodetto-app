# LED and button breadboard example

This original circuit uses a half board, a 5V battery (BT1), a normally open push button (SW1), a 220 ohm resistor (R1), and a red LED (D1). Red and blue jumpers connect the supply rails to the circuit. Its nets are `GND`, `VCC`, `N_D1_1`, and `N_R1_1`.

Check the document and compare generated files with their goldens:

```sh
bun apps/cli/src/main.ts lint examples/breadboard/led-button.jsonl
bun apps/cli/src/main.ts breadboard bom examples/breadboard/led-button.jsonl --check examples/breadboard/led-button.bom.csv
bun apps/cli/src/main.ts breadboard netlist examples/breadboard/led-button.jsonl --format kicad --check examples/breadboard/led-button.net
bun apps/cli/src/main.ts breadboard netlist examples/breadboard/led-button.jsonl --format spice --check examples/breadboard/led-button.cir
```

The BOM contains four component rows. Lint reports no findings. See [format details](../../docs/breadboard/format.md), [ERC rules](../../docs/breadboard/erc-rules.md), and [KiCad import](../../docs/breadboard/kicad-import.md).
