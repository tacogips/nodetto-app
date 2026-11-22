# M2 capture-02-output-safety

- dependsOn: M1 (green type check)
- Design: sections 4.2 (absolute path), 4.3, 11 (output), 12
- writePaths: `crates/native/src/fs.rs`,
  `crates/native/tests/file_contract.rs` (new tests only),
  `apps/cli/native/src/files.rs`, `apps/cli/native/src/engine.rs` (four
  host operations and their names in the list at `:238-241`),
  `apps/cli/native/src/engine_tests.rs` (new tests only),
  `apps/cli/src/capture-io.ts` (new), `apps/cli/src/capture-io.test.ts`
  (new), `apps/cli/src/commands.ts` (the `CommandIo` field only),
  `apps/cli/src/local-io.ts`, `apps/cli/src/native-engine.ts` (the
  `declare const native` entries and the `io` object)
- Pre-authorised: none. Existing tests are not edited.

## Contract

```rust
// crates/native/src/fs.rs
pub enum NewFile { Written, Identical, Exists }
/// Exclusive creation (create_new): never follows a link, never replaces.
/// An existing regular file with equal bytes yields Identical.
pub fn write_new(path: impl AsRef<Path>, bytes: &[u8]) -> io::Result<NewFile>;
/// Atomic replacement of a regular file; a symbolic link is an error.
pub fn replace_regular(path: impl AsRef<Path>, bytes: &[u8]) -> io::Result<()>;
/// Create with mode 0700, or accept an existing real directory that is not
/// a link and, on unix, is owned by `owner` and not writable by group or others.
pub fn private_dir(path: impl AsRef<Path>, owner: Option<u32>) -> io::Result<()>;
/// The effective user id (unix): the owner of a file this process just created
/// in `dir` (an anonymous temporary file). None on other platforms.
pub fn current_owner(dir: impl AsRef<Path>) -> io::Result<Option<u32>>;
```

```ts
// apps/cli/src/commands.ts, new optional field of CommandIo
readonly capture?: {
  /** Per-user private directory for default captures; created on first use. Throws with the reason. */
  dir(): string;
  /** Absolute form of a command path. */
  absolute(path: string): string;
  /** replace=false: exclusive creation. replace=true: replace a regular file. */
  write(path: string, bytes: Uint8Array, replace: boolean): "written" | "identical" | "exists";
  /** 64-bit FNV-1a of the bytes as 16 lowercase hexadecimal digits. */
  digest(bytes: Uint8Array): string;
};
```

Native host operations (names added to the list in `engine.rs`):
`captureDir()` and `captureAbsolute(path)` return strings,
`writeCapture(path, bytes, replace)` returns one of the three strings,
`digest(bytes)` returns the hex string.

## Behavior

- `write_new`: open with `create_new(true)`; on `AlreadyExists` read the
  existing entry with `symlink_metadata`: a regular file of the same
  length whose bytes are equal gives `Identical`, anything else `Exists`
  (a link, a directory or a different file is never read through or
  replaced). After a successful create: `write_all`, `sync_all`; when the
  write fails the new file is removed and the error returned.
- `replace_regular`: `symlink_metadata`; a link gives
  `io::ErrorKind::InvalidInput` with the text `the output path is a
  symbolic link`; a missing file is created through `write_new`; a regular
  file is replaced through the existing `write_atomic`.
- `current_owner`: unix: create an anonymous file with the `tempfile`
  crate the package already depends on and return its `uid()`; no new
  dependency and no `unsafe`.
- `private_dir`: `DirBuilder` with mode 0700 on unix; `AlreadyExists` is
  followed by `symlink_metadata`. The error texts are: `it is not a
  directory` (also for a link), `it belongs to another user` (unix, uid
  differs from `owner`), `it is writable by other users` (unix, any of
  `0o022`). Windows checks the type only. A freshly created directory is
  checked the same way.
