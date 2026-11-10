# ipd-21-html-prototype

- planId: ipd-21-html-prototype
- planPath: impl-plans/active/ipd-21-html-prototype.md
- progressPath: impl-plans/progress/ipd-21-html-prototype.md
- dependsOn: ipd-13-prototype-core-cli, ipd-16-frames-export-compare (both edit `apps/cli/src/export-command.ts`), ipd-19-desktop-presentation (amendment round 9: `prototypeScreen` back/swap-overlay fix)
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decisions 8.7 (persistent elements) and 8.8 (HTML prototype export).
- Evidence: `tmp/ipd-s772/ipd-21-html-prototype/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/prototype-html.ts`
  - `packages/core/src/prototype-html.test.ts`
  - `packages/core/src/svg-export/theme.ts`
  - `packages/core/src/svg-export/document.ts`
  - `apps/cli/src/export-command.ts`
  - `apps/cli/src/prototype-html-cli.test.ts`
  - `impl-plans/progress/ipd-21-html-prototype.md`
  - `tmp/ipd-s772/ipd-21-html-prototype`
- sharedPaths:
  - `packages/core/src/index.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
- artifactRoots:
  - `tmp/ipd-s772/ipd-21-html-prototype`
<!-- ownership:end -->

## Intent and context

Item (8) requires a click-through presentation in the HTML export as well as the desktop. This plan adds `nodetto-cli export <doc> --format prototype --output app.html [--page P] [--flow name] [--device none|frame]`. It writes one self-contained, deterministic HTML file:

- every reachable screen and overlay, as inline SVG from the same renderer as PNG export;
- hotspot buttons;
- persistent layers;
- a small inline script.

The existing static `--format html` ZIP export is unchanged.

## Non-goals

- No change to `html-bundle.ts` or the static HTML format.
- No external assets or network requests in the output.
- No JS framework.
- No desktop dialog (`ipd-22`).

## File-level changes

New `packages/core/src/prototype-html.ts`:

```
export function exportPrototypeHtml(editor: Editor, options: { readonly pageId?: PageId; readonly flow?: string; readonly device: "none" | "frame"; readonly resolveAsset?: (src: string) => string }): string
```

Screens and flow:

- Use `prototypeFlows` (`ipd-13`) to pick the flow: the requested one, else the first. With no flow, start at the first top-level screen on the page.
- Collect screens reachable through links, including overlays and screens on other pages.
- An unknown flow -> throw `Error('unknown flow "<name>"; flows: a, b')`.

Per screen:

- Use `editor.exportArtboardSvg(screenId, {resolveAsset})`, the same as PNG export (no title), minus persistent layers.
- Persistent layers: the union of the `persistentLayerPairs` destinations for the links. Render them as separate SVG fragments (`exportSelectionSvg` of that layer, positioned relative to the screen), toggled per screen.

Hotspots:

- Absolutely positioned `<button>` elements over each link's `from` box, relative to its screen.
- Each has `aria-label` = the hotspot layer name, and a `data-link` index.
- A frame-level hotspot (`from` = the screen) is a full-screen transparent layer under the other hotspots.

Script:

- Inline, under 6 KB, deterministic.
- It reads a JSON config: screens, links with trigger/action/transition/duration/delay/overlay settings, persistent layer ids, and the start screen.
- It implements:
  - navigate; back (history stack); open-overlay (position, backdrop, dismiss); close-overlay; swap-overlay;
  - after-delay timers, cleared on change;
  - hover and press triggers;
  - instant, fade, slide-* and smart transitions (smart falls back to fade);
  - hotspot hint flash on a miss-click;
  - keys: Backspace/ArrowLeft back, Escape close-overlay, `r` restart;
  - `prefers-reduced-motion`.

Device frame:

- `device: "frame"` wraps the viewport in a CSS bezel (radius 48, 12 px border) and a home-indicator pill. It is generic, with no artwork.

Output rules:

- Escape all names with the existing XML/HTML escaping (`svg-export/markup.ts:escapeXml`).
- Embed images through `resolveAsset` as data URIs, as the HTML bundle does. A missing image -> throw, as `html-bundle.ts` does.
- No timestamps, no random ids. Ids are derived from element ids.

`apps/cli/src/export-command.ts`:

- `--format prototype` requires `--output` ending in `.html`.
- `--flow <name>`, and `--device none|frame` (default `frame`).
- `--prototype`, `--frames` and `--element` conflict with it; exit 1 with a one-line message.
- Write the UTF-8 text through `io.writeText` or `writeBytes`.

`packages/core/src/index.ts` (sharedPaths, append-only): export `exportPrototypeHtml`.

## Patterns to imitate

- `packages/core/src/html-bundle.ts:exportHtmlBundle` for asset handling and errors.
- `packages/ui-solid/src/prototype-transition.ts` for transition semantics; mirror its timing and directions in the inline script.

## Pitfalls

- Boa: building a large string with many concatenations is slow. Collect parts in arrays and `join("")`.
- The script must not use `eval`, `innerHTML` with config strings, or network APIs. Set text with `textContent`.
- Hotspots must sit above persistent layers in z-order. Back history must survive overlay operations exactly as on the desktop: overlays are not history entries.
- Persistent layers are hidden inside the screen SVGs. Exclude them from `exportArtboardSvg` with an option (`excludeIds`) on `SvgExportOptions`, and add that option in `packages/core/src/svg-export/theme.ts` and `document.ts`.
  - Those files were last edited by `ipd-13`, which is done before this plan; edit them minimally.
  - Do not hide by CSS: the SVG would still contain the layer twice.

## Tests

New `packages/core/src/prototype-html.test.ts`:

- A three-screen doc with a tab bar (`prototypeFixed`, the same `layerName` and box) and links:
  - the output contains three `<svg` screen blocks;
  - the tab bar layer appears exactly once as a persistent fragment, and not inside the screen SVGs;
  - there is one `<button` per link;
  - the start screen is the flow start.
- Two exports -> byte-identical.
- An unknown flow -> throws, listing the names.
- A name with `<&>` is escaped.
- `device: "none"` -> no bezel class.

New `apps/cli/src/prototype-html-cli.test.ts`:

- `export --format prototype --output app.html` -> exit 0, and the file starts with `<!doctype html>`.
- `--format prototype --element X` -> exit 1.
- `--output app.zip` -> exit 1.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/prototype-html.test.ts apps/cli/src/prototype-html-cli.test.ts packages/core/src/html-bundle.test.ts apps/cli/src/html-export.test.ts apps/cli/src/export-command.test.ts packages/core/src/svg-export.test.ts` -> exit 0, 0 fail.
2. `sh -c 'L=tmp/ipd-s772/ipd-21-html-prototype/final/typecheck.log; mkdir -p tmp/ipd-s772/ipd-21-html-prototype/final && bun run typecheck --pretty false > "$L" 2>&1 && exit 0; grep -q "error TS" "$L" || exit 2; ! grep -E "^(packages/core/src/prototype-html\.ts|packages/core/src/prototype-html\.test\.ts|packages/core/src/svg-export/theme\.ts|packages/core/src/svg-export/document\.ts|apps/cli/src/export-command\.ts|apps/cli/src/prototype-html-cli\.test\.ts)\([0-9]+,[0-9]+\): error TS" "$L"'` -> exit 0. Exit 0 also when the workspace typecheck fails only in files this plan does not own (record those as `owned_elsewhere`). Exit 1 prints the `error TS` lines in owned files: fix them. Exit 2 means tsc failed without diagnostics: a gate failure. The full log is the evidence.
3. `bunx biome check packages/core/src/prototype-html.ts packages/core/src/prototype-html.test.ts packages/core/src/svg-export/theme.ts packages/core/src/svg-export/document.ts apps/cli/src/export-command.ts apps/cli/src/prototype-html-cli.test.ts` -> exit 0 (owned TS/TSX/CSS files only; every listed file must exist at completion).
4. Visual evidence:
   - Write `final/prototype.html` from a generic 4-screen doc.
   - If a headless browser is available in the sandbox (for example `bunx playwright` is already installed; do not install), screenshot the start screen and one navigation. Otherwise record that manual browser inspection is deferred to `ipd-26`/`ipd-27`, as a `pending_downstream` finding.

