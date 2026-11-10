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
- PNG bytes can differ between resvg-js and native resvg. Compare SVG bytes plus PNG dimensions unless an existing parity test already compares PNG bytes, and record the choice. (Superseded by the round-12 amendment: compare PNG outputs by decoded RGBA content with exact pixel equality.)
- Retry only deadline timeouts, up to 3 attempts. An assertion mismatch fails on the first attempt and becomes a finding for the owning plan.

## Invariants

- No source file outside this plan's writePaths changes.
- Existing parity topic files are untouched.

## Tests (input -> expected outcome)

- Each numbered case in "File-level changes" -> identical exit code, stdout, stderr and written bytes between the bun CLI and the native binary. Id-minting edits instead require equality under the round-13 normalized comparison, and PNG outputs require round-12 decoded RGBA equality.
- Normalizer self-check, permuted ids: the same logical document serialized with permuted generated ids, in a different id-sorted line order -> equal.
- Normalizer negative check, non-id field: a minted element's `visual.x` or a prop value changed on one side -> not equal.
- Normalizer negative check, reference wiring: child memberships swapped between two distinct frames -> not equal.

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

## Amendment 2026-11-10 (operator round 12)

Compare PNG outputs (frame exports and the compare diff image) between Bun and native by decoded content, not encoded bytes. Use the existing `decodeRgbaPng` from `apps/cli/src/native-parity/harness.ts` and assert equal width, height and RGBA pixels with exact equality, so any pixel difference still fails. Encoded PNG bytes may differ because the two encoders compress differently. Text, JSON, SVG and HTML outputs keep their exact or normalized comparisons. Then complete the remaining cases: kit insertion and property cases, the DR-02 lint cases and the remaining comparison assertions. Keep the ipd-24 work already in the working tree and continue from it.

## Amendment 2026-11-10 (operator round 13)

Use two edit-parity mechanisms.

1. **Exact:** the harness `compareFile`, unchanged, for every edit whose input document uses fixed element ids and that creates no new element (update, move, align, prototype settings on existing ids). This is how `ipd-23` passes.
2. **Normalized:** for edits that create elements with generated ids (connect/prototype links, kit insertion, add), write a test-local helper inside `apps/cli/src/native-parity/app-design-flows.test.ts`. It runs Bun and native exactly like `compareFile` (same input document copied into two temp files, same argv), then asserts equal exit codes, equal normalized stdout and stderr, and equal normalized documents. The normalization is independent of id order (Step 5 IPD-R8 repair, see below). The text above that said to number ids in output order is replaced by these rules:
   - **Generated id.** Any substring matching `/\b01[0-9A-HJKMNP-TV-Z]{24}\b/`, plus any short id prefix the CLI prints for such an id.
   - **Stdout and stderr.** Replace every generated id and printed short prefix with the single token `<ID>` (no ordinal). When stdout is JSON, parse it and compare structurally after masking. `created` entries are pushed in operation order (`apps/cli/src/edit/batch.ts:301`, `this.created.push`), so arrays keep their order. If the worker finds a stdout list that the CLI sorts by id, compare that list as a sorted list of masked entries and record the field name in the progress log.
   - **Documents.** Parse each JSONL line with `JSON.parse`. For every record, compute its masked canonical text: deep-replace every generated id with `<ID>`, then serialize with object keys sorted. Do not mask fixed (non-ULID) ids and page ids that do not match the pattern. Compute each element's containment depth as the number of container records whose `memberIds` chain reaches it (`packages/ir/src/registry/containers.ts` reads `memberIds`).
   - **Ordinals.** Assign `ID1..IDn` to generated ids by sorting their records on (page after masking, containment depth, masked canonical text). Use the ordinals to rewrite references only to print a readable failure diff. Records that tie on all three keys are interchangeable: their ordinals may be swapped, and the comparison must not depend on which one gets the lower ordinal.
   - **Equality.** The two documents are equal when both of these hold. (a) The sorted lists of masked canonical record texts are equal (multiset equality). (b) The sorted lists of reference edges are equal. Each edge is the string `maskedText(source) + "\u0000" + fieldPath + "\u0000" + maskedText(target)`, emitted for every field in a record whose value is a generated id that names another record in the same document. `fieldPath` includes array indices, for example `semantic.memberIds[2]`. Arrays of id references keep their serialized order (they are written in operation and payload order, not sorted by id). Check (b) catches miswired references, such as a child that ends up in the wrong frame, that (a) alone would miss.
   - **Pitfall (why the old rule failed).** `packages/io/src/jsonl/serialize.ts:146-152` (`compareElements`) sorts elements by page and then by the element id string. Ids are ULIDs: a 10-character millisecond time prefix plus 16 random characters (`packages/core/src/ids.ts:38-40`). One edit batch mints several ids in the same millisecond, for example `frame:iphone` plus an `ios:*` instance, and `packages/core/src/editor/components.ts:162` and `:289` mint one id per instance payload element. The random suffix therefore decides their relative file order, and that order differs between the Bun run and the native run. Never number ids by their position in the file. Never make ids deterministic by changing `harness.ts`, `serialize.ts`, `ids.ts` or any engine source. Never weaken the document comparison to counts or type-only checks.
   - **Helper self-checks.** These are plain `test(...)` cases inside the same test file. They do not need the native binary, so they always run. Build the inputs by hand as JSONL strings inside the test (helper unit input, not a fixture document):
     - Two serializations of the same logical document (one frame whose `memberIds` lists three minted children, each child with a distinct `visual.x`) with the generated ids permuted. Choose the ULIDs so the id-sorted line order differs between the two strings. -> the helper reports equal.
     - The same pair, but in one string one minted child's `visual.x` (a non-id field) is changed. -> the helper reports not equal.
     - The same pair, but in one string a minted child's prop value is changed. -> the helper reports not equal.
     - Two frames with distinct names, each with one minted child. In one string the two children's memberships are swapped between the frames. -> the helper reports not equal (check (b)).

Do not change `harness.ts`. PNG outputs keep the round-12 decoded RGBA comparison. Then complete the remaining DR-02 and clean-kit lint cases. Keep the ipd-24 work already in the working tree and continue from it.

The working-tree kit-insertion loop (the `compareFile` calls on `add frame:iphone` plus `add ios:<shape>`) and every other id-minting `add` or `connect` case move to the normalized helper. Cases with fixed ids and no new elements stay on `compareFile`.

Stability evidence: run Verification step 2 three times in a row. Each run must exit 0 with 0 fail and 0 skip. Record all three logs in `tmp/ipd-s772/ipd-24-parity-flows/final/` and their counts in the progress log. One passing run is not enough, because the id order between the two hosts is random.

## Amendment 2026-11-10 (operator round 14, binding; keep this section verbatim)

Z-order comparison: an element's fractional z-order `index` is randomized when the element is created, independently in Bun and native. The normalized comparison therefore does not compare the raw `index` strings of elements created by the compared edit. Instead, for each page, sort all elements by `index` (the engine ordering) and assert that both hosts give the same sequence of normalized element ids (ID placeholders and fixed ids). Raw `index` values of elements that already existed in the input document are compared exactly. Every other field is compared exactly after id normalization. Do not change engine or harness code.

Done when the normalized edit-parity test and the decoded-PNG checks pass in three consecutive runs of the parity gate, and the DR-02 and clean-kit lint cases are complete. Keep the ipd-24 work already in the working tree and continue from it.
