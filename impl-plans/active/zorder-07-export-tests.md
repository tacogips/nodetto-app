# zorder-07-export-tests

- planId: zorder-07-export-tests
- planPath: impl-plans/active/zorder-07-export-tests.md
- progressPath: impl-plans/progress/zorder-07-export-tests.md
- wave: 3
- dependsOn: zorder-04-paint-consumers, zorder-05-canvas
- Design: `design-docs/specs/design-z-order.md` section 5.
- writePaths:
  - `apps/cli/src/export-determinism.test.ts`
  - `apps/cli/src/export-paint-order.test.ts` (new)
  - `packages/ui-solid/src/paint-order-parity.test.ts` (new)
  - `impl-plans/progress/zorder-07-export-tests.md`
  - `tmp/zorder-s734/zorder-07-export-tests`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

Follow the worker rules in `impl-plans/active/zorder-00-overview.md`.

## Intent and context

These are end-to-end regressions for H2 through the real CLI export, plus the check that
the canvas and SVG agree. Tests only; no production change. If a test exposes a production
defect, stop and report it in the progress log.

Existing code to imitate: `apps/cli/src/export-determinism.test.ts` (spawning `main.ts`,
`serializeDocument`) and `apps/cli/src/export-command.test.ts` (PNG and PDF output files).

Fixture rule: build documents from literal elements with explicit `index` keys through
`new Editor({ document })` or `serializeDocument`. Frames are filled by default
(`style.fill` `#ffffff`). Give nodes a distinct fill such as `#336699`.

## Tests

`apps/cli/src/export-paint-order.test.ts`:

- A = page `[node, frame]`, frame enclosing node. B = same page `[frame, node]`. C = B
  without the node.
- `export --format svg`: A and B are byte-identical, and A contains the node's `data-id`.
- `export --format png`: A and B are byte-identical, and A differs from C. That shows the
  node is visible.
- `export --format pdf` on A: exit 0 and a file starting with `%PDF`.

`apps/cli/src/export-determinism.test.ts` (append; do not change the existing test):

- `[node, panel, frame, connector]` as in the design: the SVG layer order is `panel` then
  `frame` in `backdrops`, then the connector, then `node`. SVG and PNG bytes equal those
  of the same page stored `[panel, frame, node, connector]`.
- `[node, panel, frame, group, other]`, `group` lists `node`, no connector: SVG root order
  is `panel`, `frame`, `group`, `other`. SVG and PNG bytes equal those of
  `[panel, frame, node, group, other]`.
- `[node, inner, panel, frame, outer, other]`, `outer` lists `inner`, `inner` lists `node`:
  SVG and PNG bytes equal those of `[panel, frame, node, inner, outer, other]`.

`packages/ui-solid/src/paint-order-parity.test.ts`:

For each case, compute the canvas partition (as in `canvas-paint-order.test.ts`) and read
the `data-id` root order of each `data-layer` from `renderPageSvg`. They must match:

- no-connector `[node, frame]`;
- `[node, panel, frame, connector]`;
- `[node, panel, frame, group, other]`;
- `[node, group, frame]`;
- `[lane, task, pool, flow]`.

## Pitfalls

- Compare only direct layer children, because group members also carry `data-id`.
- Use a fresh temp directory and clean it up in `finally`.
- Do not add image files or PNG goldens. Compare bytes generated within the test.
- Do not assert pixels.
- The second document in each comparison must have the same pre-change paint order and no
  grouped element below a surface. That is what makes it a valid reference.

## Acceptance criteria

- All cases above exist and pass.
- The existing determinism test is unchanged.

## Verification (each must exit 0)

1. `bun test apps/cli/src/export-paint-order.test.ts apps/cli/src/export-determinism.test.ts packages/ui-solid/src/paint-order-parity.test.ts`:
   all pass and no test is skipped.
2. `bun test apps/cli/src/export-command.test.ts`: all pass.
3. `bun run typecheck`: no errors.
4. `bunx biome check apps/cli/src/export-paint-order.test.ts apps/cli/src/export-determinism.test.ts packages/ui-solid/src/paint-order-parity.test.ts`
