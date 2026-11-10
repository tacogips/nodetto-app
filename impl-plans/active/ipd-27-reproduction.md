# ipd-27-reproduction

- planId: ipd-27-reproduction
- planPath: impl-plans/active/ipd-27-reproduction.md
- progressPath: impl-plans/progress/ipd-27-reproduction.md
- dependsOn: ipd-25-docs-help, ipd-26-example-sample (all features, parity and docs are done)
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, section "Reproduction (item 11) support", Decision 10.2 (bands), user-QA Q1 default (device layout with two bands).
- Evidence and working directory: `tmp/ipd-s772/ipd-27-reproduction/` (git-ignored).
<!-- ownership:start -->
- writePaths:
  - `impl-plans/progress/ipd-27-reproduction.md`
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

## Verification (evidence in `tmp/ipd-s772/ipd-27-reproduction/final/`)

1. `nodetto-cli validate <output-dir>/<doc>.jsonl` -> exit 0.
2. `nodetto-cli lint <output-dir>/<doc>.jsonl --format json` -> summary 0 problems.
3. `nodetto-cli inspect <output-dir>/<doc>.jsonl --flows` -> one flow. Count 10 frames of 390×844 with `nodetto-cli inspect --type frame`.
4. `ls <output-dir>/compare | wc -l` -> 10.
5. `git status --porcelain --ignored -- tmp | head` shows `tmp/` ignored. `git check-ignore -q <output-dir>` -> exit 0.

## Done criteria

- All verification passes.
- The per-screen table in the progress log shows drift <= 4 for all ten screens, with yes for icons, colors and weight, and 0 missing elements.
- No private content appears in the progress log. Self-check: `grep -i -F -f tmp/ipd-s772/ipd-27-reproduction/private-terms.txt impl-plans/progress/ipd-27-reproduction.md` -> exit 1.

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
