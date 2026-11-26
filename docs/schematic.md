# Schematic pages

Schematic pages draw single-sheet electrical circuits. Place parts, connect
pins with orthogonal wires, add junctions and labels, and inspect electrical
findings. Symbols snap to a 10-unit grid; rotate in quarter turns or mirror
around the anchor pin. Moving a part does not rubber-band its wires.

## Elements and semantic examples

Each example is a type and its `semantic` object, not a complete JSONL element.
Parts have editable `reference` and `value` fields. Capacitor polarity,
transistor polarity, MOSFET channel and switch style are fields, not separate
types. Connector pin counts range from 1 to 40; ICs have up to 256 uniquely
numbered pins on the four sides.

| Type | Example semantic object |
| --- | --- |
| `schematic.resistor` | `{"reference":"R1","value":"10k"}` |
| `schematic.capacitor` | `{"reference":"C1","value":"100n","polarized":false}` |
| `schematic.inductor` | `{"reference":"L1","value":"10u"}` |
| `schematic.diode` | `{"reference":"D1","value":"1N4148"}` |
| `schematic.led` | `{"reference":"D2","value":"LED"}` |
| `schematic.bjt` | `{"reference":"Q1","value":"NPN","polarity":"npn"}` |
| `schematic.mosfet` | `{"reference":"Q2","value":"NMOS","channel":"n"}` |
| `schematic.switch` | `{"reference":"SW1","value":"SW","style":"toggle"}` |
| `schematic.potentiometer` | `{"reference":"RV1","value":"10k"}` |
| `schematic.battery` | `{"reference":"BT1","value":"9V"}` |
| `schematic.voltageSource` | `{"reference":"V1","value":"5V"}` |
| `schematic.connector` | `{"reference":"J1","value":"CONN","pinCount":2}` |
| `schematic.ic` | `{"reference":"U1","value":"IC","pins":[{"number":1,"name":"IN","side":"left"}]}` |
| `schematic.power` | `{"style":"ground","net":"GND"}` |
| `schematic.wire` | `{"points":[{"x":0,"y":0},{"x":20,"y":0}]}` |
| `schematic.junction` | `{}` |
| `schematic.label` | `{"net":"NET"}` |
| `schematic.noConnect` | `{}` |

A capacitor may set `polarized` to true; BJT `polarity` is `npn` or `pnp`,
MOSFET `channel` is `n` or `p`, switch `style` is `toggle` or `push`, and
power `style` is `ground` or `rail`.

## Pins

| Symbol | Pin numbers and names |
| --- | --- |
| Resistor, inductor, switch, nonpolar capacitor | 1, 2 |
| Polar capacitor, battery, voltage source | 1 positive (+), 2 negative (-) |
| Diode, LED | 1 anode (A), 2 cathode (K) |
| BJT | 1 emitter (E), 2 base (B), 3 collector (C) |
| MOSFET | 1 gate (G), 2 drain (D), 3 source (S) |
| Potentiometer | 1, 2 wiper (W), 3 |
| Connector | 1 through `pinCount` |
| IC | Explicit number, name and side per pin |
| Power | 1 |

## Connectivity

Pins, power pins, wire ends, junctions and label anchors join at coincident
points. Wire bends alone do not join other wires. A crossing without a junction
remains separate; place a junction to connect the wires. Same-named labels
and power symbols join nets within one page. A no-connect mark suppresses an
unconnected-pin warning at its pin. Wires must be orthogonal; diagonal
segments are rejected as `schematic.wireDiagonal`.

## Electrical rule checks

| Rule | Severity | Meaning |
| --- | --- | --- |
| `unconnected-pin` | warning | A part pin has no connection. |
| `single-pin-net` | warning | A connected net has only one part pin and no power symbol. |
| `dangling-wire-end` | warning | A wire end is unattached, including an end touching a path without a junction. |
| `duplicate-reference` | error | More than one part has the same reference. |
| `shorted-power-nets` | error | Different power net names are connected. |

## PCB parity

PCB pages are checked against the first schematic page when one exists.

