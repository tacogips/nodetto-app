# car5-f3-lattice-scan progress

Status: in-progress; exact default-parallel release gate failed its existing timing test under load. Formal review and integration are downstream.

Changes: `lattice.rs` charges projected scan entries before both casts using the existing exhaustion flag; `tool_view.rs` counts visits in tests; `tests/interference.rs` pins admitted cube output and tests multi-pair thread determinism. No shared files were edited.

Pre-edit SHA256: lattice `826edc376ad235eb1869612f8e67e3b9636f234b4e78dd31b554d3d81375c593`; tool_view `1771f6968dd30d27b1cb4bf7daada0d8a60f33a9f8ccba9ff7146eb9fa74a83e`; interference `040f170587cd28aea01be201951d44909632e078dd960223932d68c70a44876c`. Per-edit snapshots, intentions and hashes are in `tmp/car5-r5/car5-f3-lattice-scan/`.

Baseline before production change: `baseline-pin.log`, exit 0, one test: volume 256.0, PNG digest 12628891807842507440, complete JSON in log. `pre-fix-scan-retry.log`, exit 101, one failing test: 75,497,472 pair entries, 768 rays, no cap. A first test compile attempt in `pre-fix-scan.log` failed because Body is not Clone; corrected before baseline regression.

Focused post-fix: `focused-scan.log`, exit 0, one test; pair and census each visit 0 entries at 1 ray, capped before the oversized first bin. `focused-integration.log`, exit 0, one test. Both preceded final formatting and minor fixture corrections; the serial full suite reran them on final source.

Exact plan gate: `final-gate.log`, exit 101, clippy fixture style failure; corrected. `final-gate-retry.log`, `final-gate-retry2.log`, and `final-gate-retry3.log`, exit 101 each, 79 passed and one existing timing test failed (2468, 1861, and 1104 ms versus 1000 ms). `timing-isolated.log`, exit 0, one passed at 977 ms. `serial-suite.log`, exit 0, 193 tests passed. Exact command and current status require downstream disposition; do not claim the default-parallel gate passed.
4be755efc3db6dad5004495e405dfe8114c59792e4dc2232de0b9db2837de518  crates/capture/src/lattice.rs
99bab31de71e8a18d62f4f3d3a4e50a2c77c38ccf4eb5aec8215376087de78e4  crates/capture/src/tool_view.rs
fb148e6442f9ee2a3ee6ec8e3c66fa0a9afab6fc4be6def230d39042171e156f  crates/capture/tests/interference.rs
