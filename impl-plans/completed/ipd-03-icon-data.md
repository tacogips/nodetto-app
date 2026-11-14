# ipd-03-icon-data

- planId: ipd-03-icon-data
- planPath: impl-plans/active/ipd-03-icon-data.md
- progressPath: impl-plans/progress/ipd-03-icon-data.md
- wave: 2. dependsOn: ipd-00-baseline
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 2.1 and 2.4 (lookup order), user-QA Q3 (full set, lazy parse; curated-subset fallback).
- Evidence: `tmp/ipd-s772/ipd-03-icon-data/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/icons`
  - `scripts/vendor-lucide.ts`
  - `THIRD_PARTY_NOTICES.md`
  - `impl-plans/progress/ipd-03-icon-data.md`
  - `tmp/ipd-s772/ipd-03-icon-data`
- sharedPaths:
  - `packages/core/src/index.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
- artifactRoots:
  - `tmp/ipd-s772/ipd-03-icon-data`
<!-- ownership:end -->

Download audit record: the progress log (a writePath) is the tracked audit manifest for every downloaded input. For each download, record the exact download command, its exit code, the URL, the version, and the SHA-256 or npm integrity of the archive. Downloads and extracted files stay under this plan's `tmp/ipd-s772/ipd-03-icon-data` artifact root and are never committed.

## Intent and context

Phone designs need real outline icons; without them, glyphs render as tofu (D6). This plan vendors the Lucide icon set (ISC license) as a committed, generated data module in `packages/core`. It also provides the lookup and SVG markup functions used by:

- the `ui.icon` element (`ipd-07`);
- control icons (`ipd-12`);
- the kit (`ipd-14`, `ipd-15`);
- the desktop picker (`ipd-10`).

The module runs unchanged in the Boa-hosted native CLI.

## Non-goals

- No element type, renderer case, CLI command or UI. Those are later plans.
- Add no npm dependency and do not touch `package.json` or `bun.lock`. The source package is downloaded as a tarball into `tmp/`.
- No icon fonts.

## File-level changes

New `scripts/vendor-lucide.ts`, a dev-time Bun script.

- **Input.** `bun scripts/vendor-lucide.ts <extracted-lucide-static-dir>`. The input is an extracted `lucide-static` npm tarball: download `https://registry.npmjs.org/lucide-static/-/lucide-static-<version>.tgz` (pinned: 1.70.0, already downloaded and recorded in session-772; amendment round 1, 2026-11-10) into `tmp/ipd-s772/ipd-03-icon-data/src/` and extract it there.
- **Records.** Record the version, the tarball SHA-512 and the `dist.integrity` from `https://registry.npmjs.org/lucide-static/<version>` in the progress log.
- **Parsing.** Read `package/icons/*.svg` and `package/tags.json` (if absent, tags are `[]`). Parse each SVG's child elements with a small strict regex/XML tokenizer.
  - Accept only the elements `path`, `circle`, `rect`, `line`, `polyline`, `polygon` and `ellipse`.
  - Accept only the geometry attributes `d`, `cx`, `cy`, `r`, `x`, `y`, `width`, `height`, `rx`, `ry`, `x1`, `y1`, `x2`, `y2` and `points`.
  - Amendment round 1 (2026-11-10): additionally accept a `fill` attribute on a child element only when its value is `currentColor` or `none` (Lucide 1.70.0 `brain-circuit` has `fill="currentColor"` on a dot). Store it as a node attribute `fill` with that value. The markup functions render `fill="currentColor"` nodes filled with the icon color and everything else unfilled (`fill="none"`, the default). Any other `fill` value still fails the script with the icon name. Add a test that `brain-circuit` keeps its filled node and that a fixture with `fill="red"` is rejected.
  - The root `viewBox` must be `0 0 24 24`.
  - Any other element or attribute fails the script with the icon name. Do not silently drop it.
- **Output.** Write `packages/core/src/icons/lucide-data.generated.ts` deterministically, with icons sorted by name and attributes in a fixed order:
  - `export const LUCIDE_VERSION = "<version>";`
  - `export const LUCIDE_DATA = "<one JSON string>";`

  The JSON is an array of `[name, tags, nodes]`, where `nodes` is an array of `[elementName, {attr: value}]`. Escape for a TS string literal: JSON-encode the JSON string.
