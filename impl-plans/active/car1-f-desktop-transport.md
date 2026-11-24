# car1-f-desktop-transport: binary capture transport for the desktop (F10)

- planId: car1-f-desktop-transport. Wave 1. dependsOn: none. Gate: none.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F10 and 13.
- Progress log: `impl-plans/progress/car1-f-desktop-transport.md`.

## Intent

The packed scene crosses the Tauri bridge as a raw binary body, and the
reply as a raw binary response, instead of one JSON number per byte. The
`captureSolid` signature seen by `export-handlers.ts` is unchanged.

## Non-goals

- Do not change `writeBytes` and its `Array.from` transport.
- Do not edit `export-handlers.ts`, the renderer, or any other command.

## Changes

1. `apps/desktop/src/file/backend.ts`, `createTauriExportBackend`:
   - Accept an optional injected `invokeImpl = invoke` for tests. Keep
     the default call shape for production.
   - `captureSolid(scene, format, quality)` calls
     `invokeImpl("capture_solid", scene, { headers: { "x-nodetto-format": format, "x-nodetto-quality": String(quality) } })`,
     with `scene` passed as the `Uint8Array` itself.
   - The reply is an `ArrayBuffer`. Split it with the section 6.3
     framing: `u32` little-endian report length, the report UTF-8 JSON,
     then the image.
   - Return `{ image: Uint8Array, report: string }`.
   - Throw `Error("Truncated solid capture packet.")` on a short reply
     (imitate `apps/cli/src/native-engine.ts` `renderSolid`).
2. `apps/desktop/src-tauri/src/capture.rs`:
   - `capture_solid` takes `request: tauri::ipc::Request<'_>`.
   - Require `InvokeBody::Raw`; otherwise return
     `Err("scene must be a binary body")`.
   - Read the two headers. A missing or bad format gives
     `format must be png or jpg`; a missing or bad quality gives
     `quality must be between 1 and 100`. These are the existing messages.
   - Copy the body to a `Vec<u8>`, then run `capture_solid_blocking` on
     `spawn_blocking`.
   - Return `tauri::ipc::Response::new(framed)`, where `framed` is
     `u32 LE len(report) || report || image`.
   - `capture_solid_blocking` keeps its validation. Add
     `fn frame_reply(&CaptureReply) -> Vec<u8>` for tests.

## Pitfalls

- An async Tauri command with a borrowed `Request` must return `Result`.
  Copy the body before `spawn_blocking`.
- Use little-endian length, exactly as the native CLI packet does.
- Do not JSON-encode the image anywhere.

## Tests (each fails before: today the body is `{ scene: number[] }`)

- New `apps/desktop/src/file/backend.test.ts`, with a fake `invokeImpl`
  that records its arguments and a 1,179,856-byte scene:
  - the second argument is the same `Uint8Array` instance, not an array;
  - the headers are `x-nodetto-format: png` and `x-nodetto-quality: 90`;
  - a framed reply built from a known report string and image bytes
    splits back into exactly those values;
  - a 3-byte reply throws.
- `apps/desktop/src-tauri/src/capture.rs` tests:
  - `frame_reply(capture_solid_blocking(SCENE, "png", 90))` splits into
    the image and report of `render_scene(SCENE, Png, 0)`;
  - the existing invalid-input test is kept.

## Verification

1. `biome check apps/desktop/src/file/backend.ts apps/desktop/src/file/backend.test.ts && bun test apps/desktop/src/file/backend.test.ts apps/desktop/src/shell/export-handlers.test.ts`
   must exit 0.
2. `CARGO_TERM_QUIET=true cargo fmt -p app -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-f cargo test -p app capture`
   must exit 0 with the capture tests running.
3. `bun run typecheck && bun test apps/desktop/src/file/backend.test.ts`
   must exit 0.

## Done when

- [x] The scene and the reply are binary.
- [x] The image and report equal the direct render (Rust parity test; verification recorded in progress log).
- [x] This plan does not edit `export-handlers.ts`.
