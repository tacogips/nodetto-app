# ipd-24-parity-flows

- planId: ipd-24-parity-flows
- planPath: impl-plans/active/ipd-24-parity-flows.md
- progressPath: impl-plans/progress/ipd-24-parity-flows.md
- dependsOn: ipd-23-parity-shapes (both build `target`; this orders the two cargo builds), ipd-13-prototype-core-cli, ipd-14-kit-core, ipd-15-kit-content, ipd-16-frames-export-compare, ipd-20-app-lint, ipd-21-html-prototype, plus ipd-06-geo-strokes, ipd-07-icon-core-cli, ipd-08-cli-layout-ops, ipd-09-text-layer, ipd-11-frames, ipd-12-controls (stable engine tree; see `ipd-23`)
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, "Verification" (native parity split by area). Areas: kit, prototype, lint, export/compare.
- Evidence: `tmp/ipd-s772/ipd-24-parity-flows/`.
<!-- ownership:start -->
- writePaths:
  - `apps/cli/src/native-parity/app-design-flows.test.ts`
  - `impl-plans/progress/ipd-24-parity-flows.md`
  - `tmp/ipd-s772/ipd-24-parity-flows`
  - `target`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-24-parity-flows`
  - `target`
<!-- ownership:end -->

Build artifact roots: `target` (and `apps/desktop/src-tauri/binaries` where declared) are outputs of cargo, `mise run test-cli` and `mise run build-cli`. They are git-ignored and contain no authored source. Never edit files under them by hand. Cargo's lock serializes concurrent builds; `ipd-24` additionally depends on `ipd-23`, so the W9 parity builds do not overlap.

## Intent and context

This is the second half of the native parity matrix. It proves the TS and native CLIs behave identically for:

- kit insertion and properties;
- prototype links, export and inspect;
- the app lint, including the DR-02 instance cases;
- `--frames`;
- `compare`;
- `--format prototype`.

## Non-goals

No source fixes: a mismatch is a finding naming the owning plan.

## File-level changes

New `apps/cli/src/native-parity/app-design-flows.test.ts`, using `nativeTest`, `compare` and `compareFile` with generic fixtures built through `edit` operations in a temp directory. Cases:

1. **Kit.**
   - `add` each of the 16 `ios:` shapes into a `frame:iphone` with a parent -> `compareFile`.
   - `shapes ios:tab-bar` -> `compare`.
   - `update` `props` on an instance -> `compareFile`.
   - `props` on a rect -> `compare` (error).
   - Assert `IOS_KIT` has 16 entries via `shapes` listing rows.
2. **Prototype.**
   - `connect` with `tap` and `prototype:back` from-only -> `compareFile`.
   - `export --prototype --format svg` -> `compareFile`.
   - `inspect --flows` text and JSON -> `compare`.
   - `--prototype --element` -> `compare` (error).
3. **Lint.**
   - `lint` text and `--format json` on an app page with the DR-02 reproduction (instance with an overridden 100 `W` label in an 80×44 button, and a 24×24 hotspot child) -> `compare`. Stdout includes `app-text-overflow` and `app-touch-target` with context.
   - A clean kit page -> `compare`, with no app findings.
4. **Frames export.** `export --frames --format png --output-dir <dir>` -> every file `compareFile`-equivalent: loop the files and compare the bytes written by each host into separate directories.
5. **Compare.**
   - A file pair -> the output bytes are equal between hosts.
   - Directory mode -> both hosts write the same file names and bytes (this exercises the native `listDir`).
   - A bad band -> `compare` (error).
6. **HTML prototype.** `export --format prototype --output app.html` -> `compareFile`.

## Patterns to imitate

- `apps/cli/src/native-parity/export.test.ts` and `apps/cli/src/native-parity/lint-rules.test.ts`: `nativeTest`, `compare` and `compareFile` usage with temp-directory fixtures.
- `apps/cli/src/native-parity/harness.ts:compare` and `compareFile`: never re-implement the comparison.

## Pitfalls

- A test skipped because `NODETTO_CLI_TEST_BINARY` is unset is not evidence. The log must show the cases ran (0 skip).
- Build fixtures through CLI `edit` operations inside the test, not from hand-written JSONL. Use generic names.
- PNG bytes can differ between resvg-js and native resvg. Compare SVG bytes plus PNG dimensions unless an existing parity test already compares PNG bytes, and record the choice.
- Retry only deadline timeouts, up to 3 attempts. An assertion mismatch fails on the first attempt and becomes a finding for the owning plan.

## Invariants

- No source file outside this plan's writePaths changes.
- Existing parity topic files are untouched.

## Tests (input -> expected outcome)

- Each numbered case in "File-level changes" -> identical exit code, stdout, stderr and written bytes between the bun CLI and the native binary.

## Verification (evidence in `final/`)

1. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli` -> exit 0.
2. `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/app-design-flows.test.ts` -> exit 0, 0 fail, 0 skip.
3. `bunx biome check apps/cli/src/native-parity/app-design-flows.test.ts` -> exit 0.

## Done criteria

Verification passes, and the progress log has a per-case result table.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes.
- No state-changing git commands, no emojis. Generic fixtures only.
- Evidence files must not match Bun test patterns. Builds run in the foreground.
