# AI capture: PNG and JPG pictures of any page, with 3D CAD camera and interference

Status: design revision 4, base commit `ebcac57`, branch `feat/ai-capture`
(revision 4 checked against `be8fa5d`). Section 18 lists what revisions 2,
3 and 4 changed and why; section 8.5 gives the completion order of the
remaining milestones.
Implementation plan: `impl-plans/active/capture-00-overview.md`.
Citations of the form `path:line` are repository evidence at the base commit.
Citations `[S-n]` are external sources listed in section 17. Measurements
marked "spike" come from throwaway code under `tmp/capture/spike/` (ignored by
git, `.gitignore:41`), run on an Apple M4 (10 cores), Bun 1.4.4, Rust 1.98
release builds; logs are `tmp/capture/spike/*.log` (`r2.log` and the
`r2-*.png` pictures belong to revision 2).

## 1. Context

### 1.1 Facts at `ebcac57`

1. `nodetto-cli export --format png` renders one page: the TypeScript core
   builds an SVG (`apps/cli/src/export-command.ts:517-538`), the host
   rasterizes it. The native host uses resvg and tiny-skia
   (`apps/cli/native/src/render.rs:40-101`, called through the `png` host
   operation, `apps/cli/native/src/engine.rs:128-136`); the Bun host uses
   `@resvg/resvg-js` (`apps/cli/src/raster-backend.ts:48-60`).
2. There is no JPEG encoder anywhere: a search for `jpeg`/`jpg` finds only
   image import and attachment code; `EXPORT_FORMATS` has no JPEG entry
   (`apps/cli/src/export-command.ts:78-89`), and the desktop rasterizer
   only calls `canvas.toBlob(..., "image/png")`
   (`packages/ui-solid/src/raster-export.ts:83-126`).
3. PNG and PDF export require `--output` and replace an existing file
   without a check (`apps/cli/src/export-command.ts:214-219,675-681`). The
   writers resolve symbolic links and replace the link target, and a
   dangling link creates its target (`apps/cli/src/write-atomic.ts:25-90`,
   `crates/native/src/fs.rs:9-57`). Output paths are not confined
   (`apps/cli/native/src/engine.rs:82-90`); the sandboxed Store CLI is
   limited to folders granted through `authorize`
   (`apps/cli/native/src/access.rs:18-47`).
4. A document with several pages and no `--page` makes `export` fail with
   a page list (`apps/cli/src/commands.ts:230-250`,
   `apps/cli/src/export-command.ts:374-381`). Success text goes to stderr
   and stdout stays empty for binary formats
   (`apps/cli/src/export-command.ts:683-690`).
5. Exporting a `cad3d` page fails today: CAD shape utils return no bounds
   (`packages/core/src/shapes/cad.ts:21-30`), `renderElementsSvg` then
   returns `null` (`packages/core/src/svg-export/document.ts:260-262,382-386`)
   and the command prints `Page "Angle bracket" has no visible content to
   export.` with exit 2 (run against
   `apps/cli/src/__fixtures__/cad-bracket.jsonl`). The desktop Export
   dialog keeps SVG, PNG and PDF selectable on a CAD page and shows
   "Choose visible artwork to export."
   (`packages/ui-solid/src/raster-export.ts:45`,
   `packages/ui-solid/src/test-dom/cad-mesh.dom.tsx:263-267`).
6. The accepted CAD design gives the CLI no geometry kernel and plans only
   a fixed isometric wireframe of tool solids for export
   (`design-docs/specs/design-cad3d.md:889-893,898-913`); milestone M18 that
   implements it is not on this branch
   (`impl-plans/active/cad3d-18-export-docs-final.md:6-17`). Cut and
   intersect results therefore never appear as solids outside the desktop
   viewport. Nothing in the repository detects interference between bodies
   (a search for `interfer`, `collision` and `clash` under `packages/` and
   `apps/` finds only 2D routing and PCB text).
7. The kernel-free TypeScript layer already yields, for every valid
   feature, a frame, a span and nested loops (`ExtrudeGeometry`,
   `packages/core/src/cad/history.ts:400-404,433-503`), and
   `checkCadPage` walks the history without a kernel
   (`packages/core/src/cad/check.ts:57-137`). A body is a fold over the
   history: `new` creates it from a tool, `add`, `cut` and `intersect`
   combine it with a tool (`packages/core/src/cad/evaluate.ts:402-438,
   660-669`); a tool is a region of its sketch swept along the sketch
   normal. The region is not simply even-odd: loops keep their nesting
   depth in the whole sketch when an extrude selects only some of them
   (`packages/core/src/cad/loops.ts:380-396`), and the kernel path adds
   even depths and cuts odd depths in ascending order, skipping leading
   odd levels (`packages/core/src/cad/evaluate.ts:303-337`).
8. The native CLI interprets the engine bundle in Boa
   (`apps/cli/native/Cargo.toml`, `apps/cli/native/src/engine.rs:218-256`).
   Each invocation creates a new context; `nodetto-cli --version` takes
   0.65 s and `cad check` of a 74-element CAD page 0.59 s on the spike
   machine, so about 0.6 s is the floor of every command. Host operations
   are a fixed list of names (`apps/cli/native/src/engine.rs:238-241`).
9. The desktop viewport is an own WebGL2 renderer over kernel meshes
   (`packages/ui-solid/src/cad/renderer.ts:152`, context created without
   `preserveDrawingBuffer`); the camera is component state that nothing
   outside `NodettoCanvas` can read
   (`packages/ui-solid/src/Canvas.tsx:142-149,184-185`); the camera is Z-up
   with yaw, pitch, distance and an `ortho` flag
   (`packages/ui-solid/src/cad/camera3d.ts:3-11,37-39,110-138`). Reference
   bodies are drawn at 45% opacity
   (`packages/ui-solid/src/cad/renderer.ts:316-318`).
10. The desktop rasterizes PNG in the webview
    (`packages/ui-solid/src/raster-export.ts:83-126`) and only picks a
    path and writes bytes in Rust
    (`apps/desktop/src/shell/export-handlers.ts:89-101`,
    `apps/desktop/src-tauri/src/fs.rs:129-133`,
    `apps/desktop/src-tauri/src/dialogs.rs:202-226`). The desktop crate
    depends on no raster library (`apps/desktop/src-tauri/Cargo.toml`).
11. The CLI cannot ask the running desktop app for anything: `open` only
    launches it (`apps/cli/src/open-command.ts:11-55`,
    `apps/cli/native/src/files.rs:22-64`) and the app has no reply channel
    (`apps/desktop/src-tauri/src/lib.rs:46-70`).
12. MCP tools are derived from `COMMAND_HELP`: one `nodetto_<command>` tool
    per key, with the help page as description, in the TypeScript server
    (`apps/cli/src/mcp.ts:88-99`) and the native server
    (`apps/cli/native/src/mcp.rs:97-118`). A tool result is
    `{exitCode, stdout, stderr}` (`apps/cli/native/src/mcp.rs:27-35`).
13. The help overview must split into fewer than 40 segments when printed
    with its trailing newline (`apps/cli/src/ai-commands.test.ts:91-93,471`).
    It has 38 lines (`apps/cli/src/help.ts:7-44`), which is 39 segments:
    one more line fails the test.
14. Canvas-mode tokens are CSS only (`apps/desktop/src/styles/canvas.css:7-45`);
    there is no error or warning token in that family, and export modules
    must not read appearance state
    (`apps/desktop/src/styles/theme-tokens.test.ts:615-643,739`). The
    viewport uses `--nodetto-canvas-bg`, `-ruler-surface`, `-ruler-text`
    and `-overlay` (`packages/ui-solid/src/cad/theme.ts:4-10`).
15. Raster limits are 8192 pixels per side and 32 megapixels, and
    `rasterDimensions` accepts only the listed scales
    (`packages/core/src/export-geometry.ts:4-6,75-98`).
16. The base commit does not pass its own checks: `bun run typecheck`
    reports two errors in `packages/core/src/cad/check.ts:114,118`
    (`cad.pcb` reaches the extrude branch), and `bun test` has two failures
    in `packages/io/src/jsonl/cad-format.test.ts:103,207`. Both are repaired
    on `feat/cad3d-pages` by commit `75d239b` (logs:
    `tmp/capture/design/typecheck.log`, `bun-test.log`). Section 8.4 says
    how this plan deals with it.

### 1.2 Facts handed to this run, verified

| Statement in the request context | Result |
| --- | --- |
| `export --format png` rasterizes 2D pages natively | Confirmed (fact 1) |
| There is no JPEG output | Confirmed (fact 2) |
| The CLI has no kernel; only a fixed-camera wireframe is planned | Confirmed (fact 6); the wireframe is not on this branch |
| Interference is designed nowhere | Confirmed (fact 6) |
| The desktop has a WebGL2 viewport renderer | Confirmed (fact 9) |
| Option: per-pixel ray interval evaluation, heavy work in Rust | Adopted with changes; see sections 3 and 6 and the spike in 10.1 |

## 2. Scope

### 2.1 Goal

An agent that edits a nodetto document can look at any page with one
command, without choosing options: `nodetto-cli capture <doc>` writes a PNG
(or JPG), prints where it is and what it shows, and never replaces a file
that is not the same capture. On a 3D CAD page the picture shows the solids
that result from the feature history, from a chosen direction, and the
bodies that occupy the same space are listed and drawn.

### 2.2 First shippable slice (milestones M1 to M20)

- CLI command `capture` and MCP tool `nodetto_capture` for all eleven page
  kinds (`packages/ir/src/types.ts:27-39`), PNG and JPG.
- 3D CAD pages: orthographic camera (seven named views, or a direction, or
  an eye position and target, with up vector, zoom and fit), shaded solids
  with hidden surfaces removed, results of `new`, `add`, `cut` and
  `intersect`, PCB reference bodies, imported meshes.
- Interference between distinct bodies: text (pair, box, volume, the
  sampling cell as the stated guarantee) and a hatched overlay in the
  image, consistent with each other.
- Desktop: "3D view image" in the Export dialog for a CAD page, rendered
  by the same Rust code; JPG next to PNG for 2D artwork.
- Deterministic output with tests, measured time budgets, documentation.

### 2.3 Later phases (not in this plan)

- Perspective projection, section planes, an axis triad and dimensions in
  the image, smooth normals on arcs.
- Pictures of sketches on a CAD page that has no body yet.
- Reproducing the app's handling of a feature that empties a body (skip
  it and fail its dependents) instead of reporting it.
- `capture --all` (every page), `cad check --interference` (text only),
  clearance (minimum distance) checks.
- Live interference display in the desktop viewport, computed exactly by
  the kernel's intersect.
- Capture in the hosted web application (section 14).
- Pruning of old default captures.

### 2.4 Non-goals

Photorealism, textures, shadows, transparency other than reference bodies,
animation, video, screen capture of the application window, changes to
`export` output, server code, auth and deployment configuration.

## 3. Decisions and alternatives

### 3.1 A new command instead of new `export` formats

`export` is a converter with ten formats, requires `--format`, requires
`--output` for binary formats and fails on a multi-page document without
`--page` (facts 3 and 4). Each of those is a wasted round trip for an agent
whose question is "what does it look like now". `capture` has a different
contract: every argument except the document is optional, the result is
described on stdout, and nothing is overwritten silently. `export` keeps
its behaviour byte for byte.

| Alternative | Verdict |
| --- | --- |
| `export --format jpg` plus defaults for `--output` and `--page` | Rejected: changes the documented failure cases of an existing command and mixes two contracts in one help page |
| Extend `cad check` with an image | Rejected: 2D pages need the same command |
| New command `capture` | Chosen |

### 3.2 Where the 3D picture is computed

