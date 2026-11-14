# sac-00-overview: slide area and Copy shapes from page

- taskId: sac-s826 (workflowExecutionId opus-terra-design-and-implement-review-loop-session-826)
- Issue: none. The session 826 runtime workflowInput is authoritative.
- Design (accepted at Step 3, comm-018950, which also resolved SAC-DES-001
  and SAC-DES-002): `design-docs/specs/design-slide-area-copy-shapes.md`.
  Baseline: `design-docs/specs/design-presentation.md`. Owner Q&A:
  `design-docs/user-qa/slide-area-copy-shapes.md` (defaults applied).
- Dispatch manifest: `impl-plans/active/sac-s826-dispatch.json`.
- Branch: `feat/slide-area-copy-shapes`, local only (gitPush false).
- Evidence root: `tmp/sac-s826/<planId>/final/`. Progress logs:
  `impl-plans/progress/<planId>.md`.

## Waves (design section 8)

| Wave | Plan | Depends on |
| --- | --- | --- |
| 1 | sac-01-slide-data: IR, JSONL, store meta, the `updateDocument` command, `updatePage.slideOrigin` | none |
| 1 | sac-02-copy-shapes-core: the shared copy helper, `copyPageElements`, `adjacentPageId` | none |
| 1 | sac-03-slide-rect-core: `resolveSlideRect`, presets, labels | none |
| 2 | sac-04-slide-collab-duplicate: Yjs meta and page fields; duplicate copies `slideOrigin` | 01, 02 |
| 2 | sac-05-cli-copy-shapes: `nodetto-cli pages copy-shapes` | 02 |
| 2 | sac-06-slide-area-overlay: the canvas overlay; presentation controller clipping | 01, 03 |
| 2 | sac-07-settings-and-picker-ui: PresentationSection, copy-shapes options and dialog, PageTabs item | 01, 02, 03 |
| 3 | sac-08-wiring: App, preferences, ZoomControls toggle, FileActions button, Inspector mount, barrels, help, docs, README | 04-07 |

Each file has exactly one owning plan per wave. `packages/core/src/editor/pages.ts`
is edited in wave 1 by sac-02, and then in wave 2 by sac-04, which depends
on sac-02.

## Pinned contracts (exact names; do not rename)

- IR (sac-01, `packages/ir/src/types.ts`, exported through the existing
  `export *` / named exports of `packages/ir/src/index.ts`; sac-01 owns
  that file only to add the name if the barrel uses named exports):
  - `interface SlideSize { readonly width: number; readonly height: number }`
  - `interface SlideOrigin { readonly x: number; readonly y: number }`
  - `Document.slideSize?: SlideSize`
  - `Page.slideOrigin?: SlideOrigin`
- Core command (sac-01): `{ type: "updateDocument"; document: { slideSize?: SlideSize | null } }`
  and the `updatePage` patch field `slideOrigin?: SlideOrigin | null`.
  `null` removes the key.
- Store (sac-01): `DocumentMeta.slideSize?: SlideSize` and
  `StoreCommit.meta?: DocumentMeta`.
- Facade (sac-02, `packages/core/src/editor/facade/page-editing.ts`):
  - `adjacentPageId(id: PageId, direction: "prev" | "next"): PageId | null`
  - `copyPageElements(fromPageId: PageId, toPageId: PageId, applyOptions?: ApplyOptions): ElementId[] | null`
- Core helper (sac-02, `packages/core/src/editor/pages.ts`):
  `planPageElementsCopy(editor: EditorCore, idSource: IdSource, fromPageId: PageId, toPageId: PageId): PastePlan`
- Core presentation (sac-03, exported from `packages/core/src/presentation/index.ts`;
  the core barrel already re-exports it):
  - `type SlideRect = { readonly kind: "explicit" | "artboard" | "content"; readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly frameId?: ElementId }`
  - `resolveSlideRect(store: Store, registry: ShapeUtilRegistry, pageId: PageId, input: { readonly slideSize?: SlideSize; readonly slideOrigin?: { readonly x: number; readonly y: number } }, isHidden?: (id: ElementId) => boolean): SlideRect | null`
  - `SLIDE_SIZE_PRESETS: readonly { readonly id: SlideSizePresetId; readonly label: string; readonly width: number; readonly height: number }[]`
  - `type SlideSizePresetId = "16:9" | "4:3" | "16:10" | "a4-landscape"`
  - `DEFAULT_SLIDE_SIZE: SlideSize` (1920x1080)
  - `slideSizePreset(size: SlideSize): SlideSizePresetId | "custom"`
  - `slideLabel(pages: readonly { readonly id: PageId; readonly hiddenInPresentation?: boolean }[], pageId: PageId): string | null`
  - The existing `SlideSize` in `presentation/fit.ts` is structurally
    identical to the IR `SlideSize`. sac-03 must NOT add a second exported
    `SlideSize` to the core barrel; reuse the one in `fit.ts`.
- ui-solid (sac-06): `effectiveShowSlideArea(pref: boolean | undefined, slideSize: SlideSize | undefined): boolean`
  and `slideAreaModel(...)` in `packages/ui-solid/src/canvas/slide-area.ts`.
  `NodettoCanvasProps.showSlideArea?: boolean`.
- ui-solid (sac-07): `copyShapesOptions(pages, targetId)`,
  `defaultCopyShapesOption(options)`, `CopyShapesDialog`,
  `PresentationSection`, and `PageTabsProps.onCopyShapesFrom?: (targetId: PageId) => void`.

## Explicit new Command kind

`updateDocument` is the only new core Command kind (design 3.1). The final
summary must state it, and that the private nodetto-cloud sync Worker needs
one new switch case. Do not change the private repo.

## Rules for every worker

- Read your plan and the design sections it cites first. Do not widen
  scope. If you need a file outside your `writePaths`, stop and record a
  blocker (file and symbol) in your progress log.
- Record `git hash-object <your plan>` as the intent snapshot before the
  first edit.
- All plans in a wave share one branch and one working directory:
  - Read each file fresh before every edit.
  - Record pre and post `git hash-object` for each edit.
  - On drift (the pre hash is not your last post hash), re-read the file,
    keep the other change and record it.
- Edit only your own progress log. Run no state-changing git commands (no
  commit, stash, checkout or reset). Run Biome only on your own files.
- Code must typecheck under `noUncheckedIndexedAccess`: no `arr[0].x`.
  Check indexed reads for `undefined`. `bun run typecheck` does NOT enforce
  this, because the tsconfig does not set the flag.
  - The production-only gate (SAC-PLAN-001) runs at reconcile after wave 1
    and after wave 2, and in sac-08:
    `bunx tsc --noEmit --noUncheckedIndexedAccess -p tsconfig.json > <log> 2>&1; ! grep 'error TS' <log> | grep -v -e '\.test\.ts' -e '^apps/desktop/scripts/'`
  - Workers may run it locally on their own files before finishing.
  - Never change the tsconfig.
- Do not edit:
  - `packages/core/src/svg-export/*`
  - `packages/core/src/clipboard.ts`
  - `packages/core/src/presentation/{source,slides,fit,navigation}.ts`
  - `apps/desktop/src-tauri/*`
- No emojis. No server, auth or deployment code.

## Final gates (serial, after wave 3)

`bun run typecheck`, `CARGO_TERM_QUIET=true mise run lint`,
`CARGO_TERM_QUIET=true mise run test`, `CARGO_TERM_QUIET=true mise run verify`,
`bun run build`.
