# sac-08-wiring

- planId: sac-08-wiring
- planPath: impl-plans/active/sac-08-wiring.md
- progressPath: impl-plans/progress/sac-08-wiring.md
- wave: 3
- dependsOn: sac-04-slide-collab-duplicate, sac-05-cli-copy-shapes, sac-06-slide-area-overlay, sac-07-settings-and-picker-ui
- Design: `design-docs/specs/design-slide-area-copy-shapes.md` sections 5.1, 7 and 9; user-qa Q3.
- writePaths:
  - `apps/desktop/src/App.tsx`
  - `apps/desktop/src/settings/preferences.ts`
  - `apps/desktop/src/settings/preferences.test.ts`
  - `apps/desktop/src/shell/FileActions.tsx`
  - `packages/ui-solid/src/ZoomControls.tsx`
  - `packages/ui-solid/src/Inspector.tsx`
  - `packages/ui-solid/src/index.ts`
  - `apps/cli/src/help.ts`
  - `docs/editing.md`
  - `docs/cli.md`
  - `README.md`
  - `impl-plans/progress/sac-08-wiring.md`
  - `tmp/sac-s826/sac-08-wiring`
  - `target`
  - `apps/desktop/dist`
- sharedPaths: none
- artifactRoots: `target`, `apps/desktop/dist`

## Intent and context

Connect the finished pieces to the app:

- the "Show slide area" view toggle, persisted as a UI preference and never
  in the document
- the copy-shapes dialog, opened from the page tab menu and from a header
  action
- the Presentation inspector section
- the barrel exports
- the CLI help
- the docs

The desktop app has no Edit/Page menu bar. Page commands live in the page
tab menu and in the header action bar (`FileActions.tsx`, where Present
lives). The design's "Edit/Page menu" entry is therefore a header button,
"Copy shapes from page...", that targets the current page.

## Non-goals

- No core, IR, collab, controller or overlay logic changes.
- No new keyboard shortcut.
- No Tauri changes.

## File-level changes

1. `preferences.ts`:
   - Add `readonly showSlideArea?: boolean` to `EditorPreferences`. There
     is no default key, so absent means automatic.
   - In the loader, keep the value only when `typeof value["showSlideArea"] === "boolean"`.
   - The saver omits it when it is undefined.
2. `ZoomControls.tsx`: add the optional props
   `showSlideArea?: boolean` (the effective value) and
   `onShowSlideAreaChange?: (show: boolean) => void`. Render one more
   `toggle("Slide area", "Show slide area", ...)` after "Grid", only when
   the callback is given.
3. `App.tsx`:
   - Add the signal `showSlideArea: boolean | undefined`, from preferences,
     and save it with the other preferences (`App.tsx:262` pattern).
   - Pass `showSlideArea={showSlideArea()}` to every `NodettoCanvas`
     (lines 687, 855 and 926 region).
   - Pass ZoomControls the effective value
     `effectiveShowSlideArea(showSlideArea(), editor.store.getMeta().slideSize)`,
     which reads the editor revision. On change it stores `!effective`.
   - Hold the state `copyShapesTarget: PageId | null`. Render
     `<CopyShapesDialog editor targetId onClose>` when it is set.
   - Pass `onCopyShapesFrom={setCopyShapesTarget}` to every `PageTabs`
     (line 922 and the top placement).
   - Close open menus first, the same way the Present start does.
4. `FileActions.tsx`: add the button "Copy shapes from page..." next to the
   Present buttons. It is disabled when there is one page or the document
   is read-only. It calls a new required prop `onCopyShapes()`, which
   `App.tsx` passes as `() => setCopyShapesTarget(editor.currentPageId)`.
5. `Inspector.tsx`: inside the `selectedIds().length === 0` block, mount
   `<PresentationSection editor={props.editor} page={current()} />`
   directly after `PageSection` (`Inspector.tsx:423`).
6. `packages/ui-solid/src/index.ts`: export `CopyShapesDialog`,
   `PresentationSection` and `effectiveShowSlideArea` (and
   `copyShapesOptions` if `App.tsx` needs it), following the existing named
   export style.
