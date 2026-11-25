# car10-p1-capture-write-rust

- planId: car10-p1-capture-write-rust; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car10-p1-capture-write-rust.md
- Finding: function-capture-failed-create-removes-successful-replacement
  (medium), native CLI backend.
- Design: `design-docs/specs/design-ai-capture.md` 4.3, 12 and 28.1 R10-1. Follow
  the worker rules in `impl-plans/active/car10-00-overview.md`. Evidence:
  `tmp/car10-r10/car10-p1-capture-write-rust/`.

## Intent and context

`write_new_with` (`crates/native/src/fs.rs:20-47`) creates the public path with
`create_new` (`:25`), then writes and syncs it (`:40`). On failure it removes the
public path (`:43`). Meanwhile another writer's `replace_regular` (`:116-139`) can
publish a forced replacement through `write_to_entry` and `persist` (`:241`), and
that removal then deletes it. The native CLI reaches `write_new` through
`write_capture` (`apps/cli/native/src/files.rs:67-76`). The fix stages bytes in an
owned temporary file, publishes without clobbering, and cleans up only the staging
file.

Non-goals:
- Do not change `replace_regular`'s existing-file branch, `write_to_entry`,
  `write_atomic`, `write_with_permissions` or `write_selected_file_atomic`. Desktop
  export uses the last one and must not change.
- Do not change `existing_matches`, `open_regular`, `private_dir`,
  `current_owner`, `NewFile`, `apps/cli/native/src/files.rs` or
  `crates/native/tests/file_contract.rs`.
- No new dependency (tempfile 3.27 is already used).

## Changes (`crates/native/src/fs.rs` only)

- Keep `pub fn write_new(path, bytes) -> io::Result<NewFile>` and
  `fn write_new_with(path: &Path, bytes: &[u8], write_contents: impl FnOnce(&mut fs::File) -> io::Result<()>) -> io::Result<NewFile>`
  with the same signatures. `write_new_with` delegates to the new crate-internal
  ```
  fn write_new_inner(path: &Path, bytes: &[u8],
      write_contents: impl FnOnce(&mut fs::File) -> io::Result<()>,
      publish: impl FnOnce(tempfile::NamedTempFile, &Path) -> Result<(), tempfile::PersistError>,
  ) -> io::Result<NewFile>
  ```
  The default `publish` is `|file, path| file.persist_noclobber(path).map(drop)`.
- `write_new_inner` runs in this order:
  1. `path.symlink_metadata()`. On `Ok(_)`, return the collision decision (below)
     without creating anything. On `NotFound`, continue. Any other error is
     returned.
  2. Staging. The parent is computed as in `write_to_entry` (`:225-228`). Use
     `tempfile::Builder::new()` with `permissions(Permissions::from_mode(0o666))`
     under `#[cfg(unix)]`, exactly as `write_to_entry` (`:229-234`). Keep
     tempfile's default prefix and suffix; never derive the name from the target.
     Then call `tempfile_in(parent)?`.
  3. `write_contents(file.as_file_mut()).and_then(|()| file.as_file().sync_all())`.
     On error, return that error unchanged. Dropping the `NamedTempFile` removes
     the staging file.
  4. `publish(file, path)`. `Ok` gives `NewFile::Written`. On
     `Err(PersistError { error, file })`, drop `file`, which removes the staging
     file. If `error.kind() == AlreadyExists`, return the collision decision.
     Otherwise return `error` unchanged.
  - The collision decision is the existing one:
    `if existing_matches(path, bytes).unwrap_or(false) { Identical } else { Exists }`.
- `write_new_inner` never calls `fs::remove_file(path)` or opens `path` for
  writing.

Pitfalls:
- There is no fallback to a direct `create_new` of the public path on any error.
- Do not call `fs::remove_file` on the staging path yourself. tempfile's drop
  owns it.
- `replace_regular`'s NotFound branch already goes through `write_new`. Keep its
  `"the output path appeared while writing"` mapping.
- `persist_noclobber` returns `Ok(File)`. Drop the file (`map(drop)`); do not keep
  handles open.

## Tests (`crates/native/src/fs.rs` `mod tests`, appended)

- `failed_new_capture_keeps_a_concurrent_forced_replacement` (fail-before
  evidence).
  - Setup: `folder = tempdir`, `path = folder/image.png` (absent),
    `B = b"replacement capture"`. Call
    `write_new_with(&path, b"capture", |file| { file.write_all(b"cap")?; replace_regular(&path, B).unwrap(); Err(io::Error::other("injected write failure")) })`.
  - Expected: the error text equals `injected write failure`,
    `fs::read(&path) == B`, and the sorted `read_dir` names are exactly
    `["image.png"]`.
  - Before the fix, the read fails with NotFound because A removed B's file.
    Record that log.
- `failed_publish_keeps_a_concurrent_forced_replacement`.
  - Call `write_new_inner(&path, b"capture", |f| f.write_all(b"capture"), |file, target| { replace_regular(target, B).unwrap(); Err(tempfile::PersistError { error: io::Error::new(io::ErrorKind::Unsupported, "injected publish failure"), file }) })`.
  - Expected: the error kind is `Unsupported` and its text is `injected publish
    failure`. The path holds `B`, and the directory names are exactly
    `["image.png"]`.
  - This test cannot compile before the fix, so it is not fail-before evidence.
- Existing `write_new_removes_a_partly_written_file_on_error` stays unedited and
  passes.
- `crates/native/tests/file_contract.rs` stays unedited and passes: identical,
  exists, directory, links, dangling links, readonly `PermissionDenied` with an
  empty directory, and forced replacement.

## Verification (each command exits 0 and runs tests)

1. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-native -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car10-p1 cargo clippy -p nodetto-native --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car10-p1 cargo test -p nodetto-native`
   - Evidence: both new tests and every `file_contract` test pass, and clippy is
     clean.
   - The pre-fix log of `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car10-p1 cargo test -p nodetto-native failed_new_capture_keeps_a_concurrent_forced_replacement`
     is stored as evidence only.

## Done criteria

- `grep -n "remove_file(path)" crates/native/src/fs.rs` finds nothing inside
  `write_new_inner` and `write_new_with`.
- The pre-fix failing log and the post-fix passing log exist, and command 1 exits
  0.
- `git diff --name-only` for this plan stays inside its writePaths.
- The progress log reads `done`, with hashes, commands, exit codes and log paths.

## Implementation status

Implementation complete; regression, formatting, clippy and crate tests pass.
Formal review and integration gates remain downstream. See
`impl-plans/progress/car10-p1-capture-write-rust.md` for evidence.
