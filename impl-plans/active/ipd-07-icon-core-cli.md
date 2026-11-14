# ipd-07-icon-core-cli

- planId: ipd-07-icon-core-cli
- planPath: impl-plans/active/ipd-07-icon-core-cli.md
- progressPath: impl-plans/progress/ipd-07-icon-core-cli.md
- wave: 3. dependsOn: ipd-05-core-catalogue, ipd-07a-icon-shape (amendment 2026-11-10 operator round 3); accepted dependencies ipd-01-ir-schema, ipd-03-icon-data, ipd-04-cli-edit-contracts (this plan updates `shapes-command.test.ts` expectations for the new catalogue rows).
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 2 (2.2 rendering, 2.4 lookup and CLI).
- Evidence: `tmp/ipd-s772/ipd-07-icon-core-cli/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/svg-export/shapes.ts`
  - `packages/core/src/shape-warnings.ts`
  - `packages/core/src/ui-icon.test.ts`
  - `apps/cli/src/edit/icon-shapes.ts`
  - `apps/cli/src/shapes-command.ts`
  - `apps/cli/src/shapes-command.test.ts`
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/edit/apply-batch.ts`
  - `apps/cli/src/icon-commands.test.ts`
  - `impl-plans/progress/ipd-07-icon-core-cli.md`
  - `tmp/ipd-s772/ipd-07-icon-core-cli`
- sharedPaths:
  - `packages/core/src/index.ts`
  - `packages/core/src/shapes/ui-icon.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
  - path: `packages/core/src/shapes/ui-icon.ts`; intendedEdit: created and registered by ipd-07a-icon-shape; edit only if the export/warning work needs a helper there; keep its type, bounds, defaults and registration unchanged
- artifactRoots:
  - `tmp/ipd-s772/ipd-07-icon-core-cli`
<!-- ownership:end -->

## Intent and context

D6: there is no icon element. This plan makes `ui.icon` (IR from `ipd-01`, data and markup from `ipd-03`) a real shape:

- registered shape util;
- SVG export;
- authoring warning for unknown names;
- the CLI surface:
  - `shapes icon <query>`;
  - `shapes icon:<name>`;
  - `icon:<name>` in `draw`/`add`;
  - an `icon.unknown` warning in `validate` and `edit`.

The desktop view is `ipd-10`.

## Non-goals

- No desktop UI.
- No icons inside controls (`ipd-12`).
- No help text (`ipd-25`).

## File-level changes

Already delivered by `ipd-07a-icon-shape` (amendment round 3); verify, do not rewrite. `packages/core/src/shapes/ui-icon.ts`, `uiIconShapeUtil: ShapeUtil`:

- type `"ui.icon"`;
- `canResize: true`;
- bounds from the visual: default 24×24 at x, y 0;
- box `hitTest`;
- `resize` returns the box;
- `defaultSemantic: () => ({icon: "square"})`;
- `defaultVisual` 24×24 with style `{stroke: "#000000", strokeWidth: 2}`.

`ipd-07a-icon-shape` registers it in `packages/core/src/shapes/index.ts:createDefaultRegistry`; this plan must not edit `packages/core/src/shapes/index.ts`.

`packages/core/src/svg-export/shapes.ts`, new `case "ui.icon"`:

- Resolve the source: `semantic.path` -> `{path}`; else `findIcon(semantic.icon)`.
- Paint:
  - `stroke = style.stroke ?? "#000000"`;
  - `strokeWidth = style.strokeWidth ?? 2`;
  - `fill = style.fill ?? "none"`;
  - `viewBox = semantic.viewBox ?? 24`;
  - opacity from `style.opacity`.
- An unknown name -> `renderIconPlaceholder(box, stroke)`.
- Respect rotation and flip like other node shapes. Follow the wrapper used for `ui.control` at `shapes.ts:284`.

`packages/core/src/shape-warnings.ts`: for `ui.icon` with an `icon` that `findIcon` cannot resolve, add the warning `Unknown icon "<name>". Search with nodetto-cli shapes icon <query>.`

`apps/cli/src/edit/icon-shapes.ts` (replaces the `ipd-04` stub; keep its exported signatures exactly):