| Alternative | Evidence | Verdict |
| --- | --- | --- |
| Pure TypeScript renderer in `packages/core`, run by Boa in the CLI | Spike: the same JavaScript renders 256 x 192 rays in 70 to 77 ms in Bun and 11,477 ms in Boa (about 150 times slower); the default picture has 64 times as many rays, about 12 minutes | Rejected for the CLI |
| Ask the running desktop app to capture its viewport | No reply channel (fact 11); needs a window, a GPU and a human session; viewport readback is not available (fact 9) and not deterministic | Rejected |
| Link a native kernel (Manifold through C++ or OpenCascade) into the CLI | A C++ toolchain in the Rust build, LGPL questions for OpenCascade (`design-docs/specs/design-cad3d.md:454`), and a mesh still has to be rasterized afterwards | Rejected for the slice |
| Kernel-free per-pixel ray intervals in Rust; TypeScript supplies the scene | Spike: 1024 x 768 with 2 x 2 samples and 66 tools in 339 ms on one thread, 98 ms on eight; identical bytes for 1, 3 and 8 threads | Chosen |
| The same in both TypeScript (reference) and Rust | Two implementations of about 900 lines each to keep equal | Rejected: the Bun CLI stays the reference for everything except the two operations that only the native host has (section 8.2) |

The division follows `design-docs/specs/native-hosts.md`: document
semantics stay in TypeScript (history order, references, statuses, sketch
frames, loops, tessellation, camera, theme, report text); Rust receives
generic geometry (extruded polygon sets, triangle meshes, boolean steps)
and does only per-ray arithmetic and encoding. No CAD rule is written
twice.

### 3.3 How solids are drawn without a kernel

The solids of the slice are prisms combined by boolean steps, plus meshes
(fact 7). For such a model the classical method is ray casting of the
construction tree [S-1, S-2]: intersect the ray with each primitive, apply
the boolean operator to the one-dimensional intervals, take the nearest
boundary. It needs no mesh, no triangulation and no robust 3D boolean, and
the same intervals answer the interference question (section 6.6).

| Alternative | Verdict |
| --- | --- |
| Depth-buffer CSG on a GPU (Goldfeather, SCS, as in OpenCSG [S-3]) | Rejected: needs a GPU context in a headless CLI, and cannot report geometry |
| Tessellate each tool and run mesh booleans in Rust | Rejected: this is the kernel problem the CAD design avoided |
| Wireframe of tool solids (M18) | Not sufficient: it shows cut tools as if they were material |
| Ray intervals | Chosen |

### 3.4 Interference

Interference of two bodies is the set where both are solid. Along a ray it
is the intersection of their interval lists. Sampling a box with parallel
rays along the three axes gives presence, extent and, by summing overlap
lengths times the cell area, volume; this is the layered-depth sampling
used for solid modelling on images [S-4], and Onshape and SolidWorks report
the same items (pairs, a box or volume, a coloured region) [S-5, S-6].

| Alternative | Verdict |
| --- | --- |
| Bounding box overlap only | Rejected: reports every pocketed part as colliding |
| Exact kernel intersect in the CLI | Not available (fact 6) |
| Only the overlay in the chosen view | Rejected: the text must not depend on the camera |
| Three-axis ray sampling on a fixed lattice over the body boxes (revision 1) | Rejected after review: misses a pin smaller than a cell (section 6.6) |
| Exact arrangement of all projected edges | Rejected: overlap also changes where oblique faces cross, so an edge arrangement is not exact either, and it is quadratic |
| Three-axis sampling with a cell stated in millimetres, refined around small loops and region boundaries, bounded by a ray budget | Chosen |

### 3.5 Encoders

PNG uses the `png` crate that the CLI already links
(`apps/cli/native/Cargo.toml`). JPEG uses `jpeg-encoder` 0.7.1 with default
features (no `unsafe`, no runtime dependencies) [S-7]. An own JPEG encoder
was considered and rejected: the format is easy to get subtly wrong and the
crate's licence terms are acceptable (section 9). Both encoders live in one
module that takes raw pixels only (section 8.1).

### 3.6 Default output location

| Alternative | Verdict |
| --- | --- |
| Next to the document | Rejected: untracked files in the user's repository after every look |
| Fixed name in the temporary directory | Rejected: two captures replace each other |
| Random name | Rejected: the same picture gets a new name every time |
| Per-user private capture directory, name from the content digest | Chosen (section 4.3) |

### 3.7 How the agent receives the picture

Coding agents with file access read an image from a path [S-8]. MCP can
carry an image content block [S-9], but clients count it against a result
size limit and have handled it inconsistently [S-10]. Default: the tool
result is the text with the path. Opt-in: `--inline` adds an image content
block for clients that cannot read files (section 4.5).

## 4. Command surface

### 4.1 CLI

```
nodetto-cli capture <doc.jsonl> [--page <short-id|id|name> | --page-number <n>]
        [--output <file>] [--format png|jpg] [--force] [--quality <1-100>]
        [--size <W>x<H>] [--scale <n>] [--theme light|dark]
        [--element <id>] [--padding <n>] [--background <#rrggbb>] [--font-dir <dir>]
        [--view iso|front|back|left|right|top|bottom]
        [--direction <x,y,z>] [--eye <x,y,z>] [--target <x,y,z>] [--up <x,y,z>]
        [--zoom <factor>] [--no-interference] [--fail-on-interference]
        [--interference-cell <mm>] [--interference-bodies <id,id,...>]
        [--json] [--inline]
```

| Option | Default | Notes |
| --- | --- | --- |
| page | first page in display order | The order of `nodetto-cli pages`; stdout says which page of how many. `--page` uses `resolvePageQuery`, `--page-number` uses `pageAtNumber` (`packages/ir/src/page-id.ts:28-66`) |
| `--output` | `<capture directory>/<stem>-<page short id>-<digest>.<ext>` | Section 4.3. Extension must be `.png`, `.jpg` or `.jpeg` |
| `--format` | from the `--output` extension, else `png` | A contradiction between the two is a usage error |
| `--force` | off | Needed to replace an existing file with different bytes |
| `--quality` | 90 | JPG only |
| `--size` | 2D: box 1568 x 1568 and at most 1.15 megapixels; 3D: exactly 1024 x 768 | 2D: the page is scaled down to fit, never up. 3D: 64 to 2048 per side |
| `--scale` | 2D only, replaces the fit; 0.01 to 4 | Limits of fact 15 apply |
| `--theme` | `light` | Canvas-mode tokens (section 6.5). On a 2D page it changes only the background: shapes keep the export theme, as in the app, where the document paint is pinned to light values (`design-docs/specs/design-appearance.md:239`, `packages/core/src/svg-export/theme.ts:18-27`); the help says that default dark strokes are hard to see on the dark background |
| `--element`, `--padding`, `--font-dir` | as `export` | 2D only |
| `--background` | the theme's canvas background | 2D only, six-digit hex |
| camera options | `--view iso`, fit, zoom 1 | 3D only (section 6.2) |
| `--no-interference` | off | Skips analysis and overlay |
| `--fail-on-interference` | off | Exit 1 when a pair interferes or a candidate pair could not be checked; the image is still written |
| `--interference-cell` | 0.25 | Target sampling cell in mm, 0.01 to 10 (section 6.6) |
| `--interference-bodies` | all bodies | Ids, short ids or names; only pairs among the named bodies are checked and drawn |
| `--json` | off | One JSON object on stdout instead of lines |
| `--inline` | off | MCP only (section 4.5); ignored in a terminal |

An option of the other page family (for example `--view` on a 2D page) is a
usage error that names the page kind, so a wrong assumption is corrected in
one step.

### 4.2 Output on stdout

Text form, one `key: value` per line, fixed order, the path first. The
path is always absolute, also when `--output` was relative, because an MCP
server's working directory can differ from the agent's.

```
path: /var/folders/x/T/nodetto-capture-501/plate-AbC123xyz_--5f0c2a9e41d7.png
format: png
size: 1024x768
bytes: 41491
page: 1/3 "Plate" (cad3d, id plate)
camera: view=iso direction=-0.57735,-0.57735,-0.57735 up=0,0,1 centre=55,35,7 scale=0.1296 mm/px
frame: complete
bodies: 2 (Plate, Block)
errors: 0
interference: 1 (1 candidate pair checked, cell 0.25 mm)
  Plate x Block: volume 590.4 mm3, box 85,45,2 .. 100,60,5 mm
```

(The fixture's exact polygonal overlap is 590.721 mm3: its shared box holds
one whole hole, two half holes and a quarter hole. The 637.362 mm3 of the
spike table in section 6.6 belongs to the spike scene, which had one hole
in the overlap.)

`camera`, `frame`, `bodies`, `errors` and `interference` appear only for
CAD pages.

- `camera`: `centre` is the model point shown at the middle of the
  picture; with `right`, `up` (derived from `direction` and `up`) and
  `scale` it maps a pixel to model coordinates.
- `frame`: `complete` when every body's bounding box projects inside the
  picture, else `cropped` (possible with `--zoom` above 1 or `--target`).
- `bodies`: names in history order (the first eight, then `...`). A body
  carries a note when it is not drawn or not what the app shows:
  `[hidden behind other bodies]`, `[outside the picture]`, `[no
  material]`, `[not sampled]`, `[differs from the app, see errors]`
  (section 6.7) or `[open mesh, not checked]`. A body seen only through
  translucent reference bodies counts as drawn.
- `errors`: features with a failed status, one indented line each
  (`<short id> <code>`), the form of `cad check`
  (`apps/cli/src/cad-command.ts:67-70`), plus one line per body for the first feature that leaves it without
  material, also when a later feature adds material again: `<short id>
  cad.result.empty (sampled): leaves no material in "<body>"; the app
  rejects this feature and keeps the body, this picture applies it`.
