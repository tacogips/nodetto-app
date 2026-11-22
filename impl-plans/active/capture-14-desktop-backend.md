# M14 capture-14-desktop-backend

- dependsOn: M11 (`prepareCadCapture` with the mesh decoder option, the
  final report shape with `open`), which includes M20 and M18
  (`describeInterference`, `describeBodies`)
- Design: sections 6.1 (`prepareCadCapture`), 8.1, 9, 13
- writePaths: `apps/desktop/src-tauri/Cargo.toml` (dependency
  `nodetto-capture`), `Cargo.lock`,
  `apps/desktop/src-tauri/src/capture.rs` (new),
  `apps/desktop/src-tauri/src/lib.rs` (module line and one entry in
  `generate_handler!`), `apps/desktop/src/file/backend.ts`,
  `apps/desktop/src/shell/export-handlers.ts` and its test
- Pre-authorised: fakes of `ExportBackend` in existing tests need no
  change because the new method is optional. If a test or a Tauri
  capability file enumerates the registered commands exactly, the new
  command name `capture_solid` may be appended there and nowhere else.

## Contract

```rust
// apps/desktop/src-tauri/src/capture.rs
#[derive(serde::Serialize)]
pub struct CaptureReply { pub image: Vec<u8>, pub report: String }
#[tauri::command]
pub async fn capture_solid(scene: Vec<u8>, format: String, quality: u8) -> Result<CaptureReply, String>;
/// The command body, callable from tests.
pub fn capture_solid_blocking(scene: &[u8], format: &str, quality: u8) -> Result<CaptureReply, String>;
```

```ts
// apps/desktop/src/file/backend.ts: ExportBackend gains
captureSolid?(scene: Uint8Array, format: "png" | "jpg", quality: number): Promise<{ image: Uint8Array; report: string }>;

// apps/desktop/src/shell/export-handlers.ts: ExportHandlers gains
readonly captureCadImage: (options: { camera: CaptureCameraRequest; format: "png" | "jpg";
  theme: CaptureTheme; width: number; height: number }) => Promise<void>;
```

## Behavior

- `capture_solid`: accepts `format` `"png"` or `"jpg"` and quality 1 to
  100, runs `nodetto_capture::render_scene(&scene, format, 0)` inside
  `tauri::async_runtime::spawn_blocking`, and maps every error to its
  text. It touches no file. The scene bytes arrive as the JSON number
  array that `write_export_atomic` already uses for bytes
  (`apps/desktop/src/file/backend.ts:176-180`); the reader's limits bound
  their size.
- Tauri backend: `captureSolid` invokes the command with
  `Array.from(scene)` and wraps the returned image in a `Uint8Array`. The
  unavailable backend does not define the method.
- `captureCadImage`: reads the current page (must be `cad3d`) and calls
  the shared `prepareCadCapture(editor.getSnapshot().elements, page.id,
  { camera, width, height, theme, interference: { cellMm: 0.25 },
  decodeMesh })`, the request the CLI builds for its defaults, with the
  NMESH decoder of `@nodetto/io/nmesh`. A `CaptureInputError` is shown as
  its message. Then `exportBackend.captureSolid`, `parseSolidReport`,
  `pickExportPath(<page name>.<ext>)` and `writeBytes`. After saving it
  reports through `setExportError`, the channel the STL export uses for
  notes (`apps/desktop/src/shell/export-handlers.ts:217-227`): `Image
  saved.` followed by the lines of `describeInterference`, the error
  entries of `describeBodies` and the count of failed features when
  there are any. Errors are reported as `could not capture: <message>`.

## Tests

- Rust unit tests in `capture.rs`: the fixture bytes
  `crates/capture/tests/fixtures/plate-iso.ncs1` give a PNG of 1024 x 768
  and a report with one pair; the bytes equal
  `nodetto_capture::render_scene` called directly; an unknown format and
  a truncated scene are errors.
- `export-handlers.test.ts` (fake backend with `captureSolid` that
  records the scene and returns fixed bytes and a canned report with one
  pair and one emptied body): the handler writes the returned bytes to
  the picked path with the right extension; the recorded scene equals
  `prepareCadCapture` called directly with the same request, and equals
  the committed `apps/cli/src/__fixtures__/capture-plate-default.ncs1`
  for the Plate document with the `iso` view, 1024 x 768 and the light
  theme (the file the CLI test and the Boa test pin, so desktop, Bun CLI
  and native CLI are tied to one set of bytes); `theme: "dark"` changes
  the colour block; the note names the pair and the emptied body; a page
  without bodies and a backend without `captureSolid` report errors and
  write nothing; a cancelled save dialog writes nothing.

## Acceptance criteria

- The desktop renders a CAD page with the same code, the same request
  function and the same scene bytes as the CLI, and saves it through the
  existing dialog and writer.
- No new entitlement, no file access in the new command.

## Verification (each must exit 0)

1. `sh -c 'mkdir -p tmp/capture/m14 && CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p app --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p app capture > tmp/capture/m14/app-test.log 2>&1 && grep -Eq "test result: ok\. [1-9][0-9]* passed" tmp/capture/m14/app-test.log'`
   (the desktop package is named `app`, `apps/desktop/src-tauri/Cargo.toml:2`;
   the `grep` fails the command when the filter `capture` matched no test)
2. `sh -c 'bun run typecheck && bun run lint:ts && bun test apps/desktop/src/shell/export-handlers.test.ts packages/core/src/capture'`

## Progress

Pending.
