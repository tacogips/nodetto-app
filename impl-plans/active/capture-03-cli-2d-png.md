# M3 capture-03-cli-2d-png

- dependsOn: M2 (`CommandIo.capture`), M19 (`captureRasterPlan`,
  `CAPTURE_THEMES`)
- Design: sections 3.1, 4.1 to 4.4, 5, 7 (2D), 8.2, 12
- writePaths: `apps/cli/src/capture-command.ts` (new),
  `apps/cli/src/capture-command.test.ts` (new),
  `apps/cli/src/capture-backend.ts` (new, Bun only),
  `apps/cli/src/capture-help.ts` (new), `apps/cli/src/capture-help/`
  (new: `general.ts`, and the empty parts `jpg.ts`, `cad.ts`,
  `interference.ts`, `inline.ts`), `apps/cli/src/raster-backend.ts` (add
  `export` to `fontOptions`, nothing else), `apps/cli/src/cli.ts`,
  `apps/cli/src/commands.ts` (one `case`), `apps/cli/src/native-engine.ts`,
  `apps/cli/src/help.ts`, `apps/cli/native/src/engine_tests.rs` (one new
  test), `apps/cli/src/native-parity/capture.test.ts` (new)
- Pre-authorised: none. `apps/cli/src/ai-commands.test.ts`,
  `mcp.test.ts`, `mcp-stdio.test.ts`, `help-app-design.test.ts` and
  `export-command.test.ts` pass unmodified.

## Contract

```ts
// apps/cli/src/capture-help.ts
export interface CaptureHelpPart { readonly usage: readonly string[]; readonly body: string }
export const CAPTURE_HELP: string;   // general, jpg, cad, interference, inline, in this order

// apps/cli/src/capture-command.ts
export interface CaptureBackend {
  rasterize(svg: string, scale: number, fontDir: string | undefined, fallback?: boolean): Promise<Uint8Array>;
}
export function captureCommand(io: CommandIo, args: readonly string[], backend: CaptureBackend): Promise<CommandResult>;
```

`nodetto-cli capture <doc.jsonl> [--page <q> | --page-number <n>] [--output
<file>] [--format png] [--force] [--size <W>x<H>] [--scale <n>] [--theme
light|dark] [--element <id>] [--padding <n>] [--background <#rrggbb>]
[--font-dir <dir>] [--json] [--inline]`

## Behavior

- Arguments through `parseArgs`; errors end with the help excerpt as
  `export` does. `--page` and `--page-number` exclude each other. Without
  either, the first page in the order `pages` lists them
  (`apps/cli/src/pages-command.ts:40`). `--element` implies its page as in
  `export` (`apps/cli/src/export-command.ts:253-271`).
- `--format` accepts `png` only in this milestone; `jpg` or an output
  ending in `.jpg`/`.jpeg` fails with `JPG capture is not available in this
  build.` (replaced in M4). `--output` must end in `.png`. A `cad3d` page
  fails with `3D CAD capture is not available in this build.` (replaced in
  M9). `--inline` is accepted and has no effect in the command.
- Background: `--background`, else `CAPTURE_THEMES[theme].background`.
- SVG: the calls of `export` for page, frame and other element
  (`apps/cli/src/export-command.ts:517-538`), attachments resolved the same
  way; `null` gives `Page "<name>" has no visible content to capture.`
- Raster: `captureRasterPlan`, `snapSvgFrameToPixels`, font coverage and
  glyph warnings exactly as `export`
  (`apps/cli/src/export-command.ts:598-618`), then `backend.rasterize`.
- Target (design 4.3): without `--output` the name is
  `<stem>-<shortPageId>-<digest first 12>.png` in `io.capture.dir()`; an
  error from `dir()` or from writing there is printed with the addition
  `Pass --output <file> (Mac App Store build: inside the authorized
  folder).` and exit 2. `write(path, bytes, false)`; on `"exists"` try the
  suffixes `-2` to `-99` then fail. With `--output`: `write(path, bytes,
  force)`; `"exists"` fails with `<path> exists with different content;
  pass --force to replace it, or omit --output.` A host without
  `io.capture` fails with `This host cannot write captures.`
- Stdout: the lines of design 4.2 (`path` from `io.capture.absolute`,
  `format`, `size`, `bytes`, `page: <n>/<count> "<name>" (<kind>, id
  <id>)`), or the JSON object with `--json`. Warnings on stderr. Exit 0,
  or 2 on any failure.
- Wiring: `ASYNC_COMMANDS.capture` in `cli.ts` passes the Bun backend from
  `capture-backend.ts` (resvg with `fitTo: { mode: "zoom", value: scale }`
  and the exported `fontOptions`); `commands.ts` adds `case "capture":` to
  the asynchronous fall-through; `native-engine.ts` adds the branch with
  `rasterize` on `native.png`. `capture-command.ts` imports neither
  `capture-backend.ts` nor `capture-io.ts`: both use Node APIs and must
  stay out of the engine bundle that `native-engine.ts` roots
  (`apps/cli/scripts/build-engine.ts:12`).