## Done criteria

Implementation verification: 71 tests pass, scoped typecheck and Biome pass, and the generic start and navigation screenshots and CLI PNG have been inspected. Formal review remains downstream.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared: append export lines only.
- No state-changing git commands, no lockfile changes, no emojis. Evidence files must not match Bun test patterns.
- Gate scope (S5-s786-R2): the typecheck and biome gates cover only this plan's owned files. `error TS` lines or biome diagnostics in files this plan does not own never block completion and are never fixed here: record each as an `owned_elsewhere` finding in the progress log (file path and the first error line, no fix) and finish. Errors in owned files always block. Do not wait for, or ask for, another amendment because a sibling's in-progress file fails the workspace typecheck.

## Amendment 2026-11-10 (operator round 9)

This plan now runs after `ipd-19-desktop-presentation`, which fixes `prototypeScreen` so back and swap-overlay links are kept; the HTML prototype must present those links too.

## Amendment 2026-11-10 (step5 s786 S5-s786-R2)

The manifest and Verification typecheck and biome gates are now scoped to this plan's owned files, with the expected result stated (typecheck: exit 0, or exit 0 when only non-owned files fail; exit 1 lists owned-file `error TS` lines; exit 2 is a tsc failure without diagnostics). The markdown and the manifest carry the identical command strings. Ownership, plan ID and dependsOn are unchanged. Errors in non-owned files are `owned_elsewhere` findings and never block (see Worker rules).
