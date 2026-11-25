# car9-p3-mcp-bun

- planId: car9-p3-mcp-bun; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car9-p3-mcp-bun.md
- Finding: function-mcp-inline-image-replaced-before-readback (medium), Bun server.
- Design: `design-docs/specs/design-ai-capture.md` 4.5, 11, 27.1 R9-2 (Bun, Bun
  staging, Tests), 27.4. Follow `impl-plans/active/car9-00-overview.md` worker
  rules. Evidence: `tmp/car9-r9/car9-p3-mcp-bun/`.

## Intent and context

`createMcpServer` (`apps/cli/src/mcp.ts:66-182`) wraps `io.capture.write`
(`mcp.ts:100-103`) and keeps only `writtenPath`; after the command returns,
`inlineContent` (`mcp.ts:35-63`) re-reads the path through `readInlineBytes`
(default `io.readBytes`; `serveMcp` passes `readLocalInlineBytes`, `mcp.ts:185-210`).
A concurrent writer can replace the file in between, so call A gets B's image.
Fix: attach the bytes the call itself wrote.

Non-goals: no change to `mcp-image.ts`, `capture-command.ts`, `commands.ts`,
`local-io.ts`, the CLI, tool registration, instructions text, `structuredContent`,
`isError`, note texts, `mcp-stdio.test.ts` or `cad-command.test.ts`.

## Changes (`apps/cli/src/mcp.ts`), two stages

Stage 1 (seam only, readback kept):
- Third parameter becomes
  `options: { readInlineBytes?: (path: string) => Uint8Array | number | undefined; run?: typeof runCliAsync } = {}`;
  reader default `io.readBytes?.(path)`; `run` default `runCliAsync`.
- `execute` calls `run(args, io', version)` instead of `runCliAsync`.
- `serveMcp` passes `{ readInlineBytes: readLocalInlineBytes }`.
- Add the new test (below), run the focused command, record the failure: both
  writes complete, both calls exit 0, and A's attachment equals B's bytes.

Stage 2 (fix):
- Per-request record set by the write wrapper when the status is not `"exists"`:
  `{ path: capture.absolute(path), byteLength: bytes.byteLength, bytes?: Uint8Array }`
  with `bytes` kept (by reference, no copy) only when
  `byteLength <= MCP_INLINE_MAX_BYTES`. A later recorded write replaces it. A
  thrown inner write propagates as today and records nothing.
- Content after the result: unchanged conditions (`record !== undefined` and exit
  0 or 1); `capturedImage(result.stdout)` path must equal `record.path`, else the
  existing "could not read the written path from capture output. Try --json." text
  (also when stdout has no path, as today). Oversize -> existing text
  `Image not inlined: ${byteLength} bytes exceed ${MCP_INLINE_MAX_BYTES}. Open the path instead, or capture with a smaller --size or --format jpg.`;
  else `{ type: "image", data: base64(record.bytes), mimeType: image.mimeType }`.
- Remove `readInlineBytes` from the options (final type `{ run?: typeof runCliAsync }`),
  remove `readLocalInlineBytes`, its `node:fs` imports and the read-error branch;
  `serveMcp` passes no options.
- Imitate `mcp.ts:inlineContent` for base64 (`Buffer.from(buffer, offset, length)`).

Pitfalls: record per `execute` call (a local variable), never module state; keep
`"identical"` recording; do not copy bytes; do not read any file; no `!` assertions.

## Tests (`apps/cli/src/mcp.test.ts`)

Add a `connect` variant (or optional parameter) that passes options to
`createMcpServer`. New test "MCP inline capture attaches each call's own write":
- Shared memory io: `capture = { dir: () => "/mock", absolute: (p) => p, digest: () => "0".repeat(16), write }`
  storing into a `Map`; `io.readBytes` returns the current map entry.
- A and B: 4,096 bytes each, `A[i] = i & 255`, `B[i] = 255 - (i & 255)`.
- Two servers, each `{ run }`: run A writes A to `/mock/shared.png` via
  `io.capture.write`, resolves `aWritten`, awaits `bWritten`, returns
  `{ exitCode: 0, stdout: "path: /mock/shared.png\n", stderr: "" }`; run B awaits
  `aWritten`, writes B, resolves `bWritten`, returns the same stdout. Call both
  concurrently with `["--inline", "--output", "/mock/shared.png"]` -> both
  `isError` false; map entry is B; A's decoded image equals A; B's equals B.
- One server each, fake runs writing then returning:
  exit 1 -> image present, `isError` true, `structuredContent` equals the fake result;
  inner write returns `"identical"` -> image equals the call's bytes;
  inner write returns `"exists"` and run returns exit 2 -> one content block;
  inner write throws -> one content block, exit 2;
  1,048,576 bytes -> image, decoded length 1,048,576;
  1,048,577 bytes -> text containing `1048577 bytes exceed 1048576`;
  `/mock/front.jpg` -> `mimeType` `image/jpeg`.
- Existing test "MCP capture appends opt-in images and read notes while preserving
  the CLI result" (design 27.4): scenarios `/mock/large.png` and
  `/mock/unreadable.png` change `mode` to `"image"` (attachment equals
  `direct.bytes.get(path)`); `expect(reads).toEqual([])`; remove only the now unused
  `large`/`unreadable` entries of `notes`. Every other scenario and assertion stays.

## Verification (exits 0 and runs tests)

1. Stage 1 evidence (expected to fail, not a gate):
   `bun test apps/cli/src/mcp.test.ts --test-name-pattern '^MCP inline capture attaches each call.s own write$'`
   - evidence: exactly one case ran; failure is A's byte comparison.
2. Gate: `bunx biome check apps/cli/src/mcp.ts apps/cli/src/mcp.test.ts && bun test apps/cli/src/mcp.test.ts apps/cli/src/mcp-image.test.ts apps/cli/src/mcp-stdio.test.ts`
   - evidence: new test passes both byte comparisons; all other tests pass;
     complete log under the evidence root.

## Done criteria

- `grep -n "readInlineBytes\|readLocalInlineBytes\|readSync" apps/cli/src/mcp.ts` prints nothing.
- Stage 1 failing log and command 2 passing log exist; command 2 exits 0.
- `git diff --name-only` for this plan's edits stays inside its writePaths.
- Progress log reads `done` with hashes, commands, exit codes and log paths.

## Implementation status

Implementation complete; focused gate passed. Stage 1 regression and final results are recorded in `impl-plans/progress/car9-p3-mcp-bun.md`. Formal review and integration gates remain downstream.