- `interference`: the number of interfering pairs, how many candidate
  pairs were checked and the sampling cell that was used (the detection
  guarantee of section 6.6 is stated in that unit). One indented line per
  pair. A pair found only by the picture's own rays ends with `(found in
  the picture only)`. When pairs could not be checked: `interference: 0
  found, 12 of 40 candidate pairs not checked (cell 4 mm)`, then lines
  `not checked: <a> x <b>` (the first twenty, then a count) and the hint
  to narrow with `--interference-bodies`. A pair whose refinement was
  capped ends with `, approximate`. When `cappedCount` is above 0 one more
  line follows the pairs: `  refinement capped on <k> checked pairs
  (<j> without a hit); sub-cell parts of those pairs may be missed;
  narrow with --interference-bodies`. The printed cell still holds for
  capped pairs (their level 0 is complete); a capped pair does not change
  the exit code. With `--no-interference`: `interference: not checked`.

`--json` prints the same data as one object with the keys `path`,
`format`, `width`, `height`, `bytes`, `page` (`number`, `count`, `id`,
`name`, `kind`), and for CAD pages `camera` (`view`, `direction`, `up`,
`right`, `centre`, `mmPerPixel`), `frame`, `bodies` (`id`, `name`,
`state`), `errors`, `interference` (`cellMm`, `candidates`, `checked`,
`unchecked` as id pairs (at most the first 256), `uncheckedCount` (the
exact total, also when the list is truncated), `cappedCount`,
`cappedWithoutHit` as id pairs, `budget` in weighted rays, and `pairs`
with `a`, `b`, `aName`, `bName`, `volumeMm3`, `min`, `max`, `source` and
`approximate`, which is the wire pair's `capped` flag, so text and JSON
mark the same pairs as approximate). Warnings (document load, missing
glyphs) go to stderr as today.

Exit codes: 0 when the image was written (also when it already existed
with the same bytes), 1 with `--fail-on-interference` when a pair
interferes or a candidate was not checked, 2 for usage, input and output
errors.

### 4.3 Where the file goes and what may be replaced

- Capture directory: per user. On unix `<temporary directory>/nodetto-
  capture-<uid>`, elsewhere `<temporary directory>/nodetto-capture` (the
  temporary directory is per user there). It is created with mode 0700.
  An existing entry is accepted only if it is a real directory (not a
  link), is owned by the effective user, and is not writable by group or
  others. Otherwise the command fails with exit 2 and the message
  `Cannot use the capture directory <dir>: <reason>. Pass --output <file>
  (Mac App Store build: inside the authorized folder).` The same message
  is used when the directory cannot be written.
- Default name: the document file stem reduced to `[A-Za-z0-9._-]` (at
  most 40 characters), the page short id (`shortPageId`,
  `packages/ir/src/page-id.ts:10-21`) and the first 12 hexadecimal digits
  of a 64-bit FNV-1a digest of the image bytes. Equal pictures get equal
  names, so a repeated capture is a no-op; a name that exists with other
  bytes gets the suffix `-2`, `-3`, and so on.
- Any target: created with exclusive creation (`O_EXCL`), which fails on
  an existing file and on a link, including a dangling one. If the target
  exists with identical bytes the command succeeds without writing. If it
  exists with different bytes the command fails with exit 2 and names
  `--force`. With `--force` the existing atomic writer replaces a regular
  file; a symbolic link is refused.
- Parent directories of `--output` are not created.
- The Store CLI's temporary directory is inside its container, which
  another process may not be allowed to read; the help says to use
  `--output` inside the authorized folder for that build.

### 4.4 Discovery

- `COMMAND_HELP.capture` holds the full page; the MCP tool
  `nodetto_capture` follows from it in both servers (fact 12). The page is
  assembled from one part per topic (`apps/cli/src/capture-help/`), so
  milestones that add options do not edit one shared string.
- The overview gains `nodetto-cli capture <doc>` under "Render" and names
  `capture` in the AI loop line. The two closing sentences are merged
  into one line and the two AI loop lines into one, so the overview has 37
  lines: one line of headroom under the limit of fact 13 for whatever the
  cad3d branch adds before the merge (commit `75d239b` does not change
  `help.ts`). Section 8.3 lists this as a merge check.
- The MCP server instructions (`apps/cli/src/mcp.ts:33`,
  `apps/cli/native/src/mcp.rs:39`) say that `nodetto_capture` writes a
  picture of a page and returns its path.

### 4.5 MCP

`nodetto_capture` takes the same argument tokens. The result text is the
stdout of section 4.2. With `--inline` and exit code 0 or 1 the server
reads the written file and appends `{"type":"image","data":<base64>,
"mimeType":"image/png"|"image/jpeg"}` [S-9] when the file is at most
1,048,576 bytes; above that it appends a text line that says so.
`structuredContent` is unchanged and never contains the image.

Size for the model: a picture costs `ceil(width/28) * ceil(height/28)`
visual tokens [S-11], so the default 1024 x 768 picture costs 37 x 28 =
1,036. The 1.15 megapixel bound of 2D captures is this design's own
choice: with it no default picture exceeds 1,568 tokens, the limit the
source lists for its standard tier. Clients apply their own limit to tool
results, images included [S-10]; the help says that a client may refuse
or shrink an inline picture well below 1 MiB and recommends `--format jpg`
with a smaller `--size`, or reading the path.

### 4.6 Desktop

Section 13.

## 5. 2D pages

Every kind except `cad3d` (`freeform`, `erd`, `uml`, `sequence`, `state`,
`flowchart`, `architecture`, `bpmn`, `breadboard`, `pcb`) is drawn by the
existing page serializer: `editor.exportPageSvg` for the page,
`exportArtboardSvg` or `exportSelectionSvg` for `--element`, exactly the
calls of `export` (`apps/cli/src/export-command.ts:517-538`), with the
theme's canvas background unless `--background` is given. A 2D page kind
only selects a tool palette; the one content rule separates CAD pages from
the rest (`packages/ir/src/types.ts:23-26`), so one path covers all ten. The SVG is rasterized by the host renderer of fact 1 with the
font coverage and fallback logic of `export`
(`apps/cli/src/export-command.ts:598-618`).

Scale: `scale = min(1, boxW / w, boxH / h, sqrt(1150000 / (w * h)))`,
rounded down to three decimals and at least 0.01, where `w` and `h` are the
SVG viewport; `--size` replaces the box and drops the megapixel term,
`--scale` replaces the whole rule. The result must satisfy
`RASTER_LIMITS`. The function lives in a new core module because
`rasterDimensions` rejects scales outside its list (fact 15).

`--theme dark` on a 2D page paints the dark canvas background under shapes
that keep the export theme (default strokes `#1d2a2e`,
`packages/core/src/svg-export/theme.ts:18-27`), which is what the app
shows in the dark canvas mode because document paint is pinned to light
values (`design-docs/specs/design-appearance.md:239`). The help says that
the light theme is the readable default for 2D pages.

A page without visible content fails with `Page "<name>" has no visible
content to capture.` and exit 2. The dispatch is on the page kind, before
any SVG call, so the wireframe that M18 adds to the serializer for CAD
pages never reaches `capture`.

## 6. 3D CAD pages

### 6.1 Scene model (TypeScript, kernel-free)

`buildCadCaptureModel(elements, pageId, options)` in
`packages/core/src/capture/scene.ts` repeats the walk of `checkCadPage`
(`packages/core/src/cad/check.ts:57-137`) and keeps what it found:

- tools: one per successful extrude or PCB reference
  (`ExtrudeGeometry`: frame `o,u,v,n`, span `t0,t1`, loops as flat point
  lists with a source entity per edge), one per decodable mesh;
- bodies in history order: the creator's id and name, `reference` for
  `cad.pcb`, and steps `(op, tool)` where `new` and `add` are union, `cut`
  is difference and `intersect` is intersection; a feature with several
  targets appends its step to each target body
  (`packages/core/src/cad/evaluate.ts:660-669`);
- statuses of every feature, as `cad check` reports them;
- conservative bounds per body: the union of the boxes of its union tools
  (cut and intersect cannot enlarge a body).

Loops of a tool. The loops the core returns carry their nesting depth in
the whole sketch, also when the extrude selects only some of them (fact
7), and the kernel path adds even depths and cuts odd depths in ascending
order. A point is therefore inside the tool exactly when the deepest
selected loop that contains it has even depth. That is not the even-odd
region of the selected loops: with a rectangle R (depth 0), a circle C1
inside it (depth 1) and a circle C2 inside C1 (depth 2), the selection
`[C1, C2]` is the disc of C2 and the selection `[R, C2]` is the full
rectangle. The model normalises each tool's loop list so that the two
rules coincide: a loop is dropped when its nearest selected ancestor has
the same depth parity, and an odd loop without a selected ancestor is
dropped. After that, parities alternate along every chain of nested
loops, starting with even, so "inside an odd number of loops" equals the
kernel rule, and the scene needs no depth field. Containment among the
selected loops is decided with a bounding-box test followed by a
point-in-polygon test of one vertex (loops never cross,
`packages/core/src/cad/loops.ts:376-378`). Body bounds use the kept loops.

Failed and suppressed features contribute nothing and their bodies pass
through unchanged, as in the evaluator
(`design-docs/specs/design-cad3d.md:597-598`). A body whose creator is
hidden (`visual.hidden`) is left out, as the STL export and the 2D exports
skip hidden elements (`apps/desktop/src/shell/export-handlers.ts:192-196`).
The function receives the whole document's elements because a PCB
reference reads the board's page. Mesh payloads are decoded by an injected
`decodeMesh`, the pattern of the evaluator
(`packages/core/src/cad/evaluate.ts:34-36`); the CLI passes the NMESH
decoder (`packages/io/src/nmesh/index.ts:7-8`).

`prepareCadCapture(elements, pageId, request)` in
`packages/core/src/capture/cad-request.ts` is the one place that turns a
request (camera, size, theme, interference options) into the model, the
camera and the scene bytes. The CLI and the desktop both call it, which is
what makes their pictures equal.

### 6.2 Camera

Orthographic only in the slice: lengths in the picture are proportional to
lengths in the model, every ray has the same direction (which the
evaluator exploits, section 6.4), and the fit is exact arithmetic.

The world is Z-up (fact 9). A camera is three unit vectors `right`, `up`,
`forward` (the direction of view), the world point at the image centre and
millimetres per pixel.

| `--view` | forward | up |
| --- | --- | --- |
| `iso` | (-1,-1,-1), normalised | +Z |
| `front` | +Y | +Z |
| `back` | -Y | +Z |
| `right` | -X | +Z |
| `left` | +X | +Z |
| `top` | -Z | +Y |
| `bottom` | +Z | -Y |

`iso` looks from the octant the viewport opens in
(`packages/ui-solid/src/cad/camera3d.ts:132-138`): it shows the faces that
`top`, `back` and `right` show, not the face that `front` shows. The help
says so and names `--direction 1,1,-1` for the front-left-top corner. A
named view is its integer vector passed through the same normalisation as
`--direction`, so `--view iso` and `--direction -1,-1,-1` give equal
bytes. `--direction x,y,z` gives `forward` directly; `--eye x,y,z` gives
`forward = target - eye`, where `--target` defaults to the centre of the
model bounds.

Default `up`: +Z, except when the normalised `forward` has `|x| <= 1e-9`
and `|y| <= 1e-9` (a view along the Z axis); then it is +Y for a view
down (`forward.z < 0`) and -Y for a view up, so `--direction 0,0,1` equals
`--view bottom` and `--direction 0,0,-1` equals `--view top`. `up` is made
perpendicular to `forward` (`right = normalize(forward x up)`,
`up = right x forward`). A zero vector or an `up` parallel to `forward` is
a usage error. Only `+ - * /` and `sqrt` are used, so Boa, JavaScriptCore
and V8 produce the same doubles (the rule of
`impl-plans/active/cad3d-00-overview.md:80-84`).

Fit: project the eight corners of every body's conservative box on `right`
and `up`; the image centre is the centre of that rectangle (or the
projection of `--target`), and `mmPerPixel = max(spanX / width, spanY /
height) * 1.08 / zoom`. The fit is conservative after cuts, never too
tight. `--target` moves the centre and `--zoom` changes the scale without
a new fit, so either can push part of the model out of the picture; the
`frame:` line of section 4.2 reports `cropped` when a projected box corner
lies outside, and the `camera:` line prints the centre.

### 6.3 Scene bytes (NCS1)

The scene crosses the host boundary as one byte array, written by
`packages/core/src/capture/scene-binary.ts` and read by the Rust module
`scene`. Little endian; reals are IEEE 754 doubles, copied as typed-array
bytes so that no number passes through text. The writer checks that the
platform is little endian and fails otherwise.

```
offset size field
0      4    magic "NCS1"
4      2    version = 1
6      2    flags = 0 (a reader rejects any set bit)
8      4    width      12  4  height     16  4  supersample (1, 2 or 3)
20     4    toolCount  24  4  bodyCount
28     4    options: bit 0 analyse interference, bit 1 draw the overlay
32     4    analysis budget in million weighted rays (1..256; 0 when bit 0
            is clear)
36     4    zero
40     104  camera: right[3], up[3], forward[3], centre[3], mmPerPixel
144    8    interference tolerance in mm
152    8    target sampling cell in mm (0.01..10)
160    16   colours: background, body, edge, interference (RGB each),
            reference opacity (0..255), 3 zero bytes
176         tools, then bodies
tool:  u32 kind, u32 count
  kind 0 prism: count = loopCount; o[3], u[3], v[3], n[3], t0, t1
       (14 doubles); per loop: u32 pointCount, u32 zero,
       2*pointCount doubles (x, y), pointCount u32 face ids (edge i runs
       from point i to point i+1), one zero u32 when pointCount is odd
  kind 1 mesh:  count = vertexCount; u32 triangleCount, u32 zero,
       3*vertexCount doubles, 3*triangleCount u32 indices, one zero u32
       when that number is odd
body:  u32 flags (bit 0 reference, bit 1 takes part in the interference
       analysis), u32 stepCount,
       per step: u32 op (0 union, 1 difference, 2 intersection), u32 tool
```

