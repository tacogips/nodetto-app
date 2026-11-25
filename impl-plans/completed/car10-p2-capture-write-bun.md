# car10-p2-capture-write-bun

- planId: car10-p2-capture-write-bun; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car10-p2-capture-write-bun.md
- Finding: function-capture-failed-create-removes-successful-replacement
  (medium), Bun reference host.
- Design: `design-docs/specs/design-ai-capture.md` 4.3, 12, 28.1 R10-1 and 28.4.
  Follow the overview worker rules. Evidence:
  `tmp/car10-r10/car10-p2-capture-write-bun/`.

## Intent and context

`writeNew` (`apps/cli/src/capture-io.ts:100-124`) opens the public path with
`"wx"`. On a write or sync error it unlinks the public path (`:117`), which can
delete another writer's forced replacement. That replacement is published by
`writeCapture` (`:145`) through `writeEntryAtomic`
(`apps/cli/src/write-atomic.ts:39-86`). The fix stages bytes in a short-named
owned file, publishes with `linkSync`, and cleans up only the staging file.

Non-goals:
- Do not change `writeCapture`'s forced branch, `existingMatches`,
  `captureDirectory`, `absolutePath`, `digest` or `writeFileAtomic`.
- `writeEntryAtomic` keeps its own temporary name and behaviour.
- No new dependency, and no fallback to a direct create of the public path.

## Changes

`apps/cli/src/write-atomic.ts`:
- Export `siblingPath(target: string, name: string): string`. It contains the
  existing parent-joining code from `writeEntryAtomic` (`:44-50`):
  `dirname(target)`, then `join` on win32, otherwise concatenation that keeps the
  parent traversal intact.
- `writeEntryAtomic` calls it with its unchanged name
  `.${basename(target)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`.

`apps/cli/src/capture-io.ts`, `writeNew(path, bytes): WriteResult`:
1. `lstatSync(path)`. If it succeeds, return
   `existingMatches(path, bytes) ? "identical" : "exists"`. On `ENOENT`,
   continue. Any other error is rethrown.
2. `staging = siblingPath(path, `.nodetto-${randomBytes(8).toString("hex")}.tmp`)`.
   The name is 27 bytes and independent of the target basename.
   `descriptor = openSync(staging, "wx", 0o666)`.
3. In a `try` whose `finally` runs `unlinkSync(staging)` and ignores its error:
   - `writeFileSync(descriptor, bytes)` and `fsyncSync(descriptor)`, with
     `closeSync` in an inner `finally`. Keep `writeFileSync(descriptor, ...)`,
     because the existing test spies on it.
   - `linkSync(staging, path)`. On an `EEXIST` error, return the step 1 decision
     for `path`. Any other error is rethrown unchanged. Success gives
     `"written"`.
- Import `linkSync` from `node:fs` and `randomBytes` from `node:crypto`. Remove
  the public-path `unlinkSync` cleanup.

Pitfalls:
- `writeNew` never calls `unlinkSync(path)`, never opens `path` for writing, and
  never falls back when `linkSync` fails.
- The `writeCapture` NotFound branch keeps
  `if (writeNew(...) === "exists") throw new Error("the output path appeared while writing")`.
- Keep the named import style. The tests use `spyOn(fs, ...)` on the `node:fs`
  namespace, as the existing test does.

## Tests (`apps/cli/src/capture-io.test.ts`)

- New "a failed new capture keeps a concurrent forced replacement" (fail-before
  evidence).
  - Save `const originalWrite = fs.writeFileSync`, then spy on
    `fs.writeFileSync`. On its first call, the mock writes `cap` to the
    descriptor with `fs.writeSync`, asserts that
    `captureIo.write(image, B, true)` returns `"written"`, and throws `failure`.
    Later calls delegate to `originalWrite`.
  - Expected: the outer `captureIo.write(image, Buffer.from("capture"), false)`
    throws `failure`, `readFileSync(image)` equals `B`, and
    `readdirSync(folder)` equals `["image.png"]`. Restore the mock in `finally`.
  - Before the fix, `readFileSync` throws ENOENT. Record that log.
- New "a failed publish keeps a concurrent forced replacement".
  - Save `const originalLink = fs.linkSync`, then spy on `fs.linkSync`. On its
    first call, the mock asserts that `captureIo.write(image, B, true)` returns
    `"written"`, then throws `Object.assign(new Error("not supported"), { code: "ENOTSUP" })`.
    Later calls delegate to `originalLink`.
  - Expected: the outer call throws that error, the spy was called at least
    once, the image holds `B`, and the folder equals `["image.png"]`.
- New "a new capture accepts a near-limit basename" (behaviour guard).
  - Probe by writing and then removing a 255-byte name in the folder. Return
    early only on `ENAMETOOLONG`.
  - The target is `"a".repeat(251) + ".png"`. Expected: `"written"`, the exact
    bytes are at the target, and the folder contains only the target name.
- Existing "capture removes a partly written file and returns the write error":
  replace only the in-mock line `expect(readFileSync(image, "utf8")).toBe("cap")`
  (design 28.4) with two checks:
  - `lstatSync(image)` throws `ENOENT`;
  - `readdirSync(folder)` has exactly one entry starting with `.nodetto-`, whose
    content is `cap`.

  Every other assertion in that test stays as it is.
- All other existing tests in `capture-io.test.ts` and `write-atomic.test.ts`
  stay unedited and pass.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check apps/cli/src/capture-io.ts apps/cli/src/capture-io.test.ts apps/cli/src/write-atomic.ts && bun test apps/cli/src/capture-io.test.ts apps/cli/src/write-atomic.test.ts`
   - Evidence: all three new tests and every existing test pass.
   - The pre-fix failing log of
     `bun test apps/cli/src/capture-io.test.ts --test-name-pattern 'a failed new capture keeps a concurrent forced replacement'`
     is evidence only.

## Done criteria

- `writeNew` has no `unlinkSync(path)` and no fallback path, and `siblingPath` is
  exported and used by both writers.
- The pre-fix failing log and the post-fix passing log exist, and command 1 exits
  0.
- `git diff --name-only` for this plan stays inside its writePaths, and the
  progress log reads `done`.

## Implementation status

Done: Bun staging and no-clobber publication and the three regressions are
implemented. The focused Biome and test gate passed (18 tests); see the
plan-local progress log for evidence. Formal review and integration remain
owned by downstream workflow steps.
