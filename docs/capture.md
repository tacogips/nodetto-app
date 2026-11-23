# Capture page images

Use `nodetto-cli capture <doc.jsonl> [options]` to inspect a page as a PNG or JPG.

## Options

| Option | Meaning and default |
| --- | --- |
| `--page <query>` | Page ID, short ID or name; defaults to the first page. |
| `--page-number <n>` | Page number from `nodetto-cli pages`; defaults to 1. Mutually exclusive with `--page`. |
| `--output <file>` | Output in an existing directory; default is a digest-named private temporary file. |
| `--force` | Replace a different existing regular output file; off by default. |
| `--size <W>x<H>` | 2D fit box, default 1568x1568 and at most 1.15 megapixels; CAD exact size, default 1024x768, each side 64–2048. |
| `--scale <n>` | 2D scale 0.01–4 instead of fit, rounded down to three decimals; maximum 8192 per side and 32 megapixels. |
| `--theme light|dark` | Background theme; default light. |
| `--element <id>` | 2D frame or element ID or unique prefix; default whole page. |
| `--padding <n>` | 2D margin 0–256, default 16; frames use their artboard dimensions. |
| `--background <#rrggbb>` | Override 2D background; default theme background. |
| `--font-dir <dir>` | Add 2D fonts; default uses available fonts. |
| `--json` | Print a JSON object; default is text. |
| `--inline` | Include MCP image content; off by default, ignored in terminal. |
| `--format png|jpg` | Default follows output extension, or PNG without output; explicit format must match extension. |
| `--quality <1-100>` | JPG quality; default 90. JPG needs the native CLI. |
| `--view <name>` | CAD view, default iso; exclusive with direction and eye. |
| `--direction <x,y,z>` | CAD viewing direction; exclusive with view and eye. |
| `--eye <x,y,z>` | CAD camera position; exclusive with view and direction. |
| `--target <x,y,z>` | CAD point to center; default model center. |
| `--up <x,y,z>` | CAD camera up vector; default Z, or +Y from above and -Y from below along Z. |
| `--zoom <n>` | CAD fitted scale multiplier, 0.01–1000; default 1. |
| `--no-interference` | Skip CAD interference checking; default checks it. |
| `--interference-cell <mm>` | Set CAD sampling cell in mm; default 0.25 mm (range 0.01–10). |
| `--interference-bodies <id,id,...>` | Limit checking to body IDs; default all eligible bodies. |
| `--fail-on-interference` | Exit 1 on interference or unchecked candidates; default off. |

## Output and files

Text stdout reports absolute `path`, `format`, `size`, `bytes` and `page`;
CAD adds `camera`, `frame`, `bodies`, `errors` and `interference`. Warnings
appear on stderr. `--json` returns these as structured fields, including
`approximate` for capped pairs and exact `uncheckedCount` even when the
`unchecked` list is truncated. A `refinement capped` line warns that sub-cell
parts may be missed; unchecked candidates are listed with a narrowing hint.

The default private per-user capture directory is under the system temporary
directory, with a digest-based filename. Identical bytes succeed without a
rewrite; different bytes at an explicit path need `--force`. Symbolic links
are refused, and output parent directories are not created. For the Mac App
Store CLI, use `--output` inside the authorized folder so another process can
read the image.

## 2D pages

Capture the whole page or select a frame or element. Size fits without enlarging
artwork; `--scale` replaces that fit. Dark theme changes only the background,
not shape colours. JPG is flattened on the background.

```bash
nodetto-cli capture drawing.jsonl --output drawing.png
nodetto-cli capture drawing.jsonl --page-number 1 --format jpg --output drawing.jpg
```

## 3D CAD pages

The orthographic camera uses Z up. `--view` accepts `iso` (default, from
+X,+Y,+Z, showing top, back and right), `front` (-Y), `back` (+Y), `left`
(-X), `right` (+X), `top` (+Z), and `bottom` (-Z). Alternatively use
`--direction` or `--eye`, with `--target`, `--up` and `--zoom` as needed.
The camera line gives the center and scale in mm/px; `frame` reports complete
or cropped. Body notes identify hidden, outside, empty and unknown bodies,
and bodies whose capture differs from the app. Failed features are listed and
skipped. A `cad.result.empty (sampled)` error identifies a feature the app
rejects but the picture applies, even with `--no-interference`.

Closed imported meshes participate like solids; open meshes are translucent
and marked not checked. Reference bodies are drawn at 45% over what is behind
and participate in interference. 2D artwork options do not apply to CAD.
After the merge with the CAD branch, `export` produces a CAD wireframe while `capture` renders shaded solids.

```bash
nodetto-cli capture plate.jsonl --view iso --output plate.png
nodetto-cli capture plate.jsonl --view front --output front.png
```

## Interference

Interference is shared volume above 0.001 mm; touching faces do not interfere.
Text gives the number of pairs, candidate count and cell, then each pair's
volume and box. The printed cell is the largest used. Interference is always
found when its projection along X, Y or Z contains an axis-aligned square of
that side over which overlap is longer than the tolerance. Refinement may be
capped and miss sub-cell parts; slivers thinner than the cell in two directions
may also be missed. Curved surfaces are approximated by facets.

A striped hatch replaces shading and remains visible through other bodies:
light uses `#335c67` and `#fffdf8`, dark uses `#5fb4c7` and `#1f2427`.
Use `--no-interference` for an unobstructed view, `--interference-cell` to
set the cell, `--interference-bodies` to narrow candidates, and
`--fail-on-interference` to signal interference or unchecked candidates.

## Exit codes

- 0: image written, including an identical existing file.
- 1: only with `--fail-on-interference`, when a pair interferes or a candidate was not checked.
- 2: usage, input, output, refusal or work limit error. Empty pages, invalid options, unsafe output and a CAD page without a solid body are refused.

The work refusals each suggest a smaller `--size`:

- `The scene is too heavy for this picture size (work <work>, limit 4000000000). Use a smaller --size.`
- `The scene is too heavy for this picture size (tile list entries <entries>, limit 4194304). Use a smaller --size.`
- `The scene is too heavy for this picture size (picture boundary scans over 16000000000). Use a smaller --size.`

## Determinism

The same 3D scene bytes produce the same image bytes across runs, thread counts
and supported platforms. For 2D, the same document, options, binary and fonts
produce the same bytes. Text contains no time or random value.

## MCP

Call `nodetto_capture` with capture arguments. `--inline` adds the image to
the MCP result up to 1 MiB; clients may impose lower limits or shrink it.
Visual token cost follows pixel size: a 1024x768 image costs about 1,036 tokens
at 28x28 pixels per token. Reduce `--size`, try JPG or open the returned path.

## Desktop Export

The desktop Export dialog offers PNG and JPG for 2D pages. For CAD, choose
“3D view image”, one of the seven views or “Current view”, and PNG or JPG.
The dialog has no interference switch in `captureCadImage`. 2D desktop PNG/JPG
bytes are not equal to CLI output.

## Agent loop

Capture a page, open the reported path with an image-capable reader, inspect it,
edit the document and capture again to check the result.

## Measured budgets

Values are recorded by M16 from `target/capture-m16/`; see design section 10.3.

## Licences

This software is based in part on the work of the Independent JPEG Group.
See `THIRD_PARTY_NOTICES.md`.
