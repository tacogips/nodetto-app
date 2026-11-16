# dps-10-snippet-ui

- planId: dps-10-snippet-ui. Wave 2.
- dependsOn: dps-01-syntax, dps-03-model.
- Design: sections 3.4, 3.5 and 4.4 of
  `design-docs/specs/design-document-pages-snippets.md`.
- writePaths:
  - New files:
    - `packages/ui-solid/src/shapes/SnippetView.tsx`
    - `packages/ui-solid/src/shapes/snippet-view-model.ts`
    - `packages/ui-solid/src/shapes/snippet-view-model.test.ts`
    - `packages/ui-solid/src/snippet/SnippetTextEditor.tsx`
    - `packages/ui-solid/src/snippet/snippet-editor-keys.ts`
    - `packages/ui-solid/src/snippet/snippet-editor-keys.test.ts`
    - `packages/ui-solid/src/inspector/CodeSnippetSection.tsx`
    - `packages/ui-solid/src/inspector/MarkdownSnippetSection.tsx`
    - `packages/ui-solid/src/inspector/snippet-edits.ts`
    - `packages/ui-solid/src/inspector/snippet-edits.test.ts`
  - Logs and artifacts: `impl-plans/progress/dps-10-snippet-ui.md`,
    `tmp/dps-s861/dps-10-snippet-ui`, `target`.
- sharedPaths: none.
- artifactRoots: `target`.

## Intent and context

This plan builds the canvas view, the inline text editor and the inspector
sections for both snippet types.

For exact parity with export, the canvas view paints the markup produced by
the core renderers (dps-08 `renderCodeSnippet`, dps-09
`renderMarkdownSnippet`). Those renderers are injected by dps-17 through a
`render` prop, so this plan has no wave-2 import.

dps-17 mounts these components in `ShapeView.tsx`, `Inspector.tsx`,
`Canvas.tsx` and `interaction/pointer.ts`.

## Non-goals

- No edits to `ShapeView.tsx`, `Inspector.tsx`, `Canvas.tsx`, `pointer.ts`,
  `shape-palette.ts` or any CSS token file.
- No new dependency and no DOM test dependencies. Test the pure modules
  only.

## Contract

```ts
// shapes/snippet-view-model.ts
export function snippetViewBox(box: Box): string;                 // "x y w h"
// shapes/SnippetView.tsx
export function SnippetView(props: { element: Element; box: Box; render: (element: Element, box: Box) => string }): JSX.Element;
// snippet/snippet-editor-keys.ts
export type SnippetEditorKeyResult = { kind: "insertTab" } | { kind: "commit" } | { kind: "cancel" } | { kind: "default" };
export function snippetEditorKey(event: { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; isComposing?: boolean }): SnippetEditorKeyResult;
// snippet/SnippetTextEditor.tsx
export function SnippetTextEditor(props: { editor: Editor; id: ElementId; box: Box; mono: boolean; wrap: boolean; onClose(): void }): JSX.Element;
// inspector/snippet-edits.ts
export function codeLanguageCommand(element: Element, language: string): Command | null;
export function codeFlagCommand(element: Element, flag: "showLineNumbers" | "wrap", on: boolean): Command | null;
export function snippetThemeCommand(element: Element, mode: "light" | "dark"): Command | null;
export function snippetThemeOf(element: Element): "light" | "dark";
```

## Rules

- `SnippetView`:
  - An absolutely positioned `<svg>` with `viewBox = snippetViewBox(box)`,
    width and height equal to the box, `pointer-events: none` on the
    content, and `innerHTML = props.render(element, box)`.
  - Memoise by element object, so re-render happens only on change.
  - Imitate positioning in `packages/ui-solid/src/shapes/TableSheetView.tsx`.
  - Set `color-scheme: light` where the existing paint-pin convention does
    so for element layers. See `design-appearance.md` section 5.3; do not
    add CSS tokens.