Every field starts on a multiple of 8 bytes or directly follows a 4-byte
field of the same record, so arrays can be copied as whole typed arrays.

Face ids: 0 is the start cap, 1 the end cap, 2 + k the k-th distinct source
entity of the tool; a circle or arc therefore is one face although it is
many edges, the naming of the viewport
(`packages/core/src/cad/tool-solid.ts:8-20`). Reader rules are in
section 11.

The reply is `u32 length`, that many bytes of JSON, then the image. The
JSON is written by hand with fixed number formatting: `width`, `height`,
`bodies` (per body `state`: `drawn`, `hidden`, `outside`, `empty` or
`unknown`; `emptiedByStep`; `open`), `analysis` (`cell`, `candidates`,
`checked`, `unchecked`, `uncheckedCount`, `cappedCount`, `budget` in
weighted rays, `cappedWithoutHit` as index pairs), `pairs` (`a`, `b`,
`volume`, `min`, `max`, `source`, `capped`). These keys, in this order, are
the contract between the crate and `packages/core/src/capture/report.ts`
(revision 4 fixes them as written by `be8fa5d`); the picture-pass state
`absent` exists only before the census of section 6.7 resolves it (until
M23 wires the census, the text prints it as `[not in the picture]`, the
M9 note).

### 6.4 Ray intervals

For a ray `P + s * forward` (smaller `s` is nearer the viewer) and a prism
with frame `(o,u,v,n)`, span `[t0,t1]` and loops:

1. Slab: with `dz = forward . n` and `z0 = (P - o) . n`, the ray is between
   the caps for `s` between `(tlo - z0)/dz` and `(thi - z0)/dz`; if
   `|dz| <= 1e-12` the ray is inside the slab for all `s` or for none.
2. Column: in sketch coordinates the ray is the line `(x0,y0) + s*(dx,dy)`.
   Each loop edge is crossed when its end points lie on different sides of
   that line; the test `(ca > c0) != (cb > c0)` on the signed offsets is
   half open, so a line through a vertex counts once. The sorted crossing
   parameters pair up into the intervals where the projection is inside an
   odd number of loops, which is the tool's region after the normalisation
   of section 6.1. If `dx*dx + dy*dy < 1e-18` (the view is along the
   extrusion) the projection is a point and a crossing count along +x
   decides inside or outside.
3. The prism's intervals are the column intervals clipped to the slab.
   Caps need no polygon test and nothing is triangulated.

All rays of a camera share `(dx,dy,dz)`. Per tool and camera the edges are
bucketed once by their offset range, so a ray tests only the edges of one
bucket. The bucket count starts at one per edge (at most 4,096) and is
halved until the table holds at most `4 * edges + 4096` entries, so a loop
of long zig-zag edges cannot make it quadratic.

A body's intervals are the fold of its steps over the tool intervals with a
sweep over the two boundary lists (union, difference, intersection). Every
boundary keeps its tool and face id. Boundaries closer than 1e-7 mm are
merged: a cut that starts on the face it was sketched on must not leave a
skin, and coordinates are on a 1 nm grid within 10 m
(`design-docs/specs/design-cad3d.md:603-605`), far above double rounding at
that size.

A closed mesh contributes the intervals between its sorted crossings; the
triangles are binned once per camera in a grid over the picture, with the
same bound on table entries.

### 6.5 The picture

Per sample: the nearest boundary over all bodies gives depth, body, tool
and face. Bodies are visited in history order and a later body replaces
the current nearest only when it is nearer by more than 1e-7 mm, so two
bodies with coincident faces cannot alternate between samples.

- Shading: the face normal (cap: `n`; side: perpendicular of the edge in
  the sketch plane; mesh: triangle normal), turned toward the viewer, and
  a fixed light `l = normalize(0.8*forward + 0.3*right - 0.5*up)`; colour
  = body colour * `(0.42 + 0.58 * max(0, -n . l))`.
- Edges: a sample is an edge when its right or lower neighbour differs in
  body, tool or face id. Between two samples with the same three ids it is
  an edge only when the surface bends or breaks there: the two normals
  differ by more than 30 degrees (`na . nb < 0.8660254037844386`, the
  crease rule of the viewport, `design-docs/specs/design-cad3d.md:621-622`),
  or the chord `c` between the two surface points leaves the tangent plane
  of either sample by more than half its length (`(c . n)^2 > 0.25 * c . c`),
  which is an occluding contour inside one curved face. Two samples on one
  planar face have equal normals and a chord inside the plane, so a face
  is never drawn as an edge, whatever the viewing angle. (Revision 1 used
  an absolute depth step; the spike reproduces the reviewer's case: seen
  from 8.5 degrees above the plate, 44.7% of the body samples were edge
  samples with the old rule and 3.4% with this one,
  `tmp/capture/spike/r2.log`, `r2-graze-old.png`, `r2-graze-new.png`.)
- Reference bodies (`cad.pcb`): their colour is mixed at 45% over whatever
  lies behind (fact 9).
- Interference overlay: section 6.6.
- Anti-aliasing: 2 x 2 samples per pixel, averaged. The factor is fixed,
  never chosen from elapsed time.
- Work is done in bands of rows on up to eight threads; a pixel depends
  only on its own ray and its neighbours, so the bytes do not depend on
  the thread count.

Theme. The four colours are the canvas-mode tokens the viewport uses
(fact 14), for the mode chosen by `--theme`:

| Use | Token | Light / dark |
| --- | --- | --- |
| Background | `--nodetto-canvas-bg` | `#f6f4ee` / `#15191b` |
| Body | `--nodetto-canvas-ruler-surface` | `#fffdf8` / `#1f2427` |
| Edges | `--nodetto-canvas-ruler-text` | `#596366` / `#a3adb1` |
| Interference | `--nodetto-canvas-overlay` | `#335c67` / `#5fb4c7` |

No token is added. The values are mirrored in
`packages/core/src/capture/theme.ts`, and a test reads
`apps/desktop/src/styles/canvas.css` and fails when a value differs; there
is no fallback value. The capture modules take the theme as an argument
and read no appearance state. The overlay token is the canvas accent for
selection and preview (`design-docs/specs/design-cad3d.md:434`); a still
picture has neither, so the colour is unambiguous there.

### 6.6 Interference

Definition: two distinct bodies interfere where both are solid along a
stretch longer than the tolerance (0.001 mm, the display quantum of
`design-docs/specs/design-cad3d.md:603-605`). Faces that only touch do not
interfere. Reference bodies take part: a board inside an enclosure wall is
the case the PCB reference exists for. Curved faces are facets with a
chord tolerance of 0.01 mm (`packages/core/src/cad/tessellate.ts:4-5`), so
a pin in a hole of exactly its diameter can be reported with a sliver
volume of that order; the help states this.

Revision 1 sampled a fixed 128 x 128 lattice over the overlap of the two
bodies' boxes. The reviewer's case shows why that is not enough: a 1.5 mm
pin through a 200 mm cover lies between the lattice rays on all three
axes, and the spike confirms a reported volume of 0 for it and for two
variants (`tmp/capture/spike/r2.log`, lines `r1-method`). The analysis now
ties the resolution to millimetres and to the features.

Analysis (independent of the camera):

1. Candidates are all pairs of bodies that take part (all bodies, or
   those named by `--interference-bodies`; open meshes never) whose
   conservative boxes overlap by more than the tolerance on all three
   axes. The candidate box `P` is that overlap.
2. Cell. For a cell size `c`, a candidate needs on each axis a lattice of
   `n = clamp(ceil(extent / c), 16, 1024)` rays per side of the box
   cross-section. `c` starts at the target cell (0.25 mm, or
   `--interference-cell`) and is doubled, for all candidates together,
   until the level-0 work of all candidates fits the budget (24 million
   weighted rays). A ray of a candidate weighs `max(1, ceil(steps / 8))`,
   where `steps` counts the steps of the two bodies that survive the
   filter of step 3, so a pair with a 600-hole plate is sampled more
   coarsely instead of taking longer. The weight is an upper bound for
   rays that skip more steps inside the candidate box. Report the
   weighted ray budget in the analysis JSON. If the minimum lattice
   (768 rays per candidate) does not fit, check the candidates that fit
   in history order and report the rest by name.
   There is no fixed pair limit. Candidates are enumerated without
   storing more than can be checked plus the 256 that are listed; the
   rest are only counted.
3. Level 0. For each axis, one ray through the centre of every lattice
   cell; only the two bodies are evaluated, and of their steps only the
   unions and differences whose tool box meets `P` and every
   intersection (an intersection whose tool is elsewhere empties the
   body there). A ray hits when the two bodies' intervals overlap
   by more than the tolerance. For a volume ray in a prism cap or side
   plane, choose the same side in world coordinates even if the sketch
   frames point in opposite directions. Surface shading retains its
   original boundary rule.
4. Refinement. A level-0 cell is replaced by `m x m` sub-rays when
   - its hit state differs from one of its four neighbours (`m = 8`): the
     boundary of the region, for the volume; or
   - it meets the projected box of a small loop: a loop of any tool of
     either body, union, difference or intersection alike, whose projected
     box is narrower than four cells in a lattice direction. Then
     `m = clamp(ceil(8 * cell / loop side), 8, 64)`, so the loop is
     sampled at one eighth of its size or finer. This is what finds a pin
     that is added, a pin that a ring-shaped cut leaves standing, and a
     peg of the other body.
   Reserve small-loop cells in X, Y, Z order before using any allowance
   for boundary-only cells. Sample cells in row order within each
   priority. A candidate can use at most 2,000,000 refinement rays per
   axis. The analysis budget also caps weighted refinement rays in
   total. Each candidate receives an allowance in proportion to its
   level-0 work before the threads run. Unrefined cells keep their centre
   sample. When every sub-ray in a refined cell misses, preserve a hit
   from its centre. A truncated pair is marked `capped`, and the report
   counts it even if it produced no hit. The whole analysis costs at
   most twice the budget. Within a ray, skip a union or difference step
   when its projected box does not contain the ray.
5. Result. A pair interferes when any axis has a hit. Its volume on an
   axis is the sum over leaf cells of overlap length times leaf area; the
   reported volume is the mean of the axes that hit; the box is the union
   of the hit leaves and their overlap stretches, rounded to 0.001 mm.
