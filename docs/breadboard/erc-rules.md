# Breadboard checks

`nodetto-cli lint` runs these checks on breadboard pages. Imported pages can contain staged parts that are not yet in holes; the `pin-not-in-hole` error makes lint exit 1 until those parts are placed. Warnings alone do not make lint fail. Lint exits 0 with no errors, 1 with error-level findings, and 2 for usage, parse, or configuration errors.

| Rule | Severity | Description |
| --- | --- | --- |
| `pin-not-in-hole` | error | A component lead does not land in a board hole. |
| `shorted-part` | error | Both terminals of a two-pin component share one conductive net. |
| `rail-short` | error | The positive and negative supply rails are electrically joined. |
| `reversed-polarity` | error | A polarized part faces opposite to a supply direction that can be established. |
| `led-no-series-resistor` | warning | An LED path has no detectable current-limiting resistor. |
| `unconnected-pin` | warning | A component pin has no connection to another component. |
| `duplicate-reference` | error | More than one visible part uses the same reference designator. |
| `wire-end-off-hole` | error | A jumper end misses both a board hole and a part pin. |
| `parity-missing-connection` | warning | The board has not joined pins that the target groups together. |
| `parity-extra-connection` | error | A board connection joins target nets that should stay separate. |
| `parity-missing-part` | warning | A target component has no matching board component. |
| `parity-extra-part` | warning | A board component is absent from the target. |
| `parity-value-mismatch` | warning | A part value differs from the target value. |

Parity checks run only when a target netlist card exists. Missing work and value differences are warnings so users can build incrementally; joining two distinct target nets is an error.