- Help: `COMMAND_HELP.capture = CAPTURE_HELP`. `capture-help.ts` joins the
  usage tokens of the five parts into the usage block and their bodies
  into the page, then the exit codes. `general.ts` covers this milestone:
  every option above, the stdout form, that the path is absolute, where
  default captures go and what is never replaced, the Store build note,
  that `--theme dark` on a 2D page changes only the background and keeps
  the shapes' own colours, that the picture is opened with the agent's
  image-capable file reader, two examples. The other four parts export
  `{ usage: [], body: "" }`; later milestones replace only their own
  part file.
- `OVERVIEW` (design 4.4), 37 lines afterwards: add `  nodetto-cli capture
  <doc>       PNG/JPG picture of a page for a quick look` as the first
  line under `Render`; merge `Global --quiet suppresses warning lines.`
  and `Run "nodetto-cli help <command>" ...` into one line; merge the two
  AI loop lines into one that names `capture (look at the picture)`
  instead of `export (look at the PNG)`.

## Tests

- `capture-command.test.ts` (memory `CommandIo` with a fake `capture`
  field, fake backend that records its arguments and returns fixed PNG
  bytes): default page is the first; `--page`, `--page-number`; one
  generated one-shape document per kind in `PAGE_KINDS` except `cad3d`
  reaches the backend (the loop reads `PAGE_KINDS`, so a new kind is
  covered); stdout lines and `--json`; the printed path is the absolute
  one for a relative `--output`; default name pattern and that a second
  run reports the same path; suffix on a digest-name clash; `--output`
  refuses an existing different file and succeeds with `--force`; wrong
  extension; empty page; CAD page message; a failing `capture.dir()`
  gives exit 2 and a message that contains `--output`; theme background
  reaches the SVG; `OVERVIEW` has 37 lines and contains `nodetto-cli
  capture`, `nodetto-cli export` and `compare`; `CAPTURE_HELP` names every
  option of the usage block in its body.
- Real Bun renderer: one test captures a small document twice into a
  temporary directory and gets equal bytes, PNG signature and the planned
  size.
- `engine_tests.rs`: `nodettoRun(["capture", <doc>, "--output", <png>])`
  in a temporary directory writes a file with the PNG signature and
  returns exit code 0 with a `path:` first line.
- `native-parity/capture.test.ts` (runs with `NODETTO_CLI_TEST_BINARY`):
  for a 2D fixture, Bun and native agree on exit code and on the `path`,
  `format`, `size` and `page` lines; two native runs give equal bytes;
  the default-output run prints an absolute path inside a directory whose
  name starts with `nodetto-capture` and repeats it on the second run;
  wall time under 10,000 ms.

## Acceptance criteria

- `nodetto-cli capture <doc>` with no other argument writes a bounded PNG
  of the first page and prints its absolute path first, in both hosts.
- `nodetto_capture` is listed by both MCP servers with the help page.
- `export` behaviour and its tests are unchanged.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/mcp.test.ts apps/cli/src/mcp-stdio.test.ts apps/cli/src/help-app-design.test.ts apps/cli/src/export-command.test.ts'`
2. `sh -c 'bun run lint:ts && bun test apps/cli/src/capture-command.test.ts'`
3. `sh -c 'CARGO_TERM_QUIET=true cargo test -p nodetto-cli'`
4. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/native-parity/export.test.ts apps/cli/src/mcp-stdio.test.ts'`

## Progress

Implemented, pending implementation review. Both CLI hosts render PNG and
register the capture help through their existing MCP tool registries.

- Deviation: bake integral output dimensions into the snapped SVG root and
  apply density through its viewBox, then rasterize at unit zoom. The
  native zoom rule allocates 1569 x 701 for a 12247 x 5468 viewport whose
  fit is 1568 x 700. Single-precision rounding can also cross the
  default area cap (19780 x 14187). Export keeps its existing raster path.
- CAP-M19-01: report dimensions from the encoded PNG header. Both hosts
  have regression coverage for 100 x 100 at scale 1.1 and the default
  3000 x 3296 fit, plus the two native rounding cases above.
- CAP-M19-02: the command test reaches the height-only side limit at
  100 x 8193, scale 1, and checks that no rasterization takes place.
- CAP-M19-03: exit 2 retains the minimum-scale fit guidance. Help names
  --scale, --size and --element. Design section 5 remains an M16 follow-up.
- Verification logs: `tmp/capture/m03/v1.log` to `v4.log`.
