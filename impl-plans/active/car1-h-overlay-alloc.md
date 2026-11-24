# car1-h-overlay-alloc: allocation-free nearest-eight overlay selection (F11)

- planId: car1-h-overlay-alloc. Wave 1. dependsOn: none. Gate: none.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F11.
- Progress log: `impl-plans/progress/car1-h-overlay-alloc.md`.

## Intent

Interference marking picks at most the nearest eight bodies per sample
without allocating any per-sample vector, and does no pair work with
fewer than two bodies.

## Non-goals

- Change only the overlay hunk of `raster.rs` (today `:220-235`) and
  `overlay.rs`.
- No setup or classification change (plan i), no `interference.rs` or
  `lattice.rs` change.

## Changes

1. `crates/capture/src/overlay.rs`:
   - `overlapping_pairs` takes a fixed-size selection, for example
     `&[SampleBody<'_>]` built in a caller-owned
     `[Option<SampleBody>; NEAREST_BODIES]` or a scratch `Vec` reused
     across samples.
   - Order by `intervals[0].s` with `total_cmp`, then by `body`, exactly
     as the current sort plus `truncate(NEAREST_BODIES)` orders them.
   - Return early when fewer than two bodies are given.
2. `crates/capture/src/raster.rs`:
   - Replace the per-sample `collect()` into `bodies` with an insertion
     into fixed storage (or a scratch vector in the per-worker `scratch`
     that is cleared, never reallocated).
   - Skip pair processing when fewer than two bodies have material.

## Pitfalls

- Ties: equal depth must order by ascending body index. Insertion must
  keep the eight smallest `(depth, body)` keys, exactly as sort plus
  truncate does.
- `comparisons` counting in `overlapping_pairs` must stay as today for
  existing tests.

## Tests

- New `crates/capture/tests/overlay_alloc.rs`, alone in its test binary:
  - a `#[global_allocator]` that counts allocations in an `AtomicUsize`;
  - render one screen-filling solid at 1024 x 768 with supersample 2,
    `draw_interference` on and one thread;
  - assert that the allocations during the render are below
    `samples / 16`. Before the fix there are at least two per sample;
    record the pre-fix count.
- `crates/capture/tests/overlay.rs`: a case with more than eight bodies
  tied in depth. The hatch pixels, pair order and image bytes equal a
  reference computed with the old sort-and-truncate algorithm, kept as a
  test helper.
- The single-body image bytes are unchanged, and the existing overlay
  digests pass.

## Verification

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-h cargo fmt -p nodetto-capture -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-h cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-h cargo test -p nodetto-capture --test overlay_alloc --test overlay --test render`
   must exit 0.
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-h cargo test -p nodetto-capture`
   must exit 0.

## Done when

- No per-sample vector is allocated, as shown by the counting allocator.
- Pixels and digests are unchanged.

## Implementation status

Implemented nearest-eight stack selection and lazy sample traversal. Allocation,
reference tie ordering, hatch/image parity, and existing digest checks pass.
Formal review and integration remain downstream.
