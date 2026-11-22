# M13 capture-13-mcp

- dependsOn: M3 (the command and its `path:` first line)
- Design: sections 3.7, 4.4, 4.5, 11 (MCP)
- writePaths: `apps/cli/src/mcp.ts`, `apps/cli/src/mcp-image.ts` (new) and
  its test, `apps/cli/src/mcp.test.ts` (new cases only),
  `apps/cli/src/mcp-stdio.test.ts` (new case only),
  `apps/cli/native/src/mcp.rs`, `apps/cli/src/help.ts` (the `mcp` page:
  one sentence), `apps/cli/src/capture-help/inline.ts` (the part M3 left
  empty). No other milestone after M3 writes any of these files.
- Pre-authorised: none. The existing assertions of `mcp.test.ts` and
  `mcp-stdio.test.ts` pass unmodified; in particular `structuredContent`
  stays `{exitCode, stdout, stderr}` and the first content item stays the
  JSON text.

## Contract

```ts
// mcp-image.ts (pure, no I/O)
export const MCP_INLINE_MAX_BYTES = 1_048_576;
/** The capture arguments ask for an inline image: the command is capture and --inline is present. */
export function wantsInlineImage(args: readonly string[]): boolean;
/** Path and MIME type from a successful capture's stdout (text or --json form), or null. */
export function capturedImage(stdout: string): { path: string; mimeType: "image/png" | "image/jpeg" } | null;
```

Rust: two private functions with the same behaviour in `mcp.rs`.

## Behavior

- Instructions of both servers (`apps/cli/src/mcp.ts:33`,
  `apps/cli/native/src/mcp.rs:39`) gain one sentence: `To look at a page,
  call nodetto_capture: it writes a PNG or JPG and returns its path; add
  --inline to also receive the image in the result.` The existing
  sentences stay.
- Tool call: after the command returned, when `exitCode` is 0 or 1 (1 is
  `--fail-on-interference` with a written image), `wantsInlineImage(args)`
  holds (for `nodetto_capture`, and for `nodetto_cli` whose first
  argument is `capture`), and `capturedImage(stdout)` yields a path:
  - read the file through the command I/O (`io.readBytes` in the
    TypeScript server; `std::fs::read` of the path resolved like the host
    resolves command paths in the native server);
  - at most `MCP_INLINE_MAX_BYTES`: append the content item `{ type:
    "image", data: <standard base64>, mimeType }` after the text item;
  - larger: append a text item `Image not inlined: <n> bytes exceed
    1048576. Open the path instead, or capture with a smaller --size or
    --format jpg.`;
  - unreadable: append a text item with the reason; the tool result is
    still the command's result.
- `structuredContent` and `isError` are computed as today. The image
  never appears in `structuredContent` or in the text item.
- `capturedImage`: the first line `path: <p>` of the text form, or the
  `path` member when stdout parses as a JSON object; the MIME type from
  the extension (`.png`, `.jpg`, `.jpeg`); anything else gives null.
- Without `--inline` nothing changes: no file is read.
- Help: the part `inline.ts` describes `--inline` (MCP only, the 1 MiB
  cap, that the token cost follows the pixel size and the default 1024 x
  768 picture is about 1,036 tokens of 28 x 28 pixels, that a client
  applies its own limit to tool results and may refuse or shrink a
  picture well below the cap, and the advice to use `--format jpg` with
  a smaller `--size` or to read the path instead); the `mcp` page names
  `nodetto_capture` as the way to look at a page.

## Tests

- `mcp-image.test.ts`: `wantsInlineImage` for both tool forms and for
  other commands; `capturedImage` for text and JSON stdout, jpg and jpeg,
  a path with spaces, missing line, other extension.
- `mcp.test.ts` (in-memory transport; the memory I/O gets a `capture`
  field that stores written bytes in a map and a `readBytes` that reads
  from the same map; the picture comes from the real Bun renderer, and
  for the size-cap case `readBytes` returns an enlarged array):
  `nodetto_capture` with
  `--inline` returns two content items, the second an image whose base64
  decodes to the written bytes; without `--inline` one item; a file above
  the cap gives the text note; `structuredContent` equals the plain CLI
  result in all three cases; the instructions string contains
  `nodetto_capture`.
- `mcp-stdio.test.ts`: against the source server, and against the
  compiled binary when `NODETTO_CLI_TEST_BINARY` is set, a real 2D
  capture with `--inline --output <tmp>/a.png` returns an image item
  whose bytes equal the file; the tool list assertion is unchanged.
- Rust unit test in `mcp.rs`: the two functions on the same vectors as
  the TypeScript test.

## Acceptance criteria

- An MCP client finds `nodetto_capture` in the tool list and in the
  server instructions without being told.
- A client without file access can receive the picture with one flag;
  the default result stays small text.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun run lint:ts && bun test apps/cli/src/mcp-image.test.ts apps/cli/src/mcp.test.ts apps/cli/src/mcp-stdio.test.ts apps/cli/src/ai-commands.test.ts'`
2. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p nodetto-cli --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-cli'`
3. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/mcp-stdio.test.ts'`

## Progress

Implemented, pending implementation review. Both MCP servers advertise
`nodetto_capture` and append an image or a readback note after the original
text content when requested. The tests cover both argument forms, text and
JSON reports, and the image bytes sent through source and native stdio.

Readback follows the design's 1 MiB read limit. The local servers inspect
the open file and bound the read instead of loading the entire file before
checking its size. The TypeScript in-memory server uses `CommandIo.readBytes`.
The TypeScript server checks the reported path against the capture write.
The native server checks the requested output file or the default capture
directory. For filenames containing line breaks, use `--json` to supply an
unambiguous path.

Verification logs are in `tmp/capture/m13/` as `typescript.log`, `rust.log`
and `native-stdio.log`.