- `SnippetTextEditor`:
  - A `<textarea>` overlay at the box: monospace (`CODE_FONT_STACK`) when
    `mono`, else the app sans stack; padding 12 for code and 16 for
    Markdown; `spellcheck=false`; `wrap` set to `off` unless the `wrap` prop
    is true; initial value `editor.getText(id) ?? ""`.
  - Keys through `snippetEditorKey`:
    - Tab without Shift: insert `\t` at the caret and `preventDefault`.
    - Escape: cancel, with no commit.
    - Mod+Enter, where Mod is meta on mac and ctrl otherwise (accept
      either): commit.
    - While IME composing, `default`.
  - Blur commits. Commit calls `editor.setText(id, value)` once. It writes
    nothing when the value is unchanged, then calls `onClose`.
  - Imitate `packages/ui-solid/src/table-sheet/CellEditor.tsx` for focus
    and close handling.
- Inspector sections (imitate
  `packages/ui-solid/src/inspector/TableSheetSection.tsx`):
  - `CodeSnippetSection`:
    - a language `<select>` over `SYNTAX_KINDS` labelled by
      `SYNTAX_KIND_LABELS`, showing the stored language even when unknown
      (as "<id> (unknown)");
    - Line numbers and Wrap lines switches, using the existing `Switch.tsx`;
    - a "Snippet theme" Light/Dark segmented control.
  - `MarkdownSnippetSection` has only the theme control.
  - Every change is one `editor.apply([command])`, skipped when the
    command is null.
- `snippet-edits.ts`:
  - `codeLanguageCommand`: an `updateSemantic` with the canonical
    language, or null when unchanged or when the input does not resolve.
  - `codeFlagCommand`: writes `true`, or removes the key with the
    repository's existing remove-key convention for `updateSemantic`. Check
    how `withOptionalFlag` in `packages/ui-solid/src/inspector/edits.ts`
    does it and reuse it.
  - `snippetThemeCommand`: an `updateVisual` with `style.fill` set to
    `CODE_PALETTES[mode].background`, merged with the existing style
    exactly as other style edits do (check `edits.ts`). Null when the mode
    is already the effective mode.
  - `snippetThemeOf` uses `codePaletteFor(element.visual.style?.fill).mode`.

## Pitfalls

- No `any`. Use Solid `JSX.Element` types as in the neighbouring views.
- Commit exactly once. A blur that follows a Mod+Enter commit must not
  commit again.
- Do not read the DOM in the pure modules.

## Tests (input -> expected)

- `snippetViewBox({x:1,y:2,width:3,height:4})` gives `"1 2 3 4"`.
- `snippetEditorKey`:
  - Tab gives `insertTab`.
  - Shift+Tab gives `default`.
  - Escape gives `cancel`.
  - Meta+Enter and Ctrl+Enter give `commit`.
  - Enter alone gives `default`.
  - Composing gives `default`.
- `codeLanguageCommand`:
  - `"rs"` on plain gives an `updateSemantic` with language `"rust"`, or
    the chilla canonical id for `rs`.
  - The same language gives null. `"nope"` gives null.
- `codeFlagCommand`: on gives `showLineNumbers: true`. Off removes the key.
- `snippetThemeCommand` dark gives fill `#1f2427` and keeps other style
  keys. Dark on an already dark fill gives null.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-10-snippet-ui/)

1. `bun test packages/ui-solid/src/shapes/snippet-view-model.test.ts packages/ui-solid/src/snippet packages/ui-solid/src/inspector/snippet-edits.test.ts`
2. `bun run typecheck`, with the sibling-tolerance rule of dps-01.
3. `bunx biome check --diagnostic-level=warn packages/ui-solid/src/shapes/SnippetView.tsx packages/ui-solid/src/shapes/snippet-view-model.ts packages/ui-solid/src/shapes/snippet-view-model.test.ts packages/ui-solid/src/snippet packages/ui-solid/src/inspector/CodeSnippetSection.tsx packages/ui-solid/src/inspector/MarkdownSnippetSection.tsx packages/ui-solid/src/inspector/snippet-edits.ts packages/ui-solid/src/inspector/snippet-edits.test.ts`

## Done criteria

- The components and pure modules exist with the contract.
- All three commands exit 0.
- The progress log records the commands, exit codes and log paths.

## Coordination

Edit only your writePaths. Re-read before each edit and record hashes. No
git state changes.

## Implementation status

Implemented the view, editor, inspector sections and pure helpers; focused tests,
workspace typecheck and scoped Biome check pass on the current shared tree.
See `impl-plans/progress/dps-10-snippet-ui.md` for evidence. Formal review and
integration wiring remain downstream.