6. Work outside the ray count (revision 4). The ray budget bounds the
   whole analysis only if the setup does not grow with the pair count.
   Tool views (the bucketed edges of section 6.4, and the mesh grids of
   M11) are therefore built at most once per tool and axis, lazily, and
   shared read-only by every candidate and worker; at most three per tool
   exist.

   Memory and ray accounting of one axis. Level 0 is cast row by row into
   a window of three rows of stretches; the decision for a cell (keep the
   coarse stretch or refine) is taken once its own row and both neighbour
   rows are cast, so the boundary rule of step 4 sees the same neighbours
   as before, and cells are decided in the same row order with the same
   small-loop reservation and allowances. Working memory is therefore
   proportional to the lattice width, not its area. No ray is cast twice:
   the coarse stretch stays in the window until its cell is decided, so a
   centre witness needs no re-cast. Every cast is charged: level-0 rays
   count once each, a refinement is charged `m * m` against the per-axis
   cap and the candidate's weighted allowance before its sub-rays are
   cast, and a refinement that does not fit is not cast (the cell keeps
   its coarse stretch and the pair is `capped`). A cell's volume and box
   are committed only after that choice, from the retained leaves only:
   the sub-ray leaves when one of them hits, else the coarse leaf; a
   replaced coarse stretch never enters the box. Results are those of
   storing the whole level-0 record, in the same deterministic order.

   Inputs. `plan` returns either a finite cell or the minimum-grid marker
   (today `f64::INFINITY`), which means 16 rays per side; it is a valid
   result, not an error. Work accounting and sampling read the marker the
   same way (16 per side), the candidates in the history-order prefix
   that fits are sampled and reported like any other, and the reported
   cell is the finite physical side actually used (box extent / 16,
   rounded up to 0.001 mm). Invalid inputs are separate: a target cell
   passed to `plan` that is NaN, not positive or not finite gives no
   checked candidate (all are listed as unchecked) and returns at once; a
   lattice request with an axis outside 0 to 2, an empty or inverted box,
   a NaN coordinate, or a cell that is NaN or not positive (the marker is
   allowed) gives an empty sample with zero rays. Nothing panics, loops
   without end or divides by zero, because later modules call these
   functions with values the scene reader has not checked.

   M10 regressions for these rules: an allowance exactly equal to the
   cost of the first refinements (the counted rays equal level 0 plus
   that allowance, never one more); a coarse hit whose replacement
   sub-rays hit only inside the cell (the reported box is the sub-ray
   footprint, smaller than the coarse cell); a centre-only witness (all
   sub-rays miss, the pair is still reported); the existing 2,000-body
   minimum-grid test (`candidate_table_bounds_and_unchecked_order`,
   `crates/capture/tests/interference.rs:440-464`) keeps its assertions
   and gains new ones: all 1,302 checked candidates are sampled and
   reported as hits, the unchecked order is unchanged, and the cell is
   finite; invalid target cells (NaN, 0, negative,
   infinite) and invalid lattice requests return at once. The Plate
   result (590.404 mm3) and the M8 digest stay pinned.

Guarantee, printed with every result: the cell `c`, the largest level-0
cell side used on any checked pair (`cell 0.25 mm`; larger when the
budget forced it or a box is wider than 1024 cells). An interference is
always found when, seen along X, Y or Z, it contains an axis-aligned
square of side `c` over which the overlap is longer than the tolerance. Below that
size, refinement samples around sketch loops smaller than four cells
(step 4). A capped pair may miss such an overlap. A sliver between large
faces thinner than `c` in two directions can also be missed. Report the
cell rounded up to 0.001 mm so it remains an upper bound. The help and
`docs/capture.md` state these limits.

Spike (`tmp/capture/spike/r2.log`, one thread, cell 0.25 mm unless noted):

| Case | Exact mm3 | Revision 1 | This analysis | Rays, time |
| --- | --- | --- | --- | --- |
| 1.5 mm pin added to a 200 mm plate, inside a 200 mm cover | 8.822 | 0 | 8.852 (+0.3%) | 684,544, 58 ms |
| The same pin left standing by a ring-shaped cut | 8.822 | 0 | 8.852 (+0.3%) | 684,544, 38 ms |
| 0.8 mm peg of the other body, off centre on a 300 mm part (cell 0.29 mm: 1024 cells per side) | 1.506 | 0 | 1.502 (-0.3%) | 1,092,608, 47 ms |
| The pin cases at cell 4 mm (loop refinement only) | 8.822 | 0 | 8.763 (-0.7%) | 37,012, 1.3 ms |
| Plate and Block of the fixture | 637.362 | 639.9 | 636.5 (-0.1%) | 29,808, 7.8 ms |

Picture. A sample is marked when two distinct bodies that take part
overlap along its ray by more than the tolerance. Text and picture are
kept consistent by construction: after the picture pass, every pair that
marked a sample and is not yet in the result is analysed in the box of
its marked samples (steps 3 to 5 with that box as `P`) and added with the
source `view`; the text shows it with `(found in the picture only)`. If
the lattice finds nothing in that box (a sliver below every cell), the
pair is still listed, with the box of the marked stretches and `volume
under 0.001 mm3`. So no stripe exists without a text line. The camera
can therefore add pairs to the text, never remove one; without such
sub-cell cases the text does not depend on the camera. The marking is
bounded: on one ray only the eight nearest bodies with material are
compared, and at most 4,096 pairs that the analysis did not report may
mark samples; a scene that exceeds this fails with a message that names
`--interference-bodies` and `--no-interference`.

Marked samples are drawn over the shaded picture, also where another body
is in front, as a flat hatch: diagonal stripes 8 samples wide that
alternate between the interference colour and the body colour, inside an
outline of the interference colour. The hatch does not depend on the
shade of the face underneath; its two colours have a contrast of 7.2:1
(light) and 6.6:1 (dark), and the theme test requires at least 3:1.
(Revision 1 blended the overlay with the shaded face, which left about
1.4:1 on the darkest faces.) The spike pictures
`tmp/capture/spike/r2-iso-new.png` and `r2-graze-new.png` show it. The
hatch replaces the shading where it is drawn, so a large interference (a
part placed wholly inside another) covers the geometry there; the help
names `--no-interference` for an unobstructed picture of the same view.

### 6.7 Differences from the kernel result

- Emptied bodies. In the kernel path every boolean step whose result is
  empty fails with `cad.result.empty`
  (`packages/core/src/cad/evaluate.ts:211-212,430-434`), the body stays
  as it was (`:671-685`), and features that depend on the failed one fail
  too. The capture applies the step. The body is then gone from the
  picture, or, when a later feature adds material again (Plate, a cut
  that removes all of it, then a boss), the picture shows only what came
  afterwards while the app shows the plate with the boss. Neither may
  look like a clean result, so the rule is applied per step, as the
  kernel applies it:
  - Liveness. For every body and every step, "some ray has material
    after this step". The picture pass records it for all its rays while
    it folds the steps. A body is suspect when a difference or
    intersection step of it has no such ray; a body without material on
    any picture ray is suspect in all steps.
  - Confirmation. Suspect bodies are sampled with the lattice of section
    6.6 (steps 2 to 4, with the body's own box as `P`, "material" in
    place of "overlap", liveness per step), because the picture may
    simply not reach the material (a close-up, a body out of frame). The
    sampling of a body stops as soon as every step is alive. It has its
    own budget of the same size as the analysis budget and covers at
    most 4,096 bodies, in history order; bodies beyond that are
    `unknown` and no claim is made about them.
  - Result. The first step of a body after which neither the picture nor
    the lattice has material is reported as an error line with the code
    `cad.result.empty (sampled)` that names the feature and says that the
    app rejects it and keeps the body (section 4.2); `errors:` is then
    not 0. Only the first such step is reported: before it the capture
    and the app agree, after it they do not, so later steps cannot be
    judged. This holds whether or not the body has material at the end.
  - State of a body, independent of what hides it: `drawn` (it is the
    nearest solid on some sample; translucent reference bodies and open
    meshes in front do not hide it), `hidden` (material on a sample ray,
    never nearest), `outside` (no material on a sample ray, the lattice
    finds some), `empty` (none at the end), `unknown`. A body that has
    material at the end but an emptying step before carries the note
    `[differs from the app, see errors]`.
  Reproducing the app's behaviour (skip the feature and fail its
  dependents) needs a second evaluation and is a later phase.
- An open mesh has no solid in the app. The reader checks that every edge
  is shared by exactly two triangles; a mesh that fails is drawn as a
  surface with reference styling, steps on it are not applied, it takes no
  part in interference, and the text says so.
- Curved faces are faceted with the tessellation of the core
  (`packages/core/src/cad/tessellate.ts`), as in the app.
- Kernel limits and failures (`cad.limit` on triangles, `cad.kernel.failed`)
  do not exist here.
- A page with sketches and no body cannot be captured in the slice; the
  message says what is missing (section 12). Drawing sketches is a later
  phase.

## 7. Formats, sizes, determinism

- PNG: 8-bit RGB for 3D, written with explicit `Compression::Balanced` and
  `Filter::Adaptive` so a crate default cannot change the bytes [S-12]; 2D
  keeps the RGBA output of the existing renderer.
- JPG: baseline, quality 90, 4:4:4 sampling (4:2:0 smears thin coloured
  lines), fixed Huffman tables, no metadata. 2D pictures are flattened on
  the background colour first. Spike: for the reference picture PNG is
  41,491 bytes and JPG at quality 85 is 50,108 bytes, so PNG is the
  default and JPG exists because it was asked for.
- Size limits: section 4.1. The 3D limits bound memory to 2048 x 2048 x 4
  samples processed in bands.
- 3D determinism: the same scene bytes give the same image bytes on every
  run, thread count and supported platform (little endian, IEEE doubles,
  no fused multiply-add in Rust, only `+ - * /` and `sqrt`). Tests: equal
  bytes for 1, 2 and 5 threads; a committed digest of the pixel buffer of
  a fixture scene; equal files from two runs of the binary.
- 2D determinism: the same document, options, binary and fonts give the
  same bytes (`apps/cli/src/help.ts` already states that PNG depends on
  fonts). Test: two runs give equal files.
- The text output contains no time and no random value. The interference
  text is computed from the model alone; the camera can only add a pair
  that the picture's own rays found (section 6.6).

## 8. Architecture

### 8.1 Modules

| Module | Location | Role |
| --- | --- | --- |
| `capture/raster-fit.ts` | `packages/core/src` | 2D scale rule |
| `capture/camera.ts` | `packages/core/src` | Views, basis, fit |
| `capture/scene.ts` | `packages/core/src` | Kernel-free CAD model |
| `capture/scene-binary.ts` | `packages/core/src` | NCS1 writer; imports types only |
| `capture/theme.ts` | `packages/core/src` | Token mirror |
| `capture/cad-request.ts`, `capture/report.ts` | `packages/core/src` | One function from request to scene bytes; report type and parser |
| `capture/describe.ts` | `packages/core/src` | Body, error and interference text shared by CLI and desktop |
| `capture-command.ts`, `capture-cad.ts` | `apps/cli/src` | Arguments, page choice, 2D and CAD pipelines |
| `capture-interference-options.ts` | `apps/cli/src` | The four interference options: parsing, ranges, exclusions, the `--fail-on-interference` exit rule (pure; registered by `capture-command.ts`) |
| `capture-help.ts`, `capture-help/*.ts` | `apps/cli/src` | Help page assembled from one part per topic |
| `capture-io.ts`, `capture-backend.ts` | `apps/cli/src` | Bun host: capture directory, exclusive write, digest, 2D rasterizer |
| `mcp-image.ts` | `apps/cli/src` | Inline image decision for MCP results |
| `nodetto-capture` | `crates/capture` (new workspace member) | `scene` (reader), `interval`, `view`, `prism`, `tool_view`, `mesh`, `tiles`, `raster`, `shade`, `overlay`, `lattice`, `interference`, `census`, `report`, `flatten`, `encode::{png,jpeg}` |
| host operations | `apps/cli/native/src/engine.rs` | `captureDir`, `captureAbsolute`, `writeCapture`, `digest`, `captureEncode`, `captureSolid` |
| Tauri command | `apps/desktop/src-tauri/src/capture.rs` | `capture_solid` |

`encode` depends on nothing else in the crate and takes pixel buffers
only; `scene-binary.ts` and the Rust reader are the two ends of one
format. Either can be moved to a library without the rest.

### 8.2 The Bun reference host

The Bun CLI stays the regression reference
(`design-docs/specs/native-hosts.md`). It runs `capture` for 2D pages as
PNG through its existing renderer. For JPG and for CAD pages it has no
implementation and fails with exit 2 and a message that names the native
`nodetto-cli`. Those paths are tested in Rust (`cargo test`) and against
the release binary (`mise run test-cli`); command logic is tested in Bun
with an injected backend, the seam `export` already has
(`apps/cli/src/export-command.ts:107-123`).

