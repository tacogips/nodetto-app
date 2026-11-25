# car14-p1-prism-slab-proof progress

Status: done (implementation); formal reviews and native parity are downstream.

The volume-only cap-parallel branch rejects rays proven outside the exact stored slab. The cap flag, facet path, cap error and tie rule remain unchanged. Added near-cap, boss contact, suppressed boss and penetration regressions. Front and back camera probe gave centre [0, 0, 60.75] and 3.24 mm/px. The boss has one candidate and no pairs; suppressed has zero candidates; 0.01 mm penetration has pair (0, 1). Thread and reference parity and overlay-off RGB assertions pass.

Evidence: `tmp/car14-r14/car14-p1-prism-slab-proof/`. Per-edit preimages, intentions and hashes are retained there. Fail-before boss test exited 101 with one pass and one failure on pairs; prism test exited 101 with one failure at z=-7.105427357601002e-15. Initial test compile failed on candidate integer types and was corrected. Initial fmt check failed after an incorrect rustfmt edition; corrected with edition 2021. All final gates below exited 0.

- `bun tmp/car14-r14/car14-p1-prism-slab-proof/camera-probe.ts`: `camera-probe.log`.
- `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`: `fmt-final.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p1 cargo clippy -p nodetto-capture --all-targets -- -D warnings`: `clippy-final.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p1 cargo test -p nodetto-capture --lib -- prism:: raster:: lattice:: interference::`: `test-lib-final.log`, 51 passed, 10 ignored.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p1 cargo test -p nodetto-capture --test render --test overlay --test interference --test census`: `test-integration-final.log`, 53 passed, 7 ignored.

Final source SHA-256:

```text
0868b3d51740568b9de63acdd827d8f0625c0ed5d3309c1da48954c60ff3240f  crates/capture/src/prism.rs
ae6f47a7b368e2b9255181290a0edb7650b70d20b59e9a9052a4c5713f08787c  crates/capture/src/raster/reference.rs
3feef47dd363b94dddba7b9cb19a1519863647e972da0e6b82cd88d2de5ef215  crates/capture/src/raster/tests.rs
```

`CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p1 cargo test -p nodetto-capture --lib -- prism:: raster:: lattice:: interference:: --format pretty` exited 0 with 51 passed and 10 ignored; `test-names.log` names each passed regression.

Workspace-wide gates and release CLI parity belong to serial integration and p6, respectively.
