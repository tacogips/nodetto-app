# ipd-22-desktop-export-compare-check

- planId: ipd-22-desktop-export-compare-check
- planPath: impl-plans/active/ipd-22-desktop-export-compare-check.md
- progressPath: impl-plans/progress/ipd-22-desktop-export-compare-check.md
- dependsOn: ipd-16-frames-export-compare, ipd-18-desktop-prototype-view, ipd-29-desktop-snap-grid (`App.tsx` ownership order), ipd-19-desktop-presentation, ipd-20-app-lint, ipd-21-html-prototype
- Design (binding): `design-docs/specs/design-iphone-app-design.md`:
  - Decision 9.3 (Design check panel);
  - Decision 10.1 (desktop "All artboards -> PNG/SVG" ZIP);
  - Decision 10.3 (desktop "Compare with reference...": entry points, inputs, pairing, data flow, errors, panels);
  - Decision 8.8 (desktop Export dialog "Prototype (HTML)");
  - user-QA Q2, resolved: desktop comparison retained.
- Evidence: `tmp/ipd-s772/ipd-22-desktop-export-compare-check/`.
<!-- ownership:start -->
- writePaths:
  - `packages/ui-solid/src/ExportDialog.tsx`
  - `packages/ui-solid/src/ExportDialog.css`
  - `packages/ui-solid/src/compare-dialog.ts`
  - `packages/ui-solid/src/CompareDialog.tsx`
  - `packages/ui-solid/src/AppDesignProblemsPanel.tsx`
  - `packages/ui-solid/src/AppDesignProblemsPanel.css`
  - `packages/ui-solid/src/interaction/context-menu.ts`
  - `packages/ui-solid/src/ContextMenu.tsx`
  - `apps/desktop/src/App.tsx`
  - `packages/ui-solid/src/compare-dialog.test.ts`
  - `packages/ui-solid/src/app-design-panel.test.ts`
  - `packages/ui-solid/src/export-dialog-artboards.test.ts`
  - `impl-plans/progress/ipd-22-desktop-export-compare-check.md`
  - `tmp/ipd-s772/ipd-22-desktop-export-compare-check`
- sharedPaths:
  - `packages/ui-solid/src/index.ts`
- sharedPathNotes:
  - path: `packages/ui-solid/src/index.ts`; intendedEdit: append export lines only, and only if needed; re-read before writing; verify sibling lines survive
- artifactRoots:
  - `tmp/ipd-s772/ipd-22-desktop-export-compare-check`
<!-- ownership:end -->

## Intent and context

Per-frame export, comparison, app lint and the HTML prototype must work from the desktop app as well as the CLI. This plan adds the desktop surfaces. They reuse the shared core functions: `orderedTopLevelFrames`, `frameFileStem`, `composeComparisonSvg`, `pngInfo`, `pairByLeadingNumber`, `parseBand`, `lintAppDesignPage`, `exportPrototypeHtml` and `encodeStoredZip`.

## Non-goals

- No new core logic. A needed core change is a finding for its owner plan.
- No new Tauri capability or filesystem permission. Saving uses the existing raster-export save path. References are read with a browser file input.
- Reference images are never added to the document, attachments or undo.

## File-level changes

`packages/ui-solid/src/ExportDialog.tsx`:

- **All artboards -> PNG/SVG.** One ZIP of `<stem>.<ext>` files (names from `frameFileStem`, order from `orderedTopLevelFrames`).
  - PNGs are rasterized with `rasterizeSvg` (`packages/ui-solid/src/raster-export.ts`) at the chosen scale.
  - The ZIP comes from `encodeStoredZip` (`packages/core/src/zip.ts`).
  - Saved through the same save mechanism the dialog uses for the single PNG.
- **Prototype (HTML).** `exportPrototypeHtml(editor, {pageId, flow, device})` saves one `.html` file. There is a flow select (from `prototypeFlows`) and a device toggle.
- **Compare with reference...** opens `CompareDialog`.

New `packages/ui-solid/src/compare-dialog.ts`, pure logic with no DOM:

