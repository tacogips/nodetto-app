# car1-h-overlay-alloc progress

Implemented F11 in the shared branch; formal review and integration are pending.
Pre-edit hashes: `tmp/car1-r1/car1-h-overlay-alloc/pre-sha256.txt`.
Post-source hashes: `tmp/car1-r1/car1-h-overlay-alloc/post-source-sha256.txt`.
Per-edit intent and fresh snapshots are in the same evidence directory.

- Pre-fix `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-h cargo test -p nodetto-capture --test overlay_alloc`: exit 101, 1 failed; 6,385,713 allocations for 3,145,728 samples. Log: `tmp/car1-r1/car1-h-overlay-alloc/pre-fix-analysed.log`.
- Focused tie test after correcting its report setup: exit 0, 1 passed. Log: `tmp/car1-r1/car1-h-overlay-alloc/tie-test-attempt.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-h cargo fmt -p nodetto-capture -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-h cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-h cargo test -p nodetto-capture --test overlay_alloc --test overlay --test render`: exit 0, 24 passed, 2 ignored. Log: `tmp/car1-r1/car1-h-overlay-alloc/gate1.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-h cargo test -p nodetto-capture`: exit 0, 127 passed, 21 ignored. Log: `tmp/car1-r1/car1-h-overlay-alloc/gate2.log`.

Both gates ran on a moving shared tree using isolated build output. Stable integration verification is downstream.
