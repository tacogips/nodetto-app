# Breadboard circuit pages

Choose **Breadboard** in **Mode** to open or create a Breadboard page. Use its
palette to place a full, half, or mini solderless board and add parts. Part pins
and jumper wire ends snap to the 0.1 inch hole lattice. On a breadboard page,
select a part and press `r` or `Shift+R` to rotate it in 90 degree steps. Wires
can include bend points. New and pasted parts get reference designators
automatically. The inspector edits reference, value and part parameters, and it
can highlight a net.

The editor derives nets from board strips, rails, wires, and pins. It highlights
the selected net, checks electrical rules, and compares a built board with an
optional KiCad target. The ratsnest shows target connections that still need
wiring. Findings appear in the breadboard problems panel and can cross-probe the
canvas. `nodetto-cli lint` runs the same checks.

Export a component BOM, a KiCad-style netlist, or a SPICE netlist with
`nodetto-cli breadboard bom|netlist` or the **Breadboard** tab of the
**Export** dialog. To have a board made, export it as a PCB Gerber and drill
ZIP with `nodetto-cli breadboard gerber` or the same tab, and upload the ZIP to
a board house such as JLCPCB. The PCB keeps the breadboard layout: used holes
become plated holes, strips become traces, and wires become traces or
silkscreen jumper lines. `--outline used` trims the board to the used area so
small circuits fit cheaper size tiers. Import KiCad 6+ `.kicad_sch` or
`.net` files with `nodetto-cli breadboard import` or the desktop Open dialog.
The import is detached and creates a new page with a target netlist card. Its
parts are staged beside the board, so the page fails
lint until every part is placed. Builds older than breadboard support reject
documents that contain a breadboard page.

Any board's Gerber and drill files, for example a KiCad project's fabrication
output, can be drawn on a page with `nodetto-cli gerber import` or by opening
the ZIP or a single Gerber or drill file from the desktop Open dialog; see
[Gerber import](../pcb/gerber-import.md).

See the [breadboard format](format.md),
[electrical rule reference](erc-rules.md),
[KiCad import details](kicad-import.md),
[PCB export details](pcb.md), and the
[LED/button example and golden exports](../../examples/breadboard/).
