# clm-14-lint-image-path

- planId: clm-14-lint-image-path
- planPath: impl-plans/active/clm-14-lint-image-path.md
- progressPath: impl-plans/progress/clm-14-lint-image-path.md
- wave: 1
- dependsOn: none (clm-08-lint-cli is landed)
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, D3
  "Integration fix 3" and "Traversal tests", Verification row "Fix 3".
- writePaths:
  - `apps/cli/src/lint-diagram.ts`
  - `apps/cli/src/lint-diagram.test.ts`
  - `impl-plans/progress/clm-14-lint-image-path.md`
  - `tmp/clm-s731/clm-14-lint-image-path`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

`apps/cli/src/lint-diagram.ts:lintDiagramPages` builds the `io.exists` probe
path by string concatenation (`documentPath.slice(0, slash + 1) + src`, around
line 119). It must come from one pure helper that normalizes the document
directory. Containment stays in `io.readAttachment` (the confined reader in
`apps/cli/src/attachments.ts`), whose failure gives the fixed reason
`cannot be read (outside the document folder, too large, or unreadable)`.

`src` cannot contain `.`, `..`, `\` or a leading `/`: `isRelativeAttachmentPath`
(`packages/ir/src/attachments.ts`) rejects them, and the IR rejects such an
`image.raster` with `image.source` before lint runs. So traversal coverage is
about document paths with `..`/`.` segments and symlink escapes.

## Non-goals

- Do not change messages, rule ids, severity, `isRelativeAttachmentPath`,
  `attachments.ts`, or any other file. Do not use `node:path` in the helper
  (the shared engine runs in Boa).
- clm-09 later switches this module's relative core imports to
  `@nodetto/core`; do not do that here.

## File-level changes

`apps/cli/src/lint-diagram.ts`:

- Add `export function documentRelativePath(documentPath: string, src: string): string`.
  - Directory = `documentPath` up to and excluding the last `/` (empty when
    there is no `/`).
  - Split the directory with the plain string `"/"` (short path, not a
    document; no regex split).
  - Keep a leading `/` (absolute path). Drop empty and `.` segments. Fold a
    `name/..` pair; a `..` with no foldable predecessor (relative path) is
    kept; a `..` directly under the absolute root is dropped.
  - Result = normalized segments joined with `/`, plus `/` + `src`; with an
    empty relative directory the result is `src`.
- Use it for the `exists` probe. Keep `io.readAttachment(documentPath, src)`
  unchanged (it receives the original arguments).

## Tests (add to `apps/cli/src/lint-diagram.test.ts`)

Helper table:
- `("a/b/../doc.jsonl", "img/x.png")` -> `"a/img/x.png"`
- `("./doc.jsonl", "x.png")` -> `"x.png"`
- `("doc.jsonl", "x.png")` -> `"x.png"`
- `("../x/doc.jsonl", "y.png")` -> `"../x/y.png"`
- `("/abs/doc.jsonl", "y.png")` -> `"/abs/y.png"`
- `("a//b/./doc.jsonl", "y.png")` -> `"a/b/y.png"`

Through `lintDiagramPages` with a real temp directory and real io (as the
existing test does for files), document containing one present and one
missing image:
- Opened as `../<tmpname>/doc.jsonl` relative to a sibling working directory
  (or with a documentPath containing `..`) -> present image: no row; missing
  image: `image src "assets/missing.png" file not found`.
- Opened as `<dir>/./doc.jsonl` -> same results.
- `assets/link.png` is a symlink to a PNG outside the document folder ->
  `image src "assets/link.png" cannot be read (outside the document folder, too large, or unreadable)`.
  If the test platform cannot create symlinks, the test must fail, not skip.

Existing tests in the file must keep passing unchanged.

## Working rules

- Fresh read before each edit; record pre/post `git hash-object` per file in
  the progress log. Edit only writePaths; no state-changing git commands; logs
  under `tmp/clm-s731/clm-14-lint-image-path/`. Clean up temp directories in
  tests (`afterEach`/`finally`).

## Verification (each must exit 0)

1. `bun test apps/cli/src/lint-diagram.test.ts` -> 0 fail, test count higher
   than before (record both counts).
2. `bun run typecheck`.
3. `bunx biome check apps/cli/src/lint-diagram.ts apps/cli/src/lint-diagram.test.ts`.
4. `grep -n "export function documentRelativePath" apps/cli/src/lint-diagram.ts`.

## Done criteria

- Verification 1-4 exit 0, logs recorded; `git status --short` shows only
  writePaths changed by this plan.
