# car6-f3-request-scan-budget progress

Status: in-progress: literal pre-change executions for the visible, hidden and view tests were missed; independent post-change mutation controls demonstrate each limit. Formal reviews remain downstream.

Implemented R = 32 * B, mesh-only charges, pre-dispatch analysis shares, and shared visible census, hidden census and view pair allowances. Prism edges remain subject only to the existing combined per-ray limit.

- `crates/capture/src/lattice.rs`: final SHA-256 `3df9a077850eb3b3039fa805fb6ac7f9a3b80f8919e343d6ece41ae1176eab8e`; pre-edit and per-edit SHA-256 in `tmp/car6-r6/car6-f3-request-scan-budget/*-intent.txt`.
- `crates/capture/src/interference.rs`: final SHA-256 `fc4380a4a837ed796c808c36ee45c62000843f54039b2c4775cbd1d0f252fd8d`; pre-edit and per-edit SHA-256 in `tmp/car6-r6/car6-f3-request-scan-budget/*-intent.txt`.
- `crates/capture/src/census.rs`: final SHA-256 `60a260e4a9e83fd23075ef4f956775dc574067ed727eb8639829ee5dfef033f8`; pre-edit and per-edit SHA-256 in `tmp/car6-r6/car6-f3-request-scan-budget/*-intent.txt`.
- `crates/capture/src/tool_view.rs`: final SHA-256 `71e7cfea0b2e57bd83fbb74e23e0ae432953c4947f5996359b6c7a61b2ddcbca`; pre-edit and per-edit SHA-256 in `tmp/car6-r6/car6-f3-request-scan-budget/*-intent.txt`.
- `crates/capture/tests/interference.rs`: final SHA-256 `92eb1f39adc4d7f745df00a5ea6c62bcfe00e6f19e4394e5df0e1536b0ad81c1`; pre-edit and per-edit SHA-256 in `tmp/car6-r6/car6-f3-request-scan-budget/*-intent.txt`.

Measurements (B = 1,000,000): pre-change prism 74,235,264 edge visits, zero mesh visits after change, min [0,0,0], max [126,128,128], capped true. Pre-change moderate analysis: 393,215,232 entries, capped 0; current: 15,998,592 entries, capped 6. Visible finisher 2,185,216 and total 8,000,000 (empty/1, unknown/-1). Hidden finisher 1,196,032 and total 4,000,000 (Some(1), None). View pairs 3,999,894, both capped and from_view. One and five thread render report and PNG match. Constant 32 preserves admitted-cube pin and goldens.

Pre-change analysis regression: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f3 cargo test --release -p nodetto-capture --lib lattice::scan_tests::moderate_mesh_analysis_obeys_request_triangle_ceiling -- --exact --nocapture` exit 101, `tmp/car6-r6/car6-f3-request-scan-budget/02-moderate-baseline.log`. Prism baseline test itself passed 1/1 in `01-prism-baseline.log`; the enclosing shell returned 1 afterward because zsh reserves the variable name status.

Phase negative controls individually disabled the visible, hidden, and view limits in the current tree, then restored exact source; all failed the relevant ceiling assertion with exit 101, respectively `16-visible-negative.log`, `16-hidden-negative.log`, `16-view-negative.log`. The census and view tests were authored after production changes, so these mutation controls are not pre-change executions. All paths in this paragraph are under `tmp/car6-r6/car6-f3-request-scan-budget/`.

Final required gate: `rustfmt --edition 2021 crates/capture/src/lattice.rs crates/capture/src/interference.rs crates/capture/src/census.rs crates/capture/src/tool_view.rs crates/capture/tests/interference.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f3 cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f3 cargo test --release -p nodetto-capture`; exit 0, 197 passed, 0 failed, complete log `tmp/car6-r6/car6-f3-request-scan-budget/17-final-gate.log`. Earlier fixture development failures are retained in the evidence directory. Workspace gates belong to integration.

## Continuation 1 evidence review

The source hashes above still match all five Rust files. An independent read-only
review verified that the three mutation controls fail their own phase ceiling
assertions: visible 19,552,256 > 8,000,000; hidden 18,563,072 > 4,000,000;
view 524,288,512 > 4,000,000. These controls establish sensitivity to each
current phase limit, but cannot establish literal execution before the production
edits. That historical sequencing gap remains unresolved; no earlier execution
is claimed and no older checkout or baseline binary was used.