| Rule | Severity | Meaning |
| --- | --- | --- |
| `pcb-parity-missing-connection` | warning | A schematic connection is missing on the PCB. |
| `pcb-parity-extra-connection` | error | A PCB net joins distinct schematic nets. |
| `pcb-parity-missing-part` | warning | A schematic part has no matching footprint. |
| `pcb-parity-extra-part` | warning | A footprint has no matching schematic part. |
| `pcb-parity-value-mismatch` | warning | Matching references have different values. |

## Text netlist

The deterministic UTF-8 text format starts with `# nodetto schematic netlist 1`,
then `# document <title>` and `# page <page-name>`. Component lines precede
net lines: `component <reference> <value> <partName>` and
`net <code> <name> <reference>.<pin> ...`. Empty tokens or tokens containing
whitespace, `"`, `#`, or backslash are double-quoted; backslashes and quotes
are escaped with a backslash. Lines use LF and the file ends with a newline.
See [the example](../examples/schematic/led-switch.netlist.txt).

## Desktop editing

Select the Schematic workspace to get the schematic part palette and the wire
tool.

- Wire tool: click to add points. Each click adds an orthogonal corner,
  horizontal first, or vertical first while Shift is held. Clicking a pin,
  wire end, junction or label anchor other than the start finishes the wire.
  Enter also finishes it, and Esc cancels the draft. Ending a wire on the
  middle of another wire creates a T and adds a junction there in the same
  undo step. A click that would join wires through a labelled crossing is
  rejected, and the reason is announced in a status notice on the canvas.
- Wire points: select a wire to show one handle per point. Drag a handle, or
  Tab to it and press an arrow key to move it one grid step. Untouched ends
  stay fixed, and focus follows the moved point when bends merge. Undo
  restores the previous shape.
- Parts, power symbols and labels: `r` rotates clockwise, `Shift+R` rotates
  counter-clockwise and `x` mirrors the selection. Dragging snaps to the grid
  when snapping is on.

## KiCad mapping

The KiCad netlist export uses nodetto part names. Import to a breadboard maps
these names as follows; unsupported projections report diagnostics.

| Schematic type | KiCad part name | Breadboard mapping |
| --- | --- | --- |
| resistor | `Resistor` | resistor |
| capacitor | `Capacitor` / `CapacitorPolarized` | ceramic / electrolytic capacitor |
| diode / LED | `Diode` / `LED` | diode / LED |
| BJT | `TransistorNPN` / `TransistorPNP` | transistor, EBC pins |
| potentiometer / battery | `Potentiometer` / `Battery` | potentiometer / battery |
| connector | `Header` | header |
| IC | `DIP` / `Header` / `IC_Generic` | contiguous pins up to 40 map to DIP or header; sparse or larger ICs cannot project |
| switch | `SW_Push` | button; schematic pins 1 and 2 map to 1 and 3 |
| MOSFET | `MOSFET_N` / `MOSFET_P` | transistor, with pin-name diagnostic |
| inductor / voltage source | `Inductor` / `VoltageSource` | two-pin header, with unsupported-symbol diagnostic |

## CLI

```sh
nodetto-cli edit circuit.jsonl --ops operations.json
nodetto-cli lint circuit.jsonl
nodetto-cli export circuit.jsonl --page Circuit --format svg --output circuit.svg
nodetto-cli capture circuit.jsonl --page Circuit --output circuit.png
nodetto-cli schematic netlist circuit.jsonl --page Circuit --format text --output circuit.txt
nodetto-cli schematic netlist circuit.jsonl --format kicad --check circuit.net
nodetto-cli schematic import circuit.kicad_sch --output imported.jsonl
nodetto-cli schematic to-breadboard circuit.jsonl --page Circuit --breadboard Board --output updated.jsonl
```

Netlist accepts `--format text|kicad`, `--page`, `--output` or `--check`,
and `--strict`. Import accepts `.kicad_sch` or `.net`, `--output` and
`--strict`. Strict warnings exit 3; usage errors exit 2. Import errors exit 1
and write nothing, including `schematic.importTooComplex` for inputs exceeding
the diagonal lookup budget. A failed breadboard projection exits 1 and leaves
the target card untouched. Desktop KiCad open continues to import a
breadboard; use `schematic import` to create a schematic page.