- `iconShapeCreation("icon:<name>", index)`:
  - unknown name -> `OperationError(index, 'unknown icon "<name>". Did you mean: a, b, c?')`, with up to 5 names from `searchIcons(name, 5)`, or "Search with nodetto-cli shapes icon <query>" when there are none;
  - otherwise `{type: "ui.icon", semantic: {icon: <normalized name>}, visual: {width: 24, height: 24, style: {stroke: "#000000", strokeWidth: 2}}}`.

`apps/cli/src/shapes-command.ts`:

- `shapes icon <query...> [--all]` prints one line per icon: `<name>\t<comma-joined tags>`.
  - Limit 50, or unlimited with `--all`.
  - No matches -> exit 1 with `no icon matches "<query>"`.
- `shapes icon:<name>` describes it like other shape IDs: element type, defaults, a `draw` command and an edit op. An unknown name gives exit 1 with suggestions.
- The plain `shapes` listing appends one synthetic row after the catalogue rows, in the existing row format: id `icon:<name>`, label "Icon (any Lucide name; see shapes icon <query>)", category `ui-control`, type `ui.icon`.
- Category and connector filters treat it like a `ui-control` placed shape.
- Plain `shapes` also lists the new catalogue rows from `ipd-05`. Update the expectations in `apps/cli/src/shapes-command.test.ts`.

Unknown-icon warnings in the CLI:

- `apps/cli/src/commands.ts:validateCommand`: after IR validation, scan `ui.icon` elements. For each unknown name, print `warning: <elementId> icon.unknown Unknown icon "<name>"` to stderr. The exit code is unchanged (warnings do not fail).
- `apps/cli/src/edit/apply-batch.ts`: emit the same warning after a batch, through the existing warning channel used for `semantic.unknownField` (`:193-210`), so `--quiet` collapses it.

`packages/core/src/index.ts` (sharedPaths, append-only): export `uiIconShapeUtil`.

## Patterns to imitate

- `packages/core/src/shapes/uiControl.ts` (19 lines) for the shape util.
- The `ui.control` case in `svg-export/shapes.ts` for wrapping.
- The `shapes <shape-id>` describe branch in `shapes-command.ts:51-89`.

## Pitfalls

- `findIcon` lazily parses about 1 MB of data. Never call it at module load; call it inside functions only.
- Names in IR may carry a `lucide:` prefix. Normalize with `normalizeIconName` for lookup, but leave the stored semantic exactly as the author wrote it.
- The stderr warning format must match the existing `warning:` lines so `--quiet` and the parity harness treat it the same.
- Do not make unknown icons a validation error. Documents stay valid.

## Tests

New `packages/core/src/ui-icon.test.ts`:

- Export of `ui.icon {icon: "bell"}` at 48×48 contains `scale(2)` and `stroke="#000000"`.
- `{icon: "nope"}` -> output contains `stroke-dasharray`, and `shapeAuthoringWarnings` returns the unknown-icon message.
- A custom path with `style.fill: "#ff0000"` -> `fill="#ff0000"`.
- `strokeWidth: 1.5` -> `stroke-width="1.5"`.

New `apps/cli/src/icon-commands.test.ts`, using the existing CLI test helpers from `apps/cli/src/shapes-command.test.ts`:

- `shapes icon bell` -> the first line starts with `bell\t`, exit 0.
- `shapes icon zzzz-none` -> exit 1.
- `shapes icon:bell` -> mentions `ui.icon`.
- `draw doc icon:search --at 10,10` -> the doc has a `ui.icon` with `icon: "search"`, 24×24.
- `edit` with `{"op":"add","shape":"icon:not-an-icon"}` -> exit 1 with "Did you mean".
- `validate` on a doc with `{icon:"nope"}` -> exit 0, and stderr contains `icon.unknown`.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/ui-icon.test.ts apps/cli/src/icon-commands.test.ts apps/cli/src/shapes-command.test.ts apps/cli/src/commands.test.ts apps/cli/src/warnings.test.ts packages/core/src/shape-warnings.test.ts apps/cli/src/edit/label-field.test.ts` -> exit 0, 0 fail (`label-field.test.ts` added by amendment 2026-11-10 round 2).
2. `bun run typecheck` -> no `error TS` line in the owned files.
3. `bunx biome check` on the owned files -> exit 0.
4. Visual evidence:
   - Draw an icon sheet with 24 common icons (bell, folder, search, settings, chevron-left, chevron-right, plus, message-square, calendar, file-text, user, house, ellipsis and similar) through `bun apps/cli/src/main.ts draw ...`.
   - Export `final/icon-sheet.png` at `--scale 2`, inspect it, and record the notes.

## Done criteria

- Verification passes.
- `rg -n '"ui.icon"' packages/core/src/shapes/ui-icon.ts packages/core/src/svg-export/shapes.ts` -> 2 or more matches (one per file).
- `bun test apps/cli/src/edit/label-field.test.ts` -> exit 0, 0 fail: a `ui.icon` created from the core registry `defaultSemantic()` (`{icon: "square"}`) validates.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared: append export lines only.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.

## Amendment 2026-11-10 (blocked-wave-scope-or-contract, round 2, ordering)

Finding S5-R2-IPD08-GATE (mid). `apps/cli/src/edit/label-field.test.ts`
("all registered types accept their mapped label or report no label") fails
today for `ui.icon`: the core shape registry has no `ui.icon` shape, so
`getOrFallback("ui.icon").defaultSemantic()` returns a semantic without `icon`
or `path`, which `packages/ir/src/registry/icons.ts` rejects with
`icon.source`. This plan's `packages/core/src/shapes/ui-icon.ts`
(`defaultSemantic: () => ({icon: "square"})`) is the owner fix.

Decision:

- Verification step 1 now includes `apps/cli/src/edit/label-field.test.ts`,
  expecting exit 0 and 0 fail. A done criterion records that the `ui.icon`
  default semantic validates.
- `label-field.test.ts` is run, never edited: it is not in writePaths, and it
  must not be skipped or loosened. If it still fails, fix the shape in
  `packages/core/src/shapes/ui-icon.ts` or its registration in
  `packages/core/src/shapes/index.ts`.
- `ipd-08-cli-layout-ops` now depends on this plan and reruns its aggregate
  after this plan is accepted. writePaths of both plans are unchanged and
  disjoint.

## Amendment 2026-11-10 (blocked-wave-scope-or-contract, operator round 3, ipd-07a split)

Operator decision recorded in `impl-plans/active/ipd-s772-dispatch.json` `reviewContext.designDecisionsAndRationale`: `ipd-01-ir-schema` is accepted (its code is in the working tree; `bun test packages/ir packages/io/src/jsonl/golden.test.ts` -> 213 pass, 0 fail). The new root plan `ipd-07a-icon-shape` delivers the minimal `ui.icon` core shape util (`packages/core/src/shapes/ui-icon.ts`, `defaultSemantic: () => ({icon: "square"})`) and its `createDefaultRegistry` registration, so `apps/cli/src/edit/label-field.test.ts` passes before any wave-2 plan runs a broad `bun test packages apps/cli/src` gate.

Decision for this plan:

- dependsOn becomes `ipd-05-core-catalogue`, `ipd-07a-icon-shape`; accepted plans are no longer listed as pending dependencies. Wave 4 -> 3.
- `packages/core/src/shapes/ui-icon.ts` and `packages/core/src/shapes/index.ts` leave this plan's writePaths. `ui-icon.ts` is a sharedPath (see sharedPathNotes); `packages/core/src/shapes/index.ts` is not writable here.
- The File-level changes block for `uiIconShapeUtil` is now a contract to verify, not to rewrite: confirm the type, bounds, defaults and registration match it, and record the result in the progress log.
- This supersedes the round-2 sentence "fix the shape in `packages/core/src/shapes/ui-icon.ts` or its registration in `packages/core/src/shapes/index.ts`": if `apps/cli/src/edit/label-field.test.ts` fails because the util or its registration is missing or wrong, record a finding with status `owned_elsewhere` (owner `ipd-07a-icon-shape`) and do not edit `packages/core/src/shapes/index.ts`.
- Verification step 1 keeps `apps/cli/src/edit/label-field.test.ts` (exit 0, 0 fail). The done-criterion `rg` now targets `packages/core/src/shapes/ui-icon.ts`, because the registration in `index.ts` references the util by import name, not by the `"ui.icon"` literal.