- **License.** Copy `package/LICENSE` verbatim to `packages/core/src/icons/LICENSE-lucide.txt`.

New `packages/core/src/icons/icon-registry.ts`:

- `export interface IconNode { readonly element: string; readonly attrs: Readonly<Record<string, string>> }`
- `export interface IconDefinition { readonly name: string; readonly tags: readonly string[]; readonly nodes: readonly IconNode[] }`
- `export function normalizeIconName(name: string): string | undefined`
  - Strips a `lucide:` prefix.
  - Returns undefined unless the result matches `^[a-z0-9]+(-[a-z0-9]+)*$`.
  - Defines the regex locally (identical to IR `ICON_NAME_PATTERN` without the prefix), so this plan does not depend on `ipd-01`.
- `export function findIcon(name: string): IconDefinition | undefined`
- `export function iconNames(): readonly string[]`, sorted.
- `export function searchIcons(query: string, limit = 50): readonly string[]`
  - The query is trimmed and lowercased. Empty -> the first `limit` names.
  - Rank 0: exact name. Rank 1: name prefix. Rank 2: name substring. Rank 3: any tag contains the query.
  - Within a rank, sort alphabetically. Never return duplicates.
  - `limit <= 0` means unlimited.
- `export const ICON_SET_VERSION`, re-exporting `LUCIDE_VERSION`.
- Lazy parse: parse `LUCIDE_DATA` with `JSON.parse` into a module-level `Map` on the first call to any function. No work at import time.

New `packages/core/src/icons/icon-markup.ts`:

- `export interface IconPaint { readonly stroke: string; readonly strokeWidth: number; readonly fill: string; readonly viewBox: number; readonly opacity?: number }`
- `export function renderIconMarkup(source: { readonly nodes: readonly IconNode[] } | { readonly path: string }, box: Box, paint: IconPaint): string`
  - Returns `<g transform="translate(tx ty) scale(s)" fill=… stroke=… stroke-width=… stroke-linecap="round" stroke-linejoin="round">…</g>`.
  - `s = min(box.width, box.height) / viewBox`, centred in the box.
  - Use `tag`/`wrap` and `fmt` from `packages/core/src/svg-export/markup.ts`, so attributes are escaped and numbers formatted like every other export.
  - A custom path renders as one `<path d=…>`.
  - `stroke-width` is in viewBox units, because it sits inside the scaled group.
- `export function renderIconPlaceholder(box: Box, color: string): string`: a dashed rect inset 1 unit, with `stroke-dasharray="2 2"`, and no text.

`THIRD_PARTY_NOTICES.md` (new, repository root): two sections.

1. Lucide: version, URL `https://lucide.dev`, ISC license, the path of the full license text (`packages/core/src/icons/LICENSE-lucide.txt`), and "icon geometry vendored as data in packages/core/src/icons/lucide-data.generated.ts".
2. Liberation Sans metrics: "advance widths only, derived from Liberation Sans 2.x fonts (SIL Open Font License 1.1); no font data is shipped". Full text at `packages/core/src/text-metrics/LICENSE-liberation-sans.txt`, written by `ipd-02`.

`packages/core/src/index.ts` (sharedPaths, append-only): export the names above.

## Size gate (user-QA Q3)

Record `wc -c` of the generated file. If it exceeds 1,500,000 bytes, record a finding and apply the Q3 fallback: about 300 icons whose tags or names match navigation, communication, files, media, status or editing terms. Record the selection rule in the generated header. Otherwise ship the full set.

The engine-size and native-deadline check happens in `ipd-23`/`ipd-24`. It feeds back as a finding if a deadline regresses.

## Patterns to imitate

- `packages/core/src/svg-export/markup.ts:tag` and `wrap` for markup.
- Lazy module-level cache: any existing `let cache` pattern, such as `packages/core/src/text-layout.ts:graphemes` segmenter reuse.

## Pitfalls

- Do not embed raw SVG strings and inject them later. Store parsed nodes so attribute values are re-escaped on output.
- Element order inside an icon matters for drawing. Keep source order.
- Do not lowercase or alter names from the package. Names are already kebab-case. Skip and report any name that fails the regex.
- `JSON.parse` of a large string inside Boa is fine. A large object literal is not, because it is slow to compile. Keep the data as one string.
- The generated file is excluded from Biome formatting checks only if the repository already has an ignore mechanism. Otherwise make the script emit Biome-clean output: one long line string, which is allowed.