### 8.3 Merging with cad3d M18 and M21

New code is in new files and directories. Shared files get small additive
edits: `apps/cli/src/help.ts`, `cli.ts`, `commands.ts`, `native-engine.ts`,
`apps/cli/native/src/engine.rs` and `mcp.rs`, `packages/core/src/index.ts`
(one export line; `packages/core/src/cad/index.ts` is not touched), the
root `Cargo.toml`, `docs/cli.md` (one new section at the end),
`THIRD_PARTY_NOTICES.md` (one new section at the end). M18 edits
`packages/core/src/svg-export/document.ts`, `docs/cli.md` in the 3D CAD
section, `README.md` and `impl-plans/README.md`; the only common files are
`docs/cli.md` and `impl-plans/README.md`, in different places. The capture
of a CAD page does not call the SVG serializer (section 5).

Merge checks, to be run when the branches meet: the overview line count
(`apps/cli/src/ai-commands.test.ts`; this plan leaves one line of
headroom, section 4.4), and the octant of the M18 wireframe against
`--view iso` (section 6.2). After the merge `export` of a CAD page gives
the M18 wireframe and `capture` the shaded solids; `docs/capture.md`
states the difference.

### 8.4 Base repair

Fact 16 makes every command that type-checks fail. M1 applies the two
hunks of commit `75d239b` for `packages/core/src/cad/check.ts` and
`packages/io/src/jsonl/cad-format.test.ts`, byte for byte (the patch is
`impl-plans/active/capture-base-repair.patch`). Identical changes on both
branches merge without conflict. Nothing else of M21 is taken. With the
patch applied, `bun run typecheck`, `bun run lint:ts` and the CAD tests
pass (`tmp/capture/design/`).

### 8.5 Completion order and file ownership (revision 4)

M1 to M9, M13 and M19 are accepted; M10 is implemented at `be8fa5d` and
reviewed in revision 4. The remaining work was a chain M20, M17, M18,
M11, M12 whose links mostly handed over shared files, not data. Revision
4 runs it as two waves of plans that write disjoint files, one wiring
milestone that is the last writer of the shared registration files, and
the closing milestone M16. Ids stay stable; the two new milestones take
M22 and M23 (21 is skipped so it is not confused with cad3d M21).

| Stage | Milestone | Owns (writes) | Uses |
| --- | --- | --- | --- |
| Wave 1 | M10 repair | `lattice.rs`, `interference.rs`, `prism.rs`, Rust `report.rs` and `raster.rs` only where the repair needs them, `tool_view.rs` (new), `lib.rs` (module lines), empty `overlay.rs`, `census.rs`, `mesh.rs`, `tiles.rs` declared `pub mod`, `tests/interference.rs`, `tests/render.rs` (report assertions only) | `be8fa5d` |
| Wave 1 | M20 request and options | `cad-request.ts` and test (the request shape below, the draw-bit rule, `DEFAULT_CAD_INTERFERENCE`), `apps/cli/src/capture-interference-options.ts` (new) and test, `packages/io/src/nmesh/capture-decoder.ts` (new: `decodeCaptureMesh`) and test, `packages/io/src/nmesh/index.ts` (one export line) | report contract of 6.3 |
| Wave 1 | M22 report text | TS `report.ts` and test (all 6.3 keys, mapping wire `capped` to public `approximate`), `describe.ts` (new: `describeInterference`, `describeBodies`) and test, `packages/core/src/capture/index.ts` (one export line), `capture-help/interference.ts` (usage and body, including the overlay and capped sentences) | report contract of 6.3 |
| Wave 1 | M15 desktop dialog | the M15 files except `apps/desktop/src/App.tsx` | crate public API, existing core types |
| Wave 2 | M17 overlay | `overlay.rs` (marking table, eight-nearest rule, 4,096 limit, hatch colour, view-pair boxes), `interference.rs` (`add_view_pairs`) | M10 |
| Wave 2 | M18 census | `census.rs`, `lattice.rs` (one-body mode with per-step liveness and early exit), `capture-help/cad.ts` (body notes and the two M11 sentences on meshes and reference bodies) | M10 |
| Wave 2 | M11 meshes | `mesh.rs`, `tool_view.rs` (mesh arm), `scene.ts` and test (decoder option of `buildCadCaptureModel`), `cad-request.ts` and test (forward `decodeMesh` to the model builder; nothing else), `lattice.rs` and `interference.rs` (tool-bounds call sites only, CAP-R4-05) | M10, M20, after M17 and M18 |
| Wave 2 | M12 tiles | `tiles.rs` (lists, `work`, `WORK_LIMIT`) | M10 |
| Wave 2 | M14 desktop backend | the M14 files plus `apps/desktop/src/App.tsx` (the M15 wiring) | M15, M20, M22, crate public API |
| Wiring | M23 | crate `lib.rs`, `raster.rs`, `shade.rs`, `report.rs`; `tool_view.rs` (picture-family constructor and facet dispatch); `mesh.rs` (additive facet-normal seam only, CAP-R4-06); `tests/render.rs` (the digest constant and the superseded assertions named below, nothing else); new `tests/overlay.rs`, `census.rs`, `mesh.rs`, `scale.rs`; `capture-command.ts`, `capture-cad.ts` and tests; `__fixtures__/capture-plate-default.ncs1`; `native-parity/capture.test.ts`; `apps/desktop/src/shell/export-handlers.test.ts` (new cases only: fixture equality and mesh-only parity) | M17, M18, M11, M12, M14, M20, M22 |
| Closing | M16 | docs, design measured values, progress table | M23 |

Contracts that make the waves possible:

- `tool_view` is the one crate-internal place that turns a tool into
  intervals for a ray family: a closed enum with a prism arm (M10) and a
  mesh arm (M11), offering intervals, bounds, average occupancy, the
  small-loop boxes (none for a mesh) and whether the tool is a solid.
  `lattice` and `interference` evaluate tools only through it, so meshes
  enter the analysis and the census when M11 lands without M11 editing
  those files (deviation CAP-R4-05: M10 still took the tool bounds of the
  pair code from the small-loop boxes, so M11 routes those call sites to
  `tool_view::tool_bounds`); candidates skip a body whose creating tool is not a solid
  (an open mesh). Until M11 the mesh arm keeps today's behaviour (no
  intervals, not a solid). M23 routes the picture pass through it.
- Wave 2 modules are complete units with their own unit tests
  (`#[cfg(test)]` inside the module, scenes built in code, synthetic
  picture liveness for the census). Their contract items are `pub`, so
  they compile without dead-code warnings before M23 calls them. All
  render-level and native tests of M17, M18, M11 and M12 move to M23.
- Request contract, complete after wave 1 (M20), before any consumer runs
  alone:
  `CadCaptureRequest` gains `interference?: { cellMm: number; bodies?:
  readonly string[] } | null` and `decodeMesh?: CaptureMeshDecoder`, with
  `CaptureMeshDecoder = (data: string) => { positions: Float64Array;
  triangles: Uint32Array }` declared in `cad-request.ts`. Draw-bit rule
  (written by `prepareCadCapture`, owned by M20): `interference` absent or
  `null` writes options 0, budget 0 and the analysed flag clear on every
  body, which are the bytes of today's committed fixture; any other value
  writes the analyse bit and the draw bit together (options 3), budget 24,
  tolerance 0.001, the cell and the analysed flags. There is no request
  for analysis without the overlay. `DEFAULT_CAD_INTERFERENCE = { cellMm:
  0.25 }` is exported next to it for both hosts. `decodeCaptureMesh` in
  `@nodetto/io/nmesh` (M20) is the one decoder both hosts pass
  (`toTriangleMesh(decodeNmesh(fromInline(data)))` with positions copied
  to `Float64Array`); both hosts import it from the subpath
  `@nodetto/io/nmesh` (`packages/io/package.json` maps `./nmesh` to
  `src/nmesh/index.ts`, which M20 extends). The package root
  `@nodetto/io` (`packages/io/src/index.ts`, explicit named re-exports) is
  not edited and does not expose it, so no plan owns a root barrel edit.
  Desktop code never imports from `apps/cli`. Until M11 `prepareCadCapture` accepts `decodeMesh` and
  ignores it (meshes stay skipped as today); M11 forwards it to
  `buildCadCaptureModel` and changes nothing else in the request writer.
- M14 calls `prepareCadCapture` with `interference:
  DEFAULT_CAD_INTERFERENCE` and `decodeMesh: decodeCaptureMesh`; its test
  compares the recorded scene with `prepareCadCapture` called with the
  same request for the Plate document. M23 regenerates the fixture and
  asserts in the CLI test and in a new case of the desktop handler test
  that both hosts' scenes equal that call and the fixture; it adds the
  same two-host equality for a page whose only body is a `cad.mesh` cube,
  and checks that `--no-interference` (and `interference: null` on the
  desktop) leaves options 0 while the default sets options 3. Desktop,
  Bun CLI and native CLI stay tied to one set of bytes.
- The picture ignores the draw bit until M23 wires the overlay, so no
  pixel digest changes before M23.
- Approximate pairs. The public `approximate` of a pair is the wire
  pair's `capped`, in text (`, approximate`) and in JSON alike;
  `uncheckedCount` stays the exact total next to the bounded `unchecked`
  list. M22's parser and describe tests cover a report with one capped
  and one complete hit, `cappedCount` 1 and an empty `cappedWithoutHit`.
  M23's fake-backend CLI test asserts that the text and the JSON mark the
  same pair, that `uncheckedCount` exceeds a truncated list, and that the
  exit codes of section 4.2 hold.
- Superseded render assertions. `crates/capture/tests/render.rs:390-411`
  (`references_meshes_and_interference_stay_out_of_the_m8_picture`) pins
  the M8 placeholders that M11 and M18 replace: line 407 (the picture
  equals the picture without the reference prism and the open triangle)
  and lines 410-411 (both bodies `Absent`). M23 is authorised to change
  exactly those three assertions, and no others, in the commit that wires
  reference styling and the census. The commit message states the old and
  new expectations. The replacements must be at least as specific: a
  sample covered only by the reference prism equals the 45% mix of the two
  single-body renders; the reference body is `Drawn`; the open-mesh body
  is `Drawn` with `open` true; and `candidates == 0` and empty `pairs` stay
  asserted (open meshes are excluded from interference). The scene's
  two-thread render is kept. M23 adds a separate no-overlay regression to
  `tests/overlay.rs`: a scene with the draw bit set and no interfering pair
  renders the same as with the bit clear. The cross-worker and
  encoded-image determinism tests of `render.rs` stay unchanged. The
  digest constant changes only as the M17 rule allows.
- `packages/core/src/capture/index.ts` gets its single new line from M22
  in wave 1, not from M23, because M14 imports the text functions through
  `@nodetto/core` in wave 2; no other plan edits it.

Rollout rules for every remaining plan: each plan builds into its own
`CARGO_TARGET_DIR=target/capture-<mNN>` (the native binary is then
`target/capture-<mNN>/release/nodetto-cli`); only M23 and M16 run native
parity tests, and they build the binary in the same command; a timing
test may be retried up to three attempts under machine load and is then
run alone before a failure is reported; no existing test or deadline is
relaxed.

M16 gates. `mise run test-cli` hardcodes `$PWD/target/release/nodetto-cli`
(`mise.toml:50-59`), which is the wrong binary under an isolated target.
M16 therefore runs the same stages explicitly and does not edit
`mise.toml`. The stages are three independent gates, each run to its
end whatever the others return, so a failure in one cannot stop the
parity run:

