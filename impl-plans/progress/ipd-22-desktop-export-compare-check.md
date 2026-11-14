# ipd-22 desktop export, comparison and design check

Plan hash before work: `10cdd261b28114710bc8acc1a13549f050b1a0f8`. Dependency `ipd-20-app-lint` was accepted by dispatch. The plan implements design decisions 8.8, 9.3, 10.1 and 10.3.

- Added all-artboard PNG/SVG ZIP export, prototype HTML flow/device options, and desktop comparison entry points in the export dialog and frame context menu.
- Added PNG validation, pairing, shared SVG composition, transient preview and saving; references are not written into the document.
- Added the debounced app-design problems panel with selection and zoom.
- Focused regression tests, typecheck and Biome are recorded under `tmp/ipd-s772/ipd-22-desktop-export-compare-check/final/`.
- Visual comparison: `final/desktop-compare.png` was generated through `buildComparisons` using the CLI resvg rasterizer; `final/cli-compare.png` used the CLI compare command on the same artboard and reference. Both inspected images show the same reference, actual and difference panel layout; the difference panel is black with no visible difference. `final/visual.log` records the commands' output and no size warnings.
- Formal integrity, adversarial and integration reviews and workflow completion remain downstream.

## Implementation completion

- [x] Required focused aggregate: 43 passed, 0 failed (`final/tests-final.log`).
- [x] Scoped typecheck gate: exit 0; workspace typecheck has no errors (`final/typecheck.log`, `final/typecheck-gate.log`).
- [x] Biome: exit 0, 12 files checked (`final/biome-final.log`).
- [x] Comparison evidence exported and visually inspected as described above (`final/visual.log`).
