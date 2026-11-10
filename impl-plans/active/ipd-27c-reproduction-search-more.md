# ipd-27c-reproduction-search-more

- planId: ipd-27c-reproduction-search-more
- planPath: impl-plans/active/ipd-27c-reproduction-search-more.md
- progressPath: impl-plans/progress/ipd-27c-reproduction-search-more.md
- dependsOn: ipd-27b-reproduction-detail
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, section "Reproduction (item 11) support", Decision 10.2 (bands), user-QA Q1 default (device layout with two bands).
- Evidence and working directory: `tmp/ipd-s772/ipd-27-reproduction/` (git-ignored).
<!-- ownership:start -->
- writePaths:
  - `impl-plans/progress/ipd-27c-reproduction-search-more.md`
  - `tmp/ipd-s772/ipd-27-reproduction`
  - `target`
  - `apps/desktop/src-tauri/binaries`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-27-reproduction`
  - `target`
  - `apps/desktop/src-tauri/binaries`
<!-- ownership:end -->

Build artifact roots: `target` (and `apps/desktop/src-tauri/binaries` where declared) are outputs of cargo, `mise run test-cli` and `mise run build-cli`. They are git-ignored and contain no authored source. Never edit files under them by hand. Cargo's lock serializes concurrent builds; `ipd-24` additionally depends on `ipd-23`, so the W9 parity builds do not overlap.

## Privacy rule (read first)

The reference app is private. This plan file, the progress log and every tracked file must never contain its name, its screen texts, its colors, or descriptions of its content.

The reference screenshots and color tokens are in the reference directory named in the workflow input ("Evidence"). The required output location is the reproduction directory named in workflow input acceptance criterion 4. Both are under the git-ignored `tmp/`. Refer to them in the progress log only as `<reference-dir>` and `<output-dir>`.

## Intent and context

Item (11): reproduce the ten reference screens faithfully, using only `nodetto-cli` operations (no hand-written JSONL). The document must pass `validate` and the app lint with zero findings. It must contain ten 390×844 iPhone frames, with:

- an iOS status bar and home indicator;
- real icons;
- the app's colors and type;
- prototype links for the bottom tabs, list -> detail, the detail tabs, back buttons, search -> results, and more -> settings;
- one flow start.

Per-frame PNGs at scale 2 are compared side by side with every reference screenshot.

## Non-goals

- No source changes. A missing feature or a bug is a finding naming the owning plan, with a generic reproduction written from scratch.
- No tracked files other than the progress log, which must contain no private content.

## Steps

1. Build: `CARGO_TERM_QUIET=true mise run build-cli` (log). Use the built sidecar in `apps/desktop/src-tauri/binaries/` for all commands. Fall back to `bun apps/cli/src/main.ts` only if the build fails, and record the fallback.
2. Study `<reference-dir>/screenshots/01..10` and the color tokens. The screenshots are 780×1688 at 2x, which is 390×844 points.
3. Write the operation files in `tmp/ipd-s772/ipd-27-reproduction/ops/`, one per screen plus one for links and the flow, using:
   - kit components and `props`;
   - text layers;
   - icons;
   - `parent` with relative coordinates;
   - `layout`, `sizing`, `align`, `distribute`, `snap`.

   Apply them with `nodetto-cli edit <doc> --ops <file>` into `tmp/ipd-s772/ipd-27-reproduction/work/doc.jsonl`. The ops files are the only authored source; never edit the JSONL directly.
4. Layout per user-QA Q1 default:
   - status bar 0-47;
   - top-anchored content shifted +47;
   - bottom-anchored content (tab bar, floating buttons, composer) placed above the home indicator;
   - the empty middle absorbs the difference.

   For each screen, choose a split row in empty space and record the bands `0:<split>:47` and `<split>:844:<bottom offset>`.
5. Run `nodetto-cli validate` and `nodetto-cli lint`. Iterate until there are zero findings, then record both outputs.
6. Run `nodetto-cli export work/doc.jsonl --page <page> --frames --format png --scale 2 --output-dir work/frames/`.
7. Run `nodetto-cli compare work/frames/<NN>.png <reference-dir>/screenshots/<NN>.png --output work/compare/<NN>-compare.png --scale 2 --band ... --grid 4`, once per screen, with that screen's bands.
8. Inspect all ten comparison images. In the progress log, record per screen (by number only, no content description):
   - the maximum observed drift in points, read from the 4-point grid;
   - icon correctness, color correctness and weight correctness (yes/no);
   - missing elements (count).

   Fix the operation files and repeat steps 3-8 until every screen is within 4 points, with correct icons, colors and type, and nothing missing. A remaining difference caused by a product limitation becomes a finding for the owning plan, with a generic reproduction.
9. Copy the deliverables into `<output-dir>`: the final document (named as in acceptance criterion 4), `frames/` and `compare/`. Record the copy command's exit code with paths abbreviated. This copy target is git-ignored and intentionally not declared as a write path, because its name must not appear in tracked files.
10. Write `tmp/ipd-s772/ipd-27-reproduction/private-terms.txt` (git-ignored). It lists the private app name and up to 20 distinctive screen strings, one per line. `ipd-28` uses it to check that no tracked file contains them.

## Verification (evidence in `tmp/ipd-s772/ipd-27-reproduction/final/ipd-27c-reproduction-search-more/`)

Scope: this part's screens 07, 08, 09, 10 only. The output-directory copy, prototype links, flow start, the ten-image count and `private-terms.txt` belong to `ipd-27-reproduction`.

1. `CARGO_TERM_QUIET=true mise run build-cli` -> exit 0, log kept.
2. `apps/desktop/src-tauri/binaries/nodetto-cli-aarch64-apple-darwin validate tmp/ipd-s772/ipd-27-reproduction/work/doc.jsonl` -> exit 0.
3. Lint gate (asserting, operator round 19): `sh -c 'apps/desktop/src-tauri/binaries/nodetto-cli-aarch64-apple-darwin lint tmp/ipd-s772/ipd-27-reproduction/work/doc.jsonl --format json | bun -e "const d=await Bun.stdin.json(); const f=d.pages.flatMap((p)=>p.findings); process.exit(d.summary.errors === 0 && f.every((x)=>x.ruleId === \"app-misaligned\") ? 0 : 1)"'` -> exit 0. It exits 1 if there is any error or any finding other than `app-misaligned` (so `app-off-grid`, `note-overflow`, `app-text-overflow`, touch-target and overlap must be zero). Record the `app-misaligned` count per screen with `sh -c 'apps/desktop/src-tauri/binaries/nodetto-cli-aarch64-apple-darwin lint tmp/ipd-s772/ipd-27-reproduction/work/doc.jsonl --format json | bun -e "const d=await Bun.stdin.json(); console.log(d.pages.flatMap((p)=>p.findings).filter((x)=>x.ruleId === \"app-misaligned\").length)"'`. For each one, record in the progress log that the element matches the reference screenshot within 4 points. This applies to the whole working document. Earlier parts' frames must stay clean; fix any regression in them through the ops files.
4. `apps/desktop/src-tauri/binaries/nodetto-cli-aarch64-apple-darwin inspect tmp/ipd-s772/ipd-27-reproduction/work/doc.jsonl --type frame | grep -cE '^    frame .* 390x844$'` -> 10 (cumulative top-level 390x844 screen frames after this part).
5. For each of 07, 08, 09, 10: `test -s tmp/ipd-s772/ipd-27-reproduction/work/compare/<NN>-compare.png` -> exit 0, and the image was opened and inspected (one progress-log table row per screen).
6. `sh -c 'test -s tmp/ipd-s772/ipd-27-reproduction/private-terms.txt && test -s impl-plans/progress/ipd-27c-reproduction-search-more.md && ! grep -i -F -f tmp/ipd-s772/ipd-27-reproduction/private-terms.txt impl-plans/progress/ipd-27c-reproduction-search-more.md'` -> exit 0 (fails if the terms file or the progress log is missing, or a term matches).

## Done criteria

- All verification passes.
- The per-screen table in the progress log covers screens 07, 08, 09, 10 with drift <= 4, yes for icons, colors and weight, and 0 missing elements.
- No private content appears in the progress log (verification 6).

## Worker rules

- Record `git hash-object` of this plan first.
- No source edits, and no state-changing git commands.
- No emojis.
- Commands run in the foreground with full logs.

## Amendment 2026-11-10 (operator round 16, binding; keep this section verbatim)

Determinism contract. Documents built through `nodetto-cli edit` operations contain values generated at random: element and component ids (including the ids kit insertion mints internally) and fractional ordering keys such as element `index` and page `order`. Repeated-run and Bun-versus-native determinism checks therefore use the round-15 generated-value comparison from `ipd-24-parity-flows`, never raw byte equality:

- ids are replaced by ordinal placeholders, never numbered by their position in the file;
- generated ordering keys are compared by relative order within their collection;
- every other field and every pre-existing value is compared exactly.

The committed example document is generated once and committed. Its regression test validates it, lints it with zero findings and renders it, but does not regenerate it byte for byte. Do not change engine id generation. Keep the work already in the working tree and continue from it.

## Amendment 2026-11-10 (operator round 18, binding; keep this section verbatim)

Scope: this part builds screens 07, 08, 09 and 10, through nodetto-cli operations into `tmp/ipd-s772/ipd-27-reproduction/work/doc.jsonl`, appending to the document the previous part left. Steps 1-8 above apply to this part's screens only. Done when, for this part's frames: `validate` exits 0, `lint` reports zero findings on them, and each one is exported, compared and inspected, with drift <= 4 points, correct icons, colors and weight, and 0 missing elements per screen. Prototype links, the flow start, the full-document gates, step 9 and step 10 belong to `ipd-27-reproduction`.

Layout rule (operator round 18, binding for every reproduction part): the reference screenshots are a 390x844 web view with no iOS status bar or home indicator. In each 390x844 iPhone frame: iOS status bar 0-47; top-anchored content shifted +47; bottom-anchored chrome (tab bar, floating action buttons, composer) shifted up by the 34-point home indicator, with the home indicator below it; the empty middle absorbs the difference. Where shifted top content would collide with bottom chrome (one screen in this set), that content area is a scroll region: put the content inside a frame clipped at the top edge of the tab bar (clip content on), so rows below the visible area are hidden as in the running app; floating action buttons stay as an intentional overlay above the content exactly as in the reference. Compare such a screen with two bands (top content above the clip line, bottom chrome) and record the number of clipped rows in the progress log by number only.

Keep the work already in `tmp/ipd-s772/ipd-27-reproduction` and continue from it.

## Amendment 2026-11-10 (step 4 s805 plan consistency, round 19)

Step 4 corrections (session 805): the header now names this plan's own planId, planPath and dependsOn (it had been copied from `ipd-27-reproduction`). The Verification and Done criteria sections are scoped to this part's screens and the cumulative working document, replacing the copied ten-screen and `<output-dir>` gates that only `ipd-27-reproduction` can satisfy. Steps 9 and 10 are not performed by this part.

CLI path (binding): every `nodetto-cli` command in this plan means the sidecar built by step 1, `apps/desktop/src-tauri/binaries/nodetto-cli-aarch64-apple-darwin`. A bare `nodetto-cli` on PATH resolves to an older installed release without the new features, and `target/release/nodetto-cli` is only refreshed by `cargo build --release`, not by `mise run build-cli`, so neither may be used for evidence.

Unchanged: writePaths, sharedPaths, artifactRoots, the round-16 and round-18 sections and every privacy rule.

## Amendment 2026-11-10 (operator round 19, binding; keep this section verbatim)

Reproduction lint gate (operator round 19, binding for ipd-27a, ipd-27b, ipd-27c, ipd-27-reproduction and ipd-28-finish; replaces the plain zero-findings wording for the reproduction document only): `app-off-grid`, `note-overflow`, `app-text-overflow`, touch-target, overlap and every error must be zero. `app-misaligned` ("nearly aligns") findings are allowed only for elements whose position matches the reference screenshot within 4 points, because the reference itself is not pixel-aligned; record their count per screen in the progress log. The generic example and kit tests keep the strict zero-findings gate.

Visual acceptance (operator round 19): fix every drift visible in the side-by-side comparisons, including floating action button icon stroke width and color, border color, card accent bar width, button and badge positions, so each screen is within 4 points and matches icon weight and color.

Keep the work already in the working tree and continue from it.

## Amendment 2026-11-10 (step 4 s806 plan consistency, round 19)

Step 4 makes the plan consistent with the operator round-19 section above. Verification item 3 now uses the round-19 lint gate, which allows only `app-misaligned`. The privacy self-check now fails closed when `private-terms.txt` is missing. The dispatch manifest entry for this plan uses the same strings.

Unchanged: planIds, dependsOn, writePaths, sharedPaths, artifactRoots, the frame, compare and flow gates, the round-16, round-18 and round-19 operator sections, and every privacy rule.

## Amendment 2026-11-10 (operator round 22, binding; keep this section verbatim)

Scratch rule (operator round 22, binding for every remaining plan): temporary directories that test harnesses create under the operating system temp dir (mkdtemp under os.tmpdir(), for example nodetto-*-parity-*) are authorized scratch and are not write-scope violations. The reproduction plans do not run the native parity suites (they belong to accepted ipd-23 and ipd-24); their required gates are build-cli plus the reproduction gates.

Rebuild rule (operator round 22, binding for ipd-27a, ipd-27b, ipd-27c and ipd-27-reproduction): the reproduction document is rebuilt from an empty document on the fixed kit by a generator script kept under tmp/ipd-s772/ipd-27-reproduction/ (git-ignored). The script writes the ops files and applies them with nodetto-cli edit. Ops never hard-code generated element ids: build each screen in one edit batch using `ref` and `@ref`, and resolve cross-batch targets (for example prototype link targets) by element name through nodetto-cli inspect --format json inside the script. Each part reruns the script from scratch for its screens plus all earlier parts, so the document always reflects the current kit.

## Amendment 2026-11-11 (step 4 s811 round-22 consistency)

Step 4 (session 811) applies the operator round-22 section above to the rest of this plan. Where an earlier section disagrees, this section and round 22 win.

Generator contract (shared by ipd-27a, ipd-27b, ipd-27c and ipd-27-reproduction, which run serially):

- The single authored source is `tmp/ipd-s772/ipd-27-reproduction/gen/build.ts` (git-ignored). Run it as `bun tmp/ipd-s772/ipd-27-reproduction/gen/build.ts --through <NN>`, where NN is the last screen this part owns: 03 for ipd-27a, 06 for ipd-27b, 10 for ipd-27c. ipd-27-reproduction runs `--through 10 --links` to add the prototype links and the flow start.
- On every run the script deletes `tmp/ipd-s772/ipd-27-reproduction/work/doc.jsonl` and starts from an empty document. It writes the ops files to `tmp/ipd-s772/ipd-27-reproduction/gen/ops/` and applies them in order with `apps/desktop/src-tauri/binaries/nodetto-cli-aarch64-apple-darwin edit <doc> --ops <file>`. It stops at the first non-zero exit and prints the failing file and exit code.
- Each screen is one edit batch. Inside a batch, refer to elements only through `ref` and `@ref`. Across batches, for example a link target frame, a hotspot or the flow start, ops refer to existing elements by name and never by id (step 4 s812; this replaces the s811 lookup that wrote ids found through inspect into the ops). Use `name:<exact element name>` in a reference field (`id`, `from`, `to`, `parent`, items of `memberIds`), or bind first with `{"op":"select","ref":"<r>","where":{"name":"<name>","page":"<page name>"},"expect":1}` and then use `@<r>` (apps/cli/src/edit/selectors.ts:62-73, docs/cli.md:315-319). `page` always takes the page name. The flow start is `{"op":"update","id":"name:<start frame name>","semantic":{"prototypeStart":true,"prototypeFlowName":"<flow>"}}` (docs/cli.md:387). An ops file never contains a literal generated element, page or component id, as a full id or as an id prefix. The binding literal-id gate is in the s812 section below.
- The older `tmp/ipd-s772/ipd-27-reproduction/ops/` files (00-seed, 01-03, 04-corrections, 05-overlays) and the current `work/doc.jsonl` were built on the pre-fix kit with hard-coded ids. Use them only as layout reference. Never apply them and never patch the old document. Earlier mentions of "the ops files" in steps 3 and 5, in Verification item 3 and in earlier amendments mean the generator's output.
- A later part only adds its own screens to the script. It may correct an earlier part's screen in the script when the full-document lint or a comparison regresses, and it records that correction in its own progress log.

Gates (round 22): the required gates are `mise run build-cli` and the reproduction gates in the dispatch manifest entry for this plan: validate, the round-19 lint gate, the frame count, the comparison images and the privacy self-check. The native parity suites (`apps/cli/src/native-parity/*`) are not run by any reproduction part. They belong to the accepted ipd-23 and ipd-24.

Unchanged: planId, writePaths, sharedPaths, artifactRoots, the layout, lint, comparison and privacy rules, and every operator section.

## Amendment 2026-11-11 (step 4 s812, review finding S5-s811-1)

Step 4 (session 812) fixes the s811 generator contract above, which told the script to put ids found through inspect into the ops and then counted such ids as a failure. Where the s811 section or an earlier section disagrees, this section wins. The operator round-22 section stays verbatim and is read as follows: "resolve cross-batch targets by element name" means the ops carry the name and nodetto-cli resolves it when the batch is applied.

Cross-batch references:

- Write names, not ids. Use `name:<exact element name>` in `id`, `from`, `to`, `parent` and `memberIds` items, or `select` with `where` {`name`, `page`} and `expect` 1, then `@<ref>`. The flow start is an `update` with `id` `name:<start frame name>`. Resolution code: `apps/cli/src/edit/selectors.ts` (`resolveElementReference`, lines 62-73), `apps/cli/src/edit/batch.ts` (`resolveReferences`), `apps/cli/src/edit/operations/connect.ts` (`from`/`to` go through `batch.element`).
- `nodetto-cli inspect <doc> --format json` is used only as an assertion. Before the script writes a batch that refers to elements from an earlier batch (always including the `--links` batch), it runs inspect on the current document and checks that every referenced name occurs exactly once on the reproduction page. A missing or duplicate name makes the script exit non-zero and print the names. The script never writes an id it read from inspect into `gen/ops/`. Read the JSON field shape from `apps/cli/src/inspect-command.ts` and do not guess it. The CLI itself also rejects a missing or ambiguous `name:` with a non-zero exit, so this check is an early, clearer failure and not the only guard.
- All applied ops are files in `tmp/ipd-s772/ipd-27-reproduction/gen/ops/`. Do not pipe ops through `--ops -` or stdin.
- Ops file format: a JSON array with one op per line, each written as `JSON.stringify(op)` with no indentation. The literal-id gate is line based and rejects indented (pretty-printed) files.

Pitfalls:

- Name matching is exact and case-sensitive after trimming. It is scoped to the op page, or to the source page for `connect`. What counts as an element's name depends on the type (`textOf` in `selectors.ts`). For example, a frame's name is `semantic.name` and a `text.note`'s name is its text.
- Names must be unique on the reproduction page. Kit instance children share default names (for example `Icon` and `Label` in every tab bar slot, or a nav bar `Title`). If a later batch links from such a child, the child's own screen batch gives it a unique name with an `update` on its `@ref` first. Give the ten frames unique names too.
- Never put an id-shaped string where the gate will see it. A page name, or the whole value of a reference key, must not consist only of 4 to 26 Crockford characters (`0-9`, `A-H`, `J`, `K`, `M`, `N`, `P-T`, `V-Z`). Use names that contain a lowercase letter or a space. If the gate flags a real label, rename it. Do not weaken the gate.

Literal-id gate (binding for ipd-27a, ipd-27b, ipd-27c and ipd-27-reproduction; replaces the s811 `grep -cE` count). It is run from the repository root after `gen/build.ts` and expects exit 0:

`sh -c 'set -- tmp/ipd-s772/ipd-27-reproduction/gen/ops/*.json; test -f "$1" || exit 2; ! grep -nE "\"[0-9A-HJKMNP-TV-Z]{26}\"|\"(id|target|parent|page|from|to)\": *\"[0-9A-HJKMNP-TV-Z]{4,25}\"|\"(memberIds|ids)\": *\[[^]]*\"[0-9A-HJKMNP-TV-Z]{4,25}\"|^[[:space:]]+\"" "$@"'`

- Exit 0 means there are ops files and none of them contains a literal id. Exit 1 means a match: a full 26-character id under any key or in any array; a 4 to 25 character id prefix as the whole value of `id`, `target`, `parent`, `page`, `from` or `to`; an id prefix inside `memberIds` or `ids`; or an indented line. Exit 2 means there are no ops files, so an empty `gen/ops/` fails closed.
- Step 4 tested this exact gate on scratch samples under `tmp/ipd-s772/plan-check/step4-s812/samples/`, running it from each sample root (log in `tmp/ipd-s772/plan-check/step4-s812/gates.log`). The samples with a full id in `from`, `to`, `id`, `page` or `memberIds`, with an id prefix in `id` or `memberIds`, or with pretty-printed JSON exit 1. The empty directory exits 2. The `name:`/`@ref`/`select` sample, with uppercase option labels, exits 0.
- The progress log records the gate command, its exit code and the number of ops files checked.

Scope precedence (s812): the operator round-18 Scope wording in this plan and in its manifest entry ("ops files under tmp/ipd-s772/ipd-27-reproduction/ops/", "appending to the document the previous part left") is superseded by the operator round-22 rebuild rule. Ops are the `gen/ops/` output of `gen/build.ts`, and every run rebuilds `work/doc.jsonl` from an empty document. The round-18 text is kept for the record.

Unchanged: planId, dependsOn, writePaths, sharedPaths, sharedPathNotes, artifactRoots, the 31 accepted dependencies, the lint, frame, flow, compare and privacy gates, and every operator section. The only verification change is the literal-id gate added above. It is also in this plan's manifest entry, inserted after `validate`.

## Amendment 2026-11-10 (operator round 23, binding; keep this section verbatim)

Near-alignment justification (operator round 23, binding for ipd-27b, ipd-27c, ipd-27-reproduction and ipd-28-finish): justify `app-misaligned` findings in bulk, not one by one. For each screen, export the frame and run nodetto-cli compare against its reference with the 4-point grid. If the comparison shows the flagged elements within 4 points of their reference positions, record a single line per screen in the progress log: screen number, count of app-misaligned findings, and 'within 4 points of reference'. A part is done when hard findings are zero, the per-screen lines are recorded, and the operator-style visual checklist (positions within 4 points, icons, colors, weight, nothing missing) is met for its screens. Do not spend continuations on cosmetic differences under 4 points.

`ipd-27a-reproduction-chrome` is accepted; its document and comparisons are in `tmp/ipd-s772/ipd-27-reproduction/work/`. Continue from them.