1. Workspace: `env CARGO_TERM_QUIET=true
   CARGO_TARGET_DIR="$PWD/target/capture-m16" mise run verify`; if Bun
   discovery stalls or runs out of memory on the ignored `tmp/` and
   `target/` folders, the intake fallback replaces it: scoped `bun test`
   over `apps` and `packages`, plus `CARGO_TERM_QUIET=true
   CARGO_TARGET_DIR=target/capture-m16 cargo test --workspace`.
2. Shared native contracts: `env CARGO_TERM_QUIET=true
   CARGO_TARGET_DIR="$PWD/target/capture-m16" cargo test -p
   nodetto-native`.
3. CLI and parity, with build before parity and one binary: `env
   CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m16" sh -c
   'cargo test -p nodetto-cli && cargo build --release -p nodetto-cli &&
   NODETTO_CLI_TEST_BINARY="$CARGO_TARGET_DIR/release/nodetto-cli" bun
   test apps/cli/src'`.

Each gate's command, final exit status and complete log path go under
`tmp/capture/m16/`. Gate 3 must show that the native parity tests ran
against that binary (non-zero parity test count in its log, no skip for a
missing binary). M16 is accepted only when all three gates exit 0 and
gate 3 has that evidence. A nonzero result, including the Foundation
atomic-write denials recorded at M10 (`tmp/capture/m10/workspace-verify.log`
and `native-tests.log`, both exit 101), stays a failure: it may be
retried, with each attempt logged, until a passing run supersedes it.
Otherwise M16 stays unaccepted and the failure is reported as a blocker
with its log. It is never counted as passing.

## 9. Licensing and distribution

| Dependency | Licence | Distributed in | Note |
| --- | --- | --- | --- |
| `jpeg-encoder` 0.7.1 (new) | `(MIT OR Apache-2.0) AND IJG` [S-7]; the published crate carries `LICENSE-MIT`, `LICENSE-APACHE` and `LICENSE-IJG`, and `src/fdct.rs` carries the IJG notice (checked in the registry copy) | native CLI, desktop, Mac App Store build | Default features only. The IJG terms require that documentation of a binary distribution states "this software is based in part on the work of the Independent JPEG Group" [S-13]; no copyleft, no use restriction. The sentence is placed in `THIRD_PARTY_NOTICES.md` and at the end of the `capture` help page, which is the documentation inside the binary |
| `png` 0.18 (already linked by the CLI) | MIT OR Apache-2.0 [S-12] | now also the desktop binary | |
| `jpeg-decoder` (development dependency, tests only) | MIT OR Apache-2.0 | not distributed | |

The web application receives nothing new from this plan. M4 records the
entries and the IJG sentence in `THIRD_PARTY_NOTICES.md`, with the licence
files of the pinned version, and stops with a report if the published crate
shows another licence than the table. No new npm package. The Mac App
Store build gains pure computation only: no entitlement changes.

## 10. Performance

### 10.1 Spike results

Scene: plate 100 x 60 x 5 mm with 60 through holes of 64 edges, a pocket,
a hollow boss, a second body that interferes, a third made by intersect;
66 tools. Picture 1024 x 768, 2 x 2 samples.

| Implementation | Time |
| --- | --- |
| Rust, 1 thread, isometric / top / front | 339 / 297 / 291 ms |
| Rust, 8 threads | 98 / 107 / 102 ms |
| Rust, 606 tools, 1 / 8 threads | 2,177 / 547 ms |
| PNG encode, JPG encode | 5 to 7 ms, 3 ms |
| JavaScript in Bun (no culling) | 3,314 ms |
| JavaScript in Boa, 256 x 192, 1 sample | 11,477 ms (Bun: 70 ms) |
| Native CLI start (`--version`) | 650 ms |
| Native `cad check` of the reference page | 590 ms |
| Interference analysis of a 200 mm pair at cell 0.25 mm, 1 thread | 38 to 58 ms for 684,544 rays (section 6.6) |

The 606-tool row shows that cost grows with the step count even when a
tool is off the ray; M12 adds per-tile candidate lists so a ray visits
only the steps whose tools cover its tile.

### 10.2 Budgets

| Budget | Value | Measured by |
| --- | --- | --- |
| Native capture of the reference CAD page, default options, start to file | under 5,000 ms enforced; about 1 s expected (0.65 s start + render) | M9 native test, value recorded in `tmp/capture/m09/` |
| Render of the reference scene in the crate, one thread | under 2,000 ms | M8 crate test |
| Interference analysis of one 200 mm pair at cell 0.25 mm, one thread | under 500 ms | M10 crate test |
| Interference analysis in total | at most 24 million weighted level-0 rays and as many refinement rays by construction (a weighted ray folds at most 8 steps; about 2 to 5 s on one thread at the limit); pairs run on the render threads; setup bounded by three tool views per tool (section 6.6 step 6) | M10 crate tests of the budget rule, including a 300 mm pair with a 600-hole plate under 2,000 ms and 200 bodies that share one 20,000-point loop (19,900 pairs) under 5,000 ms, both release only |
| Body sampling (section 6.7) | the same budget again, only for suspect bodies; none in a fitted view of a sound model | M18 crate test |
| Native capture of a CAD page with 1,000 elements in 50 bodies | under 10,000 ms | M12 native test |
| Native 2D capture | the class of `export` today (0.66 s for a small page) | M3 native test with the existing 10,000 ms class |
| Scene build for 20,000 elements in Bun | under 1,000 ms | M5 test |

For pages near the 20,000 element limit the time is dominated by loop
building in Boa, which `cad check` already measures at 8.4 to 9.8 s for
10,000 records (`impl-plans/active/cad3d-16-cli.md`, Progress); capture
adds its render time to that and does not change it. No existing deadline
is relaxed. Timing tests that fail are re-run once alone before they are
reported.

Timing assertions and the heavy renders (2048 x 2048, 600 holes, 200,000
triangles) are compiled only without debug assertions, so they run in the
release commands of the plans and not in `cargo test --workspace` of
`mise run test`; the workspace sets `opt-level = 2` for this crate in the
development profile so that the remaining tests stay fast in debug runs.

A work limit protects against pathological scenes. Before rendering, the
estimate is the sum over picture tiles of `samples in the tile * sum of
the weights of the steps listed for it`, where a step's weight is the
average number of entries in a non-empty edge bucket or mesh cell of its
tool (at least 1). Above 4e9 the render is refused with a message that
suggests a smaller `--size`. Bucket and cell tables are bounded by
`4 * entries + 4096` (section 6.4) and the reader bounds the entries
(section 11), so memory is bounded as well.

## 11. Security

- Output: only image extensions; exclusive creation; no replacement
  without `--force`; no writing through links; a per-user capture
  directory whose owner and mode are checked (section 4.3). The command
  writes exactly one file.
- Scene bytes are parsed as untrusted input although the core writes
  them: magic, version, flags and zero padding are checked; every count
  is checked against the remaining length before allocation; limits are
  20,000 tools, 20,000 points per loop, 4,000,000 points in total,
  2,000,000 triangles per mesh, picture sides 64 to 2048, supersample 1
  to 3, analysis budget 1 to 256, cell 0.01 to 10; every real must be
  finite and within 1e7; indices must be in range. Errors are values; the
  crate has no `unsafe` and no panic on any input (a fuzz-style test feeds
  truncated and mutated fixtures).
- Documents: element limits of the CAD design apply before the scene is
  built; nothing from a document is evaluated as code.
- MCP: `--inline` reads only the file the command just wrote, at most
  1 MiB. The server keeps the permissions it has today.
- Resource limits: picture size, work limit with edge and triangle
  occupancy, bounded lookup tables, a budget of weighted rays for the
  analysis, the same again for refinement and for body sampling, a
  bounded candidate table, eight bodies compared per ray and 4,096
  picture-only pairs in the marking pass, 4,096 sampled bodies.

## 12. Failure behaviour

| Situation | Behaviour |
| --- | --- |
| Unknown option, option of the other page family, bad vector | Exit 2, message, help excerpt |
| Page has no visible content | Exit 2 |
| A CAD page has no body | Exit 2: `Page "<name>" has no solid body yet (<n> sketches, <k> features failed). Add an extrude with op "new", or fix the errors below; sketches alone cannot be captured yet.` followed by the error lines |
| Features failed | They are skipped, the picture shows the rest, `errors:` lists them, exit 0 |
| A feature leaves a body without material (at the end, or before a later feature adds some) | Picture as folded, an error line `cad.result.empty (sampled)` that names the first such feature, exit 0 |
| More than 4,096 interfering pairs that only the picture finds | Exit 2, names `--interference-bodies` and `--no-interference` |
| The model is partly outside the picture | `frame: cropped`, exit 0 |
| Target exists with other bytes | Exit 2, names `--force`; nothing written |
| Target is a link; capture directory is a link, belongs to another user, is writable by others or cannot be written | Exit 2 with the message of section 4.3 that names `--output`; nothing written |
| Bun host, JPG or CAD page | Exit 2, names the native CLI |
| Scene rejected by the reader, or work limit exceeded | Exit 2 with the reader's message |
| Candidate pairs do not fit the ray budget | The cell grows and is printed; pairs that still do not fit are listed as not checked; exit 0, or 1 with `--fail-on-interference` |
| Refinement of a checked pair reaches its cap | The pair ends with `, approximate`; the `refinement capped` line of section 4.2; exit code unchanged |
| Write fails | Exit 2; a partly written new file is removed |

## 13. Desktop

On a CAD page the Export dialog gets the entry "3D view image" in the
Artwork group (`packages/ui-solid/src/ExportDialog.tsx:97-111`), enabled
when the page kind is `cad3d` and the native backend is available. It
offers the seven views plus "Current view", PNG or JPG, and writes through
the existing save dialog and byte writer (fact 10). The handler builds the
same model and scene bytes as the CLI through the shared
`prepareCadCapture` (section 6.1), with the theme of the current canvas
mode, and invokes the Tauri command `capture_solid`, which calls
`nodetto_capture::render_scene` on a blocking thread. For equal options
the desktop and the CLI produce equal bytes. The dialog shows the
interference lines of section 4.2 after saving.

"Current view" uses the direction, target and visible height of the
viewport camera (the request field `viewHeight`, which replaces fit and
zoom and has no CLI option); `NodettoCanvas` reports camera changes through a new
optional callback (fact 9). The picture is orthographic also when the
viewport is in perspective; the dialog says so.

2D pages: the Export dialog already offers PNG of the page, selection or
artboard, rasterized by the webview (fact 10). It gains JPG through
`canvas.toBlob("image/jpeg")`. These pictures are not byte-equal to CLI
captures because the rasterizer and the fonts differ, the difference
`docs/cli.md:189-190` already documents.

In a plain browser the native backend is absent; the 3D entry is disabled
with an explanation (section 14). The agent path is always the CLI or the
MCP server on the same file; the app picks up edits through its file
watcher (`docs/cli.md:201-203`).

## 14. Follow-up in the private nodetto-cloud repository (not done here)

1. Hosted web application: 3D capture needs the renderer in the browser.
   Build `crates/capture` for `wasm32-unknown-unknown` (it has no thread or
   file dependency when called with one thread), serve it like the kernel
   WASM, provide the capture backend to the editor, add the JPEG notice.
2. Server-side previews or thumbnails of pages (item 5 of
   `design-docs/specs/design-cad3d.md:1081`) can reuse the scene writer and
   the crate.
3. Agents that work on cloud documents have no local file: an
   authenticated capture endpoint or an MCP server bound to a cloud
   document is cloud work.
4. Storage, retention and access rules for captures made on a server.

## 15. Tests and acceptance mapping

