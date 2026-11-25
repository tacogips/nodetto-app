# car14-p2a-rust-attachment-sides

Status: done (implementation; formal review and integration are downstream).

C2b joins non-attachment edges, rejects attachment sides in the same component or with overlapping integer box interiors, and then joins attachment edges. Bracket, slit ring, separated guard, closure and target eligibility regressions are included. Existing classifications and fast path remain intact.

Pre/post file hashes and per-edit intent snapshots are in `tmp/car14-r14/car14-p2a-rust-attachment-sides/`; final hashes are in `final-source.sha256`. The fail-before library run exited 101 with bracket and slit-ring failures (10 passed, 2 failed), recorded in `fail-before.log`.

Final gates, all exit 0:
- `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`: `fmt-retry.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p2a cargo clippy -p nodetto-capture --all-targets -- -D warnings`: `clippy-final.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p2a cargo test -p nodetto-capture --lib -- mesh_contact:: nmesh:: mesh::`: `lib-exact.log`, 30 passed.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p2a cargo test -p nodetto-capture --test mesh --test closure_count`: `integration-final.log`, 10 passed, one ignored.

An earlier crate-wide formatting check found concurrent sibling edits; its log is `fmt-final.log`. The subsequent check passed after the sibling formatted its files. Selected-file formatting also passed (`owned-fmt.log`). Tests were run on the shared moving tree; serial integration remains downstream. No work counters apply.
