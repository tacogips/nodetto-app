# LED and switch schematic

This original circuit connects a 9 V battery (BT1), toggle switch (SW1),
470 ohm resistor (R1), and LED (D1). Capacitor C1 (100n) connects from the
switched output to ground at a junction. The resistor-to-LED net has an
explicit `N_R1_2` label.

The schematic has no electrical rule findings. Its four nets are `VCC`,
`GND`, `SW_OUT`, and `N_R1_2`. The `.netlist.txt` and `.net` files are
exported from the example through schematic connectivity and the respective
netlist formatters.
