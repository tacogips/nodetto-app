# KiCad import

The importer reads KiCad 6 and newer S-expression schematics (`.kicad_sch`) and S-expression netlists (`.net`). It imports the root sheet and the supported symbol subset below. Unknown tokens are tolerated. Buses, hierarchical sheets, KiCad 5 and older schematic files, and symbols with no useful pin data are diagnosed rather than interpreted as supported circuit behavior.

## Symbol mapping

Mapping uses the symbol library name and reference prefix to select an original nodetto part. References and values carry through. LED and diode pins map by their `A` and `K` names; other pins map by number where possible. Unmapped symbols are represented by a generic IC or header when pin counts allow it, otherwise skipped with a warning.

| KiCad symbol or prefix | Nodetto part |
| --- | --- |
| `Device:R`, reference `R` | Resistor |
| `Device:C`, reference `C` | Ceramic capacitor |
| `Device:C_Polarized`, reference `C` | Electrolytic capacitor |
| `Device:LED`, reference `D` | LED |
| `Device:D`, reference `D` | Diode |
| NPN or PNP transistor symbol, reference `Q` | Transistor with polarity and pin order |
| `Switch:SW_Push`, reference `SW` | Push button |
| Potentiometer symbol, reference `RV` | Potentiometer |
| DIP or multi-pin IC, reference `U` | DIP IC with matching pin count |
| `Connector:Conn_01xNN`, reference `J` | Single-row pin header |
| Battery or power source, reference `BT` | Battery |

## Staging and diagnostics

Import creates a new breadboard page with a half board, a target netlist card beside it, and parts arranged in rows below the board. Parts begin staged because they are not inserted into board holes; place them to resolve the `pin-not-in-hole` check. The source file is opened as a detached import in desktop, so edits do not rewrite it.

Diagnostics use stable codes. The S-expression reader reports `sexpr.empty`, `sexpr.unterminatedString`, `sexpr.unclosedList`, `sexpr.unexpectedClose`, `sexpr.trailingContent`, and `sexpr.tooDeep`. Import mapping can report `kicad.unknownRoot`, `kicad.legacyFormat`, `kicad.bus`, `kicad.hierarchicalSheet`, `kicad.invalidNumber`, `kicad.unsupportedAngle`, `kicad.missingLibSymbol`, `kicad.unsupportedSymbol`, `kicad.skippedSymbol`, `kicad.unmappedPin`, `kicad.duplicateReference`, `kicad.missingReference`, and `kicad.pinNamesMissing`.

Use `nodetto-cli breadboard import circuit.net` or open a `.kicad_sch` or `.net` file in the desktop app. KiCad files are read by a parser written from scratch for this project; no KiCad code or library symbols are included.