| Acceptance criterion | Where it is verified |
| --- | --- |
| Design and plan with evidence | This document; `impl-plans/active/capture-*.md` |
| One obvious command, defaults, parseable output, MCP, help | M3 (command, help, MCP list), M19 (bounded size), M2 (no silent overwrite, per-user directory), M13 (MCP instructions and inline) |
| Camera, shaded solids with cut and intersect, time budget | M5 (camera, loop rule), M7 and M8 (pixels of cut, intersect, hidden surfaces, grazing views), M9 (native, budget) |
| Interference in text and image | M10 (analysis: pin, peg, enclosure, budget and shared-loop cases), M20 (request, options, exit rule), M22 (text), M17 (marking and hatch units), M23 (overlay in the picture, agreement of text and picture, CLI and native tests) |
| A picture that never hides a modelling error | M18 (census units: the first emptying step of every body as an error, also when material is added afterwards), M23 (picture liveness, body states end to end), M9 (`frame:` line) |
| Imported meshes, reference bodies, large pages | M11 (mesh units, meshes in the analysis), M12 (tile lists and work estimate units), M23 (pictures, work limit refusal, native budgets) |
| Determinism | M4, M8, M9 (3D, including Boa against Bun), M3 (2D) |
| Desktop | M14, M15; section 13 states the 2D difference |
| Existing export and documents keep working | M3 runs the export tests unmodified; M16 runs three independent gates (workspace verify or the scoped fallback, shared native contracts, CLI tests with parity against its isolated binary), all of which must exit 0 (section 8.5) |
| Every milestone accepted by review | Progress table in the overview |

## 16. Risks

| Risk | Mitigation |
| --- | --- |
| Capture and kernel disagree on a degenerate model | Section 6.7 lists the cases; emptied bodies are reported as errors; the exact kernel path stays in the app |
| Interference below the sampling cell that involves no small loop | The cell is printed with every result and stated as the guarantee; `--interference-cell` lowers it; the picture's own rays add what they find to the text |
| Speckles from coincident faces | Boundary merging at 1e-7 mm inside a body and the same tolerance with a fixed order between bodies; tests with a cut that starts on a face, a boss on a face and two bodies with a common face |
| The cad3d branch changes history or loop code before the merge | The scene builder calls the same functions as `cad check`; its tests fail at the merge if a contract moved |
| The cad3d branch adds an overview line | The overview keeps one line of headroom (section 4.4); the merge runs `apps/cli/src/ai-commands.test.ts` |
| The M18 wireframe uses another isometric octant | `iso` follows the viewport; the octant is re-checked when M18 lands and documented either way |
| The Store CLI's temporary directory is not readable by the agent | Help, docs and the failure message name `--output` in the authorized folder |
| Default captures accumulate | Content-named files deduplicate; the directory is temporary; pruning is a later phase |
| Two Rust renderers (2D resvg, 3D own) | They share only the encoder module; each is tested alone |
| After the merge, `export` of a CAD page (wireframe) and `capture` (shaded) differ | `docs/capture.md` states which command shows what |

## 17. External sources

- [S-1] Roth, "Ray Casting for Modeling Solids", Computer Graphics and
  Image Processing 18(2), 1982; summary at
  https://en.wikipedia.org/wiki/Ray_casting
- [S-2] Constructive solid geometry, ray tracing of intervals:
  https://en.wikipedia.org/wiki/Constructive_solid_geometry
- [S-3] OpenCSG, image-based CSG rendering and its limits:
  https://opencsg.org/
- [S-4] Wang, Leung, Chen, "Solid modeling of polyhedral objects by
  Layered Depth-Normal Images on the GPU", Computer-Aided Design 42(6),
  2010 (cited for the method; the abstract could not be retrieved in this
  run)
- [S-5] Onshape interference detection:
  https://cad.onshape.com/help/Content/View/interference_detection.htm
- [S-6] SolidWorks interference detection:
  https://help.solidworks.com/2020/English/SolidWorks/sldworks/c_Interference_Detection.htm
  (options known from search results; page body not retrieved)
- [S-7] jpeg-encoder: https://crates.io/api/v1/crates/jpeg-encoder ,
  https://github.com/vstroebel/jpeg-encoder ,
  https://docs.rs/jpeg-encoder/latest/jpeg_encoder/struct.Encoder.html
- [S-8] Claude Code, working with images:
  https://code.claude.com/docs/en/common-workflows
- [S-9] MCP tools specification, image and resource link content:
  https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- [S-10] Claude Code MCP output limits: https://code.claude.com/docs/en/mcp
- [S-11] Claude vision limits and token cost:
  https://platform.claude.com/docs/en/build-with-claude/vision ; OpenAI
  image input: https://developers.openai.com/api/docs/guides/images-vision
- [S-12] png crate: https://crates.io/api/v1/crates/png ,
  https://docs.rs/png/latest/png/struct.Encoder.html
- [S-13] IJG licence text:
  https://raw.githubusercontent.com/libjpeg-turbo/libjpeg-turbo/main/README.ijg

## 18. Changes in revisions 2, 3 and 4

| Finding | Change | Sections |
| --- | --- | --- |
| CAP-R1-01 | Interference analysis redone: cell in millimetres, refinement around small loops and region boundaries, the cell printed as the guarantee; pairs that mark a picture sample are always in the text; spike on the pin and peg cases | 3.4, 4.2, 6.6, 10 |
| CAP-R1-02 | No fixed pair limit: a ray budget shared by all candidates, unchecked pairs named, `--interference-bodies`, `--interference-cell`, exit 1 with `--fail-on-interference` when a candidate was not checked | 4.1, 4.2, 6.6, 12 |
| CAP-R1-03 | The tool region is the depth rule of the kernel path; loops are normalised so that even-odd is exact | 1.1 fact 7, 6.1, 6.4 |
| CAP-R1-04 | Body states that do not depend on occlusion or framing; an emptied body is an error line that names the feature | 4.2, 6.3, 6.7, 12 |
| CAP-R1-05 | Edge rule based on face identity, normals and the chord against the tangent plane; no absolute depth step; spike at 8.5 degrees | 6.5 |
| CAP-R1-06 | Per-user capture directory with an owner check and a message that names `--output` | 4.3, 11, 12 |
| CAP-R1-07 | M14 depends on M11; milestones that are not ordered by `dependsOn` share no write path (help parts, core basics in M19, interference split into M10, M20, M17, M18), checked pair by pair | 4.4, 8.1, plan overview |
| CAP-R1-08 | Tolerance and fixed order between bodies; bounded bucket tables; work estimate with occupancy | 6.4, 6.5, 10.2 |
| CAP-R1-09 | Boa against Bun scene test, a test count check for the desktop crate, release-only timing tests with an optimised development profile | 10.2, plans M4, M8, M9, M14 |
| CAP-R1-10 | `frame:` line, centre in the camera line, absolute path, one default-up rule with `bottom` | 4.2, 6.2 |
| CAP-R1-11 | Sketch pictures listed as a later phase and a helpful no-body message; facet note; hatch overlay with token contrast | 2.3, 6.6, 6.7, 12 |
| CAP-R1-12 | 2D dark theme note, overview headroom, `iso` note, inline cap note, citations | 1.1, 4.1, 4.4, 4.5, 5, 6.2, 8.3 |
| CAP-R2-01 (revision 3) | The emptied-body rule is applied per step: liveness for every step in the picture pass, confirmed by the lattice for suspect bodies; the first emptying step is an error also when a later feature adds material | 4.2, 6.7, 12, 15 |
| CAP-R2-02 (revision 3) | Budget in weighted rays (steps count), a global refinement budget, a bounded candidate table, a budget and an early exit for body sampling, bounds on the marking pass | 6.6, 6.7, 10.2, 11, 12 |
| CAP-R2-03 (revision 3) | A body behind only reference bodies is drawn; the help names `--no-interference` for an unobstructed picture; the `[not sampled]` note is listed | 4.2, 6.6, 6.7 |
| CAP-R4-01 (revision 4, M10 review of `be8fa5d` against the reference implementation `6280745`, `19c1dbf`) | Changes that `be8fa5d` made to this document are ratified, because each keeps a promise of the analysis that the revision 3 wording broke: small-loop cells are reserved on all three axes before boundary cells (otherwise a pin found on X can be lost on Y and Z once the allowance runs out); a centre hit survives when every sub-ray of its cell misses; a ray in a cap or side plane that two prisms share belongs to one of them by a world-coordinate rule (touching tilted parts are not interference); capped pairs, including those without a hit, and the weighted budget are reported. Their text form is now fixed (4.2, 12) | 4.2, 6.3, 6.6, 12 |
| CAP-R4-02 (revision 4, M10 review) | The ray budget did not bound the analysis: `be8fa5d` builds a prism view per candidate, axis and tool, and keeps a full level-0 record per cell. Tool views are built once per tool and axis and shared; level 0 is streamed through a three-row window, so no ray is cast twice and every cast is charged; public lattice and interference functions are total on any input, and the minimum-grid result of `plan` stays valid. New release test: 200 bodies sharing a 20,000-point loop | 6.6 step 6, 10.2 |
| CAP-DR4-01..06 (revision 4, design review round 1) | Ray accounting and box commit after the leaf choice, with exact-allowance and smaller-box regressions (01); the minimum-grid marker kept separate from invalid input (02); request shape, decoder and draw-bit rule complete in wave 1, two-host mesh-only parity in M23 (03); narrow M23 authorisation for the three superseded M8 placeholder assertions in `tests/render.rs`, with replacements that are at least as specific (04); M16 builds and tests one isolated binary instead of `mise run test-cli` (05); per-pair `approximate` and the exact `uncheckedCount` in public JSON (06); round 2: both hosts import the decoder from `@nodetto/io/nmesh` (03), and M16 runs three independent gates that must all pass, with positive parity evidence (07) | 4.2, 6.6, 8.5, 15 |
| CAP-R4-03 (revision 4) | The fixture's Plate and Block overlap is 590.721 mm3 (one whole, two half and a quarter hole); 637.362 mm3 belongs to the spike scene. The M20 native expectation uses the fixture value | 4.2 |
| CAP-R4-04 (revision 4) | The serialized chain M20, M17, M18, M11, M12 is replaced by two waves, the wiring milestone M23 and the closing milestone M16; a `tool_view` seam lets meshes enter analysis and census without shared edits; the text functions move to M22; the App wiring moves from M15 to M14 | 8.1, 8.5 |
| CAP-R4-05 (revision 4, checkpoint amendment after wave 2) | Deviation from 8.5: M10 moved per-tool bounds into `tool_view`, but the candidate, pair and view-pair code (`interference.rs` and `lattice::sample_axis`) still took tool bounds from the small-loop boxes. Those boxes are empty for a mesh, so a closed mesh could never become a candidate. M11 adds `lattice::scene_tool_bounds` over `tool_view::tool_bounds` and uses it at those call sites only. Prism results do not change, because a prism's `tool_view` bounds are the union of its loop boxes. M11 edits `lattice.rs` and `interference.rs` after M17 and M18. The M15 and M14 desktop build gates now write their output under `target/` instead of `apps/desktop/dist` | 8.5 |
| CAP-R4-06 (revision 4, checkpoint amendment round 2 after the wiring wave) | Deviation from 8.5 ownership: M11 returns every mesh boundary with face id 0 and exposes no hit triangle, so the picture pass cannot take the triangle normal that 6.5 requires for mesh shading and edges. M23 adds an additive seam in `mesh.rs` that mirrors the prism facet pattern (`PrismView::surface_intervals` and `surface`): a facet-encoded `surface_intervals`, a facet-encoded `first_surface_hit` and `surface(facet)` returning face id 0 and the unit triangle normal. The analysis `intervals`, `first_hit`, `is_closed`, `mesh_bounds` and the binning keep their behaviour, so analysis, census and the M11 tests do not change. The mesh face id seen by the edge rule stays 0 | 6.5, 8.5 |
