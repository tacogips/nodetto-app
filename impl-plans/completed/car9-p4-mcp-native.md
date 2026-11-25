# car9-p4-mcp-native

- planId: car9-p4-mcp-native; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car9-p4-mcp-native.md
- Finding: function-mcp-inline-image-replaced-before-readback (medium), native server.
- Design: `design-docs/specs/design-ai-capture.md` 4.5, 11, 27.1 R9-2 (Native,
  Native staging, Tests), 27.4. Follow `impl-plans/active/car9-00-overview.md`
  worker rules. Evidence: `tmp/car9-r9/car9-p4-mcp-native/`.
  `CARGO_TARGET_DIR=target/car9-p4`.

## Intent and context

`call_tool` (`apps/cli/native/src/mcp.rs:160-204`) runs `engine::run` and then
`capture_content` (`mcp.rs:93-108`), which reopens the output through
`read_inline_image` (`mcp.rs:75-91`). Another writer can replace the file first.
Fix: keep the call's own write in Rust and attach it.

Non-goals: no change to `CommandResult` or its serialization, `engine::run`'s
signature, `files.rs`, `native-engine.ts`, `main.rs`, `access.rs`, tool schemas,
instructions, the per-server mutex, `captured_image`, `wants_inline_image`,
`capture_path_matches` or their tests. No bytes enter JavaScript or JSON.

## Changes

`apps/cli/native/src/engine.rs` (stage 1):
- `pub(crate) const MCP_INLINE_MAX_BYTES: usize = 1_048_576;`
- `pub struct CaptureWrite { pub path: PathBuf, pub len: u64, pub bytes: Option<Vec<u8>> }`
- `HostState` gains `retain_capture: Cell<bool>` and `capture: RefCell<Option<CaptureWrite>>`
  (initialised `false` / `None` in `context`).
- `writeCapture` op (`engine.rs:137-142`): when `retain_capture` is set, compute
  `std::path::absolute(&path)` BEFORE writing (error -> `host_error`), call
  `files::write_capture` as today, and on `"written"` or `"identical"` store
  `CaptureWrite { path, len, bytes: (len <= MAX).then_some(data) }`, moving `data`.
  `"exists"` and errors leave the previous record. Return value unchanged.
- `pub(crate) fn inline_context(input: Input, directory: Option<PathBuf>) -> Result<Context, String>`
  = `context` plus `retain_capture.set(true)`.
- `pub(crate) fn take_capture_write(ctx: &Context) -> Option<CaptureWrite>`
  (`borrow_mut().take()`).
- `pub fn run_inline(args: Vec<String>, input: Input) -> (CommandResult, Option<CaptureWrite>)`
  sharing `run`'s `--cwd` handling and `execute`; `run` keeps its signature and
  never retains (factor a private helper rather than duplicating).

`apps/cli/native/src/mcp.rs`:
- Remove the local `MCP_INLINE_MAX_BYTES`; use `engine::MCP_INLINE_MAX_BYTES`
  (`as u64` where compared to `len`).
- `call_tool`: `wants_inline_image(&args)` -> `engine::run_inline`, else
  `(engine::run(..), None)`; pass `written.as_ref()` to `capture_content`.
- Stage 1: `capture_content(args, output, written: Option<&CaptureWrite>)` returns
  `None` when `written` is `None`, otherwise still uses `read_inline_image`. Add the
  new two-context test and record its failure (A's attachment equals B).
- Stage 2: after the unchanged exit/inline/`captured_image`/`capture_path_matches`
  checks, require `Path::new(path) == written.path` (else the existing
  "could not read the written path from capture output. Try --json." text); `bytes`
  `None` -> existing oversize text with `written.len`; else
  `ContentBlock::image(STANDARD.encode(bytes), mime_type)`. Delete `read_inline_image`
  and now unused imports.

Pitfalls: `get_data` gives `&HostState`, so mutate only through `Cell`/`RefCell`;
never hold a `RefCell` borrow across `files::write_capture`; no `unwrap` on host
paths; keep the bytes out of `CommandResult`; clippy `-D warnings`.

## Tests

`apps/cli/native/src/engine_tests.rs`, new
`capture_writes_are_retained_per_call_only_when_inline` (imitate
`capture_host_operations_resolve_paths_and_report_writes`, but build the context with
`inline_context` and evaluate JS with `ctx.eval`):
- 1,048,576-byte `Uint8Array` written with replace -> record `len` 1,048,576, `bytes`
  equal, `path` equals the absolute folder join.
- 1,048,577 bytes -> `len` 1,048,577, `bytes` None.
- identical write (same bytes, replace false) -> recorded.
- `exists` write (different bytes, replace false) -> previous record kept.
- write into a missing directory inside a JS try/catch -> throws, no record.
- `context` (not inline) write -> `take_capture_write` is None.

`apps/cli/native/src/mcp.rs` tests:
- New `inline_capture_attaches_each_calls_own_write`: contexts A and B from
  `engine::inline_context(Input::Mcp(None), Some(tmp))`; A evaluates
  `native.writeCapture(native.path('shared.png'), Uint8Array.from({ length: 4096 }, (_, i) => i & 255), true)`;
  B the same with `255 - (i & 255)`; take both records after both writes; build both
  responses with args `capture doc.jsonl --inline --output <tmp>/shared.png` and
  output exit 0, stdout `path: <tmp>/shared.png\n`. Assert the file equals B, A's
  decoded data equals A, B's equals B.
- New `run_inline_retains_the_written_capture`: one-element freeform document (copy
  the fixture of `engine_tests.rs:capture_command_renders_a_png_and_reports_its_path`),
  `engine::run_inline(["--cwd", tmp, "capture", "drawing.jsonl", "--inline", "--json", "--output", "one.png"])`
  -> exit 0, record bytes equal the file, `len` equals the JSON `bytes`.
- Adapt existing `inline_capture_preserves_exit_one_and_checks_file_size_and_path`
  to pass records (bytes of 1,048,576 and a `len` 1,048,577 / `bytes` None record)
  keeping every assertion; `explicit_output_is_matched_inside_the_cwd_folder` unedited.

## Verification

1. Stage 1 evidence (expected to fail, not a gate):
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car9-p4 cargo test -p nodetto-cli inline_capture_attaches_each_calls_own_write`
   - evidence: one test ran; failure is A's byte comparison.
2. Gate: `CARGO_TERM_QUIET=true cargo fmt -p nodetto-cli -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car9-p4 cargo clippy -p nodetto-cli --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car9-p4 cargo test -p nodetto-cli`
   - evidence: exit 0; the three new tests and all existing tests pass; complete log
     under the evidence root (rerun after p1/p2 settle if the TS bundle is mid-edit).

## Done criteria

- `grep -n "read_inline_image" apps/cli/native/src/mcp.rs` prints nothing;
  `CommandResult` unchanged (`git diff` shows no edit to its definition).
- Stage 1 failing log and command 2 passing log exist; command 2 exits 0.
- `git diff --name-only` for this plan's edits stays inside its writePaths.
- Progress log reads `done` with hashes, commands, exit codes and log paths.

## Implementation status

Source and focused verification are complete; see `impl-plans/progress/car9-p4-mcp-native.md`.
Formal reviews and integration verification remain downstream.