- CLI native `files.rs`: `capture_dir()` = `std::env::temp_dir()` joined
  with `nodetto-capture-<uid>` on unix and `nodetto-capture` elsewhere,
  through `private_dir` with `current_owner(temp_dir)`; an error is
  returned as `Cannot use the capture directory <dir>: <reason>.`
  `digest(bytes)` is FNV-1a 64 (offset `0xcbf29ce484222325`, prime
  `0x100000001b3`, wrapping multiply), formatted `{:016x}`.
  `captureAbsolute` is `std::path::absolute` of the path the host resolves
  for commands (`engine.rs:82-90`).
- `writeCapture` resolves the path like `writeBytes` does (the TypeScript
  side passes `native.path(path)`).
- Bun host `capture-io.ts` implements the same operations with `node:fs`
  (`openSync(path, "wx")`, `lstatSync`, `mkdirSync` with mode `0o700`,
  `os.tmpdir()`, `process.getuid?.()`, `path.resolve`) and `BigInt`
  FNV-1a. The directory function takes the parent directory and the
  expected uid as parameters so tests can inject both. The replace branch
  refuses a link, then calls the existing `writeFileAtomic`. `localIo()`
  exposes it as `capture`. `native-engine.ts` exposes the native
  operations as `io.capture`.
- No command uses the new field yet; `export` and every other command are
  unchanged.

## Tests

- `file_contract.rs`: `write_new` creates a file with the bytes; a second
  call with equal bytes is `Identical` and leaves the content; different
  bytes give `Exists` and leave the file; a link to an existing file and
  a dangling link both give `Exists` and neither the link nor its target
  changes; a failed write leaves no file (target in a read-only
  directory, unix only). `replace_regular` replaces a regular file,
  creates a missing one, refuses a link. `private_dir` creates mode 0700,
  accepts its own directory twice, refuses a link to a directory, a
  regular file, (unix) a directory with mode 0777, and (unix) its own
  directory when called with `owner` set to another uid (the injected
  owner stands in for a directory made by another account).
  `current_owner` equals the owner of a directory the test created.
- `engine_tests.rs`: through the `evaluate` helper, `native.writeCapture`
  returns `"written"`, then `"identical"`, then `"exists"` for other
  bytes, and `"written"` with `replace` true; `native.digest` of the bytes
  `61 62 63` is `e71fa2190541574b`; `native.captureDir()` names an existing
  directory whose last component starts with `nodetto-capture`;
  `native.captureAbsolute("a.png")` is absolute and ends with `a.png`.
- `capture-io.test.ts` (in a `mkdtemp` directory): the same cases as the
  Rust tests for `write` and the directory rule, including a wrong
  injected uid, which must throw `Cannot use the capture directory` with
  `belongs to another user`; the name contains the uid on unix; the same
  digest value, so both hosts agree; `absolute` of a relative path.

## Acceptance criteria

- Neither host can replace or write through an existing path without
  `replace`, and never through a link, with tests on both hosts.
- A capture directory that another account created is refused with a
  reason, and each account has its own directory name.
- The digest of both hosts is equal for the test vector.
- `apps/cli/src/write-atomic.test.ts` and
  `crates/native/tests/file_contract.rs` existing cases pass unmodified.

## Verification (each must exit 0)

1. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo test -p nodetto-native'`
2. `sh -c 'CARGO_TERM_QUIET=true cargo clippy -p nodetto-native -p nodetto-cli --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-cli'`
3. `sh -c 'bun run typecheck && bun test apps/cli/src/capture-io.test.ts apps/cli/src/write-atomic.test.ts apps/cli/src/commands.test.ts'`
4. `sh -c 'bun run lint:ts && bun test apps/cli/src/capture-io.test.ts'`

## Progress

Implemented. Both CLI hosts expose the capture I/O operations. The Bun
atomic writer now shares its final-entry writer with capture so capture
can preserve permissions and replace atomically without resolving an
output symlink. This also touches `apps/cli/src/write-atomic.ts`. Bun
uses the effective uid to match the native directory owner check.
