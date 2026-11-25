# car3-g1a-cast-flag progress

Status: done. C1 source, tests, and amended per-plan verification are complete. Formal review and finalization are downstream.

- Design alignment: design-ai-capture.md 21.1 and 21.5 C1; no dependencies.
- Source SHA-256 before and after: `tmp/car3-r3b/car3-g1a-cast-flag/pre-sha256.txt` and `post-sha256.txt`.
- Fail-before: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1a-cast-flag cargo test -p nodetto-capture --lib ownership_sensitive` exited 101 because methods returned `()`; `tmp/car3-r3b/car3-g1a-cast-flag/fail-before.log`.
- Focused release tests: same target and `cargo test --release -p nodetto-capture --lib ownership_sensitive`, exit 0, 2 passed; `tmp/car3-r3b/car3-g1a-cast-flag/focused.log`.
- Required combined clippy, fmt check and release test gate: exit 0, 168 passed, 0 failed; `tmp/car3-r3b/car3-g1a-cast-flag/gate.log`. This was run on the shared moving tree.
- Earlier release test attempt failed two in-progress sibling reference tests; `tmp/car3-r3b/car3-g1a-cast-flag/release-test.log`. The later combined gate passed those tests.
- Stray scan `find target tmp -name '*.test.ts' -print` found 753 paths, principally `tmp/car1-r1/`, outside authorized write paths; `tmp/car3-r3b/car3-g1a-cast-flag/stray-tests.log`. Serial owner must remove or authorize cleanup and rerun scan.

## Amendment resume verification

- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1a-cast-flag cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1a-cast-flag cargo test --release -p nodetto-capture`: exit 0, 168 passed, 0 failed; `tmp/car3-r3b/car3-g1a-cast-flag/resume-gate-final.log`. Shared tree includes sibling reference changes.
- `find target tmp -name '*.test.ts' -print | LC_ALL=C sort | LC_ALL=C comm -23 - tmp/car3-r3b/checkpoint/inventory-sorted.txt > tmp/car3-r3b/car3-g1a-cast-flag/stray-delta.txt && test ! -s tmp/car3-r3b/car3-g1a-cast-flag/stray-delta.txt`: exit 0; delta file is empty; `tmp/car3-r3b/car3-g1a-cast-flag/stray-delta-check.log`. Absolute cleanup is an integration prerequisite.
- Post-gate source SHA-256: `tmp/car3-r3b/car3-g1a-cast-flag/resume-post-sha256.txt`.

## Adversarial review correction: g1a-adv-01-cap-band-none-slab

- Moved the cap-band calculation before the slab early return, preserving interval writes and volume behavior. Added two outside-cap assertions requiring the flag and empty surface output.
- Before the fix, `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1a-cast-flag cargo test --release -p nodetto-capture --lib ownership_sensitive` exited 101 (1 passed, 1 failed); `tmp/car3-r3b/car3-g1a-cast-flag/review-fail-before.log`.
- After the fix, the same focused command exited 0 (2 passed); `tmp/car3-r3b/car3-g1a-cast-flag/review-focused.log`.
- The plan's combined clippy, fmt and release-test gate exited 0 (168 passed, 0 failed); `tmp/car3-r3b/car3-g1a-cast-flag/review-gate.log`. This is shared-tree evidence.
- The amended plan-delta scan exited 0 and `stray-delta.txt` is empty; `tmp/car3-r3b/car3-g1a-cast-flag/review-delta.log`.
- Post-correction SHA-256: `tmp/car3-r3b/car3-g1a-cast-flag/review-post-sha256.txt`. Independent re-review remains downstream.
