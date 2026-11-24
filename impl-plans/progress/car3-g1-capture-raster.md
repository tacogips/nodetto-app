# car3-g1-capture-raster progress

Status: in-progress. Design alignment and empty dependency list confirmed.

- `crates/capture/src/raster/tests.rs`: original SHA-256
  `121caea045308adf3c5f8f47e18d60fdc87e2a8ac7a8b13d0287bbd317d49cd2`;
  current SHA-256 `9503230c568bfe72a06348f0fa8b924e4ce514e4ebd8826edc53ca4b3d284681`.
  Added baseline regressions for a board behind a translucent sheet and touching caps.
- Sheet regression: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1-capture-raster cargo test -p nodetto-capture reference_board_remains_visible_through_open_sheet` exited 101, 1 test failed because the rendered images are equal. Complete log: `tmp/car3-r3/car3-g1-capture-raster/baseline-sheet.log`.
- Cap regression: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1-capture-raster cargo test -p nodetto-capture touching_caps_do_not_create_picture_interference` exited 101, 1 test failed because a pair was reported. Complete log: `tmp/car3-r3/car3-g1-capture-raster/baseline-caps.log`.
- Outstanding: implement the accepted witness and bounded layer designs, add all remaining plan fixtures and native parity cases, record baseline controls, and run both required verification gates. Neither finding is fixed yet.

## Redispatch progress

- The reference rasterizer folds volume intervals independently for analysed bodies when drawing interference, including when shading intervals are empty. The added `reference_touching_caps_use_volume_witness` test passes (1 test, exit 0), log `tmp/car3-r3/car3-g1-capture-raster/redispatch-reference-caps-final.log`.
- Source SHA-256: `reference.rs` `4b17d02e874228a25548e38e218059bf7ca9e02f7f9104814a2236706c07ea22`; `tests.rs` `555f3f5dea1eda74d40ea457748dc082234255b33f3ba0ebea3c8917e22dc26b`.
- The required Rust gate exits 101 (55 passed, 2 failed), log `tmp/car3-r3/car3-g1-capture-raster/redispatch-gate-rust-final.log`: both original production regressions still fail. Production witness and accounting, layer compositing in both rasterizers, remaining fixtures, documentation and native parity remain outstanding. Status remains in-progress.
- The CLI gate exits 0 (14 passed), log `tmp/car3-r3/car3-g1-capture-raster/redispatch-gate-cli.log`; it does not yet include this plan's required new native parity fixtures and must be rerun after they are added.
