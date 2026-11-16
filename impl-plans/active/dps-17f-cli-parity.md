# dps-17f-cli-parity

- planId: dps-17f-cli-parity (session 864, wave 2, dependsOn:
  dps-17b-golden-identity, which provides the fixture
  `packages/io/src/__fixtures__/document-pages.jsonl`)
- Design: `design-docs/specs/design-document-pages-snippets.md` sections
  7.4, 10.2 and 11 ("CLI", "Native parity", "Markdown `--document`
  equivalence").
- Parent: `impl-plans/active/dps-17-wiring.md` Changes 6 and session 863
  additions 2 and 3.
- writePaths:
  - `apps/cli/src/document-wiring.test.ts`
  - `apps/cli/src/native-parity/export.test.ts`
  - `impl-plans/progress/dps-17f-cli-parity.md`
  - `tmp/dps-s864/dps-17f-cli-parity`
  - `target` (artifact root; the release binary goes to
    `target/dps-17f`)
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

`apps/cli/src/document-wiring.test.ts` currently holds only the
end-to-end `text.code` add test (keep it unchanged). Add the CLI document
export tests and the native parity checks against the release binary.

Patterns to imitate:

- in-process CLI with a `CommandIo` fake: `apps/cli/src/export-document.test.ts:9-30`
  (`exportCommand(io, [...])`, `localIo`, temp dirs);
- native comparison: `apps/cli/src/native-parity/harness.ts`
  (`binary`, `compare`, `compareFile`, `fixtureRoot`, `nativeTest`) and
  the existing `nativeTest` in `native-parity/export.test.ts`.

## Test cases

`document-wiring.test.ts` (Bun):

- SVG byte identity: load `document-pages.jsonl` and export page `p1` as
  SVG through `exportCommand`. The output equals
  `new Editor({ document }).exportPageSvgOf("p1", <same options the command uses>)`
  byte for byte. Read the option defaults from `export-command.ts`.
- `--format pdf --document --output <tmp>/doc.pdf` on the fixture:
  - exit 0 and 3 pages;
  - `extractPdfText` equals, exactly and in order, the concatenated run
    texts of `documentPdfPlan(editor, { background })` for the same
    document;
  - those texts include one containing `日本語` and one containing `太字`.
  - Do not invent a literal for the Markdown heading; derive the expected
    value from the plan.
- Markdown (session 863 addition 2): a page holding, in order, a
  `text.markdown`, two `shape.geo`, and a `text.code` (`language: "rust"`).
  `export --format markdown --output <tmp>/doc.md` (real `localIo`):
  - exit 0;
  - `doc.md` contains the Markdown source verbatim and exactly one
    fenced block opening with three backticks followed by `rust`;
  - `<tmp>/doc.assets/` holds exactly one `.svg`.

`native-parity/export.test.ts` (add a new `nativeTest` block; do not
modify the existing ones):

- `compare(["export", join(fixtureRoot, "document-pages.jsonl"), "--format", "svg", "--page", "p1"])`
  -> byte-identical. Use the page-selection flag the CLI already has;
  check `help.ts`.
- Native `--format pdf --document --output <tmp>/n.pdf` -> 3 pages, and
  `extractPdfText` equals the Bun CLI result for the same command.
- Native `--format markdown --document --output <tmp>/a/doc.md` and
  `--format markdown --output <tmp>/b/doc.md`:
  - both exit 0;
  - the two `doc.md` files are byte-identical;
  - the two `doc.assets/` hold the same file names with byte-identical
    contents;
  - all of it equals the Bun CLI output for the same invocation.
  - Use a temp copy of a fixture with drawable shapes so assets exist.

## Pitfalls

- `nativeTest` is `test.skip` when `NODETTO_CLI_TEST_BINARY` is unset. The
  verification must set it, and the log must show these tests passed,
  not skipped.
- Never run `env -u NODETTO_CLI_TEST_BINARY ...`.
- Keep each native test inside the harness deadlines. Never raise a
  timeout.
- Do not edit `export-command.ts`, the native engine, `help.ts` or the
  fixture. If behaviour is wrong, record a repair finding for the owning
  plan (dps-14 behaviour, dps-17b fixture) and stop.

## Verification (exit 0; logs in `tmp/dps-s864/dps-17f-cli-parity/`)

1. `bun test apps/cli/src/document-wiring.test.ts` -> 0 fail.
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/dps-17f cargo build --release -p nodetto-cli`
   -> exit 0.
3. Native parity, up to 3 attempts, retrying only on a deadline timeout:

   ```
   sh -c 'mkdir -p tmp/dps-s864/dps-17f-cli-parity; for i in 1 2 3; do NODETTO_CLI_TEST_BINARY="$PWD/target/dps-17f/release/nodetto-cli" bun test apps/cli/src/native-parity/export.test.ts > tmp/dps-s864/dps-17f-cli-parity/native-$i.log 2>&1 && exit 0; grep -qiE "timed out|deadline" tmp/dps-s864/dps-17f-cli-parity/native-$i.log || exit 1; done; exit 1'
   ```

   -> exit 0. The log shows 0 skip for the new tests.
4. `bun run typecheck` -> exit 0.
5. `bunx biome check --diagnostic-level=warn apps/cli/src/document-wiring.test.ts apps/cli/src/native-parity/export.test.ts`
   -> exit 0.

## Acceptance criteria

- `rg -n "Unknown language" apps/cli/src/document-wiring.test.ts` still
  matches.
- `rg -n "document-pages" apps/cli/src/document-wiring.test.ts apps/cli/src/native-parity/export.test.ts`
  matches in both.
- The progress log records the attempt count and the final native log
  path.

## Progress

`impl-plans/progress/dps-17f-cli-parity.md`: sha256 before and after each
file, commands with exit codes, log paths and attempt numbers. No git
state changes.
