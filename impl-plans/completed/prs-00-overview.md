# prs-00-overview: presentation (slideshow) mode

- taskId: prs-s793 (workflowExecutionId opus-terra-design-and-implement-review-loop-session-793)
- Issue: none. The authoritative source is the session 793 runtime
  workflowInput.
- Design: `design-docs/specs/design-presentation.md` (accepted at step 3,
  including the PRS-DESIGN-001 fix). Owner Q&A:
  `design-docs/user-qa/presentation.md` (defaults applied).
- Dispatch manifest: `impl-plans/active/prs-s793-dispatch.json`.
- Branch: `feat/presentation`, local only (gitPush false).
- Evidence root: `tmp/prs-s793/<planId>/final/`. Progress logs:
  `impl-plans/progress/<planId>.md`.

## Waves and ownership (design section 9)

| Wave | Plan | Depends on |
| --- | --- | --- |
| 1 | prs-01-page-flag: IR, IO, collab, updatePage, Editor facade | none |
| 1 | prs-02-core-presentation: `packages/core/src/presentation/*` and one barrel line | none |
| 1 | prs-03-fullscreen: desktop fullscreen module and capability | none |
| 2 | prs-04-presentation-view: `packages/ui-solid/src/presentation/*` | 01, 02 |
| 2 | prs-05-page-flag-ui: PageTabs menu item and PageSection switch | 01 |
| 3 | prs-06-wiring: App, window-input, FileActions, ui-solid barrel, CSS, docs, README | 03, 04, 05 |

Each file has exactly one owning plan. Section 9 of the design explains
why prs-02 (and not wiring) owns the core barrel line.

## Pinned contracts (exact names; do not rename)

- IR `Page.hiddenInPresentation?: boolean` (prs-01).
- `updatePage` patch field `hiddenInPresentation?: boolean | null` (prs-01).
  `null` removes the key.
- Editor facade (prs-01, in `packages/core/src/editor/facade/page-editing.ts`):
  - `setPageHiddenInPresentation(id: PageId, hidden: boolean, applyOptions?: ApplyOptions): boolean`
  - `exportPageSvgOf(pageId: PageId, options?: SvgExportOptions): string | null`
- Core presentation (prs-02, exported through `@nodetto/core`):
  - `interface SlideSize { readonly width: number; readonly height: number }`
  - `slideList(pages: readonly { readonly id: PageId; readonly hiddenInPresentation?: boolean }[]): PageId[]`
  - `startIndex(order: readonly PageId[], slides: readonly PageId[], from: PageId | null): number | null`
  - `interface PresentationState { readonly slides: readonly PageId[]; readonly index: number; readonly black: boolean; readonly digits: string }`
  - `type PresentationAction = { type: "next" } | { type: "prev" } | { type: "first" } | { type: "last" } | { type: "goto"; n: number } | { type: "toggleBlack" } | { type: "digit"; digit: string } | { type: "enter" } | { type: "clearDigits" } | { type: "reconcile"; slides: readonly PageId[] }`
  - `createPresentationState(slides: readonly PageId[], index: number): PresentationState`
    (requires non-empty slides; the index is clamped)
  - `reducePresentation(state, action): PresentationState | null` (`null`
    only for `reconcile` to an empty list)
  - `currentSlide(state): PageId`
  - `slideCounter(state): { n: number; total: number }`
  - `PRESENTATION_MARGIN = 24`
  - `fitSlide(source: SlideSize, viewport: SlideSize, margin: number): { scale: number; x: number; y: number; width: number; height: number }`
  - `type SlideSource = { kind: "artboard"; frameId: ElementId } | { kind: "page" }`
  - `slideSource(store: Store, registry: ShapeUtilRegistry, pageId: PageId, isHidden?: (id: ElementId) => boolean): SlideSource`
  - `svgSize(svg: string): SlideSize | null`

  These are the design's `reduce`, `current` and `counter`. They are
  prefixed so they are unique in the `@nodetto/core` barrel; behavior is
  identical.
