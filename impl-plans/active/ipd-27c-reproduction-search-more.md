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
