# car4-f1b-ncs1-hidden-reader

- planId: car4-f1b-ncs1-hidden-reader; wave 1; dependsOn: none
- planPath: impl-plans/active/car4-f1b-ncs1-hidden-reader.md
- progressPath: impl-plans/progress/car4-f1b-ncs1-hidden-reader.md
- Finding: function-capture-hidden-target-empty-cut (R4-1, high), Rust NCS1 reader part.
- Design: `design-docs/specs/design-ai-capture.md` 22.1 R4-1 (NCS1, Rust scene).
- writePaths: `crates/capture/src/scene.rs`, `crates/capture/src/tiles.rs`,
  `crates/capture/src/census.rs`, `crates/capture/tests/scene.rs`,
  `tmp/car4-r4/car4-f1b-ncs1-hidden-reader`,
  `impl-plans/progress/car4-f1b-ncs1-hidden-reader.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules and pinned contracts in `impl-plans/active/car4-00-overview.md`.

## Intent and context

The reader must accept the hidden section written by f1a (header word at offset 36,
trailing body-format records with flags 0) and expose it as `Scene::hidden` without
any effect on drawing or interference, which iterate `scene.bodies` only.

Non-goals: no census, report or `lib.rs` change (f1d); no edit of `raster.rs`,
`raster/**`, `prism.rs`, `cast.rs`; `census.rs` is edited ONLY to add
`hidden: Vec::new()` to the test `Scene` literal (f1d owns its logic later).

## Changes

- `scene.rs`:
  - `pub struct Scene` gains `pub hidden: Vec<Body>` (doc comment: census-only Boolean
    histories of hidden targets; never drawn or analysed).
  - `parse_scene`: replace `reader.zero::<4>()?` after the budget (offset 36) with
    `hidden_count = reader.u32()? as usize`; reject `> MAX_RECORDS` with the existing
    `too many tools or bodies` message.
  - `reader.require_records(tool_count + body_count + hidden_count, 16)` in place of the
    current pre-tool check; after the bodies, `require_records(hidden_count, 16)` and
    read each hidden record: flags word must be 0, else
    `invalid("hidden body flags must be zero")`; steps parsed with the same rules as
    `Reader::body` (factor a shared step reader; keep body messages identical).
  - Existing error texts and their order for every other field stay unchanged.
- `tiles.rs` (test module) and `census.rs` (test module, `fn scene`): add
  `hidden: Vec::new()` to the `Scene` literals. Nothing else.

## Pitfalls

- `crates/capture/src/raster/tests.rs` and `crates/capture/tests/support/mod.rs` build
  scenes by parsing fixtures; they must compile untouched (no other literals exist:
  `grep -rn "Scene {" crates apps` shows only scene.rs, tiles.rs, census.rs).
- The old zero check made a nonzero word 36 an error ("nonzero padding"); the existing
  test in `tests/scene.rs` that may patch offset 36 must be updated only if it asserts
  that exact message at that offset; record any such change with its reason.
- Do not treat hidden records as bodies anywhere.

## Tests (`crates/capture/tests/scene.rs`, imitate `plate_word_edit` and `reject`)

- Plate fixture parses with `hidden` empty.
- Plate bytes with word 36 = 1 plus one appended hidden record `[0, 2, 0, 0, 1, 0]`
  -> parses; `hidden[0].steps` equals union tool 0, difference tool 0.
- Same with flags word 1 -> `hidden body flags must be zero`.
- Word 36 = 20,001 -> `too many tools or bodies`; word 36 = 1 with no record ->
  `record count exceeds remaining data` or `truncated data` (assert the actual existing
  message); hidden record starting with a difference -> `body must start with a union`.

## Verification (each exits 0 and runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f1b-ncs1-hidden-reader cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f1b-ncs1-hidden-reader cargo test --release -p nodetto-capture`
   -> all crate tests pass, including the new reader tests (which failed before).

## Done criteria

- New reader tests pass; all existing capture crate tests and goldens unchanged;
  rustfmt clean on touched files; progress log `done`.