- ui-solid presentation (prs-04): `PresentationView` with props
  `{ editor: Editor; from: PageId | null; onExit(lastPageId: PageId): void }`,
  and `createPresentationController`, both exported from
  `packages/ui-solid/src/presentation/index.ts`. prs-06 re-exports that file
  from `packages/ui-solid/src/index.ts`.
- Desktop fullscreen (prs-03): `enterPresentationFullscreen(env?): Promise<PresentationFullscreenSession>`
  and `watchFullscreenExit(doc, onExit): () => void`.

## Rules for every worker

- Read your plan and the design sections it cites first. Do not widen
  scope. If you need a file outside your `writePaths`, stop and record a
  blocker (file and symbol) in your progress log.
- Record `git hash-object <your plan>` as the intent snapshot before the
  first edit.
- Plans in a wave share one branch and one working directory:
  - Read each file fresh before every edit.
  - Record pre and post `git hash-object` per edit.
  - On a drift (the pre hash is not your last post hash), re-read the file,
    keep the other change and record it.
- Edit only your own progress log. Run no state-changing git commands
  (no commit, stash, checkout or reset). Run Biome only on your own files.
- Must not change:
  - `packages/core/src/svg-export/*`
  - `packages/core/src/layer-state.ts`
  - `packages/core/src/hit-test.ts`
  - `apps/cli/**`
  - any version field
  - `apps/desktop/src-tauri/gen/schemas/*`. Only prs-03 owns
    `gen/schemas/capabilities.json`, kept exactly as tauri-build regenerates
    it (amendment round 1, PRS-INT-001).
  - any other `Command` kind
- Never add a core `Command` kind. No emojis. Strict TypeScript; guard
  indexed lookups. No `node:*` imports outside tests in `packages/*`.
- Use neutral self-authored fixture data (`alpha`, `beta`, `Widget`).

## Verification rules

- Every verification command exits 0 and runs at least one test. Test paths
  are explicit, `./`-prefixed files.
- Write full output to `tmp/prs-s793/<planId>/final/<name>.log`. Record the
  exit status and the pass, fail and skip counts in the progress log. Move
  `final/` to `attempt-<n>/` before a rerun. An incomplete log is not a
  pass.
- Static checks that every plan runs and records:
  - `bunx biome check <own files> --diagnostic-level=warn` exits 0.
  - `bun run typecheck` exits 0. Errors located only in a same-wave
    sibling's file may be recorded, but must not be fixed.
- Wave gates are run by reconcile, not by workers:
  - after wave 1: `bun run typecheck`
  - after wave 2: `bun run typecheck`
  - prs-06 runs the final gates.

## Done for the whole set

- Every plan's done criteria are met.
- prs-06 recorded exit 0 for `bun run typecheck`, `mise run lint`,
  `mise run test`, `mise run verify` and `bun run build`.
- `git diff --stat d6f9ebd -- packages/core/src/svg-export apps/cli apps/desktop/src-tauri/gen/schemas ':(exclude)apps/desktop/src-tauri/gen/schemas/capabilities.json'`
  is empty.

## Amendment 2026-11-10 (integration-paths-outside-writePaths, round 1)

- prs-01-page-flag and prs-02-core-presentation were accepted by the wave-1
  integration review. They are now `acceptedDependencies` in the manifest,
  not dispatchable plans.
- PRS-INT-001: tauri-build regenerates `gen/schemas/capabilities.json` from
  `capabilities/default.json`. prs-03 owns that file, and every gen/schemas
  gate excludes only it.
- Waves are unchanged: prs-03 (redispatch), then prs-04 and prs-05, then
  prs-06.

## Amendment 2026-11-10 (blocked-wave-scope-or-contract, round 2)

- The wave-2 integration review accepted prs-03, prs-04 and prs-05. They
  are now `acceptedDependencies`. Only prs-06-wiring remains dispatchable.
- prs-06 is blocked on the build gate. The fix authorizes the gitignored
  vite output `apps/desktop/dist` as a prs-06 writePath and artifactRoot.
  Nothing else changes.