## Tests: new `packages/core/src/icons/icons.test.ts`

- `findIcon("bell")` and `findIcon("lucide:bell")` -> the same definition with at least one node.
- `findIcon("Bell")` and `findIcon("no-such-icon")` -> undefined.
- `searchIcons("bell")[0] === "bell"`. Every result of `searchIcons("arrow")` is unique. The order puts prefix matches before substring matches, checked on a fixed known pair from the data.
- `renderIconMarkup(findIcon("search")!, {x:0,y:0,width:48,height:48}, {stroke:"#111111",strokeWidth:2,fill:"none",viewBox:24})` contains `scale(2)`, `stroke="#111111"` and `stroke-linecap="round"`.
- A custom path `{path:"M0 0L24 24"}` -> exactly one `<path`.
- A non-square box is centred: for a 48×24 box, the translate x is 12.
- Placeholder output contains `stroke-dasharray`.
- `iconNames().length` > 1000, unless the Q3 fallback was applied (then about 300); the test reads a constant exported by the generated file.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/icons` -> exit 0, 0 fail.
2. Determinism: run `bun scripts/vendor-lucide.ts <dir>` twice. `shasum -a 256 packages/core/src/icons/lucide-data.generated.ts` gives the same hash both times.
3. `bun run typecheck` -> no `error TS` lines under `packages/core/src/icons` or `scripts/vendor-lucide.ts`.
4. `bunx biome check packages/core/src/icons/icon-registry.ts packages/core/src/icons/icon-markup.ts packages/core/src/icons/icons.test.ts scripts/vendor-lucide.ts` -> exit 0.

## Done criteria

- Verification passes.
- `test -f packages/core/src/icons/LICENSE-lucide.txt && test -f THIRD_PARTY_NOTICES.md`
- `grep -q 'ISC' THIRD_PARTY_NOTICES.md && grep -q 'Open Font License' THIRD_PARTY_NOTICES.md`
- The progress log records the version, integrity, file size and icon count.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared with `ipd-02` in this wave. Append export lines only and re-read immediately before writing.
- No state-changing git commands, no lockfile edits, no emojis.
- If the network is unavailable, record a blocker finding with the exact failing command and stop. Never hand-write icon data.

## Amendment 2026-11-10 (blocked-wave-scope-or-contract, round 1)

- Blocker (session-772 wave 2): lucide-static 1.70.0 (latest stable, already downloaded and recorded in the progress log) has `fill="currentColor"` on a child of `brain-circuit.svg`, which the strict allowlist rejected, so no data file was produced.
- Decision (a): pin lucide-static 1.70.0. Reuse the archive already under `tmp/ipd-s772/ipd-03-icon-data/src/` after re-checking its SHA-512 against the progress log; re-download only if the digest differs, and record the command and exit code.
- Decision (b): the generator accepts `fill` on a child geometry element only with the values `currentColor` or `none`, stored as a per-node `fill` attribute. Markup renders `currentColor` nodes filled with the icon color; `none` and absent stay unfilled (default). Any other `fill` value still fails the script with the icon name. No other attribute is added to the allowlist.
- Tests added to `packages/core/src/icons/icons.test.ts`: `brain-circuit` keeps its filled node and its markup contains a filled element with the icon color; a fixture child with `fill="red"` -> the generator rejects it with the icon name.
- The preliminary `scripts/vendor-lucide.ts` in the working tree is this plan's file; read it fresh and complete it rather than rewriting from scratch.
- Dependency note: ipd-00-baseline is an accepted dependency; `ipd-02` is accepted, so `packages/core/src/index.ts` already holds its append-only exports, which must survive.

## Implementation status, amendment round 1

Full Lucide 1.70.0 data, license, lookup, markup, notices and regression tests are implemented. The full set is 2,322 icons and 981,957 bytes (SHA-256 `5a90d1994dadfd0c20e05cf2df28c92a0121ac5020475f0afe36da848c3609e3`, after the attempt-3 Biome suppression line); deterministic generation and focused tests pass. Workspace typecheck passes on the final rerun; see the progress log for evidence. Formal review and integration remain downstream.
