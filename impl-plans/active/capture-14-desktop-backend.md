# M14 capture-14-desktop-backend (revision 4)

- Stage: wave 2. dependsOn: M15 (dialog props, `onCadCameraChange`), M20
  (`DEFAULT_CAD_INTERFERENCE`, `decodeMesh` request field,
  `decodeCaptureMesh` in `@nodetto/io/nmesh`), M22 (`describeInterference`,
  `describeBodies`, `parseSolidReport` with all keys). Uses only the crate's
  public API (`nodetto_capture::render_scene`, `ImageFormat`).
- Design: sections 6.1 (`prepareCadCapture`), 8.1, 8.5 (request contract),
  9, 13.
- writePaths: `apps/desktop/src-tauri/Cargo.toml` (dependency
  `nodetto-capture = { path = "../../../crates/capture" }`), `Cargo.lock`,
  `apps/desktop/src-tauri/src/capture.rs` (new),
  `apps/desktop/src-tauri/src/lib.rs` (module line and one entry in
  `generate_handler!`), `apps/desktop/src/file/backend.ts`,
  `apps/desktop/src/shell/export-handlers.ts`,
  `apps/desktop/src/shell/export-handlers.test.ts`, `apps/desktop/src/App.tsx`,
  `impl-plans/active/capture-14-desktop-backend.md`, `tmp/capture/m14`, `target`
- Pre-authorised: fakes of `ExportBackend` need no change (the method is
  optional). If a test or Tauri capability file lists registered commands
  exactly, `capture_solid` may be appended there and nowhere else; record
  the path in Progress. `Cargo.lock` changes only by the path dependency.

## Intent

The desktop renders a CAD page with the same crate, request function,
default and decoder as the CLI, saves through the existing dialog and byte
writer, shows the interference and body text, and the App passes the
dialog what M15 asks for.

## Non-goals

No new entitlement or capability, no file access in the Rust command, no
CLI files, no edits to `packages/ui-solid` (M15) or crate internals. Do not
import anything from `apps/cli`.

## Contract

```rust
// apps/desktop/src-tauri/src/capture.rs
#[derive(serde::Serialize)] pub struct CaptureReply { pub image: Vec<u8>, pub report: String }
#[tauri::command] pub async fn capture_solid(scene: Vec<u8>, format: String, quality: u8) -> Result<CaptureReply, String>;
pub fn capture_solid_blocking(scene: &[u8], format: &str, quality: u8) -> Result<CaptureReply, String>;
```

```ts
// backend.ts: ExportBackend gains
captureSolid?(scene: Uint8Array, format: "png" | "jpg", quality: number): Promise<{ image: Uint8Array; report: string }>;
// export-handlers.ts: ExportHandlers gains
readonly captureCadImage: (options: { camera: CaptureCameraRequest; format: "png" | "jpg";
  theme: CaptureTheme; width: number; height: number }) => Promise<void>;
```

## Behaviour

- `capture_solid`: `format` `"png"` or `"jpg"`, quality 1 to 100 (else an
  error string); runs `render_scene(&scene, format, 0)` in
  `tauri::async_runtime::spawn_blocking`; every error mapped to its text.
  Scene bytes arrive as the JSON number array `write_export_atomic`
  already uses (`apps/desktop/src/file/backend.ts:176-180`).
- Tauri backend `captureSolid`: invoke with `Array.from(scene)`, wrap the
  image in `Uint8Array`. The unavailable backend does not define it.
- `captureCadImage`: current page must be `cad3d`; call
  `prepareCadCapture(editor.getSnapshot().elements, page.id, { camera,
  width, height, theme, interference: DEFAULT_CAD_INTERFERENCE, decodeMesh:
  decodeCaptureMesh })` with `decodeCaptureMesh` imported from
  `@nodetto/io/nmesh`. `CaptureInputError` is shown as its message. Then
  `captureSolid` (quality 90 for JPG), `parseSolidReport`,
  `pickExportPath(<page name>, <ext>)` and `writeBytes`, following the STL
  export handler in the same file. After saving, report through
  `setExportError` (the STL note channel, `export-handlers.ts:217-227`):
  `Image saved.` then the lines of `describeInterference`, the error
  entries of `describeBodies`, and the failed-feature count when > 0.
  Errors: `could not capture: <message>`. Cancelled dialog writes nothing.
- `App.tsx` (the wiring moved from M15): keep the last camera per page in
  a plain `Map` fed by `onCadCameraChange`; pass `cadCurrentView`,
  `captureCadImage={exportHandlers.captureCadImage}` only when
  `exportBackend.captureSolid` exists, and `canvasMode` (the current
  canvas light or dark mode) to the Export dialog.

## Tests

- Rust unit tests in `capture.rs`: `crates/capture/tests/fixtures/plate-iso.ncs1`
  -> a 1024 x 768 PNG and a report; bytes equal `render_scene` called
  directly; unknown format and quality 0 and a truncated scene -> errors.
- `export-handlers.test.ts` (fake backend recording the scene, returning
  fixed bytes and a canned report with one capped pair and one emptied
  body): bytes written to the picked path with `.png` and `.jpg`; the
  recorded scene equals `prepareCadCapture` called with the same request
  (default interference and `decodeCaptureMesh`) for the Plate document
  (`apps/cli/src/__fixtures__/capture-plate.jsonl`), `iso`, 1024 x 768,
  light; `theme: "dark"` changes the colour block; the note names the pair
  with `, approximate` and the emptied feature; a page without bodies and a
  backend without `captureSolid` report errors and write nothing; a
  cancelled dialog writes nothing. (Fixture equality and mesh-only parity
  are added by M23.)

## Acceptance criteria

- Desktop uses the same request function, default and decoder as the CLI
  and saves through the existing dialog; App wiring enables the M15 entry.
- No new entitlement; the command touches no file.

## Verification (each must exit 0)

1. `sh -c 'mkdir -p tmp/capture/m14 && rustfmt --edition 2021 --check apps/desktop/src-tauri/src/capture.rs apps/desktop/src-tauri/src/lib.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m14 cargo clippy -p app --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m14 cargo test -p app capture > tmp/capture/m14/app-test.log 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m14/app-test.log; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed" tmp/capture/m14/app-test.log'`
   (the desktop package is `app`, `apps/desktop/src-tauri/Cargo.toml:2`)
2. `sh -c 'bun run typecheck && bunx biome check apps/desktop/src/file/backend.ts apps/desktop/src/shell/export-handlers.ts apps/desktop/src/shell/export-handlers.test.ts apps/desktop/src/App.tsx && bun test apps/desktop/src/shell/export-handlers.test.ts packages/core/src/capture'`
3. `sh -c 'bun --cwd=apps/desktop run build && bun test packages/ui-solid/src/cad/capture-image.test.ts apps/desktop/src/styles/theme-tokens.test.ts'`

## Progress

Pending (revision 4).