7. `help.ts`:
   - In the `pages` usage, add
     `nodetto-cli pages copy-shapes <doc.jsonl> --from <page|prev|next> --to <page> [--dry-run] [--format text|json]`.
   - Describe the options and add one example line.
   - Add an overview line under line 12.
8. Docs:
   - `docs/editing.md`, `## Presentation`: subsections
     - "Slide size": presets including A4 landscape 1123x794, custom,
       None, clipping, and the page origin
     - "Slide area": the dashed outline, the label, dimming, the toggle
       and its automatic default, and that it is never exported
     - "Copy shapes from page": the entry points, the default Previous
       page, same coordinates, on top, one undo step, the pasted elements
       selected
   - `docs/cli.md`: a `pages copy-shapes` section next to the `pages`
     paragraph (`docs/cli.md:218`), covering the keywords and the
     "Nothing was written." errors.
   - `README.md`: extend the Presentation bullet (`README.md:30`) with the
     slide size and slide area. Add a "Copy shapes from page" mention.

## Pitfalls

- Toggling stores the negation of the EFFECTIVE value, not of the stored
  preference. Otherwise the first click in automatic mode does nothing.
- Do not write `showSlideArea` into the document or into Yjs.
- Keep the CLI help tests green: check `apps/cli/src/*help*.test.ts` and
  `cli-wiring.test.ts` expectations after editing `help.ts`.
- Do not duplicate overlay logic in `App.tsx`. Import
  `effectiveShowSlideArea`.

## Tests (input -> expected)

- `preferences.test.ts`:
  - stored `showSlideArea: false` loads `false`
  - a missing key loads `undefined`
  - a non-boolean value loads `undefined`
  - a save and load round trip keeps `true`
  - other preferences are unchanged
- Existing suites stay green: desktop shell tests, CLI help and wiring
  tests.

## Verification (each exits 0 with at least 1 pass and 0 fail; logs in `tmp/sac-s826/sac-08-wiring/final/`)

1. `bun test ./apps/desktop/src/settings/preferences.test.ts ./apps/desktop/src/shell/window-input.test.ts` -> `desktop.log`
2. `bun test ./apps/cli/src/cli-wiring.test.ts ./apps/cli/src/pages-command.test.ts` -> `cli.log`
3. `bun run typecheck` -> `typecheck.log`
4. Strict-index gate (SAC-PLAN-001): the production-only
   `noUncheckedIndexedAccess` check that the private sync Worker relies on.
   Run exactly:
   `mkdir -p tmp/sac-s826/sac-08-wiring/final && bunx tsc --noEmit --noUncheckedIndexedAccess -p tsconfig.json > tmp/sac-s826/sac-08-wiring/final/strict-index.log 2>&1; ! grep 'error TS' tmp/sac-s826/sac-08-wiring/final/strict-index.log | grep -v -e '\.test\.ts' -e '^apps/desktop/scripts/'`
   - It exits 0 only when no production source has a strict-index error.
     The baseline errors in `*.test.ts` and `apps/desktop/scripts` (104 at
     a5ef4fa) are filtered out.
   - Do NOT change `tsconfig.json` or `tsconfig.base.json`.
   - If the command fails, fix the reported production file only when this
     plan owns it. Otherwise record a blocker naming the file and line.
5. `CARGO_TERM_QUIET=true mise run lint` -> `lint.log`
6. `CARGO_TERM_QUIET=true mise run verify` -> `verify.log`
7. `bun run build` -> `build.log`. Its output goes to the gitignored
   artifact root `apps/desktop/dist`.

## Done criteria

- Verifications 1-7 exited 0.
- `strict-index.log` exists, and `grep 'error TS' tmp/sac-s826/sac-08-wiring/final/strict-index.log | grep -v -e '\.test\.ts' -e '^apps/desktop/scripts/'`
  prints nothing.
- `git status --porcelain -- apps/desktop/dist` is empty.
- `grep -n "copy-shapes" docs/cli.md apps/cli/src/help.ts` matches.
- `grep -n "Slide area" docs/editing.md` matches.
- The progress log has the intent hash, per-edit hashes and every exit
  status with its counts.
- The final summary states that `updateDocument` is the only new Command
  kind, and that the private sync Worker needs a matching case.
