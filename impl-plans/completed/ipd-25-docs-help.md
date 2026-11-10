# ipd-25-docs-help

- planId: ipd-25-docs-help
- planPath: impl-plans/active/ipd-25-docs-help.md
- progressPath: impl-plans/progress/ipd-25-docs-help.md
- dependsOn: ipd-07-icon-core-cli, ipd-08-cli-layout-ops, ipd-09-text-layer, ipd-11-frames, ipd-13-prototype-core-cli, ipd-14-kit-core, ipd-15-kit-content, ipd-16-frames-export-compare, ipd-17-desktop-palette, ipd-18-desktop-prototype-view, ipd-19-desktop-presentation, ipd-20-app-lint, ipd-21-html-prototype, ipd-22-desktop-export-compare-check, ipd-29-desktop-snap-grid
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, section "Help, docs and examples" (help and docs parts).
- Evidence: `tmp/ipd-s772/ipd-25-docs-help/`.
<!-- ownership:start -->
- writePaths:
  - `apps/cli/src/help.ts`
  - `docs/cli.md`
  - `docs/design.md`
  - `README.md`
  - `apps/cli/src/help-app-design.test.ts`
  - `impl-plans/progress/ipd-25-docs-help.md`
  - `tmp/ipd-s772/ipd-25-docs-help`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-25-docs-help`
<!-- ownership:end -->

## Intent and context

The acceptance criteria require help text and AI-agent documentation for every new feature. The MCP tool descriptions reuse `apps/cli/src/help.ts` (`apps/cli/src/mcp.ts:78-110`), so help is also the agent contract. This plan documents behavior as implemented. Read each feature's code and tests first; never document behavior that the code does not have.

## Non-goals

- No behavior changes.
- No example files (`ipd-26`).
- No design doc edits, other than nothing at all here; `ipd-28` edits the status line.

## File-level changes

`apps/cli/src/help.ts`:

- **`edit` help** (`:183-364`):
  - `add`/`update` fields `parent` (relative coordinates), `memberIndex`, `props`, `sizing` (`fixed`/`hug`/`fill`, with cross-axis rules), `absolute`;
  - the operations `layout`, `align` (`to: selection|parent|safe-area|<ref>`), `distribute` (`gap`) and `snap` (`grid` 1/2/4/8);
  - `textAlign` aliases;
  - the typography detach warning.
- **`shapes` help:**
  - `shapes icon <query> [--all]`, `icon:<name>`;
  - `ios:<name>` and how to read properties;
  - `text:layer`;
  - the presets;
  - `prototype:back`.
- **`connect`:** `tap` alias; `prototype:back` with only `from`; the `back`/`swap-overlay` actions; `prototypeFlowName`.
- **`export`:**
  - `--frames --output-dir` (naming and order rule);
  - `--prototype` (storyboard);
  - `--format prototype` with `--flow` and `--device`;
  - the note that page export omits prototype links by default.
- **New `compare` command help:**
  - files or directories (leading-number pairing);
  - `--output`, `--scale`, `--band y0:y1:dy`, `--grid`;
  - the panel layout;
  - the output size rule as implemented in `ipd-16`.

  Add `compare` to the overview list.
- **`inspect`:** `--flows`, `--flow`, and `rel x,y`.
- **`lint`:** the seven app rules, app-page eligibility, and instance context in messages and JSON.

`docs/cli.md`: a new section "Designing phone apps with the CLI". It is a step-by-step recipe for AI agents, with copyable commands, all generic:

1. Create a page in app mode and `draw frame:iphone`.
2. Add a kit status bar, nav bar and tab bar with `parent` and `props`.
3. Add a vertical list with `layout` and `ios:list-row` rows.
4. Add icons (`shapes icon` to find names).
5. Add text layers.
6. Connect screens with prototype links, add back links, name a flow.
7. `lint` until zero app findings.
8. `export --frames`.
9. `compare` against reference images, using bands when system bars are added.
10. `export --prototype` and `--format prototype`.

Mention the parent-relative coordinate rule, and that the kit definitions live on the `iOS kit` page.

`docs/design.md`: a new section "iPhone app design" covering:

- the text layer;
- the Icon picker;
- the iOS kit palette group;
- device presets;
- outside titles;
- auto-parenting on create and drop;
- the snap grid 4/8/24;
- the Design | Prototype toggle and shortcut;
- the Flows list;
- presentation (flow selector, device frame, hotspot hints, keys, persistent layers);
- the Design check panel;
- All artboards export;
- Compare with reference;
- Prototype (HTML).

Update the existing "Screens, popups and transitions" text (`:713-746`): links are now hidden in design view and in default page export.

`README.md`: add one line per new feature to the existing feature list (`:22` onwards), in that list's style.

## Tests: new `apps/cli/src/help-app-design.test.ts`

- `helpFor("edit")` mentions `parent`, `memberIndex`, `props`, `sizing`, `layout`, `align`, `distribute` and `snap`.
- `helpFor("shapes")` mentions `shapes icon` and `ios:`.
- `helpFor("export")` mentions `--frames`, `--prototype` and `prototype`.
- `helpFor("compare")` exists and mentions `--band`.
- `helpFor("lint")` lists all seven `app-` rule ids.
- The overview lists `compare`.

Existing: `apps/cli/src/ai-commands.test.ts`, `help-style-export.test.ts`, `help-convert-frame.test.ts`, `sequence-self-help.test.ts` and `mcp.test.ts` must pass.

## Verification (evidence in `final/`)

1. `bun test apps/cli/src/help-app-design.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/help-style-export.test.ts apps/cli/src/help-convert-frame.test.ts apps/cli/src/sequence-self-help.test.ts apps/cli/src/mcp.test.ts` -> exit 0, 0 fail.
2. `bunx biome check apps/cli/src/help.ts apps/cli/src/help-app-design.test.ts` -> exit 0.
3. For each command block in the new `docs/cli.md` section, run it against a temp generic document with `bun apps/cli/src/main.ts` and record the exit codes in `final/docs-commands.log`. Every documented command must succeed (exit 0, or the documented non-zero).
4. `grep -c 'Designing phone apps with the CLI' docs/cli.md` -> 1. `grep -c 'iPhone app design' docs/design.md` -> 1 or more.

## Done criteria

Verification passes.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes.
- Generic examples only. No emojis.
- No state-changing git commands. Evidence files must not match Bun test patterns.
