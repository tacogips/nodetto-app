# car2-c2-closure-once progress

Status: done (implementation; formal reviews and integration pending).

Accepted plan dependencies car2-c1-sweep and car2-a1-rust-decoder were admitted by dispatch. The plan matches design 20.2 R2-7. Classification is computed once per render and shared by picture, census and interference. The standalone wrappers retain their signatures and classify independently. The existing sweep and decoder changes were preserved.

Pre-edit SHA-256 (new test and progress file absent):
```
7d5bd24461d3166dbffc85452e0f52de55b4e6176b0f5e75cb262712bf6e9bc8  crates/capture/src/mesh.rs
823c52c6d082def67dd9a343652b3eab99feb50b245f550d1b79e8772b524f0b  crates/capture/src/tool_view.rs
47932650d315b28b3e70146bdf1e1c0618ccf9ed28a00ac02d3e94ebc57a8a85  crates/capture/src/lattice.rs
74cbf94294b15b4e99efdb6920b40f349b0f11b700492d1fbafa8bfd7cd0dcd2  crates/capture/src/census.rs
05c052f8d0ac5d2f0e3c9a7ca58bd82873dee21936266e727c81d18b663697e7  crates/capture/src/interference.rs
9305948573e898c8c49a78e4f13c9ac7e393e88c393b02cbfc445110baf558f8  crates/capture/src/raster.rs
```
Post-edit SHA-256 (progress log excluded to avoid self-reference):
```
62b801504a3208385940b85ab2fd14c183f32eb5b3fe58772c2de2d5f447adcf  crates/capture/src/mesh.rs
85246fc6a82f60e073e337cbca1fee1401a6fe3c5cdbd87b34544b1cfc261d70  crates/capture/src/tool_view.rs
d5d33e0d26eaed140fa9bc9778ddc8f01fc3d15937a0b2899ccd6c1926f3978d  crates/capture/src/lattice.rs
ce82e4e5c6d72be3f7a16da15cff91064794c9812e29c5fc422d52769f04cdf5  crates/capture/src/census.rs
fa881587b6616125094c9ad1ee016bed64b6e167e45d4f00da737586244e90ae  crates/capture/src/interference.rs
37bc22e966bbeb67980df1f0174dc7e02ffa9090f8775a93315a975a9a0fc32d  crates/capture/src/raster.rs
7dc126e772d0c01c6f4013b6f325642417943fce7beddad4d80b1ab6c3529888  crates/capture/tests/closure_count.rs
```

Evidence under `tmp/car2-r2b/car2-c2-closure-once/attempt-1/`, with final gate logs mirrored under `target/car2-c2-closure-once/logs/`:

- Pre-fix control: isolated 3cd2401 source with an is_closed counter and the new test, `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-c2-closure-once/baseline cargo test --offline --manifest-path tmp/car2-r2b/car2-c2-closure-once/attempt-1/baseline/Cargo.toml --test closure_count`, exit 101, 1 failed: expected 2, observed 4 (`baseline-final.log`). The control was instrumented only for counting. `baseline-digests.log` records the three scenario image/report digests before the fix.
- `rustfmt --edition 2021 --check crates/capture/src/mesh.rs crates/capture/src/tool_view.rs crates/capture/src/lattice.rs crates/capture/src/census.rs crates/capture/src/interference.rs crates/capture/src/raster.rs crates/capture/tests/closure_count.rs`, exit 0 (`fmt-final.log`).
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-c2-closure-once cargo clippy -p nodetto-capture --all-targets`, exit 0, no diagnostics (`clippy-final2.log`).
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-c2-closure-once cargo test -p nodetto-capture`, exit 0, 139 passed, 0 failed, 22 ignored release-only tests (`test-final2.log`). Includes isolated closure count and existing unchanged digest tests.
- `git diff --check -- crates/capture/src/mesh.rs crates/capture/src/tool_view.rs crates/capture/src/lattice.rs crates/capture/src/census.rs crates/capture/src/interference.rs crates/capture/src/raster.rs`, exit 0 (`diff-check.log`).

The three scenarios each count exactly two closures at one and eight threads, with equal PNG bytes and report JSON, matching pre-fix digests. The overlap checks one analysed pair and the census case reports an empty body. `LatticeRequest`, reference renderer and existing named test files were not edited. Earlier compilation failures (`focused.log`, `clippy.log`) were corrected and superseded by the final gates. Integration owns workspace verification and release-only tests.