```
export async function buildComparisons(input: { readonly editor: Editor; readonly artboardIds: readonly ElementId[]; readonly references: readonly { name: string; bytes: Uint8Array }[]; readonly scale: number; readonly bands: readonly ComparisonBand[]; readonly grid?: number; readonly rasterize: (svg: string, scale: number) => Promise<Uint8Array> }): Promise<{ readonly items: readonly { number: number; artboardId: ElementId; svg: string; warnings: readonly string[] }[] }>
```

- Each reference: at most 16 MiB (`16 * 1024 * 1024`). Check `pngInfo` and `rasterDimensions` limits.
- Pairing:
  - one artboard and one reference -> pair directly;
  - otherwise pair by number, where the artboard number is the reading-order index + 1 and the reference number is `leadingNumber(name)`, through `pairByLeadingNumber`.
- Actual PNG bytes = `rasterize(exportArtboardSvg(id), scale)`.
- SVG = `composeComparisonSvg({reference, actual, scale, bands, grid})`.
- Errors are thrown as `Error` with user-facing messages:
  - not a PNG;
  - too large;
  - unmatched or duplicate number;
  - invalid band;
  - no artboard.

New `packages/ui-solid/src/CompareDialog.tsx`:

- Inputs:
  - file input `accept="image/png"`, `multiple` when comparing all artboards;
  - scale select (1, 2, 3; default 2);
  - grid (none, 4, 8);
  - band rows (y0, y1, dy), add and remove.
- It runs `buildComparisons`:
  - errors show inline in an alert region, and nothing is saved;
  - warnings (size mismatch) show inline, and composition continues.
- Results: one pair at a time, with previous/next. The SVG is shown in an `<img>` from a Blob URL. Revoke URLs on change and on close.
- **Save PNG**: one pair -> PNG via `rasterizeSvg(svg, 1)`. All pairs -> ZIP of `NN-compare.png`.

New `packages/ui-solid/src/AppDesignProblemsPanel.tsx` and `AppDesignProblemsPanel.css`:

- Lists `lintAppDesignPage` findings for the current page when it is an app-lint page: rule id, message and context.
- Clicking a finding selects the element and zooms to it.
- Re-lint on document change, debounced.
- Follow `packages/ui-solid/src/BpmnProblemsPanel.tsx` and its CSS tokens.

`apps/desktop/src/App.tsx`: mount `AppDesignProblemsPanel` in the app and web workspaces, the same way the BPMN problems panel is mounted.

Artboard context menu entry "Compare with reference..." in `packages/ui-solid/src/interaction/context-menu.ts`, plus `ContextMenu.tsx` if items are declared there. It opens `CompareDialog` with that artboard. Follow how existing frame entries (for example the HTML export entry) are declared.

## Patterns to imitate

- The existing ExportDialog structure and HTML "All artboards" option.
- `packages/ui-solid/src/image-import.ts` for file input reading and size errors.
- `BpmnProblemsPanel.tsx` for the panel.

## Pitfalls

- The browser `rasterizeSvg` is only for editor-generated SVG (`raster-export.ts` comment). The comparison SVG is generated by core from validated PNG bytes and is allowed. Never rasterize user-provided SVG.
- Revoke every `URL.createObjectURL`.
- Do not store references in Solid stores that are persisted.
- The dialog must work without a selection when "All artboards" is chosen.
- `App.tsx` was edited by `ipd-29`. Re-read it fresh, and keep both changes.

## Tests

New `packages/ui-solid/src/compare-dialog.test.ts`, with a stub `rasterize` that returns fixed PNG bytes from a tiny valid PNG:

- One artboard and one reference -> one item, with an SVG equal to `composeComparisonSvg` on the same inputs (parity with the CLI composition).
- Three artboards and references `01-a.png`, `02-b.png`, `03-c.png` -> paired by reading order.
- A duplicate `02` -> throws naming both.
- A JPEG reference -> throws "not a PNG".
- 17 MiB -> throws.
- An invalid band -> throws.
- After a run, the editor document revision and the undo stack are unchanged.

New `packages/ui-solid/src/app-design-panel.test.ts`: a page with an overflowing label lists one finding, and clicking it selects the element.

New `packages/ui-solid/src/export-dialog-artboards.test.ts`:

- The ZIP entry names equal the `frameFileStem` order for a 3-frame page.
- The prototype HTML option calls `exportPrototypeHtml` with the selected flow.

## Verification (evidence in `final/`)

1. `bun test packages/ui-solid/src/compare-dialog.test.ts packages/ui-solid/src/app-design-panel.test.ts packages/ui-solid/src/export-dialog-artboards.test.ts packages/ui-solid/src/raster-export.test.ts packages/ui-solid/src/pdf-export.test.ts packages/ui-solid/src/interaction-keyboard-menus.test.ts apps/desktop/src/design-workflow.test.ts` -> exit 0, 0 fail.
2. `sh -c 'L=tmp/ipd-s772/ipd-22-desktop-export-compare-check/final/typecheck.log; mkdir -p tmp/ipd-s772/ipd-22-desktop-export-compare-check/final && bun run typecheck --pretty false > "$L" 2>&1 && exit 0; grep -q "error TS" "$L" || exit 2; ! grep -E "^(packages/ui-solid/src/ExportDialog\.tsx|packages/ui-solid/src/compare-dialog\.ts|packages/ui-solid/src/CompareDialog\.tsx|packages/ui-solid/src/AppDesignProblemsPanel\.tsx|packages/ui-solid/src/interaction/context-menu\.ts|packages/ui-solid/src/ContextMenu\.tsx|apps/desktop/src/App\.tsx|packages/ui-solid/src/compare-dialog\.test\.ts|packages/ui-solid/src/app-design-panel\.test\.ts|packages/ui-solid/src/export-dialog-artboards\.test\.ts)\([0-9]+,[0-9]+\): error TS" "$L"'` -> exit 0. Exit 0 also when the workspace typecheck fails only in files this plan does not own (record those as `owned_elsewhere`). Exit 1 prints the `error TS` lines in owned files: fix them. Exit 2 means tsc failed without diagnostics: a gate failure. The full log is the evidence.
3. `bunx biome check packages/ui-solid/src/ExportDialog.tsx packages/ui-solid/src/ExportDialog.css packages/ui-solid/src/compare-dialog.ts packages/ui-solid/src/CompareDialog.tsx packages/ui-solid/src/AppDesignProblemsPanel.tsx packages/ui-solid/src/AppDesignProblemsPanel.css packages/ui-solid/src/interaction/context-menu.ts packages/ui-solid/src/ContextMenu.tsx apps/desktop/src/App.tsx packages/ui-solid/src/compare-dialog.test.ts packages/ui-solid/src/app-design-panel.test.ts packages/ui-solid/src/export-dialog-artboards.test.ts` -> exit 0 (owned TS/TSX/CSS files only; every listed file must exist at completion).
4. Visual verification case (design 10.3):
   - Generate a comparison for one sample artboard against its own exported PNG through `buildComparisons`, using the real `rasterizeSvg` only if a DOM canvas is available in tests; otherwise use the CLI rasterizer on the same SVG.
   - Save `final/desktop-compare.png` and the CLI `compare` output `final/cli-compare.png` for the same inputs.
   - Inspect both: the difference panel is near-black and the panel layout matches.
   - Record which rasterizer produced the desktop image.

## Done criteria

Verification passes, and the progress log records the visual comparison notes.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/ui-solid/src/index.ts` is shared: append export lines only, if needed.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.
- Gate scope (S5-s786-R2): the typecheck and biome gates cover only this plan's owned files. `error TS` lines or biome diagnostics in files this plan does not own never block completion and are never fixed here: record each as an `owned_elsewhere` finding in the progress log (file path and the first error line, no fix) and finish. Errors in owned files always block. Do not wait for, or ask for, another amendment because a sibling's in-progress file fails the workspace typecheck.

## Amendment 2026-11-10 (step5 s786 S5-s786-R2)

The manifest and Verification typecheck and biome gates are now scoped to this plan's owned files, with the expected result stated (typecheck: exit 0, or exit 0 when only non-owned files fail; exit 1 lists owned-file `error TS` lines; exit 2 is a tsc failure without diagnostics). The markdown and the manifest carry the identical command strings. Ownership, plan ID and dependsOn are unchanged. Errors in non-owned files are `owned_elsewhere` findings and never block (see Worker rules).
