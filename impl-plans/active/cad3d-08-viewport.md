# M8 cad3d-08-viewport (pure modules)

- dependsOn: M7 (`CadDisplayBody`)
- Design: sections 5 (theming), 6.7 (picking), 14
- writePaths (all new, under `packages/ui-solid/src/cad/`): `camera3d.ts`,
  `pick.ts`, `theme.ts`, `camera3d.test.ts`, `pick.test.ts`,
  `theme.test.ts`

## Intent

The parts of the viewport that need no DOM and no GPU, fully unit tested.
The renderer and the mount follow in M19.

## Contract

```ts
// camera3d.ts
export interface Camera3d { readonly target: Vec3; readonly yaw: number; readonly pitch: number;
  readonly distance: number; readonly ortho: boolean }
export function orbit(c: Camera3d, dxPx: number, dyPx: number): Camera3d;
export function pan(c: Camera3d, dxPx: number, dyPx: number, viewportHeightPx: number): Camera3d;
export function zoomAt(c: Camera3d, factor: number): Camera3d;
export function fitBounds(min: Vec3, max: Vec3, aspect: number): Camera3d;
export function alignToFrame(frame: CadFrame, distance: number): Camera3d; // looks along -n
export function viewProjection(c: Camera3d, aspect: number): Float32Array; // 4x4 column major
export function screenRay(c: Camera3d, aspect: number, ndcX: number, ndcY: number): { origin: Vec3; dir: Vec3 };
// pick.ts
export interface CadPick { readonly bodyId: ElementId; readonly faceName: string; readonly t: number; readonly point: Vec3 }
export function pickBodies(bodies: readonly CadDisplayBody[], ray: { origin: Vec3; dir: Vec3 }): CadPick | null;
// theme.ts
export const CAD_THEME_TOKENS = {
  background: "--nodetto-canvas-bg",
  grid: "--nodetto-canvas-grid",
  body: "--nodetto-canvas-ruler-surface",
  line: "--nodetto-canvas-ruler-text",     // edges, sketch and construction lines
  highlight: "--nodetto-canvas-overlay",   // selection, hover, preview, active sketch
} as const;
export interface CadTheme { readonly background: Rgb; readonly grid: Rgb; readonly body: Rgb;
  readonly line: Rgb; readonly highlight: Rgb }
export function parseCssColor(text: string): Rgb | null; // #rgb, #rrggbb, rgb(r g b), rgb(r, g, b)
export function readCadTheme(read: (token: string) => string): CadTheme;
export function contrastRatio(a: Rgb, b: Rgb): number; // WCAG relative luminance
```

## Behavior

- Camera angles may use `Math.sin` and `Math.cos`: view state is not
  persisted and this folder is outside `packages/core/src/cad`.
- `pitch` is clamped short of the poles; `zoomAt` clamps distance to
  [0.1 mm, 100 m]; `fitBounds` of an empty box returns a default view of a
  100 mm cube.
- `pickBodies`: Moeller-Trumbore over every triangle of every body, front
  and back faces, nearest positive `t`; loops index the typed arrays
  directly without per-triangle allocation.
- Theme: only canvas-mode tokens (`--nodetto-canvas-*`) are read, because
  the canvas mode is independent of the chrome theme (design fact 14). No
  token is declared. `readCadTheme` falls back to nothing: an unparsable
  value throws, so a missing token is found by tests, not hidden.

## Tests

- `camera3d.test.ts`: `fitBounds` of a unit cube projects all corners
  inside NDC; orbit keeps distance; `screenRay` through the centre hits the
  target; pan moves the target parallel to the view plane; `alignToFrame`
  of the `xy` base frame looks along -Z with u to the right.
- `pick.test.ts`: ray through a box picks the nearest face name; a miss is
  null; nearest of two bodies wins; 200,000 triangles under 50 ms.
- `theme.test.ts`:
  - every value of `CAD_THEME_TOKENS` starts with `--nodetto-canvas-` and is
    declared in both the `.nodetto-canvas` block and the
    `.nodetto-canvas.nodetto-canvas-dark` block of
    `apps/desktop/src/styles/canvas.css` (parse the file);
  - with the values parsed from each block, `contrastRatio(line,
    background)` and `contrastRatio(highlight, background)` are at least
    3.0 in the light and in the dark canvas mode; since no chrome token is
    read, the four chrome and canvas combinations reduce to these two and
    the test states so by asserting that no key of `CAD_THEME_TOKENS`
    appears in the `:root` blocks of `base.css`;
  - `line`, `highlight` and `body` are three different colours in each
    mode;
  - colour parsing cases.

## Acceptance criteria

- No DOM, WebGL or Solid import in the three modules.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/ui-solid/src/cad'`
2. `sh -c 'bunx biome check packages/ui-solid/src/cad && bun test packages/ui-solid/src/cad/theme.test.ts'`
