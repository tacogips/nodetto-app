# AI capture: PNG and JPG pictures of any page, with 3D CAD camera and interference

Status: design revision 5, base commit `ebcac57`, branch `feat/ai-capture`
(revision 4 checked against `be8fa5d`; amended after `e883b4b` for the
remaining M23 and M16, CAP-R4-07 to CAP-R4-10; revision 5 checked against
the M23 checkpoint `e43016d`, CAP-R5-01 to CAP-R5-04; revision 6 checked
against the M23 checkpoint `94c780d`, CAP-R6-01 to CAP-R6-07, splits the
remaining M23 work into sub-plans M23a to M23f; revision 7, session 889,
checked against `ac31a91`, CAP-R7-01 to CAP-R7-06, reduces the closing
milestone M16). Section 18 lists what revisions 2 to 7 changed and why;
section 8.5 gives the completion order of the remaining milestones.
Revision 8 (audit round 1 of `0a35708..eb7d8c9`, 16 major findings)
corrects the rules in sections 4.1, 6.1, 6.3, 6.6, 6.7 and 13; section 19
states each correction, its test and the plan grouping. Where an earlier
sentence and section 19 disagree, section 19 wins. Revision 9 (audit round
2 of `0a35708..3cd2401`, 10 blocking findings) is section 20; where section
19 and section 20 disagree, section 20 wins. Revision 10 (audit round 3 of
`0a35708..a964ad5`, 7 major findings) is section 21 here and section 20 of
`design-docs/specs/design-cad3d.md`; where an earlier section and section
21 disagree, section 21 wins. Revision 11 (audit round 4 of
`0a35708..3f9ce78`, 8 findings) is section 22 here and section 21 of
`design-docs/specs/design-cad3d.md`; it extends NCS1 (offset 36) and the
reply JSON of section 6.3, and section 22 wins over earlier sections.
Revision 12 (audit round 5 of `0a35708..70977f4`, 6 findings) is section
23 here and section 22 of `design-docs/specs/design-cad3d.md`; it changes
no NCS1 or report bytes, and section 23 wins over earlier sections.
Revision 13 (audit round 6 of `0a35708..6f58a74` plus the uncommitted
round 5 tree, 4 findings) is section 24; it adds one optional key to the
report JSON of section 6.3 and wins over earlier sections.
Revision 14 (audit round 7 of `0a35708..2be9db1` plus the uncommitted
round 6 tree, 2 high findings and one fixture typing error) is section 25;
it finishes the unlanded part of R6-2, bounds picture mesh-bin traversal,
and wins over earlier sections.
Revision 15 (audit round 8 of `0a35708..fc22c03`, 2 findings) is section
26. Revision 16 (audit round 9 of `0a35708..aede81d`, 2 findings) is
section 27; it rewrites the MCP attachment rule of sections 4.5 and 11
(per-call bytes, no readback) and adds an internal edge index for CAD
containment. Section 27 wins over earlier sections.
Revision 17 (audit round 10 of `0a35708..43197ca`, 4 findings) is section
28; it stages new captures before a no-clobber publish (sections 4.3 and
12), makes the edge index answer ray parity from the ray origin, derives
crowded profile depths from immediate parents, and decides capture
ancestry on the nanometre grid (section 6.1). Section 28 wins over earlier
sections.
Revision 18 (audit round 12 of `0a35708..73f73b8`, 6 findings) is section
29. Revision 19 (audit round 13 of `0a35708..25b4e97` plus the uncommitted
round-12 tree, 4 findings) is section 30; it filters picture witnesses of
bodies whose boxes only touch, finishes the Rust welded-shell contact
path of R12-6, and removes repeated side-face and ancestry work across
extrusions of one sketch. Section 30 wins over earlier sections.

Implementation status (revision 7): implemented (slice); every milestone accepted. Milestones M1 to M15, M17 to M20, M22, M23a to M23f and M16 (M16a, M16b, M16c) are accepted by their per-plan reviews and the targeted gates of section 8.5. Full
repository verification (`mise run verify`, browser tests, the whole
native parity suite) is deferred and NOT yet run; it runs outside the
workflow on the tree merged with `feat/cad3d-pages` (CAP-R7-01).
"Accepted" in this document and in the progress table never means that
this full verification has passed.
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
| `--interference-bodies` | all bodies | Ids, short ids or names; only pairs among the named bodies are checked and drawn. A full body id always selects that body; a name or id prefix must match exactly one body (section 19.1, F7) |
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
- Any target: never clobbered. An existing entry, including a link (also
  a dangling one), is never written. A new capture is written and synced
  to a sibling staging file owned by this invocation, then published with
  an atomic no-clobber operation (section 28, R10-1). If the target
  exists, before or at publish, with identical bytes the command succeeds
  without writing. If it exists with different bytes the command fails
  with exit 2 and names `--force`. With `--force` the existing atomic
  writer replaces a regular file; a symbolic link is refused.
- Failed-write cleanup belongs to the failing invocation and covers only
  its own short-named staging file. A new capture never creates, writes
  or removes the public path directly, so a failure cannot delete another
  writer's completed capture.
- Publication support depends on the CLI capture backend (section 28,
  R10-1).
  - The native CLI (`write_new` through `apps/cli/native/src/files.rs`)
    needs a no-clobber rename or a hard link on the target filesystem;
    Windows needs no extra support.
  - The Bun reference host needs hard links.
  - Where the backend's primitive is missing, a new capture fails with
    exit 2 and the publish error, and nothing appears at the path.
  - `--force` over an existing regular file is unchanged in both.
- These rules and exit codes cover only the `capture` command. Desktop
  export does not use them: it saves a user-selected file through
  `write_export_atomic` and `write_selected_file_atomic` (Foundation's
  atomic writer on macOS, `write_atomic` elsewhere) and reports errors
  in its UI (section 13). R10-1 does not change that writer.
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
- Revision 7 (M16, CAP-R7-02). Two closing lines of the page in
  `apps/cli/src/capture-help.ts` change; no part file, option or behaviour
  changes. The exit-code line read `0 success, 2 usage, input or output
  error` and omitted exit 1, which section 4.2 defines. It now states the
  three codes of 4.2 in one line: 0 written (also when identical bytes
  existed), 1 only with `--fail-on-interference` when a pair interferes
  or a candidate was not checked, 2 usage, input, output, refusal and work
  limit errors. One line after it points to the desktop Export dialog
  (PNG and JPG of 2D pages; "3D view image" on CAD pages, section 13) and
  to `docs/capture.md`. The long form lives in `docs/capture.md`, linked
  from one new section at the end of `docs/cli.md` (section 8.3) and from
  one `capture` example line in its AI section, above the `export ...
  --format png` lines.

### 4.5 MCP

`nodetto_capture` takes the same argument tokens. The result text is the
stdout of section 4.2. With `--inline` and exit code 0 or 1 the server
appends `{"type":"image","data":<base64>,
"mimeType":"image/png"|"image/jpeg"}` [S-9] built from the bytes that
this call itself wrote (outcome `written` or `identical`), when they are
at most 1,048,576 bytes; above that it appends a text line that says so.
The server never reopens the output path for the attachment, so a
concurrent capture that replaces the same path cannot change this call's
image (revision 16, section 27, R9-2). A call whose write failed or was
refused gets no attachment. `structuredContent` is unchanged and never
contains the image.

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
  (`packages/core/src/cad/evaluate.ts:660-669`), but only when every
  target is a valid Boolean target: a feature with any display-only mesh
  target (open or inconsistently wound) fails as a whole and appends
  nothing (section 19.1, F1);
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
`packages/core/src/cad/loops.ts:376-378`). That test uses the same integer
nanometre grid and exact `gridCross` predicate as sketch construction. The
loop's millimetre coordinates are what gets serialized (section 28,
R10-4). Body bounds use the kept loops.

Failed and suppressed features contribute nothing and their bodies pass
through unchanged, as in the evaluator
(`design-docs/specs/design-cad3d.md:597-598`). A body whose creator is
hidden (`visual.hidden`) is left out, as the STL export and the 2D exports
skip hidden elements (`apps/desktop/src/shell/export-handlers.ts:192-196`).
The function receives the elements that `collectCadInput`
(`packages/core/src/cad/engine.ts`) returns for the page, the evaluator's
input, because a PCB reference reads the board's page and a board counts
only while its page is a PCB page (section 19.1, F2). Mesh payloads are decoded by an injected
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
M9 note). Once M23 wires the census, no reported body has the state
`absent`: the census turns every picture-absent solid body into `outside`
(the lattice finds material at the end), `empty` (none at the end) or
`unknown` (census budget or body limit exhausted), and an open-source
body that is on no sample ray is `outside` from the picture alone
(CAP-R5-01). `BodyState::Absent` stays an internal picture-pass value;
the wire names and the parser do not change.

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
   axes. The candidate box `P` is that overlap. They are found with an
   axis-selected sweep, not by testing every pair, and keep the
   history order of exhaustive enumeration (section 19.1, F13). Every
   lattice fold charges its accumulated boundary reads against a per-pair
   allowance (section 19.1, F5).
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
    `unknown` and no claim is made about them. When the scene does not
    analyse interference (options 0, budget field 0, as with
    `--no-interference`), the census budget is the default 24 million
    weighted rays and the cell is the scene's target cell (0.25 mm), so
    the check of this section does not depend on the interference
    options (CAP-R4-09); the scene bytes do not change.
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
  part in interference, and the text says so. One classification drives
  the picture, the report, the census and the analysis (CAP-R4-09): a
  body is open-source (report key `open` true) exactly when the tool of
  its first step is not a solid (`tool_view::is_solid`), the rule
  `interference.rs` already uses for candidates. Otherwise it is solid,
  whatever tools its later steps use.
  - An open-source body draws only the surface of its first tool, with
    reference styling, and ignores all later steps. Its state comes from
    the picture alone: `drawn`, `hidden`, or `outside` when its surface is
    on no sample ray. `emptiedByStep` is -1. It is never a census subject,
    so it never gets a `cad.result.empty (sampled)` error. It takes part
    in no interference pair, in the analysis or in the overlay. (In M23
    the picture pass gives such a body a fully live picture record and
    that state before `census::resolve`, so `census.rs` is not edited.)
  - A solid body folds every step. An open mesh in a later step is an
    empty operand, in the picture (`surface_intervals` of an open mesh is
    empty) as in the lattice (`lattice.rs` gives a non-solid tool no
    bounds): union and difference leave the material unchanged, and
    intersection empties it. That emptying is a real empty step. Picture
    liveness and the census treat it like any other, so the body may get
    the sampled error.
  - Each tool is classified once, in picture setup, and the result is
    shared by every body, band and sample. No closure or topology check
    runs inside the sample loop (the mesh closure test allocates and sorts
    every edge). Revision 8: the same per-render classification is also
    passed to interference candidate selection and lattice tool bounds;
    only standalone analysis entry points compute it themselves (section
    19.1, F16).
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
| Wiring | M23 | crate `lib.rs`, `raster.rs`, `shade.rs`, `report.rs`; `tool_view.rs` (picture-family constructor and facet dispatch); `mesh.rs` (additive facet-normal seam only, CAP-R4-06); `tiles.rs` (admission before allocation, tile-major layout, per-tile body accessor; public `build`, `steps`, `work` and the M12 unit tests unchanged, CAP-R4-08); `tests/render.rs` (the digest constant and the superseded assertions named below, nothing else); `tests/overlay.rs`, `census.rs`, `mesh.rs`, `scale.rs` and additive helpers in `tests/support/mod.rs`; `capture-command.ts`, `capture-cad.ts` and tests; `__fixtures__/capture-plate-default.ncs1`, new `__fixtures__/capture-plate-no-interference.ncs1` and `packages/core/src/capture/cad-request.test.ts` (fixture expectations only, CAP-R5-02); `native-parity/capture.test.ts`; `apps/desktop/src/shell/export-handlers.ts` (the optional `interference` option of `captureCadImage` only, CAP-R4-07); `apps/desktop/src/shell/export-handlers.test.ts` (new cases only: fixture equality, mesh-only parity, options 0 and 3); evidence root `tmp/capture` | M17, M18, M11, M12, M14, M20, M22 |
| Closing | M16 | docs, capture help (exit-code line and desktop sentence), design measured values, progress table; artifact root `target` only (revision 7, CAP-R7-01: targeted gates replace the repository-wide gates, so no gate writes under `tmp/`) | M23 |

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
  Bun CLI and native CLI stay tied to one set of bytes. For that case
  (CAP-R4-07) the options object of the desktop handler
  `captureCadImage` (`apps/desktop/src/shell/export-handlers.ts`) gains
  `interference?: CadCaptureInterference | null`: an absent key means
  `DEFAULT_CAD_INTERFERENCE` (what the Export dialog does today), `null`
  is passed to `prepareCadCapture` as is. The dialog does not set it and
  gets no interference control (live desktop interference stays out of
  scope, 2.3); `ExportDialog.tsx`, `App.tsx`, `backend.ts`, the Tauri
  `capture.rs` and the `packages/ui-solid` capture modules do not change,
  because the scene is prepared in TypeScript and the dialog's narrower
  callback type stays assignable.
- The picture ignores the draw bit until M23 wires the overlay, so no
  pixel digest changes before M23.
- Option bits and fixtures after M23 (CAP-R5-02, ratifying the session 883
  amendment). In the crate the two bits of 6.3 act separately: the draw
  bit alone controls marking and hatching; the analyse bit alone controls
  `analysis`, `picture_only` and `add_view_pairs`, and report pairs exist
  only when it is set. A draw-only scene (options 2) is hatched, reports
  `analysis: None` and no pairs, and its picture equals the same scene with
  both bits set (`tests/interference.rs:217-241`, unedited). The core never
  writes options 2 (the draw-bit rule above), so the promise of 6.6 that
  no stripe exists without a text line holds for every scene a host
  produces. The committed `capture-plate-default.ncs1` holds the options 3
  bytes of `prepareCadCapture` with `DEFAULT_CAD_INTERFERENCE`, which
  `apps/cli/native/src/engine_tests.rs:369-405` compares with the CLI
  default unedited. The options 0 bytes (no or `null` interference) are
  pinned by the new `capture-plate-no-interference.ncs1`, a byte copy of the
  pre-M23 fixture, which the M20 test in `cad-request.test.ts` uses for its
  `run()`, `run(null)` and decoder-only equalities, plus one new equality of
  `run(DEFAULT_CAD_INTERFERENCE)` with the default fixture. No assertion is
  weakened.
- One wiring plan (CAP-R5-04), superseded by CAP-R6-01. The analysis of
  CAP-R5-04 still holds: the crate work all meets in `raster.rs`, and
  native parity needs the crate and the CLI together. That is why the parts
  are chained, not run in parallel. But three Terra runs (sessions 868, 883,
  884) each stopped part-way through the single plan, so M23 is now split
  into the sequential sub-plans of "M23 split" below. Each sub-plan can be
  finished in one sitting. The ownership row above stays the union of
  what the sub-plans write.
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
  exactly those three assertions, and otherwise only the one of
  CAP-R5-01 below, in the commit that wires
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
  digest constant changes only under the confirmation rule below.
- Second superseded assertion (CAP-R5-01).
  `nearest_face_wins_and_hidden_is_distinct_from_absent`
  (`crates/capture/tests/render.rs:162-178`) expects the last two bodies
  `[.., Absent, Absent]`, an M8 placeholder for the same reason as above:
  `absent` is a pre-census value (6.3) and section 6.7 lists only
  `drawn`, `hidden`, `outside`, `empty` and `unknown` as reported states.
  The wired census returns `[.., Outside, Empty]`, which is right, so the
  test changes and the code does not. Body 5 (a cube at x = 600 mm, out of
  view, solid at the end) is `outside` with `emptiedByStep` -1; body 6
  (union of the visible block, then an intersection with that disjoint
  cube) is `empty` with `emptiedByStep` 1. M23 replaces only that
  `assert_eq!` with the six states `[Drawn, Drawn, Drawn, Hidden, Outside,
  Empty]` plus those two `emptied_by_step` values, keeps the test name, the
  three-thread render and the shading assertions after it, and states the
  old and new expectations in the commit message. The fixture scene has
  `draw_interference` set, so after M23 the shading sample `[90, 45, 6.5]`
  lies in the interference hatch behind the Block face, which is correct
  per 6.6. M23d therefore also inserts `scene.draw_interference = false;`
  before the single-thread shading render. The shading assertion and its
  sample point are unchanged (CAP-R6-06).
- Digest confirmation rule (CAP-R5-03). The digest test renders
  `crates/capture/tests/fixtures/plate-iso.ncs1`: 7 tools, 3 bodies
  (Plate, Block, Puck), no reference and no mesh body, options 3 and
  budget 24, so the M23 hatch changes its pixels and the old constant
  `0x29c6_4b3e_156d_0941` must go. It is replaced only after these
  assertions, added by M23 to `tests/overlay.rs`, pass on the same tree:
  (1) the fixture with the draw bit cleared renders to the old digest
  `0x29c6_4b3e_156d_0941` (`support::digest`), so the tile-major layout,
  the `tool_view` picture path, the census and the reference mix changed no
  pixel of a scene without reference or mesh bodies; (2) the pixels that
  differ between the bit-set and bit-clear renders are not empty, and each
  lies inside the pixel projection of the box of a reported pair widened by
  2 pixels (outline and 2 x 2 downsampling); (3) the differing pixels include
  the interference colour and the body colour of the theme (the two hatch
  colours). The new constant is the value the test prints; the commit
  message states old and new values. If (1) fails, the picture pass is
  wrong and the constant is not touched.
- M23 acceptance additions (CAP-R4-08, CAP-R4-09, CAP-R4-10). These come on top of
  the M23 plan's tests, and no existing assertion or deadline changes.
  - `tests/mesh.rs`:
    - Prism, then a difference with a cube mesh missing one triangle:
      equals the prism-only picture; `open` false; the prism `drawn`.
    - Prism, then an intersection with that open mesh: the body is
      `empty` with `emptiedByStep` 1, and picture and census agree.
    - Open mesh, then a prism difference: equals the open-mesh-only
      picture; `open` true; `emptiedByStep` -1; no sampled error; no pair.
    - Open-source mesh outside the picture: `outside`, with no census
      rays.
    - `two_hundred_thousand_triangles_fit_render_budget` passes unchanged
      (200,000 triangles, 1024 x 768, one thread, under 3,000 ms). Source
      review confirms that no closure check runs per sample.
  - `tests/census.rs`:
    - An emptied solid body in a scene with options 0 gets its
      `emptiedByStep` from the 24-million-ray census.
    - An open-source body with a later cut, at a positive budget, gets no
      emptied step.
  - `tiles.rs` unit tests (new tests only, M12 tests unedited):
    - The admission `work` equals `TileLists::build(..).work(..)`, and
      `entries` equals the built entry count, on the M12 scenes and on
      seeded random rectangles.
    - 20,000 bodies with one union step each over one full tile, at 6,144
      x 6,144 samples: work 20,480,000 and 20,000 entries; build finishes
      in under 1,000 ms (release).
  - `tests/scale.rs`:
    - The 20,000-intersection refusal stays as written (under 1,000 ms).
    - A new entry-limit refusal: a 65 x 2048 picture at supersample 1 has
      a one-sample-wide edge column, and 70,000 steps covering only that
      column give about 4.48 million entries at about 143 million work.
      The render is refused naming the entry limit, in under 1,000 ms.
    - The 600-hole plate, the 20 x 15 grid and the other all-steps
      reference comparisons keep equal buffers and reports under the
      tile-major layout and the per-tile body visit.
    - Off-tile liveness suffix (release): 1024 x 768 at supersample 2,
      one prism covering the view, then 200,000 differences that reuse a
      second prism entirely outside the view. The body is `drawn` with
      `emptiedByStep` -1 and no census rays. The render takes under
      5,000 ms (printed); the span-filling path of `e883b4b` would write
      about 6.3e11 flags (3.1 million samples x 200,000 steps).
  - `tests/census.rs` (CAP-R4-10): the same history at 64 x 64 with 20,000
    off-view differences gives equal reports, liveness and buffers for 1,
    2 and 5 threads. A variant whose last off-view step is an intersection
    still reports that step as emptying, so the spans omitted from the
    tile keep the census semantics.
  - `raster.rs` unit tests (CAP-R4-10; tractable, so no pathological
    workload runs to the end):
    - Span record: on seeded random sets of spans, the merged maxima,
      materialized, equal the `Liveness` built by calling `mark` for every
      span.
    - Operation count: N unions of prisms with disjoint depth spans,
      covering every sample, execute exactly S * N * (N - 1) accumulated
      plus S * 2N tool boundary reads, as reported by the internal render
      entry. S counts executed samples, not unique ones. Each band samples
      its first row again, because the band before it already sampled that
      row as its lower neighbour for edge detection (`raster.rs:286-309`).
      So at supersample 1, S = width * (height + bands - 1), for any worker
      count (worker grouping keeps the band boundaries).
    - Costly-row refusal: 2,000 disjoint unions cover a 64 x 320 picture
      at supersample 1 (about 4.0 million reads per sample, about 256
      million per row; 10 bands, so a request for 5 threads starts 5
      workers). With a test allowance of 10,000,000, the picture is
      refused with the fixed message (test allowance shown) for 1, 2 and
      5 threads. For each run the test asserts that the started worker
      count is 1, 2 and 5, and that the executed reads are at most
      `allowance + workers x CHUNK` (at most 15,242,880 for 5 workers),
      well below a single row. A row-end check would fail this assertion.
    - Below the allowance, the same 64 x 320 layout with 50 disjoint
      unions: 10 bands execute 320 + 9 = 329 sample rows, the nine
      band-boundary rows repeated, so S = 21,056. The full charge is
      21,056 x 2,550 = 53,692,800 reads, with an allowance of 100,000,000.
      The test asserts equal buffers and reports, and exactly 53,692,800
      charged reads, for 1, 2 and 5 actual workers. A full 2,000-union
      render is never run.
    - The production allowance is the constant 16,000,000,000. The
      20,000-step disjoint-union case of the review (about 1.6e12 reads)
      is above it by arithmetic; it is not executed.
- `packages/core/src/capture/index.ts` gets its single new line from M22
  in wave 1, not from M23, because M14 imports the text functions through
  `@nodetto/core` in wave 2; no other plan edits it.

M23 split (revision 6, CAP-R6-01 to CAP-R6-05). Elsewhere in this
document "M23" means the union of M23a to M23f, and every M23 rule above
applies to the sub-plan that owns the file. State at `94c780d`, to be
checked again, not trusted. Present: tools classified once in setup, the
first-tool open-source rule, liveness spans as per-step maxima with a mesh
regression, the analyse/draw split, CLI options, printing and exit codes,
both fixtures, and the desktop `interference` option with its `null` and
default cases (`export-handlers.test.ts:224-318`). Missing:
`tiles::admit`, the entry limit, tile-major storage and the per-tile body
accessor (`tiles.rs` still keeps per-body `offsets`, `tiles.rs:17,72-92`);
the per-tile body visit; the scan allowance and the internal render entry;
most of the test inventory; the `render.rs` updates; native parity beyond
the Plate interference block (`native-parity/capture.test.ts:424-509`);
the CLI fake-backend cases; and the desktop fixture-file and mesh-only
cases. `raster.rs` has no unit-test module, and no test can reach an
all-steps render: `render_rgb` always builds and reads `TileLists`
(`raster.rs:392,454`).

In the table below, the file cap counts every edited file, including the
sub-plan's own plan file, where it writes its Progress entries.
Conditional paths count too. Artifact roots (`target`, `tmp/capture`) are
listed separately and are not edited files. Crate paths are relative to
`crates/capture/src/`, or to `crates/capture/` when they start with
`tests/`. CLI paths are relative to `apps/cli/src/`.

| Sub-plan | Writes: at most 4 edited files, plan file included | Work | dependsOn |
| --- | --- | --- | --- |
| M23a | `capture-23a-tile-admission.md`; `tiles.rs`; `raster.rs`; `tests/scale.rs` | `tiles.rs`: the admission, entry limit and tile-major storage of 10.2, the per-tile body accessor, and the `tiles.rs` unit tests of the acceptance additions. `steps`, `build` and `work` keep their results, with `steps` served from the tile group. `raster.rs`: the `admit` call before `TileLists::build`, the all-steps reference path (CAP-R6-04), and a new `#[cfg(test)] mod tests` with the five reference comparisons. `tests/scale.rs`: the new entry-limit refusal (release only, under 1,000 ms); the two existing release tests stay unedited | none |
| M23b | `capture-23b-tile-visit-allowance.md`; `raster.rs`; `tests/scale.rs`; `tests/census.rs` | `raster.rs`: the per-tile body visit through the accessor; liveness spans checked against CAP-R4-10 (O(1) per listed step, one sweep per body); the scan allowance and internal render entry of 10.2, with `render_rgb` and `render_scene` passing 16e9; the four `raster.rs` unit tests of the acceptance additions; the five reference comparisons rerun unedited; the direct liveness comparison of the CAP-R4-10 census regression (CAP-R6-05). `tests/scale.rs`: the off-tile liveness suffix (release). `tests/census.rs`: the 64 x 64 history with 20,000 off-view differences, with equal RGB buffers and equal reports for 1, 2 and 5 threads, and its intersection variant, whose last off-view step is reported as emptying in `emptied_by_step`. Helpers stay private inside these test files; `tests/support/mod.rs` is not edited | M23a (accessor, layout, reference path; `raster.rs` handover) |
| M23c | `capture-23c-picture-acceptance.md`; `tests/overlay.rs`; `tests/mesh.rs`; `shade.rs` (only to fix a compositing-order defect that a new overlay or mesh test exposes) | The overlay and mesh lists of the M23 plan and of the acceptance additions, including the no-overlay regression and CAP-R5-03 checks (1) to (3) | M23b (finished picture pass) |
| M23d | `capture-23d-census-render-digest.md`; `tests/census.rs`; `tests/render.rs` | `tests/census.rs`: the census list of the M23 plan (emptied, refilled, sound with zero census rays, hidden in a housing, outside the view, intersect miss, end to end, 1 vs 5 threads), plus the two census acceptance additions (an options-0 emptied body with the 24-million-ray census; an open-source body with a later cut). `tests/render.rs`, in this order: the three superseded assertions, the CAP-R5-01 assertion, and last the digest under CAP-R5-03. Each commit message states the old and new values | M23c (CAP-R5-03 proof on the same tree) |
| M23e | `capture-23e-native-parity.md`; `native-parity/capture.test.ts`; `capture-cad.ts` (report text only, when native parity exposes a contradiction with 4.2 or 12; gate 3 must stay green) | The rest of the native parity list: hatch colours `#335c67`/`#fffdf8` (dark `#5fb4c7`/`#1f2427`) with two equal runs; `Plate/Trim/Boss` `errors: 1`; cube `cad.mesh` with a cut exits 0; a listed `cad.pcb` board; Block moved gives 0; the 1.5 mm pin gives one pair; 1,000 elements in 50 bodies under 10,000 ms into `tmp/capture/m23/timing.json`; the stacked case with 1,225 candidates; the M9 budget unchanged. Both fixtures are checked, not rewritten | M23d (wired picture, final crate report), M23f (`capture-cad.ts` is pinned by M23f's tests, which gate 3 runs) |
| M23f | `capture-23f-host-cases.md`; `export-handlers.test.ts` (`apps/desktop/src/shell/`, new cases only); `capture-cad.test.ts`; `capture-command.test.ts` | CLI fake-backend cases of the M23 plan (2D page exits 2; capped and complete pair marked `approximate` in text and JSON alike; 25 unchecked with twenty listed; exit codes 1, 1, 0, 0; emptied, refilled, hidden and outside notes; `--no-interference` writes options 0, the default writes options 3), the pre-authorized change (d) as amended by CAP-R6-05, and the CLI scene equality with both fixtures. Desktop: the Plate scene equals the bytes of `capture-plate-default.ncs1`; a page whose only body is a `cad.mesh` cube equals the `prepareCadCapture` call. The existing `null` and default cases stay as they are. No production file is owned | none (CAP-R6-03) |

M16 depends on M23e, and so transitively on every sub-plan. The overview's
milestone and ownership tables list M23a to M23f in place of the single
M23 row. The plan step writes that change, and M16 marks it in the
progress table. M23 is accepted only when all six sub-plans are accepted.
The parent plan `capture-23-wiring.md` stays the shared reference for
traps and tests. No sub-plan edits it.

All-steps reference path (CAP-R6-04). M23a adds a private test-only
renderer to `raster.rs`, compiled only under `#[cfg(test)]`. It is not
public, not reachable from `lib.rs`, and not a runtime option. It runs the
existing render stages (setup, sample fold, shading, edges, reference mix,
overlay, census, downsample) with no tile selection: every sample folds
every body and every history step. Liveness is marked per sample with
`census::Liveness::mark`, the record that the CAP-R4-10 span sweep must
reproduce. Neither a snapshot nor a second tiled render can stand in for
it. The comparisons sit in the `raster.rs` test module and assert equal RGB
buffers and equal `Report`s, including every `emptied_by_step`. They cover:

- Plate (`tests/fixtures/plate-iso.ncs1` through `include_bytes!`)
- the 600-hole plate
- the 20 x 15 grid
- 50 bodies with intersects
- the emptied-and-refilled plate

Plate and the emptied-and-refilled plate also run at a reduced size in
debug, so the debug `--lib raster::` run reports a positive count. All
five run at full size in release. M23b reruns them unedited after changing
the traversal.

Test-boundary amendments (CAP-R6-05):

- Pre-authorized change (d) of the M23 plan names only the text
  expectation at `capture-cad.test.ts:137`. The same test's fake report
  emits the third body as `absent` (line 53), and its JSON expectation is
  `state: "absent"` (line 171). `describe.ts:114-120` derives the note from
  the supplied state, and `capture-cad.ts:138-143` carries that state into
  the JSON. Changing the text alone would therefore fail. For the test
  "reports cropped frame, body states and cad check errors in text and
  JSON" only, M23f changes three things together in
  `capture-cad.test.ts`:
  - the fake state at line 53 becomes `outside`
  - the text at line 137 expects `Puck [outside the picture]`
  - the JSON at line 171 expects `state: "outside"`
  Every other assertion of that test stays. No production file, parser or
  fixture file changes. `absent` stays a valid pre-census wire value
  (6.3), and M22's parser tests for it are not edited.
- The CAP-R4-10 census regression requires equal liveness. Liveness is
  internal: `raster.rs:527-571` builds it and passes it to
  `census::resolve`, and neither `render_rgb` nor `Report`
  (`report.rs:58-65`) exposes it. M23b's internal render entry (10.2,
  crate-private) therefore also returns the merged per-body liveness record
  it passes to `census::resolve`. The private `raster.rs` tests compare
  that record directly:
  - between 1, 2 and 5 requested threads;
  - against the per-sample liveness of the CAP-R6-04 reference path;
  - on the 64 x 64 off-view history and on its intersection variant.
  The full 20,000 steps run in release; debug uses 2,000 off-view steps,
  so the debug filter has a positive count. The `tests/census.rs`
  integration cases keep the RGB, report and `emptied_by_step` assertions.
  Liveness is not added to the public API, the report or the scene format.
  M23b lists both `--lib raster::` and `--test census`, in debug and in
  release.

Stop rules: if a check needs a production change outside the sub-plan's
write list, the sub-plan stops, records the evidence and the needed change
in its Progress section, and is not accepted. It does not widen its write
list. The scope amendment needed before a repair is then the named
production file and the failing test. Under CAP-R5-03, if check (1) fails,
M23c stops and `render.rs` is not touched. If a `shade.rs` fix in M23c
changes the bit-clear digest, check (1) fails. M23a starts from `raster.rs` hash
`34480090d85bf0b39552b2ecb686d43da19f17bf`. Each later sub-plan starts
from the hash its predecessor recorded at acceptance. The progress
protocol of the M23 plan applies to every sub-plan.

Verification boundary (CAP-R6-02):

- Every listed command must exit 0 and must run at least one test. Format,
  lint and typecheck steps are joined to a test run with `&&` in one
  `sh -c` command, so no command runs zero tests. Each test filter or
  `--test` target must report a positive pass count in the log. A filter
  that matches nothing fails the check.
- Release-only tests. Both existing `tests/scale.rs` tests carry
  `cfg_attr(debug_assertions, ignore = "release only")` (lines 9 and 27).
  A debug `--test scale` run therefore reports 0 passed and 2 ignored, so
  `scale` is listed only in release. Every new timing test is release-only
  in the same way.
- Before M23d, no plan lists the full `cargo test -p nodetto-capture`, nor
  `--test render`: three `render.rs` tests are known to fail until M23d.
  Every command below is prefixed with `env CARGO_TERM_QUIET=true
  CARGO_TARGET_DIR="$PWD/target/capture-m23<x>"` and wrapped in `sh -c`.
  Each `cargo test` in it must report a positive pass count.
  - M23a debug: `cargo fmt -p nodetto-capture -- --check && cargo clippy -p
    nodetto-capture --all-targets -- -D warnings && cargo test -p
    nodetto-capture --lib tiles:: && cargo test -p nodetto-capture --lib
    raster::`.
  - M23a release: `cargo test --release -p nodetto-capture --lib tiles:: &&
    cargo test --release -p nodetto-capture --lib raster:: && cargo test
    --release -p nodetto-capture --test scale -- --nocapture`. This run
    includes the unchanged 20,000-intersection refusal (under 1,000 ms,
    now refused by admission) and the 600-hole plate (under 1,500 ms).
  - M23b: the same format and lint prefix, then debug `--lib raster::`,
    `--test census`, `--test mesh`, `--test overlay`, `--test interference`.
    Release: `--lib raster::`, `--test scale -- --nocapture`, `--test
    census`.
  - M23c: the same prefix, then `--lib raster::`, `--test overlay`, `--test
    mesh`, `--test interference`, in debug and in release.
- Pre-edit evidence is not a verification command. Before any edit, M23a
  runs debug `cargo test -p nodetto-capture --test scene` (11 passed at
  `94c780d`) and logs it. A failure there is a pre-existing blocker: record
  it and stop. The debug `scale` result (0 passed, 2 ignored) is recorded
  as an observation only. A pre-edit release `--test scale` run is
  optional diagnostic output and is never counted as a passing gate,
  because its 20,000-intersection case exercises the pre-admission
  allocation that M23a removes. The `94c780d` crate log stopped at the
  failing `render` binary, before `scale` and `scene`
  (`tmp/capture-s884/capture-23-wiring/cargo-test-current.log`).
- From M23d on, every Rust-chain plan lists M23 gate 1 (`cargo fmt -p
  nodetto-capture -- --check && cargo clippy -p nodetto-capture
  --all-targets -- -D warnings && cargo test -p nodetto-capture`). M23d
  also lists gate 2 (release crate tests into `tmp/capture/m23/release.txt`).
  M23e lists gates 1, 3 and 4. Gate 4 builds the release `nodetto-cli` in
  the same command and runs native parity with
  `NODETTO_CLI_TEST_BINARY="$CARGO_TARGET_DIR/release/nodetto-cli"` into
  `tmp/capture/m23/native-parity.txt`. The log must show a positive parity
  count and no skip.
- M23f lists `sh -c 'bun run typecheck && bunx biome check
  --diagnostic-level=warn apps/desktop/src/shell apps/cli/src/capture-cad.test.ts
  apps/cli/src/capture-command.test.ts && bun test
  apps/desktop/src/shell/export-handlers.test.ts
  apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts'`.
  It runs no cargo command: it touches no Rust, and its cases use a fake
  backend or compare scene bytes from TypeScript.
- Build directories are `CARGO_TARGET_DIR=target/capture-m23a` to
  `target/capture-m23e`. Artifact roots are `target` and `tmp/capture` for
  every sub-plan. Evidence goes to `tmp/capture/m23<x>/`, and the gate
  files go to `tmp/capture/m23/`.

Rollout rules for every remaining plan: each plan builds into its own
`CARGO_TARGET_DIR=target/capture-<mNN>` (the native binary is then
`target/capture-<mNN>/release/nodetto-cli`); only M23e ran native
parity tests, building the binary in the same command; M16 runs no native
parity test (revision 7, CAP-R7-01: native parity belongs to the deferred
full verification); a timing
test may be retried up to three attempts under machine load and is then
run alone before a failure is reported; no existing test or deadline is
relaxed. Evidence written by tests a plan runs is part of that plan's
artifact roots: M23's parity gate runs the unchanged M9 budget test,
which writes `tmp/capture/m09/timing.json`, and its own timing goes to
`tmp/capture/m23/`, so M23 owns `tmp/capture` (CAP-R4-07). M23 also owns
`target`. M16 owns `target` only (revision 7, CAP-R7-01; the revision 4
sentence that gave M16 the root `tmp` is superseded).

M16 gates (revision 4, superseded by "M16 reduced scope" below and kept
only as the description of the deferred full verification; no M16 plan
runs them). `mise run test-cli` hardcodes `$PWD/target/release/nodetto-cli`
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

M16 reduced scope (revision 7, CAP-R7-01, owner decision of 2026-11-23).
This decision supersedes the M16 gate list above and the M16 rows of the
revision 4 rollout rules. It is a decision, not an open question.

- Scope: (a) documentation and `capture` help that let an agent find and
  use the command unprompted; (b) measured budgets with their method
  (section 10.3); (c) once the M16 deliverables, its targeted gates and
  its per-plan review are complete, the header status and the overview
  progress table mark every milestone accepted, M16 included, and say
  that full verification is deferred and NOT yet run (CAP-R7-04). Until
  then M16 stays pending in both.
- Deferred and NOT yet run: `mise run verify`, any browser, Chromium or
  Vite test, the whole native parity suite
  (`apps/cli/src/native-parity/`, including the M9 and M23 timing tests
  that write under `tmp/capture/`), `cargo test --workspace`,
  `cargo test -p nodetto-native` and the three gates above. They run
  after the workflow, outside it, on the tree merged with
  `feat/cad3d-pages`. Until then no document may describe them as passed.
- The operative M16 gates are exactly these three commands. Each runs in
  the foreground, exits 0, reports a positive test count, and keeps its
  complete log and exit status under `target/capture-m16/`. Lint and
  typecheck never stand alone; they are joined to a test run:
  1. Typecheck, lint and help/docs tests: `CARGO_TARGET_DIR=target/capture-m16
     sh -c 'bun run typecheck && bunx biome check apps/cli/src/capture-help.ts
     apps/cli/src/capture-docs.test.ts && bun test
     apps/cli/src/capture-docs.test.ts apps/cli/src/capture-command.test.ts
     apps/cli/src/ai-commands.test.ts apps/cli/src/table-docs.test.ts'`.
     The Biome path list is every TypeScript file M16 touches; the help
     test in `capture-command.test.ts` is "capture is discoverable in the
     overview and explains every option".
  2. Crate: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m16
     cargo test -p nodetto-capture` (debug; release-only tests are
     ignored there and run in the 10.3 measurement step).
  3. Capture CLI unit tests: `UPDATE_CAPTURE_FIXTURES=0
     CARGO_TARGET_DIR=target/capture-m16 bun test
     apps/cli/src/capture-command.test.ts apps/cli/src/capture-cad.test.ts
     apps/cli/src/capture-io.test.ts
     apps/cli/src/capture-interference-options.test.ts
     apps/cli/src/mcp-image.test.ts`. `UPDATE_CAPTURE_FIXTURES=0` keeps
     the maintenance branch of `capture-cad.test.ts` (it rewrites
     `apps/cli/src/__fixtures__/capture-plate.jsonl` and
     `capture-plate-default.ncs1` only when the variable is `1`) from
     touching tracked fixtures. These tests write only under the
     operating system temporary directory (`os.tmpdir()`), never under
     the repository `tmp/`, and need no native binary.
- Excluded by filter and deferred: `apps/cli/src/native-parity/capture.test.ts`
  (writes `tmp/capture/m09/` and `tmp/capture/m23/`, needs the native
  binary) and `apps/cli/src/mcp-stdio.test.ts` (has a native-binary
  variant). Gates name test files explicitly; no gate runs a directory.
- Artifacts: only under `target/` (`target/capture-m16/` for build output,
  measurement logs and measured images). Nothing is written under `tmp/`.
- Gate evidence (revision 7, CAP-R7-05). Every gate attempt, whether first
  run, retry, isolated comparison or final run, writes a new log file
  (`mktemp` under `target/capture-m16/` for M16b, under
  `target/capture-m16/gates/` for M16c). The wrapper prints the path. No
  log is ever truncated or overwritten, and earlier logs, including the
  session 889 `target/capture-m16/gate-3.log`, are kept as history. The
  log holds both output streams of the test run and of every later
  assertion. The last line is `exit=<status>`, where the status is that
  of the whole gate after all assertions. If the log cannot be written,
  the gate fails. A gate passes only if its own log shows a positive pass
  count, zero failures and `exit=0`. No output is sent to `/dev/null`.
- Publication (revision 7, CAP-R7-06). M16c works in four phases.
  (1) Preliminary: copy the budget table into `docs/capture.md`, then run
  G1 to G3 without any status edit. (2) Candidate: write the two status
  edits of CAP-R7-04 (header paragraph; overview Progress section and
  evidence-roots row) and record `git hash-object` of `docs/capture.md`,
  the design and the overview as the candidate identity. Run final G1 to
  G3 on that exact candidate. Final G3 also runs the status check below.
  (3) Review: the independent per-plan review examines the same hashes.
  (4) Publish: the workflow's integration step, the only actor that
  changes git state, commits the candidate after the review approves it
  and the files still match the recorded hashes. A worker never commits.
  A preliminary gate failure is recorded as a blocker and nothing is
  restored: no status edit exists yet, and the live hashes of the design
  and the overview must equal those recorded at the start of phase 1.
  Each candidate attempt first copies the design and the overview to its
  own new `mktemp -d` directory, `target/capture-m16/gates/candidate-<n>.*`,
  and records that path and the hashes. If a candidate gate fails or the
  review rejects that candidate, the M16c worker copies both files back
  from that attempt's directory only (a working-tree write only) and
  checks the hashes recorded for that attempt. Both records then read
  pending again. The failing log or the review decision is kept and
  recorded as a blocker. If the integration step
  cannot commit a reviewed candidate as is, the M16c plan records the
  ownership amendment needed before dispatch, and M16 stays pending.
  The status check fails unless all of the following hold:
  - The header paragraph (from `Implementation status` to
    `Implementation plan:`) contains `implemented (slice); every
    milestone accepted` and `deferred and NOT yet run`. It contains
    neither `pending` nor an HTML comment.
  - The overview `## Progress` section contains no HTML comment and has
    exactly 27 milestone rows: M1 to M15, M17 to M20, M22, M23a to M23f
    and M16, each exactly once and each with status exactly `accepted`.
  - The prose after the table in that section contains
    `deferred and NOT yet run`.
  - The single `Evidence roots` row is exactly ``| Evidence roots | M23
    `tmp/capture` and `target`; M16 `target` (CAP-R4-07, CAP-R7-01) |``,
    so M16 has `target` alone and the M23 allocation is unchanged.
- `docs/capture.md` (new) covers, in the user's words: purpose and the
  one-line form; every option of the help usage block with its default;
  stdout and `--json` forms (4.1, 4.2, including `approximate`,
  `uncheckedCount` and the capped line); output location, `--force` and
  the Store CLI `--output` note (4.3); 2D pages (5); 3D CAD pages: the
  orthographic camera, the seven views, `--direction`, `--eye`,
  `--target`, `--up`, `--zoom`, the `camera` and `frame` lines, body
  notes, meshes, reference bodies, the sampled `cad.result.empty` (6.2,
  6.7); interference: definition, text form, cell and guarantee in the
  words of 6.6, the hatched overlay and its colours, the four options;
  exit codes 0, 1, 2 and the refusal messages (4.2, 12); determinism (7);
  MCP `nodetto_capture`, `--inline`, the 1 MiB limit and token cost (4.5);
  the desktop Export dialog: "3D view image" with the seven views and
  "Current view", PNG or JPG, and 2D PNG or JPG not byte-equal to the CLI
  (13); an agent loop example; the one `export` versus `capture` sentence
  of 8.3 (no description of cad3d M18 or M21 beyond it); the IJG sentence
  and a pointer to `THIRD_PARTY_NOTICES.md`; the measured values of 10.3.
- `apps/cli/src/capture-docs.test.ts` (new) asserts: every option parsed
  from the `CAPTURE_HELP` usage block appears in `docs/capture.md`; the
  doc contains `orthographic`, `--view`, `--eye`, `interference`, `cell`,
  `approximate`, `hatch`, `--fail-on-interference`, `Exit codes`,
  `nodetto_capture`, `--inline`, `3D view image`, `Current view` and the
  IJG sentence; `CAPTURE_HELP` contains exit codes 0, 1 and 2,
  `--fail-on-interference` and `docs/capture.md`; every fenced
  `nodetto-cli capture ...` line of `docs/capture.md` and of the new
  `docs/cli.md` section parses without a usage error through
  `captureCommand` with memory I/O and a fake backend (the fakes of
  `capture-cad.test.ts`); `docs/cli.md` links to `capture.md`.
- Help changes are the two of section 4.4 (revision 7); no option,
  behaviour or output changes. No `mise.toml`, `README.md` or
  `impl-plans/README.md` edit: a Completed entry there means "passed
  final verification", which has not run, and `impl-plans/README.md`
  and `README.md` are edited by cad3d M18.

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
suggests a smaller `--size`. Picture admission and tile storage
(CAP-R4-08):

- Admission runs before any per-tile or per-body list is allocated. One
  pass adds each step to the tile rectangle it covers (an intersection
  step covers every tile) in two-dimensional difference arrays shared by
  all bodies: one for the tool weight, one for the entry count. A single
  prefix-sum pass then gives two numbers, in time linear in steps plus
  tiles and memory linear in tiles. `work` is exactly the value of
  `TileLists::work` on the built lists (the exact sum clamped to
  `u64::MAX`). `entries` is the number of (body, step, tile) list
  entries. The scene is refused with exit 2 when `work` > 4e9 (the
  message above) or when `entries` > 4,194,304, with the same message
  naming the tile list entries and their limit. A picture whose work is
  admitted and whose tiles are all full has at most 4e9 / 1,024 =
  3,906,250 entries, so the entry limit only binds when the work sits in
  partial edge tiles.
- Storage is tile-major: one offsets array of `tiles + 1` entries for the
  whole scene, plus the admitted entries, grouped per tile by body in
  history order and then by step order. There is no dense array per body.
  Memory is therefore at most `(tiles + 1) + 4,194,304` entries whatever
  the body count. The 20,000 one-tile bodies at 2048 x 2048 with
  supersample 3 (20,480,000 work, admitted) need 20,000 entries, not the
  5.9 GB of per-body offsets of the M12 layout.
- A sample visits only the bodies listed for its tile. Per-sample
  clearing, folding and overlay collection cost grows with the listed
  entries, never with the total body count, so the admitted work bounds
  the traversal. Skipping an unlisted body is exact: a body with no listed
  step, or only a listed intersection step, has no material in that tile.
- Liveness spans (CAP-R4-10). A listed step j with material marks steps
  j up to the next listed step k, or to the end of the history. These
  steps are omitted from the tile, so they cannot remove material there.
  The span can cover a long history that lies off the tile, so a sample
  does not write it. Each worker keeps, per body, the greatest exclusive
  end recorded for each starting step: one comparison per listed step,
  whatever the span length. When the workers join, the per-step maxima
  are merged by maximum. One sweep per body then turns them into the
  existing `Liveness` record, where step i is alive when some start
  j <= i has an end > i. The census therefore receives exactly the record
  it receives today, and `census.rs` is not edited. The sweep costs time
  linear in the step count, once per body and worker.
- Picture boundary scans (CAP-R4-10). Every combine call in the picture
  fold reads all boundaries of the accumulated intervals plus the tool's
  intervals, so a history of disjoint unions costs a time quadratic in
  its length on every ray. That cost is not in `work`.
  - Charge: before each combine call of the picture fold, its charge
    `c = |accumulated| + |tool|` is known, because the tool's intervals
    are computed first. The call is charged before it runs.
  - Checks inside the fold: each worker keeps a local pending count. It
    adds `c` before every combine call. When the pending count reaches
    `CHUNK = 1,048,576` (2^20), the worker adds it to a shared total and
    resets it, before that combine runs. If the total now exceeds the
    allowance of 16,000,000,000 (4 x the work limit; reading a boundary
    is cheaper than the step evaluation that `work` charges), the worker
    skips that combine, raises a shared stop flag and returns. Every
    worker also reads the stop flag at each flush. At the end of its band
    a worker flushes the rest.
  - Bound, independent of row width or scene complexity: when a worker
    flushes, the reads it has run but not yet flushed are below `CHUNK`;
    a combine whose charge makes the pending count reach `CHUNK` is
    flushed before it runs. The reads that run before every worker has
    stopped are therefore at most `allowance + workers x CHUNK`. With 16
    workers that is 0.1% over 16e9.
  - Determinism: the scene's full charge is the sum over all combine calls
    of the complete render, a function of the scene alone. If it exceeds
    the allowance, the shared total passes the allowance and the render is
    refused. Otherwise the total never passes it, because only real
    charges are added before that point. The decision is therefore the
    same for every worker count. The refusal is exit 2 with the fixed
    message `The scene is too heavy for this picture size (picture
    boundary scans over 16000000000). Use a smaller --size.`, which
    carries no partial count.
  - Admitted scenes are unaffected: their Boolean results, bytes and
    `interval.rs` (`combine`) do not change. The check lives in
    `raster.rs` around its calls to `combine`. An internal render entry
    takes the allowance as a parameter and reports the executed reads and
    the number of workers actually started, for tests. `render_rgb` and
    `render_scene` pass the 16e9 constant.
- Refused examples allocate no list: 20,000 intersection steps over a
  2048 x 2048 picture at supersample 3 (36,864 tiles) would otherwise
  need about 737 million entries.

`TileLists::build`, `steps`, `work` keep their signatures and results, and
the M12 unit tests pass unedited. Only the internal layout changes, plus
the additive admission function and a per-tile body accessor. Bucket and cell tables are bounded by
`4 * entries + 4096` (section 6.4) and the reader bounds the entries
(section 11), so memory is bounded as well.

### 10.3 Measured values (revision 7, M16, CAP-R7-03)

M16 measures the budgets of 10.2 on the final tree and records them here
and in `docs/capture.md`. Values come only from logs that M16 writes under
`target/capture-m16/`; spike values of 10.1 are never copied. Budgets and
deadlines are not changed by a measurement. Rows whose test belongs to the
deferred native parity suite are not measured; they may cite the earlier
accepted log (`tmp/capture/m09/timing.json`, `tmp/capture/m23/timing.json`,
read only) labelled "earlier evidence, M9 or M23e", with its date.

Method (all with `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m16`):

1. Machine record, `target/capture-m16/machine.txt`: date, CPU name and
   core count (`sysctl -n machdep.cpu.brand_string hw.ncpu`), macOS
   version, `rustc --version`, `bun --version`, `git rev-parse HEAD`,
   and `uptime` before and after the runs as the load note.
2. Crate timings, `target/capture-m16/crate-release.log`: `cargo test -p
   nodetto-capture --release -- --nocapture --test-threads=1`. The
   release-only tests print their elapsed time (render of the reference
   scene on one thread, the interference cases `release_pin_budget`,
   `release_many_boxes_budget`, `release_many_holes_budget`, the shared
   20,000-point loop case, the `scale` cases). A test that asserts a bound
   without printing is recorded as "passed under <budget>". One thread per
   test keeps timings from competing with each other.
3. Native timings: `cargo build --release -p nodetto-cli`, then for each
   case one discarded warm-up and three timed runs (`/usr/bin/time -p`),
   output images with `--force` under `target/capture-m16/`, stdout and
   times in `target/capture-m16/native-<case>.txt`. Cases: the reference
   CAD page `apps/cli/src/__fixtures__/capture-plate.jsonl` with default
   options (PNG) and with `--format jpg`; the 2D page
   `examples/breadboard/led-button.jsonl` with default options. The table
   gives the median and the maximum of the three runs, and the `bytes`
   line of the PNG and JPG CAD captures against the 1,048,576-byte MCP
   inline limit (4.5). Equal `bytes` and path across the three runs are
   noted as a determinism observation, not a gate.
4. Bun scene build, `target/capture-m16/bun-scene.log`: `bun test
   packages/core/src/capture/scene.test.ts -t 'builds 20,000 CAD
   elements in under 1,000 ms' > target/capture-m16/bun-scene.log 2>&1`
   (after `mkdir -p target/capture-m16`). The existing test
   (`scene.test.ts:472-485`) prints `CAD capture scene, 20,000 elements:
   <ms> ms` and asserts the unchanged 1,000 ms deadline. The printed
   value fills the 10.2 row "Scene build for 20,000 elements in Bun"
   here and in `docs/capture.md`; the log must show one test passed.
5. Timing retries follow the rollout rules: up to three attempts under
   load, then the case alone; every attempt stays in the log. A budget
   that still fails is reported as a blocker, never recorded as met.

The table has the columns Budget (the 10.2 row), Budget value, Measured
(median / max, or "passed under"), Runs, Log path. M16 fills it with the
machine line and date above it.
Machine: Apple M4, 10 cores, macOS 26.5.2, 2026-11-23; Rust 1.98.1, Bun 1.4.4. Load and full machine details: `target/capture-m16/machine.txt`.

| Budget | Budget value | Measured | Runs | Log path |
| --- | --- | --- | --- | --- |
| Native capture of reference CAD page | under 5,000 ms | median 840 ms / max 850 ms | 3 after warm-up | `target/capture-m16/native-plate-png.txt` |
| Reference scene render, one thread | under 2,000 ms | 313.27 ms | 1 | `target/capture-m16/crate-release.log` |
| Interference, one 200 mm pair | under 500 ms | 40 ms | 1 | `target/capture-m16/crate-release.log` |
| Interference analysis in total | 24 million weighted rays; 600-hole pair under 2,000 ms; shared loop under 5,000 ms | 600 holes 448 ms; 2,000 boxes 111 ms; 200 bodies/shared loop 161 ms; budget-rule tests passed | 1 each | `target/capture-m16/crate-release.log` |
| Body sampling | same budget for suspect bodies; none in a fitted view of a sound model | no timing printed; census tests passed | 1 suite | `target/capture-m16/crate-release.log` |
| Native CAD capture, 1,000 elements in 50 bodies | under 10,000 ms | earlier evidence, M23e, 2026-11-23: 1,060 ms | 1 | `tmp/capture/m23/timing.json` |
| Native 2D capture | 10,000 ms class | median 740 ms / max 740 ms | 3 after warm-up | `target/capture-m16/native-led-2d.txt` |
| Scene build, 20,000 elements in Bun | under 1,000 ms | 97.0 ms | 1 | `target/capture-m16/bun-scene.log` |
| Reference CAD PNG size | 1,048,576 bytes | 35,138 bytes | 3 after warm-up | `target/capture-m16/native-plate-png.txt` |
| Reference CAD JPG size | 1,048,576 bytes | 62,948 bytes | 3 after warm-up | `target/capture-m16/native-plate-jpg.txt` |

Earlier evidence, M9, 2026-11-23: reference native capture 742, 758,
and 700 ms (`tmp/capture/m09/timing.json`); native parity was deferred
for this run. Across the three timed runs, each native case reported the
same path and byte count; this observation does not establish byte identity.

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
- MCP: `--inline` attaches only the bytes the call's own write stored, and
  reads no file for it. Only inline calls retain them, at most 1 MiB per
  call (above that only the byte count), until the response is built. The
  server keeps the permissions it has today.
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
| Write, sync or no-clobber publish fails, including a target filesystem that lacks the capture backend's primitive (native CLI: no-clobber rename or hard link; Bun host: hard link). Desktop export is not covered here (section 13) | Exit 2 with the original error; the failing invocation removes only its own staging file, and the public path is untouched (section 28, R10-1) |

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
interference lines of section 4.2 after saving. Revision 8: the scene
and the reply cross the bridge as raw binary bodies (section 19.1, F10),
and the handler validates the report against the request before the save
picker opens (F15).

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
| Existing export and documents keep working | M3 runs the export tests unmodified; the repository-wide gates (workspace verify, shared native contracts, CLI tests with native parity) are deferred and NOT yet run; they run after the workflow on the tree merged with `feat/cad3d-pages` (section 8.5, CAP-R7-01) |
| An agent finds and uses `capture` unprompted | M3 (overview, help, MCP list), M16 (`docs/capture.md`, the `docs/cli.md` section and AI-section line, the two help lines of 4.4; `apps/cli/src/capture-docs.test.ts`) |
| Measured budgets with method | M16 (section 10.3, logs under `target/capture-m16/`) |
| Every milestone accepted by review | Progress table in the overview, with the deferred-verification sentence (CAP-R7-04) |

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

## 18. Changes in revisions 2 to 7

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
| CAP-R4-07 (revision 4, scope decisions for the M23 continuation after `e883b4b`) | Two M23 blockers were scope gaps, not design errors. (a) The required native parity gate runs the unchanged M9 budget test, which writes `tmp/capture/m09/timing.json`; M23 owns the evidence root `tmp/capture`, M16 owns `tmp`. (b) The desktop `interference: null` case that 8.5 already requires needs an input that M14's `captureCadImage` did not expose; the case is kept and M23 adds the optional `interference` option to that handler only, with no dialog control and no change to the backend, Tauri command or `packages/ui-solid` | 8.5 |
| CAP-R4-08 (revision 4, M23; ownership amendment of the accepted M12 `tiles.rs`) | The 10.2 promise that memory and work are bounded did not hold for the M12 tile lists, for three reasons. (1) `TileLists::build` allocates every list entry before `work` can refuse the scene: about 737 million entries for 20,000 intersection steps at 2048 x 2048 with supersample 3. (2) It keeps a dense offsets array per body: 5.9 GB for 20,000 one-tile bodies whose work, 20,480,000, is admitted. (3) The picture visits every body on every sample, a cost `work` does not count. M23 now owns `tiles.rs` for: admission before allocation (exact `work`, plus an entry limit of 4,194,304), a tile-major layout with no per-body dense array, and a per-tile body accessor. The picture visits only listed bodies. Public `build`, `steps`, `work`, their results and the M12 unit tests do not change | 10.2, 8.5 |
| CAP-R4-09 (revision 4, M23) | Rules the wiring needs were open or contradictory. (a) The census budget was "the size of the analysis budget", which is 0 when interference is off. `--no-interference` would then turn every suspect body into `unknown` and drop the `cad.result.empty (sampled)` error that section 12 promises unconditionally. The census now uses the default 24 million rays in that case. (b) The `e883b4b` picture classified a body as open if any step used an open mesh, while the analysis used the first step. A solid with a later open operand lost its solid pixels. An open source mesh with a later cut became a census subject and could get a false sampled-empty error. One first-tool classification now drives picture, report, census and analysis. A later open operand follows the existing empty-operand semantics of the lattice (union and difference unchanged, intersection empties). Open-source bodies stay out of the census through the picture record, so `census.rs` and `lattice.rs` are not edited. (c) The closure classification ran inside the sample loop. It now runs once per tool in picture setup | 6.7, 8.5 |
| CAP-R4-10 (revision 4, M23) | Two picture costs were outside both admission limits. (1) A listed step marked liveness up to the next listed step on every sample (`raster.rs:162-167`, `census.rs:21-25`). One visible prism followed by a million off-view differences writes about 1.9e13 flags at 2048 x 2048 with supersample 3. (2) Every `combine` call rescans the accumulated boundaries (`interval.rs:17-48`), so 20,000 disjoint unions at 64 x 64 read about 1.6e12 boundaries. Liveness is now recorded as the greatest end per starting step and turned into the unchanged `Liveness` record once per body. Picture boundary reads are charged before each combine call and checked inside the fold, in chunks of 2^20, against a deterministic allowance of 16,000,000,000. A fixed refusal message is used, and at most `allowance + workers x 2^20` reads run, whatever the row cost (a check only at row end would let one admitted row run about 2.9e11 reads first). Only `raster.rs` changes. `census.rs`, `lattice.rs`, `interference.rs`, `interval.rs`, the work estimate, the entry limit, the scene bytes and the Boolean results of admitted scenes do not | 10.2, 8.5 |
| CAP-R5-01 (revision 5, M23 checkpoint `e43016d`) | `render.rs:162-178` expected `[.., Absent, Absent]` while the wired census returns `[.., Outside, Empty]`. 6.3 and 6.7 already say `absent` is a pre-census value and list only `drawn`, `hidden`, `outside`, `empty`, `unknown` as reported states, so the census is right and the assertion is a second M8 placeholder. The narrow 8.5 authorisation is extended to that one `assert_eq!`, replaced by the six final states plus `emptiedByStep` -1 (outside body) and 1 (emptied body). No code changes for it | 6.3, 8.5 |
| CAP-R5-02 (revision 5) | The session 883 amendment is ratified in the design: the crate's draw and analyse bits act separately (options 2 is hatched, reports no pairs, and is never written by the core); the options 0 bytes move to the new `capture-plate-no-interference.ncs1`, `capture-plate-default.ncs1` holds the options 3 bytes, and M23 owns the fixture expectations of `cad-request.test.ts`. `engine_tests.rs` and `tests/interference.rs` stay unedited | 6.3, 6.6, 8.5 |
| CAP-R5-03 (revision 5) | "The digest changes only as the M17 rule allows" named no rule. The digest of `plate-iso.ncs1` (options 3) is replaced only after `tests/overlay.rs` shows that the bit-clear render keeps the old digest `0x29c6_4b3e_156d_0941`, that every changed pixel lies in a reported pair's projected box widened by 2 pixels, and that both hatch colours appear | 8.5 |
| CAP-R6-01 (revision 6, M23 checkpoint `94c780d`) | CAP-R5-04 ("M23 stays one plan") is superseded. Its dependency analysis still holds, but three Terra runs (sessions 868, 883 and 884) each stopped part-way through the single plan. The remaining M23 work becomes the sub-plans M23a to M23f. Each edits at most four files, counting its own plan file and any conditional production path (design review CAP-DR6-03). They are chained by `dependsOn` where a file handover or a contract exists: tile layout, then picture pass, then CAP-R5-03 proof, then census tests and digest, then native parity. The behaviour, contracts, pre-authorized test changes and acceptance additions of M23 do not change, and every required case has one named owner. Only the dispatch unit changes | 8.5 |
| CAP-R6-02 (revision 6) | Verification boundary per sub-plan. No command runs zero tests: format, lint and typecheck are joined to a test run. `scale` is listed only in release, because its tests are release-only. Before M23d no plan lists the full crate test or `--test render`. From M23d on, gate 1 is listed; native parity runs only in M23e, against the binary it built. Pre-edit evidence is debug `--test scene`, which is not a gate. The unchanged release `scale` deadlines are a post-edit gate of M23a (design review CAP-DR6-01) | 8.5 |
| CAP-R6-03 (revision 6) | M23f collects the host-side cases that need no crate change. The CLI fake-backend cases (`capture-cad.test.ts`, `capture-command.test.ts`) and the two desktop cases (fixture-file equality and mesh-only parity) compare fake reports or scene bytes from TypeScript `prepareCadCapture`, and no sub-plan changes that function or the fixtures. The desktop option itself already exists (CAP-R4-07). So M23f has no `dependsOn` and runs no cargo command. M23e depends on M23f, because M23e may edit `capture-cad.ts`, which M23f's tests pin. M16 depends on M23e | 8.5 |
| CAP-R6-04 (revision 6) | The all-steps reference comparisons of the acceptance additions had no reference to compare against: `render_rgb` always reads `TileLists`. M23a adds a private `#[cfg(test)]` all-steps renderer in `raster.rs`. It uses the existing stages and no tile selection, with liveness marked per sample, and it is not public and not a runtime option. M23a places the five comparisons (Plate, 600-hole plate, 20 x 15 grid, 50 bodies with intersects, emptied-and-refilled plate) in the `raster.rs` test module, and M23b reruns them after changing the traversal (design review CAP-DR6-02) | 8.5 |
| CAP-R6-05 (revision 6, design review round 2) | Two required assertions could not be made inside their test boundaries. (a) Change (d) of the M23 plan authorized only the text line of the cropped-frame CLI test, while its fake report and JSON expectation still used `absent`. M23f now updates the fake state, the text and the JSON together to `outside`; production code and fixtures are unchanged (CAP-DR6-04). (b) The CAP-R4-10 census regression asserted equal liveness from an integration test that cannot observe it. M23b's crate-private render entry also returns the merged liveness passed to `census::resolve`, and the private `raster.rs` tests compare it across 1, 2 and 5 threads and against the reference path. `tests/census.rs` keeps the RGB, report and emptying-step checks (CAP-DR6-05) | 8.5 |
| CAP-R6-07 (revision 6, M23e checkpoint amendment round 2) | The native parity assertion `cell 1 mm` for `--interference-cell 1` (`apps/cli/src/native-parity/capture.test.ts:495`) contradicted 6.6. With at least 16 rays per side, the 15 mm Plate x Block box gives a level-0 cell side of 15 / 16 = 0.9375 mm, printed rounded up as `cell 0.938 mm`. The engine is correct. M23e is authorized to change only that expected string to `cell 0.938 mm`; no engine or other assertion changes | 6.6, 8.5 |
| CAP-R6-06 (revision 6, M23d checkpoint amendment round 1) | The shading assertion kept in `nearest_face_wins_and_hidden_is_distinct_from_absent` samples a pixel that the wired picture now hatches, because `support::scene` sets the draw bit and 6.6 hatches interference behind a nearer face. The authorization is extended by one statement: clear `draw_interference` before the single-thread shading render. The assertion, its sample point and the CAP-R5-01 states on the three-thread render (draw bit still set) are unchanged, and hatch coverage stays in `tests/overlay.rs` | 8.5 |
| CAP-R5-04 (revision 5) | The remaining M23 work all meets in `raster.rs`, and native parity needs both crate and CLI, so M23 is not split; one wiring plan, then M16 | 8.5 |
| CAP-R7-01 (revision 7, session 889, owner decision 2026-11-23) | M16 is reduced to docs and help, measured budgets, and the status and progress records. The three revision 4 M16 gates, `mise run verify`, browser tests and the whole native parity suite are deferred and NOT yet run; they run after the workflow on the tree merged with `feat/cad3d-pages`. M16 runs targeted gates only and its artifact root is `target` alone; tests that write under the repository `tmp/` (native parity) are excluded by explicit file lists. This supersedes the M16 gate list and the M16 `tmp` evidence root; it is not an open question | header, 8.5, 15 |
| CAP-R7-02 (revision 7) | The help's exit-code line omitted exit 1 of 4.2; it now lists 0, 1 and 2 as 4.2 defines them. One help line points to the desktop Export dialog and `docs/capture.md`. Help text only; no option or behaviour changes | 4.4 |
| CAP-R7-03 (revision 7) | Measured values come from logs M16 writes under `target/capture-m16/` with a recorded method (10.3): machine record, release crate timings, release native CLI timings and sizes, and the Bun 20,000-element scene build (`bun-scene.log`). Rows owned by the deferred native parity suite are not re-measured and may cite the earlier accepted logs, labelled as such | 10.3 |
| CAP-R7-04 (revision 7) | Until M16 is complete, the header and the overview record M1 to M15, M17 to M20, M22 and M23a to M23f as accepted and M16 as pending. Only after the M16 deliverables, its three targeted gates and its per-plan review are complete does M16 mark every milestone row of the overview progress table `accepted`, M16 included, and change the header status to "implemented (slice); every milestone accepted". Both final records keep the sentence that full repository verification is deferred and NOT yet run. If a gate fails, M16 stays pending and the failure is reported as a blocker. The overview evidence-roots row for M16 changes from `tmp` and `target` to `target`. No Completed entry in `impl-plans/README.md`, because that index means "passed final verification" | header, 8.5, 15 |
| CAP-R7-05 (revision 7, session 891 design review M16B-01, M16C-02) | Each gate attempt gets a new, complete log whose last line is the status of the whole gate after all of its assertions. Nothing is truncated or sent to `/dev/null`. The session 889 M16b verification 3 sent its test output to `/dev/null`, so `target/capture-m16/gate-3.log` holds only `exit=0`. That log stays as history, and the repaired check is rerun into a new log. Measurements and 10.3 values are unchanged | 8.5 |
| CAP-R7-06 (revision 7, session 891 design review M16C-01) | The accepted status is published only by the integration commit, after final G1 to G3 and the per-plan review have passed on the exact candidate, identified by file hashes. A preliminary gate failure restores nothing, because no status edit exists yet. A failed candidate gate or a rejection puts both records back to pending, using only that candidate attempt's own snapshot (`target/capture-m16/gates/candidate-<n>.*`) and the hashes recorded for it. The status check asserts the required content of the owned sections (no HTML comments, deferral text in the prose after the Progress table, an exact Evidence roots row), not just a match anywhere in the file (review rounds 1 and 2 of M16C-01). This replaces the session 889 trade-off "16c marks M16 accepted before its own Step-6 review"; `capture-s889-dispatch.json` stays as history | 8.5 |

## 19. Revision 8: audit round 1 corrections

Source: audit round 1 of `feat/ai-capture`, base `0a35708` (0.10.5) to
`eb7d8c9`, sixteen major findings. The two low findings
(`function-force-identical-rewrite`, `performance-identical-capture-file-copy`)
are out of scope. The editor half of F2 and findings F3, F6, F8, F12 and
F14 are specified in `design-docs/specs/design-cad3d.md` section 19; this
section gives the capture rules, the common test rule and the plan
grouping for all sixteen.

Common rules. Every fix ships a test that fails on `eb7d8c9` and passes
after the fix; for a performance finding the test asserts a deterministic
count (visits, reads, comparisons, candidates, allocations), never a wall
clock. Admitted captures keep their bytes: no golden, digest, error code or
message changes unless a rule below names the change. Indexed reads
type-check under `noUncheckedIndexedAccess`. Heavy per-vertex work stays in
Rust on the native CLI.

### 19.1 Rules

F1 `function-open-mesh-multitarget-cut` (high). The app evaluates an open
imported mesh as display-only: the mesh feature fails `cad.mesh.open`, has
no body, and a feature that targets it fails `cad.body.missing`, so a cut
of a block and an open triangle leaves the block unchanged
(`packages/core/src/cad/evaluate.ts`, target loop of the extrude branch).
Capture now decides this before a feature is committed to any target:

- Eligibility rule. The app hands the welded mesh to Manifold and retries
  once with every triangle reversed. A kernel rejection or an empty solid
  becomes `OpenMesh` (`packages/core/src/cad/evaluate.ts:343-397`), so the
  mesh is display-only. Capture does not run Manifold; it applies a
  conservative rule. A mesh is a Boolean target only when all of these
  hold, in this order:
  - (a) Closure, the rule of `crates/capture/src/mesh.rs` `is_closed`:
    index range, finite coordinates, non-zero cross-product area, every
    undirected edge shared by exactly two triangles.
  - (b) Consistent orientation: for every directed edge `(u, v)` of a
    triangle, `(v, u)` occurs in exactly one other triangle and `(u, v)` in
    no other.
  - (c) No two triangles use the same three vertex indices in any order.
    This rejects paired coincident faces, including a double-sided
    triangle.
  - Revision 18 (29.1 R12-6) replaces (a) to (c) for edges used by more
    than two triangles and for coincident faces between touching closed
    shells. Edges used by exactly two triangles keep the rules above.
  - (d) Not empty by the editor's own emptiness test.
    `packages/cad-kernel/src/manifold-kernel.ts:155-165` treats a solid as
    empty when `volume === 0 || 2 * |volume| < area * 5e-7`: its
    thickness, volume over area, is below half the 1 nm grid. Capture
    applies the same test to the mesh as given:
    - Mesh-local origin: `o` is the position of vertex 0, the first
      vertex in the canonical NMESH order and identical in both decoders.
      Every term uses `q = p - o`, computed per coordinate in doubles from
      the decoded millimetre positions.
    - `V` is the signed volume, the sum over triangles of
      `qa . (qb x qc) / 6`, accumulated in triangle order with the same
      operation order in Rust and TypeScript.
    - In exact arithmetic `V` does not depend on `o`. Using local
      coordinates avoids subtracting nearly equal world-scale products:
      world coordinates gave a flat shell at 9000 mm a spurious
      `V = -2.2e-5 mm^3` (R2 of round 5).
    - `A` is the surface area, the sum of `|(qb - qa) x (qc - qa)| / 2`,
      in the same order;
    - the mesh is a target only if `V != 0` and `2 * |V| >= A * 5e-7`
      (millimetre units, as in the kernel).

    The test depends on thickness, not on the longest extent. This rejects
    flat closed shells and keeps long thin solids. The kernel measures in
    `Float32` positions, so a mesh within rounding of the threshold may be
    classified differently; such a mesh is outside the tested boundary.

  Rules (b) to (d) do not depend on the global orientation, so an outward-
  and an inward-wound solid both pass, as both pass in the app.
- Tested boundary. Equivalence with Manifold is claimed only for these
  fixtures, all written by `packages/nmesh` with vertices `(0,0,0)`,
  `(1,0,0)`, `(0,1,0)` and `(0,0,1)` unless noted:

  | Fixture | Triangles | Rule that rejects it | Expected `booleanTarget` and worker |
  | --- | --- | --- | --- |
  | Tetrahedron | `[0,2,1, 0,1,3, 0,3,2, 1,2,3]` | none | true, ok |
  | The same, every face reversed | | none | true, ok |
  | Mixed winding (V2 of round 2) | `[0,1,2, 0,1,3, 0,3,2, 1,2,3]` | (b) | false, `cad.mesh.open` |
  | Single triangle | `[0,1,2]` | (a) | false, `cad.mesh.open` |
  | Double-sided triangle (V2 of round 3) | `[0,1,2, 0,2,1]` | (c), also (d) | false, `cad.mesh.open` |
  | Coplanar tetrahedron (four coplanar vertices, consistently oriented; V4 of round 3) | | (d) | false, `cad.mesh.open` |
| Thin bar, outward-wound 1000 x 0.01 x 0.01 mm box, 8 vertices and 12 triangles (R2 of round 4) | | none (V = 0.1 mm^3, A ~ 40 mm^2, 2V = 0.2 >= 2e-5) | true, ok |
| Translated flat shell (R2 of round 5): coplanar tetrahedron at (9000.001,9000.007,9000), (9000.012,9000.007,9000), (9000.001,9000.020,9000), (9000.018,9000.026,9000) | `[0,2,1, 0,1,3, 0,3,2, 1,2,3]` | (d) with the local origin | false, `cad.mesh.open` |
| Translated thin bar: the thin bar moved by (9000, 9000, 9000) mm | | none | true, ok |

  Outside these fixtures the rule may still differ from Manifold; that is
  recorded as a residual risk, not claimed as equivalence. The
  worker-parity test below is the evidence for the table.
- Decoder contract (plan A). The capture mesh decoder (`CaptureMeshDecoder`
  in `cad-request.ts`) returns, besides `positions` and `triangles`,
  `booleanTarget: boolean` (the rule above) and `bounds: {min, max}` in
  millimetres. The native decoder computes both in Rust in
  `crates/capture/src/nmesh.rs` (calling `mesh::is_closed`, then the
  checks (b) to (d)); `mesh.rs` is not edited by plan A. The TypeScript
  decoder (`packages/io/src/nmesh/capture-decoder.ts`, used by the desktop
  webview and Bun) ports the same four checks with the same operation
  order, so the doubles of (d) are identical. The nine fixtures of the
  table are stored under `crates/capture/tests/fixtures/`; the existing
  `tetrahedron.nmesh.txt` is the first one.
  - `crates/capture/src/nmesh.rs` tests and
    `packages/io/src/nmesh/capture-decoder.test.ts` assert the table's
    `booleanTarget` and identical `bounds` for every fixture.
  - `packages/cad-kernel/src/worker-host.test.ts` evaluates each fixture
    alone with the real Manifold worker and asserts the table's worker
    column (ok or `cad.mesh.open`), which is the same as `booleanTarget`.
- Construction walk (plan B). `visitCadConstruction` accepts
  `"display-only"` as a result of `visitor.mesh`. Capture returns it when
  `booleanTarget` is false. Such a mesh keeps status ok and its body
  (drawn exactly as today), but it is not added to the walk's set of
  Boolean targets. The existing absent-target check then fails a later
  `add`, `cut` or `intersect` with any such target as `cad.body.missing`
  (the mesh-target code of `missingTarget`) before `visitor.tool` runs, so
  no target receives a step. Dependants fail through the existing
  dependency rule (`cad.reference.failed`). `cad check` and the wireframe
  keep their boolean mesh visitor and are unchanged.
- Display. The Rust renderer is not changed. It still classifies with
  `is_closed` alone (section 6.7), so the picture of every mesh is
  unchanged, and it still ignores later steps on an open-source body.
- Tests (fail before). Worker
  (`packages/cad-kernel/src/worker-host.test.ts`) and capture
  (`packages/core/src/capture/scene.test.ts` plus a crate or Bun pixel
  comparison) run the same documents: a 10 x 10 x 5 mm block and a
  2 x 3 mm through-cut targeting the block and (1) a single-triangle mesh,
  (2) the mixed-winding tetrahedron, (3) the double-sided triangle, (4) the
  coplanar tetrahedron, (5) the translated flat shell at 9000 mm, with
  the block and the cut unchanged, as in R2 of round 5. In each, the cut
  fails with
  `cad.body.missing`, a sketch on the cut's face fails as a dependant, the
  block has no difference step, the mesh surface is present, and the
  block's pixels equal a capture with the cut suppressed. Positive
  controls, where the worker reports ok for the mesh and the cut and
  capture appends one difference step to both bodies with no error:
  - the same cut with the consistently wound tetrahedron, in each global
    orientation;
  - the R2 document: the thin bar and the block as targets of the 2 x 3 mm
    through-cut at XY (2, 2);
  - the translated thin bar with the block and the cut unchanged.

F2 `function-pcb-reference-page-kind` (high). Both capture entry points
pass `collectCadInput(document, page.id, revision).elements` instead of all
document elements: the CLI in `apps/cli/src/capture-command.ts` (MCP
capture runs this command, `apps/cli/src/mcp-image.ts`, so it is covered)
and the desktop `captureCadImage` in
`apps/desktop/src/shell/export-handlers.ts`. A board whose page is no
longer a PCB page is then absent from `scanCadPage`, and capture reports
`cad.reference.missing` for the reference exactly as `cad check` does.
`construction.ts` is unchanged, because it receives only collected input.
Picker and the commit-time guard: cad3d section 19 (the guard needs the
`board-picker.tsx` amendment Q1 of
`design-docs/user-qa/ai-capture-audit-r1.md`). Tests:

- `apps/cli/src/capture-cad.test.ts`: convert the board's page to
  freeform; CLI capture reports `cad.reference.missing`, like `cad check`
  on the same document, and draws no reference body.
- `apps/desktop/src/shell/export-handlers.test.ts`: the desktop handler
  gives the same result.
- After Undo of the conversion, both draw the reference body again.

F4 `performance-capture-point-limit-after-allocation` (high). The writer's
rule (`scene-binary.ts`, `validate`) is a running total, in tool push order
over all tools (also tools of hidden features), of prism loop point counts
after normalisation (`points.length / 2` per kept loop) and mesh vertex
counts, checked after each tool against `MAX_POINTS = 4,000,000`; the
per-loop and mesh-vertex bounds are checked first. `scene-binary.ts`
exports that check as one function, used by the writer and by
`buildCadCaptureModel`.

Existing precedence (`cad-request.ts:58-129` and the writer). These errors
are raised in this order, and the first one wins:

1. The no-body message, with every feature error.
2. The interference cell range.
3. The body-query errors.
4. Camera and frame errors (`camera.ts`, partly dependent on the fitted
   bounds of all bodies).
5. The writer's own checks, in its order: the request header, `tool
   count` and `body count` (at most 20,000 each), then per tool the loop
   or mesh bounds and the running total. The limit is the first total
   above 4,000,000.

The point-limit message is reached only when none of 1 to 4 fires, and the
no-body and body-query diagnostics outrank it (confirmed by V5 of round 3).
The fix keeps this order exactly, with no exception and no user decision,
by splitting the work into two walks over the same construction history.

Capture walk (allocating). The builder's capture visitor builds tools as
today, but charges every tool before allocating:

- Prism. The count comes from the normalised loops before any typed array
  exists. The per-loop bounds and the running total are checked first;
  only a passing tool allocates its `Float64Array`/`Uint32Array`.
- Mesh (the A/B seam, contract owned by plan A). `CaptureMeshDecoder`
  takes `{ maxVertices }`. It always validates exactly as a full decode
  does, in the same order, so `cad.mesh.invalid` keeps its meaning. It
  also returns `vertexCount`, `bounds` and `booleanTarget`.
  - It returns `positions` and `triangles` only when `vertexCount <=
    maxVertices`.
  - Indexed access. Validation needs no random vertex access, which makes
    a streaming check possible:
    - positions are delta-coded against the previous vertex only
      (`decode.ts:70-80`, `nmesh.rs:137-150`), so the range check and
      `bounds` need three running coordinates;
    - triangle codes are checked against a running `used` counter
      (`decode.ts:81-89`), so the index check needs no positions.

    When `vertexCount > maxVertices`, the decoder therefore makes one
    streaming pass with O(1) scratch (previous vertex, min/max, counters)
    and the same error order.
  - `booleanTarget` does need indexed vertices, for the area, volume and
    edge rules. In the over-limit path it is computed only when the caller
    asks for it (`{ needTarget: true }`). The builder asks only for a mesh
    that some later `add`, `cut` or `intersect` in the history targets,
    which is known before the walk from `history.targets`.
  - For such a mesh, the allowed decoder scratch is its quantized integer
    positions, its index list and the edge list. They are bounded by the
    1 MiB inline cap, freed before the next feature, and never converted to
    millimetre `Float64` capture geometry.
  - The payload buffer from the inline armor is input, not geometry.
  - Rust lives in `nmesh.rs`. TS lives in `packages/nmesh/src/decode.ts`,
    through an optional second argument of the existing `decodeNmesh`
    export (`index.ts` unchanged) and `capture-decoder.ts`.
  - The builder passes `maxVertices = MAX_POINTS - points`, so an
    overflowing mesh never allocates its geometry arrays.
- First excess. The capture visitor stops. It never runs again for this
  request, so no later capture tool, step or typed array is created. The
  builder records the writer's exact limit message as the pending
  `overLimit`.

Metadata walk (non-allocating). The construction walk continues with a
second, metadata-only visitor:

- It records what the remaining precedence needs and nothing more:
  - statuses and feature errors;
  - each visible body's id, name, reference flag and conservative bounds
    (the same `normaliseToolLoops` and `sweptBounds` computation the
    capture tool uses, so the doubles are identical, and mesh `bounds`);
  - the tool and body counts.
- Meshes are decoded with `maxVertices = 0`: streaming validation and
  `bounds`, plus `booleanTarget` only for a mesh that a later feature
  targets. No geometry is returned, so display-only targets fail later
  features exactly as in the capture walk.
- It allocates no capture tool and no capture typed array.
- No per-feature tool geometry is rebuilt or retained in the tail.
  Today `history.ts:489-500` builds a fresh profile for every extrusion,
  and `construction.ts:104-116` keeps every extrusion's geometry in
  `geometry.extrudes` (R3 of round 4: 64 uses of one rectangle give 64
  point arrays). Two changes, both in all walks:
  - Shared contours (`history.ts` only; `loops.ts` and its sweep, owned
    by plan L, are not edited). Today `buildLoops(entities, pick)`
    (`loops.ts:290-399`):
    1. builds every profile of the whole sketch;
    2. validates them (open, branch, intersect, and a winding-0 profile
       anywhere fails);
    3. computes each depth against all profiles;
    4. keeps, in profile order, the counter-clockwise loop of each profile
       whose `members` meet `pick`;
    5. returns `cad.profile.empty` (no `at`) when none is kept.

    Steps 1 to 3 and every error before step 4 do not depend on `pick`.
    So `createCadGeometry` calls `buildLoops(entities)` (no pick) once per
    sketch id and memoises the result: the loop list or the error.
    - Each extrusion then resolves its selection against that list: the
      loops whose `members` meet the selection, in list order, or
      `cad.profile.empty` without `at` when none meet it. With no
      selection, all loops are kept.
    - This is exactly the current output, but the `CadLoop` objects and
      their `points` arrays are shared by contour identity. An extrusion
      holds only a short array of references. Different member ids that
      select the same contour therefore share one point array.
    - The frame, span and status are still computed per feature, including
      the `cad.limit` extent check, which only iterates points. Statuses
      are therefore exact.
    - Loop values are identical, so the capture tool arrays and admitted
      bytes do not change.
  - Reference-only retention. Before the walk, the set `R` of features
    whose faces some sketch plane references is read from the history
    (`history.ts` face dependencies). `geometry.extrudes` keeps an entry
    only for features in `R`, because only a face reference reads it.
    Features in `R` keep their frame, span and shared loops; nothing is
    recomputed for them. Every other feature's geometry is dropped once
    its status and bounds are known.
- Remaining tail cost: per later feature, time proportional to its loop
  points for the extent check and `sweptBounds`, with no allocation that
  grows with the feature count. Memory grows with the number of distinct
  profiles and with `R`, not with the number of extrusions.

`prepareCadCapture` (plan B, after plan C's resolver) then applies the
existing order to the full metadata:

1. The no-body message, with all feature errors.
2. The cell range.
3. Body queries (plan C's resolver over the full body list, in history
   order).
4. Camera and frame, from the full bounds.
5. The writer's pre-tool checks (request header, tool and body counts),
   exported from `scene-binary.ts` as one function that the writer also
   uses.
6. Only then the pending `overLimit`, as `CaptureInputError(message,
   undefined, true)`.

Admitted requests never enter the metadata walk, so their model, scene and
image bytes are unchanged. The CLI exit code (2) and every message are
unchanged.

The builder takes an optional test-only `stats` object with separate
counters:

- `captureVisits`: capture-visitor calls (tool and mesh);
- `toolArrays`: capture tools whose typed arrays were created;
- `metadataVisits`: metadata-visitor calls;
- `profileBuilds`: `buildLoops` calls made by `createCadGeometry` (at most
  one per sketch);
- `pointArrays`: distinct `points` arrays reachable from the loops handed
  to features, counted by identity;
- `retainedTools`: entries kept in `geometry.extrudes`.

Decoder allocations are counted where they happen, not from what the
decoder returns. The TS `decodeNmesh` takes a test-only `onAllocate(kind,
length)` hook, called at every array allocation site:

- quantized positions;
- triangles;
- the `toTriangleMesh` millimetre positions in `capture-decoder.ts`;
- the target scratch.

The Rust decoder exposes an internal `decode_with_stats` used by its unit
tests, counting each `Vec::with_capacity` site the same way. A discarded
array is therefore still counted.

Each sentinel is identified by feature id, so a test can assert that the
capture visitor never received it.

Tests (all fail before; Bun tests in `packages/core/src/capture/scene.test.ts`
and `cad-request.test.ts`):

- Admitted. One sketch is reused by visible `new` extrusions so that the
  total lands exactly on 4,000,000 points (for example a 2,000-edge sketch
  and 2,000 extrusions). The scene bytes equal the digest recorded in the
  pre-fix run, and `metadataVisits` is 0.
- Visible prism overflow, then sentinels. One more extrusion overflows,
  followed by a sentinel extrusion and a sentinel mesh. The result is the
  existing message. `toolArrays` equals the tools before the excess. No
  capture visit happens after the overflowing tool, and the overflowing
  prism allocated nothing. Neither sentinel reaches the capture visitor,
  and the decoder records no geometry allocation after the excess.
- Mixed mesh overflow, with an instrumented decoder. Prism tools sit just
  below the limit, then a visible mesh overflows, then a sentinel mesh.
  With `onAllocate`, the overflowing mesh and the sentinel each record
  zero allocations of positions, triangles and millimetre positions.
  Neither is targeted, so neither records target scratch either. The
  message is the writer's.
- Targeted mesh after the excess. A later cut targets the overflowing
  mesh. Only the target scratch is recorded, and the cut's status equals
  the pre-fix run.
- Long unreferenced tail. One visible sketch is reused by enough `new`
  extrusions to pass the limit, followed by 1,000 more unreferenced
  extrusions of the same sketch and a mesh sentinel. `profileBuilds` is
  1, `retainedTools` stays at `|R|` (0 here), and `captureVisits` and
  `toolArrays` do not grow after the excess. This fails before: R3 shows
  one profile array per extrusion.
- Distinct member selections (R3 of round 5). One closed 64-edge sketch
  and 64 `new` extrusions, each with `loops: [edgeId]` naming a
  different member edge of the same contour.
  - `pointArrays` is 1 and `profileBuilds` is 1; before the fix both are
    64.
  - The extrusions' loops, depths, statuses and capture tool bytes equal
    the pre-fix run.
  - The same pattern placed after the point-limit excess keeps
    `pointArrays` at 1 and adds no capture visits or tool arrays.
  - Selection-semantics regressions keep their results: a selection of no
    contour gives `cad.profile.empty` without `at`; a selection of a
    nested contour keeps its whole-sketch depth; a winding-0 profile
    outside the selection still fails; the existing `loops.test.ts` and
    `history` tests pass unchanged.
- Face reference in the tail. A sketch on a face of an extrusion after
  the excess, then an extrusion of it: `R` holds that feature, the
  status of both features equals the pre-fix run, and `retainedTools`
  is 1.
- Rust (`nmesh.rs` unit tests, `CARGO_TARGET_DIR=target/plan-a cargo test
  -p nodetto-capture`): `decode_with_stats` with `maxVertices` below the
  count reports zero geometry allocations and the same validation errors
  as the full decode for each corruption case of
  `rejects_what_the_reference_decoder_rejects`.
- Hidden-only overflow, with the same sentinels. Capture visits stop at the
  excess, exactly as in the visible case. The metadata walk then gives the
  no-body message and feature errors equal to the pre-fix run, with
  `toolArrays` and the decoder geometry allocations frozen at the excess.
- Body-query precedence (`cad-request.test.ts`, the V5 shape). A visible
  over-limit model with `--interference-bodies nonexistent,mesh-0` gives
  the existing unknown-body error. The same model with a valid query gives
  the point-limit error. A query that names a body created after the
  excess resolves (it is in the metadata), so the result is the
  point-limit error, as before.
- Writer pre-tool precedence. The shared pre-tool function runs before
  `overLimit`. A unit test gives it an over-limit model and a request with
  an out-of-range header field (for example `supersample` 4 through the
  writer options) and expects the header error, as the writer gave
  before.
- Native NCS1 and image, in the native engine test
  `apps/cli/native/src/engine_tests.rs`, which intercepts
  `native.captureSolid` with the existing pattern at `:382-386`. It runs
  with `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/plan-b cargo test -p
  nodetto-cli`.
  - For the admitted document, the observed NCS1 bytes and the image bytes
    equal the digests recorded by the pre-fix run.
  - The over-limit document exits 2 with the existing message, and
    `captureSolid` is never called.
  - Inline meshes may supply most of the points so that the Boa walk stays
    in the test's time class; prism extrusions cross the threshold and
    supply the sentinel.
- Native CLI parity. The same two documents through the release binary
  (`CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/plan-b cargo build
  --release -p nodetto-cli`, then `NODETTO_CLI_TEST_BINARY=...` `bun test
  apps/cli/src/native-parity/capture.test.ts`) give the pre-fix stdout,
  the image bytes, and exit 2 with the message.
- The plan records the native durations. If one exceeds its class, the
  plan reports that instead of dropping the case.

F5 `performance-interference-boundary-fold` (high). Every lattice fold in
`lattice.rs` charges `|accumulated|`, the boundaries carried from earlier
steps, before each `combine`. That covers the pair cast (used by analysed
pairs and by the view pairs of `add_view_pairs`) and the census fold
`sample_body_axis`, which is the same mechanism. The tool's own intervals
are not charged: they are linear in the steps and already bounded by ray
work.

Rule (one rule, local to one lattice request, so no state crosses requests
or threads):

- `w = max(1, ceil(s / 8))`, where `s` is the step count the request
  folds: the active steps of the two bodies for a pair request (the list
  `sample_axes` already builds, not the candidate's `weight`, which is 1
  for view pairs), and the body's step count for a census request.
- A combine may run only if `reads + charge <= 64 * w * (rays + 16)`,
  where `reads` and `rays` are the boundary reads and rays already
  executed in this request, counting the current ray. A request is
  processed in a fixed axis, row and cell order on one thread, so the
  outcome does not depend on the thread count.
- Exhaustion. The combine is not run, the current ray counts as a miss,
  no further ray of the request is cast, and the axis sample sets a new
  flag `boundary_exhausted` in addition to `capped`. The flag is distinct
  from refinement capping and travels `AxisSample` to `PairSample`.

Report outcomes for every capped exit:

- Analysed pair. `capped` is set, so it counts in `cappedCount`, is
  listed in `cappedWithoutHit` without a hit and is `approximate` in JSON.
  Hits found earlier stay reported.
- View pair with a report. Its `capped` is set as above.
- View pair without a report (no hit before exhaustion, one of the first
  `VIEW_PAIR_SAMPLES = 64`). The fallback report is `capped` when
  `index >= VIEW_PAIR_SAMPLES` or `boundary_exhausted`. Today it reads only
  the index, so it is `approximate` with volume 0 (printed as unmeasured)
  instead of looking fully measured. For admitted cases `boundary_exhausted`
  is false, so refinement caps and view fallbacks are unchanged.
- Census (`census.rs` is not edited). On exhaustion `sample_body_axis`
  returns `capped` and sets its `budget_left` to 0. The existing
  `census::resolve` then marks the body `unknown` (incomplete with zero
  budget) and charges its whole remaining allotment. A later suspect body
  gets at most the remainder, which is less than one weighted ray per step
  of the exhausted body. It is `unknown` unless that remainder settles it.

Bounds:

- Analysed pairs: reads are at most 64 x the weighted rays they cast (at
  most twice the analysis budget) plus a slack of 64 x 16 x w per pair.
- View pairs: at most 64 sampled, each at level 0 only (refinement 0),
  with reads at most 64 x w x (rays + 16) each.
- Census: reads are at most 64 x the census weighted rays plus the same
  slack per axis call.

All bounds hold whatever the step count.

Tests (crate, `CARGO_TARGET_DIR=target/plan-g`), through an internal entry
that returns executed reads:

- 1,000 separated internal cuts over a 20 x 20 mm footprint, a second
  overlapping body and a side-view camera: reads stay within the bound, the
  pair is `capped` and the report is approximate. This fails before, when
  reads exceed the bound by orders of magnitude.
- The same body pair forced into the picture-only path with no hit before
  exhaustion: the fallback is `capped`.
- Two suspect census bodies that both exhaust: both `unknown`.
- Admitted cases (the plate fixture, the 600-hole pair, the 200-body
  shared-loop case, the view-pair tests): reports and image bytes are
  identical at 1 and 8 threads and equal the existing digests. The pre-fix
  run records the largest reads-to-allowance ratio over the existing
  interference and census tests. It must be below 1; otherwise the plan
  stops and reports instead of changing a verdict.

F7 `function-interference-full-body-id` (medium). The indexed resolver
stays in `packages/core/src/capture/cad-request.ts`, the existing owner, as
a module-private function called from `prepareCadCapture`. No new
production file is added. It resolves `--interference-bodies`:

1. Deduplicate queries, keeping the first occurrence.
2. Build once an id map, a name map (name to body indices) and an id list
   sorted by UTF-16 code units.
3. Per query: an empty query fails; an exact id selects that body;
   otherwise the distinct bodies whose name equals the query or whose id
   starts with it (a binary-searched range of the sorted ids) must be
   exactly one.
4. The first failing query in input order throws the existing message
   `Body query "<q>" is unknown or ambiguous. Bodies: <names>.`; the name
   list is built only then. Fewer than two distinct bodies keeps its
   message. Indices are returned in ascending order.

For tests, the resolver adds its lookup count to an optional test-only
`stats` field of the request. Tests in `cad-request.test.ts`: `part,part-extra` selects both, a full id wins over
another body's equal name, a truly ambiguous prefix still fails,
duplicates are accepted, the order is stable, and 500 queries over 5,000
bodies make about queries x log2(bodies) lookups instead of 2,500,000.

F9 `performance-native-mesh-bounds` (medium). The Rust decode pass returns
`bounds` (and `booleanTarget`, F1) with the decoded geometry. Bounds of
millimetre positions equal the current `min(q) / 1000` values bit for bit,
because division by 1000 is monotone. Traced paths:

- Native shaded capture. `apps/cli/src/native-engine.ts` `decodeMesh`
  reads the new fields from the `nmeshDecode` packet
  (`apps/cli/native/src/engine.rs`, `crates/capture/src/nmesh.rs`). The
  value goes through `CommandIo.decodeMesh` (`apps/cli/src/commands.ts`,
  whose return type becomes the `CaptureMeshDecoder` result), then
  `apps/cli/src/capture-command.ts` (unchanged; it already forwards
  `io.decodeMesh`), then `renderCadCapture` (`capture-cad.ts`), then
  `prepareCadCapture`. Finally `scene.ts` uses `bounds` instead of
  `pointBounds(positions)`. The Bun and desktop decoder
  (`capture-decoder.ts`) computes the same fields in TypeScript.
- Native construction-view export. `apps/cli/src/export-command.ts` calls
  `editor.exportPageSvg`, which goes through `page-editing.ts` (forwards
  options unchanged; not edited) to `renderPageSvg` in
  `packages/core/src/svg-export/document.ts`, which calls
  `cadPageWireframe(elements, pageId)`. A new optional per-call option
  `meshBounds?: (data: string) => { min: Vec3; max: Vec3 } | null`:
  - is declared in `SvgExportOptions` (`packages/core/src/svg-export/theme.ts`);
  - is forwarded by `renderPageSvg` to `cadPageWireframe(elements, pageId,
    { meshBounds })`;
  - is passed by `export-command.ts` from a new optional
    `CommandIo.meshBounds`, which `native-engine.ts` implements with a
    bounds-only Rust host function (decode in Rust, return six doubles, no
    position transfer).

  Without the option (browser, Bun, desktop) the current TypeScript path
  runs. A decode failure returns null and keeps the current empty-corner
  result.
- Scope. `commands.ts`, `svg-export/theme.ts` and `svg-export/document.ts`
  are outside the finding's file list. They are the minimal amendment
  this path needs: one type change and one optional member in
  `commands.ts`, one optional member in `theme.ts`, and one forwarded
  argument in `document.ts`. The amendment is recorded for confirmation in
  `design-docs/user-qa/ai-capture-audit-r1.md` (Q2, recommended answer:
  approve). Plan A edits these three files only after Q2 is approved; the
  strict decoder typing on the native capture path needs `commands.ts`
  too, so all of plan A waits for Q2. The other plans do not depend on
  Q2, except B and C, which wait for A.

Tests:

- Native (release `nodetto-cli` built with
  `CARGO_TARGET_DIR=target/plan-a`), through the real commands:
  `nodetto-cli export` of a page with a large inline mesh gives an SVG
  byte-equal to the pre-fix output, and a test-only counter on the TS
  decoder path (`decodeNmesh` call count in the wireframe module) stays 0.
  `nodetto-cli capture` of the same page gives the pre-fix camera and frame
  lines and image bytes.
- Bun: `cadPageWireframe` with and without `meshBounds` gives equal SVG.
- The decoder fixture parity of F1 passes.

F10 `performance-desktop-capture-byte-arrays` (medium). Only the capture
transport changes. Request: `invoke("capture_solid", scene, { headers:
{ "x-nodetto-format": format, "x-nodetto-quality": String(quality) } })`
with the scene as the raw body. The Rust command takes
`tauri::ipc::Request`, rejects a non-raw body or bad headers with the
existing format and quality messages, and returns `tauri::ipc::Response`
whose body is the reply framing of section 6.3: `u32` little-endian report
length, the report JSON, the image. `backend.ts` splits the reply and
returns `{ image: Uint8Array, report: string }`, so the `captureSolid`
signature and `export-handlers.ts` do not change. `writeBytes` is not
changed. Tests: a backend test with an injected `invoke` and a
1,179,856-byte scene asserts that the body is that `Uint8Array` (not an
array), the headers, and the split image and report; the Rust test asserts
that the framed reply splits into the image and report of `render_scene`.

F11 `performance-overlay-sample-allocation` (medium). Overlay marking picks
the nearest eight bodies with material into fixed-size storage ordered by
first boundary depth, then body index, with no per-sample vector, and skips
pair processing when fewer than two bodies have material. Test: a separate
crate test binary with a counting global allocator renders one
screen-filling body and asserts allocations far below the sample count
(fails before: at least two per sample); hatch pixels, pair order and image
bytes equal the current renderer for one body and for more than eight
depth-tied bodies.

F13 `performance-interference-sparse-pairs` (medium). Candidate discovery
sorts the analysed boxes on the axis with the fewest overlapping pairs
(counted in O(n log n) per axis; ties go to X, then Y), sweeps that axis,
and applies the exact three-axis tolerance test to every examined pair.
Pairs go into a bounded selection of the `keep` smallest `(a, b)` in
history order plus a total count, so storage stays `keep` and the output
equals exhaustive enumeration. Step counts are computed for kept
candidates only. Tests: a comparison count for disjoint assemblies along
X, along Y and in a grid stays far below n^2 / 2 and grows near-linearly
when n doubles; ordered candidates, checked prefixes and totals equal an
exhaustive reference on small mixed and dense assemblies; the 2,000-body
test keeps its assertions.

F15 `maintainability-capture-report-contract` (medium). `report.ts`
exports one check of width, height and body count against the request; it
throws the CLI's existing message `The solid capture report does not match
the requested scene.` `capture-cad.ts` and the desktop handler call it
right after `parseSolidReport`, the desktop before `pickExportPath`. Tests:
width, height and body count each varied alone are rejected by both
adapters, and the desktop calls neither the picker nor the writer; the
cancellation tests get a matching report.

F16 `maintainability-capture-body-classification` (medium). One function
classifies every tool once per render (solid or not; meshes through
`is_closed`); the picture's open-body flags, interference candidate
selection and lattice tool bounds all read that result. The standalone
`interference::candidates` and analysis entry points compute it themselves
when none is passed. Tests: an internal render entry reports the number of
closure checks, equal to the number of mesh tools; two overlapping analysed
bodies (solid source then open operand, and open source then solid
operand) give the candidate counts and report states of section 6.7; the
existing mesh, census and overlay tests and digests pass.

### 19.2 Plan grouping

One plan per finding or per group in one module, each about 150 lines or
less, with its own `CARGO_TARGET_DIR` under `target/` and `artifactRoots
["target"]`. Dependencies exist only for shared files or contracts.

| Plan | Findings | Owns | After |
| --- | --- | --- | --- |
| A mesh-decode | F9 and the decoder contract of F1 and F4 (`booleanTarget` rules a to d, `bounds`, `vertexCount`, `maxVertices` without geometry) | `crates/capture/src/nmesh.rs` and the nine fixtures, `packages/nmesh/src/decode.ts` (optional argument of `decodeNmesh`: `maxVertices`, `needTarget`, test-only `onAllocate`), `packages/cad-kernel/src/worker-host.test.ts` (fixture-parity case), `apps/cli/native/src/engine.rs`, `apps/cli/src/native-engine.ts`, `apps/cli/src/export-command.ts`, `packages/io/src/nmesh/capture-decoder.ts` and its test, `packages/core/src/cad/wireframe.ts` and its test, the `CaptureMeshDecoder` type in `cad-request.ts`, mesh bounds in `scene.ts`, the fake decoders in `scene.test.ts` and `cad-request.test.ts`, `apps/cli/src/native-parity/{capture,export}.test.ts`; after Q2: `apps/cli/src/commands.ts`, `packages/core/src/svg-export/theme.ts`, `packages/core/src/svg-export/document.ts` | Q2 |
| B model-build | F1, F4 | `packages/core/src/cad/construction.ts` (display-only result, reference-only retention), `packages/core/src/cad/history.ts` (per-sketch shared contours in `createCadGeometry`; `loops.ts` untouched) and `history.test.ts` (selection-semantics and pointArrays cases), with the other `packages/core/src/cad/*.test.ts` and `evaluate.test.ts` unchanged and passing, `scene.ts` (capture and metadata visitors), `scene-binary.ts` (shared point rule and pre-tool checks), the precedence flow of `prepareCadCapture` in `cad-request.ts`, `scene.test.ts`, `cad-request.test.ts` (precedence cases), `packages/cad-kernel/src/worker-host.test.ts` (atomic-cut cases), `apps/cli/native/src/engine_tests.rs`, `apps/cli/src/native-parity/capture.test.ts` | A, C |
| C body-selection | F7 | the resolver hunk of `cad-request.ts`, `cad-request.test.ts` (selection cases) | A |
| D pcb-page-kind | F2 | `capture-command.ts`, the `captureCadImage` input in `export-handlers.ts`, `pcb-insert.ts`, `pcb-insert.test.ts`, `capture-cad.test.ts`, `export-handlers.test.ts`; after Q1: `board-picker.tsx`, `viewport.test.tsx` | - (the guard waits for Q1) |
| E report-contract | F15 | `report.ts`, `capture-cad.ts`, the report check in `export-handlers.ts`, `export-handlers.test.ts`, `capture-cad.test.ts` | D |
| F desktop-transport | F10 | `apps/desktop/src/file/backend.ts` and a new adjacent backend test, `apps/desktop/src-tauri/src/capture.rs` | - |
| G boundary-fold | F5 | `lattice.rs` folds and flag, `interference.rs` view fallback and `PairSample`, new crate tests; `census.rs` is not edited | - |
| H overlay | F11 | `raster.rs` overlay hunk, `overlay.rs`, new allocator test binary | - |
| I pairs-classification | F13, F16 | `interference.rs` candidates, `lattice.rs` tool bounds, `raster.rs` setup, `mesh.rs` | G, H |
| J to M | F3, F6 with F14, F8, F12 | `design-docs/specs/design-cad3d.md` section 19 | - |

Waves: D (except the Q1 guard), F, G, H and J to M first; A as soon as Q2
is approved; then C after A and B after C (both edit `cad-request.ts`, and
B's precedence calls C's resolver); E after D; I after G and H.

### 19.3 Decisions on the intake unknowns

- The census fold uses the same accumulated-boundary `combine`, so it gets
  the F5 accounting, entirely inside `lattice.rs` (no `census.rs` edit).
- Scope amendments that need confirmation are listed in
  `design-docs/user-qa/ai-capture-audit-r1.md`: Q1 (`board-picker.tsx`,
  F2 guard) and Q2 (`commands.ts`, `svg-export/theme.ts`,
  `svg-export/document.ts`, F9 and the decoder typing of F1). F7 and F12
  need no amendment.
- F4 keeps the full existing diagnostic precedence (no-body, cell,
  body query, camera and frame, writer pre-tool checks, then the limit)
  through a pending `overLimit` and a non-allocating metadata walk. No
  exception and no user decision is needed.
- F1 eligibility is a conservative rule (closure, consistent orientation,
  no duplicate vertex triple, and the kernel's own emptiness test
  `V != 0 && 2|V| >= A * 5e-7` from `manifold-kernel.ts:155-165`). Its
  agreement with the Manifold worker is claimed only for the nine tested
  fixtures. Revision 18 (29.1 R12-6) adds touching closed shells (edge
  contact and face contact, with either shared-face triangulation) and
  extends the claim to those three fixtures.
- Tauri transport: raw request body with headers and an `ipc::Response`
  carrying the existing reply framing (F10).
- MCP capture runs the CLI capture command; F2 needs no MCP change.
- The point rule is the writer's, shared through one exported function
  (F4).
- The boundary allowance is 64 reads per weighted ray (F5); the pre-fix run
  shows that existing tests stay under it. If one does not, the plan stops
  and reports instead of changing a verdict.
- Each performance plan records its baseline count on `eb7d8c9` in its
  pre-fix run.

### 19.4 Intentional differences

- Capture does not report a display-only mesh's own feature as
  `cad.mesh.open` (the app does); it stays a body as before, so existing
  reports and codes do not change. Only features that target it change.
- `cad check` does not classify mesh closure, so it does not fail a feature
  that targets an open mesh; it stays the structural check (cad3d section
  6.6). Capture and the app agree.
- The renderer keeps classifying meshes with `is_closed` alone. A mesh
  that passes `is_closed` but fails F1 rule (b), (c) or (d) is therefore
  still drawn and analysed as a solid (unchanged picture), although it is
  not a Boolean target (F1) and the app shows it display-only. Changing
  the picture of such meshes is not part of this audit round.

## 20. Revision 9: audit round 2 corrections

Source: audit round 2 of `feat/ai-capture`, base `0a35708` (0.10.5) to
`3cd2401`, ten blocking findings (two high, eight medium). The common
rules of section 19 apply unchanged:

- Every fix ships a test that fails on `3cd2401` and passes after it.
- A performance test asserts a deterministic count, never a wall clock.
- Admitted NCS1, PNG and SVG bytes, goldens, digests, error codes and
  messages do not change, and the existing diagnostic precedence is kept.
- Indexed reads type-check under `noUncheckedIndexedAccess`.
- Per-vertex work stays in Rust on the native CLI.

### 20.1 What round 1 left open

Checked against `3cd2401`. `git grep -e booleanTarget -e maxVertices -e
meshBounds` finds nothing.

- Landed:
  - the nine eligibility fixtures under `crates/capture/tests/fixtures/`
    and their worker-parity case
    (`packages/cad-kernel/src/worker-host.test.ts:415`);
  - per-sketch shared contours and reference-only retention
    (`createCadGeometry`, `packages/core/src/cad/history.ts:439-531`;
    `retainedTools`, `construction.ts:122-126`);
  - the picker's choice filter (`pcb-insert.ts:14-43`);
  - capture's `collectCadInput` input (`capture-command.ts:242`,
    `export-handlers.ts:263`).
- Not landed:
  - the decoder contract (section 19.1: F1 "Decoder contract", the F4
    "Mesh" seam, F9);
  - the display-only walk result (F1 "Construction walk");
  - the charged capture walk and metadata mode (F4);
  - the bounds-only export (F9);
  - the sweep (F13);
  - the once-per-render classification (F16);
  - the picker's commit-time guard (F2, Q1).

Round-2 findings 1, 2, 3, 5, 6 and 7 are therefore these round-1 rules,
which are still valid. Below they are restated only where they change.
Findings 4, 8, 9 and 10 are new.

The Q1 and Q2 decisions in `design-docs/user-qa/ai-capture-audit-r1.md`
read `approved`. No plan in this section is gated on a question, and no
new question is opened.

### 20.2 Rules

R2-1 `function-open-mesh-multitarget-cut` (high). Section 19.1 F1 applies
in full:

- the eligibility rules (a) to (d) and the fixture table;
- the construction-walk result `"display-only"`;
- the unchanged renderer;
- the tests: five negative documents and three positive controls, worker
  and capture side by side, and block pixels equal to the suppressed-cut
  control.

Changes against round 1:

- The decoder contract is R2-D below, which replaces the round-1 text.
- `visitor.mesh` receives a second argument, `{ targeted: boolean }`.
  `visitCadConstruction` computes `targeted` once, before the walk: it is
  true when some feature's `history.targets` contains this mesh.
  - Capture asks the decoder for `needTarget` only when `targeted` is
    true.
  - An untargeted mesh never needs the rule, because nothing can fold into
    it.
- Capture's mesh visitor returns `"display-only"` when `booleanTarget` is
  false. The walk then:
  - keeps the mesh status ok;
  - does not add the mesh to the Boolean body set;
  - fails any later `add`, `cut` or `intersect` that targets it with
    `cad.body.missing`, before `visitor.tool` runs, so no target receives a
    step.

  The mesh's capture body is still created, so the surface stays drawn.
  `cad check` and the wireframe keep returning a boolean.
- The test at `packages/core/src/capture/scene.test.ts:324-342` expects a
  difference step on a single open triangle. It is replaced by the
  single-triangle negative case. The same case with a closed tetrahedron
  keeps the difference step.
- Pixel comparison:
  - A rejected cut never reaches `visitor.tool`, and a suppressed cut is
    skipped by the walk, so neither pushes a capture tool. In
    `scene.test.ts`, `prepareCadCapture` of each negative document
    therefore gives NCS1 bytes equal to those of the same document with the
    cut suppressed. The renderer is deterministic, so equal scenes give
    equal pixels.
  - `apps/cli/src/native-parity/capture.test.ts` runs the same pair
    through a freshly built release binary and asserts equal image bytes,
    a `cad.body.missing` line for the cut and a failed face sketch. The
    single-triangle document and the closed-tetrahedron control run there
    too; the control's image differs from its suppressed-cut capture.

R2-D Decoder contract, shared by R2-1, R2-3 and R2-5. There is one
contract with two implementations, which accept, reject and measure
identically.

- Options:
  - `maxVertices`, default unlimited;
  - `needTarget`, default false.
- Result:
  - `vertexCount` and `triangleCount`;
  - `bounds`: `{ min, max }` in millimetres, null exactly when
    `vertexCount` is 0;
  - `booleanTarget`: present exactly when `needTarget` is true;
  - `positions` (a millimetre `Float64Array`) and `triangles` (a
    `Uint32Array`): present exactly when `vertexCount <= maxVertices`.

  Invalid data throws in TypeScript and returns `None` in Rust, with the
  existing error order.
- The budgeted decoder is a new entry point next to the existing one; the
  existing full-geometry entry points keep their names, signatures,
  packet and callers:
  - Rust: `nmesh::decode_inline` and `InlineMesh::to_packet` are
    unchanged; `decode_inline_with(text, options)` is new.
  - TypeScript: `decodeCaptureMesh(data)` in `packages/io` keeps returning
    required `positions` and `triangles`; `decodeCaptureMeshWith(data,
    options)` is new.
  - Native host: `nmeshDecode(data)` keeps its packet; `nmeshCapture(data,
    maxVertices, needTarget)` and `nmeshBounds(data)` are new.
  - `CommandIo.decodeMesh?(data)` keeps its required-array return type, so
    `apps/cli/src/cad-command.ts:56` still passes it to `checkCadPage`,
    whose `MeshDecoder` (`check.ts:20-23`) requires both arrays.
    `CommandIo.decodeCaptureMesh?(data, options)` and
    `CommandIo.meshBounds?(data)` are new optional members.
  - `CaptureMeshDecoder` becomes the budgeted signature `(data: string,
    options: CaptureMeshDecodeOptions) => CaptureMeshDecodeResult`, with
    `options` required and `positions` and `triangles` optional in the
    result. Only capture uses it.

  So `cad check`, its packet and its types never change, and no reader
  ever sees a packet layout it was not written for.
- Bounds are `min(q) / 1000` and `max(q) / 1000` over the quantized
  integers.
  - They equal `pointBounds` of the millimetre positions bit for bit,
    because division by 1000 is correctly rounded and monotone.
  - Cameras and NCS1 bytes therefore do not change.
- Over the limit, the decoder first reads the header counts. When
  `vertexCount > maxVertices`:
  - It makes one streaming validation pass with O(1) scratch: the previous
    vertex, the running min and max, and the `used` counter. This works
    because positions are delta-coded against the previous vertex only,
    and triangle codes against `used` (`decode.ts:70-89`,
    `nmesh.rs:137-160`).
  - The pass runs the same checks in the same order.
  - It allocates no position array and no triangle array.

  A malformed header takes the full path, so its error is unchanged.
- Eligibility (`needTarget`):
  - In both languages it reads vertex `i` as `q[3i + k] / 1000`, directly
    from the quantized integers, so the doubles of rules (a) and (d) are
    identical. No millimetre position array is materialized for the rule,
    on any path.
  - Over the limit, it needs scratch: the quantized positions, the index
    list and the edge list. That scratch is bounded by the 1 MiB inline
    cap, never converted to millimetre `Float64` geometry, and owned by the
    eligibility function, so it is dropped before the decoder returns; the
    result holds no scratch. Its allocations are reported with kind
    `"target"`.
- Closure input (rule (a) in Rust). `mesh::is_closed(&Mesh)` reads
  millimetre positions from the owned `scene::Mesh`
  (`scene.rs:68-71`), so the decoder cannot call it without building
  `Vec<f64>` geometry. Plan a1-rust-decoder therefore moves the body of
  `is_closed` (`mesh.rs:6-57`) unchanged into
  `mesh::closed_by(vertex_count: usize, triangles: &[u32], position: impl
  Fn(usize) -> [f64; 3]) -> bool`:
  - `is_closed(mesh)` becomes a one-line wrapper with `position = |i|
    [p[3i], p[3i+1], p[3i+2]]`, so the renderer's result and every
    existing `is_closed` test are unchanged;
  - the decoder calls `closed_by` with `position = |i| [q[3i] as f64 /
    1000.0, ...]`, reading the quantized scratch on demand;
  - the `positions.len()` multiple-of-three check stays in the wrapper,
    which passes `vertex_count = positions.len() / 3`; the index-range,
    finite-coordinate, zero-area and edge-pairing checks move into
    `closed_by` in their current order.

  This is the only `mesh.rs` edit in a1-rust-decoder; c2-closure-once
  edits `mesh.rs` after it (section 20.3).
- Rust (`crates/capture/src/nmesh.rs`):
  - `decode_inline_with(text, options)` returns the result above.
    `decode_inline` and `InlineMesh::to_packet` stay unchanged.
  - A test-only `decode_with_stats` counts each `Vec::with_capacity` site
    by kind: `positions`, `triangles`, `target`.
  - The new capture packet (`DecodedMesh::to_packet`, written by a1 and
    first emitted by the `nmeshCapture` host function in a2-native-host)
    starts with a 64-byte header:
    - `u32 vertexCount`;
    - `u32 triangleCount`;
    - `u32 flags`: bit 0 geometry present, bit 1 `booleanTarget` present,
      bit 2 its value, bit 3 bounds present;
    - a zero `u32`;
    - six `f64` bounds (`min` x y z, then `max` x y z), zero when absent.

    When geometry is present, the `f64` positions follow at offset 64 and
    the `u32` indices at `64 + 24 * vertexCount`. All values are
    little-endian.
- TypeScript:
  - `packages/nmesh/src/decode.ts`: `decodeNmesh` gains an optional second
    argument, `{ maxVertices?, onAllocate? }`. A new exported streaming
    `inspectNmesh(bytes)` returns the counts and quantized bounds, with the
    same error order.
  - `packages/io/src/nmesh/capture-decoder.ts` adds
    `decodeCaptureMeshWith(data, options)`, which implements the contract
    and ports rules (a) to (d) with the same operation order, reading
    vertices from the quantized `Int32Array` as `q / 1000` on demand. In
    the over-limit targeted path every allocation (including those inside
    `decodeNmesh`) is reported as `target`. `decodeCaptureMesh(data)` is
    unchanged.
  - It calls `onAllocate(kind, length)` at every allocation site:
    `positions`, `triangles`, `mm` (the millimetre positions of
    `toTriangleMesh`) and `target`.
  - `packages/io` still does not import `@nodetto/core`.
- Hosts:
  - New native CLI host functions in `apps/cli/native/src/engine.rs`,
    added by a2-native-host:
    - `nmeshCapture(data, maxVertices, needTarget)` returns the capture
      packet above;
    - `nmeshBounds(data)` returns six `f64` (48 bytes), or null for
      invalid or empty data.

    `nmeshDecode(data)` and its packet stay as they are.
  - `apps/cli/src/native-engine.ts` reads them as
    `CommandIo.decodeCaptureMesh` and `CommandIo.meshBounds`. The packet
    writer (`engine.rs`) and its reader (`native-engine.ts`) land in the
    same plan, a2-native-host, and its `engine_tests.rs` case asserts the
    offsets (positions at 64, indices at `64 + 24V`) on an asymmetric mesh.
  - `CaptureMeshDecoder` (`packages/core/src/capture/cad-request.ts`) is
    the TypeScript form of the budgeted contract. `capture-command.ts`
    passes `io.decodeCaptureMesh`; when it is absent (Bun),
    `capture-cad.ts` defaults to `decodeCaptureMeshWith`.
  - The desktop decodes meshes with `decodeCaptureMeshWith` in the webview
    (`export-handlers.ts:278`) and sends only the finished NCS1 scene over
    Tauri. `apps/desktop/src-tauri/src/capture.rs` has no mesh decoder, so
    the Tauri IPC payload is unchanged.
- Tests, in the `nmesh.rs` unit tests and `capture-decoder.test.ts`:
  - For all nine fixtures, they assert the table's `booleanTarget` and
    identical `bounds` doubles.
  - An asymmetric mesh with negative coordinates checks all six extrema.
  - For each corruption case of
    `rejects_what_the_reference_decoder_rejects` and of the TS codec
    tests, a decode with `maxVertices` below the vertex count rejects with
    the same result as the full decode. It records zero `positions`,
    `triangles` and `mm` allocations.
  - Over-limit targeted controls: `tetrahedron.nmesh.txt` with
    `maxVertices = 3, needTarget = true` gives `booleanTarget = true`, and
    `triangle.nmesh.txt` with `maxVertices = 2, needTarget = true` gives
    `false`. Both give the same counts and bounds as the full decode, no
    `positions` or `geometry` in the result, zero `positions`,
    `triangles` and `mm` allocations, and only `target` allocations,
    whose buffers are not reachable from the returned value.
  - `mesh.rs` unit tests: `is_closed` results are unchanged for every
    existing case, and `closed_by` over quantized input agrees with
    `is_closed` over the decoded millimetre mesh for all nine fixtures.

R2-2 `function-pcb-reference-page-kind` (medium). The change is in
`insert` (`packages/ui-solid/src/cad/board-picker.tsx:79-102`):

- The record-type test is replaced by `isPcbBoardChoice(editor.getSnapshot(),
  boardId)`. It is read immediately before `pcbReferenceCommands` is built.
- A stale choice:
  - applies no command, so there is no history entry and no reference;
  - leaves the selection unchanged;
  - sets the existing fallback notice, `Could not insert the PCB board.`;
  - closes the picker.
- The notice must still be visible after the reactive batch that converted
  the page settles. The clearing effect on `[selection, revision]`
  (`board-picker.tsx:135-139`) must not erase a notice set by that same
  batch, for example by recording the revision at which the notice was
  set.

Tests are in `packages/ui-solid/src/test-dom/cad-sketch.dom.tsx`, run by
`packages/ui-solid/src/cad/viewport.test.tsx`:

- In one batch, convert the source page to freeform and click the stale
  option. Then assert the history length, the absence of a `cad.pcb`
  element, the unchanged selection, the notice text and the closed picker.
- Undo the conversion, reopen the picker and click the restored choice. It
  adds exactly one reference and one history entry.

R2-3 `performance-capture-point-limit-after-allocation` (high). Section
19.1 F4 applies (the precedence list, capture walk, metadata walk, stats
and tests), with these changes.

- The shared rule lives in `packages/core/src/capture/scene-binary.ts` as
  two exported functions. The writer itself calls both, so the writer and
  the builder cannot drift.
  - `checkScenePreTool(options, counts)` checks the request header fields,
    then `tool count` and `body count`.
  - `chargeTool(state, tool)` is a point accountant. In the writer's order
    it applies the per-loop point bounds (or, for a mesh, the vertex and
    triangle bounds), then the running total against `MAX_POINTS`. On the
    first failure it returns the writer's exact `RangeError` message.
- Charging:
  - For a prism, the builder charges the normalised loop counts
    (`points.length / 2`) before `makeTool` creates any typed array.
  - For a mesh, it calls the decoder with `maxVertices = MAX_POINTS -
    points`, then charges the decoder's `vertexCount` and `triangleCount`.
  - The 1 MiB inline cap keeps any single mesh far below the mesh triangle
    bound, so in practice only the running total fires.
- Metadata mode. At the first failing charge the same visitor switches to
  metadata mode; the construction walk is not restarted. In metadata mode
  the visitor:
  - records statuses, body ids, names, reference flags, step lists (tool
    indices only), and the tool and body counts;
  - records bounds: `sweptBounds` of the `normaliseToolLoops` output for
    prisms, and the decoder `bounds` for meshes;
  - allocates no capture typed array;
  - calls the decoder with `maxVertices = 0`, and with `needTarget` only
    for a targeted mesh (R2-1).
- `buildCadCaptureModel` returns the allocated tool prefix, the full body
  list, `toolCount`, and an optional `overLimit` message.
- `prepareCadCapture` applies these checks in this order:
  1. the no-body message;
  2. the cell range;
  3. the body queries;
  4. camera and frame;
  5. `checkScenePreTool`;
  6. `overLimit`, raised as `CaptureInputError(message, undefined, true)`.

  An admitted model never enters metadata mode and is written exactly as
  it is today.
- Tests: the section 19.1 F4 list.
  - The allocation counters are the decoder hook of R2-D (`onAllocate`,
    `decode_with_stats`) and `stats.toolArrays` for capture typed arrays.
  - "Zero geometry allocations from the overflowing tool onward" means
    zero `toolArrays` and zero decoder `positions`, `triangles` and `mm`
    allocations, for the overflowing tool and for every later feature.
    `target` scratch is allowed only for a targeted mesh.
  - The admitted 4,000,000-point case asserts the NCS1 digest recorded on
    `3cd2401`.

R2-4 `performance-capture-loop-normalization-pair-scans` (medium).
`normaliseToolLoops` (`packages/core/src/capture/scene.ts:90-117`) keeps
its result and loop order. Only the ancestor search changes.

- The candidates are the loops handed to the tool, which are the selected
  loops. They are bucketed by `depth`.
- For a loop at depth `d > 0`, the search visits the buckets `d - 1`,
  `d - 2`, down to 0. It stops at the first bucket that holds a loop whose
  bounds contain the loop's first point and whose polygon contains it
  (`containsPoint`, unchanged).
- The result is the greatest containing depth below `d`. That is exactly
  what the current scan computes, since it keeps the maximum containing
  depth below `d`. Parity, winding, kept loops and face numbering are
  therefore unchanged for every selection.
- A perforated plate (holes at depth 1, one outline at depth 0) now costs
  one probe per hole.
- An optional test-only argument, `stats: { ancestorProbes }`, counts every
  candidate examined.
- `loops.ts` and `history.ts` are not changed.

Tests, in `scene.test.ts`:

- Probes. Circular holes come before a line-built outline, with 500, 1,000
  and 2,000 holes, built through the production loop builder.
  - The pre-fix scan measures 252,002, 1,004,002 and 4,008,002 probes.
  - After the fix, each doubling multiplies the probes by at most 2.2.
    Before the fix the factor is about 4, so the test fails.
- Equivalence.
  - Cases: a full selection, a partial selection that omits the outline,
    one that omits a hole, and nested islands (outline, hole, island, hole
    in island), with selections dropping each level.
  - The kept loops equal those of a verbatim copy of the pre-fix function,
    kept in the test as the oracle.
  - The capture scene bytes of a perforated-plate document equal the
    digest recorded on `3cd2401`.

R2-5 `performance-native-mesh-bounds` (medium). Section 19.1 F9 applies,
with the R2-D contract and these paths.

- Shaded capture. `scene.ts` takes a mesh body's bounds from the decoder
  `bounds` and no longer calls `pointBounds(positions)`. On the native CLI
  these bounds come from Rust through `nmeshCapture`, so the interpreter
  performs no per-vertex read for bounds.
- Construction export:
  - `SvgExportOptions.meshBounds?: (data: string) => { min: Vec3; max: Vec3
    } | null` is declared in `packages/core/src/svg-export/theme.ts`.
  - `renderPageSvg` forwards it as `cadPageWireframe(elements, pageId, {
    meshBounds })`.
  - `apps/cli/src/export-command.ts` passes `io.meshBounds`, which is the
    native `nmeshBounds`.
  - `page-editing.ts` forwards options unchanged and is not edited.
  - Without the option (browser, Bun, desktop), the current TypeScript
    decode runs.
  - A null or thrown result is the decode failure of R2-9.
- Instrumentation. `cadPageWireframe` takes an optional test-only `stats:
  { decodes }` that counts TypeScript decodes. With `meshBounds` supplied,
  the count is 0 and the hook is called once per mesh.
- Tests:
  - `wireframe.test.ts`: an asymmetric mesh with negative coordinates
    gives equal SVG with and without `meshBounds`, and a corrupt mesh fails
    on both paths.
  - `export-command.test.ts`: the export passes `io.meshBounds` through
    `editor.exportPageSvg`.
  - `capture-command.test.ts` or `scene.test.ts`: cameras, frame lines and
    NCS1 bytes are identical with decoder bounds.
  - `apps/cli/src/native-parity/export.test.ts`, `capture.test.ts` and
    `cad.test.ts` (the valid and corrupt `cad check` cases at `:124` and
    `:206`), against a freshly built release binary: SVG bytes, camera
    lines, image bytes and `cad check` results equal the pre-fix output.

R2-6 `performance-interference-sparse-pairs` (medium). Section 19.1 F13
applies. Details:

- The analysed boxes are filtered exactly as they are today.
- Axis choice:
  - For each axis, count the pairs whose intervals overlap under the
    relaxed test `a.max >= b.min && b.max >= a.min`. This takes O(n log n),
    using sorted starts and ends with binary search.
  - The sweep runs on the axis with the smallest count. Ties go to X, then
    Y, then Z.
- Sweep: the boxes are sorted by `min` on that axis, and each box is
  compared with the earlier boxes whose `max` is not below its `min`.
- Every compared pair gets the existing exact three-axis tolerance test
  (`interference.rs:60-64`), so `total` counts exactly the pairs that pass.
- The passing pairs go into a bounded max-heap that keeps the `keep`
  smallest `(a, b)` in body order; the heap is sorted at the end.
  - Step counts and weights are computed only for kept pairs, as today.
  - The output therefore equals the current all-pairs enumeration in
    order, totals, weights, checked prefixes and unchecked lists.
- A doc-hidden test entry returns the comparison count.
- Tests, in `crates/capture/tests/interference.rs`:
  - Separated boxes along X, and separated boxes along Y, each make at
    most `n` comparisons.
  - In a sparse grid, doubling `n` multiplies the comparisons by at most 3
    (all-pairs: by 4).
  - Small dense, mixed and tolerance-boundary assemblies give the same
    output as an all-pairs oracle kept in the test.
  - The 2,000-body test keeps its assertions.

R2-7 `performance-capture-repeated-mesh-closure` (medium). Section 19.1
F16 applies. Details:

- `tool_view::classify(scene) -> Vec<bool>` gives, per tool, whether it is
  solid: prisms are true, and meshes use `is_closed`. It runs once, at the
  start of `render_with`, and its slice is passed by reference to every
  render-path consumer through new crate-internal `_with` variants (below):
  - `Raster::prepare`: the open-body flags (replacing the `is_solid` map
    at `raster.rs:473`) and the picture views (`raster.rs:468`);
  - `interference::analyse_scene_with` and `add_view_pairs_with`: candidate
    eligibility (replacing `is_solid` at `interference.rs:48-52`) and their
    `ViewCache` instances (`interference.rs:236`, `:318`, `:361`, `:397`);
  - `census::resolve_with`, which passes it to the lattice entries it calls
    for every request it builds (`census.rs:89`); the lattice uses it for
    the slot bounds (`lattice.rs:654`), for the census lazy slot view
    (`lattice.rs:705`, today `ToolView::new` inside `get_or_init`) and for
    the axis views it takes from `ViewCache` (`lattice.rs:223`).
- Existing interfaces stay source-compatible; nothing new is added to a
  public struct:
  - `LatticeRequest` (`lattice.rs:48-55`) keeps its six fields, so the
    struct literals in `crates/capture/tests/boundary_fold.rs:46`, `:64`
    and `crates/capture/tests/interference.rs:302`, `:313`, `:341` compile
    unchanged. The classification travels as a separate `solid: &[bool]`
    argument of crate-internal `sample_axis_with`, `sample_pair_with` and
    `sample_body_axis_with`.
  - `sample_axis`, `sample_body_axis`, `census::resolve`,
    `interference::analyse_scene`, `add_view_pairs`, `candidates` and
    `analyse_pair` keep their signatures. Each becomes a wrapper that calls
    `tool_view::classify(request.scene)` (or `scene`) once and then its
    `_with` variant, so standalone and test callers behave as today.
  - The `#[cfg(test)]` reference renderer (`raster/reference.rs:321`,
    `:326`, `:379`, `:392`, `:399`) calls only these unchanged entries and
    is not edited. Its classifications are outside `render_scene`, so they
    do not reach the closure-count test (separate binary, below).
  - `render_with` calls only the `_with` variants with its one slice.
- Views take the precomputed value:
  - `MeshView::new` takes `closed: bool` instead of calling `is_closed`
    (`mesh.rs:233`).
  - New crate-internal constructors `ToolView::classified(tool, index,
    family, closed)` and `ToolView::picture_classified(tool, index, family,
    window, closed)` pass it through. `ViewCache::get` takes the
    classification slice and calls `classified`. The lattice slot view
    calls `classified` with `solid[index]`.
  - `ToolView::new` and `ToolView::picture` keep their signatures and
    classify for themselves, like the wrappers above. `reference.rs` is
    not edited; its unit tests stay in the crate gate.
- The first-tool body rule is unchanged. This renderer closure stays
  separate from the editor eligibility `booleanTarget` (R2-1): a mesh that
  is closed but is not a Boolean target is still drawn as a solid.
- Instrumentation counts actual evaluations, not calls of `classify`:
  - `mesh.rs` gets a doc-hidden `pub static CLOSURE_EVALUATIONS:
    AtomicU64`, incremented (relaxed) on entry to `closed_by` (R2-D), which
    every closure evaluation goes through, including `is_closed`, any
    retained standalone constructor and any bypass of `classify`.
  - The test lives in its own test binary,
    `crates/capture/tests/closure_count.rs`, with a single `#[test]` that
    runs its scenarios one after another, so no other test thread changes
    the counter. It reads the counter before and after each
    `render_scene` call.
- Tests (`closure_count.rs`):
  - Three cases, each with one open and one closed mesh tool: analysis
    disabled, an overlapping three-axis pair, and a census case. Each
    render adds exactly the number of mesh tools to the counter, at 1 and
    at 8 threads. Before the fix it adds at least two per mesh (picture
    view plus the `is_solid` map), so the test fails.
  - Body states, ordered reports and image bytes are equal at 1 and at 8
    threads, and equal the digests recorded on `3cd2401`.
  - The existing crate suites pass unchanged, without edits: the
    reference renderer's unit tests, `boundary_fold.rs` (boundary
    behaviour), `interference.rs`, `census.rs` and `mesh.rs`. The gate is
    the full `cargo test -p nodetto-capture`.

R2-8 `maintainability-wireframe-pcb-input` (medium). The CAD branch of
`renderPageSvg` (`packages/core/src/svg-export/document.ts:591-596`)
passes this to `cadPageWireframe`:

`collectCadInput({ pages: store.listPages(), elements: store.listElements()
}, pageId, 0).elements`

This is the input the capture entry points already use. The test is in
`packages/core/src/svg-export/cad.test.ts` and goes through the public
`editor.exportPageSvg`. A board-only CAD page gives:

- an SVG;
- null after the board's page is converted to freeform;
- the original SVG bytes after Undo.

R2-9 `maintainability-wireframe-mesh-failure` (medium). The wireframe's
mesh lookup returns either the eight projected corners or a failure.

- It fails in three cases:
  - decoding throws `NmeshError`;
  - `meshBounds` returns null;
  - the mesh has no vertex. In valid data this is the same as having no
    triangle, so it is the same emptiness rule as `check.ts:26-37` and the
    capture visitor.
- On failure, the mesh visitor returns false.
  - `visitCadConstruction` then fails the mesh as `cad.mesh.invalid` and
    does not register it as a body.
  - Dependants fail as they do in `cad check`.
- On success, the corners are drawn once, from that same result.
- Tests, in `wireframe.test.ts`:
  - A corrupt mesh plus a cut targeting it gives zero segments and null
    bounds. Before the fix it gives 12 segments.
  - A valid-mesh control draws both the mesh box and the cut.

R2-10 `maintainability-capture-raster-rounding` (medium).

- `packages/core/src/capture/raster-fit.ts` exports one rounding function,
  `capturePixelSpan(span, scale) = max(1, ceil(span * scale - 1e-6))`.
  This is the frame builder's existing rule
  (`apps/cli/src/capture-artwork.ts:52`).
- `captureRasterPlan` uses it to compute width and height once per scale
  step. It uses those same values for the box, area and raster-limit
  checks, and returns them in the plan.
- `pixelFrame` takes the plan's `width` and `height` instead of
  recomputing them.
- Scale quantization and the `snapSvgFrameToPixels` overscan are
  unchanged.

Tests:

- `raster-fit.test.ts` plans a 10000 x 100 viewport twice: at explicit
  scale 0.07, and with a 700 x 7 box. Both give scale 0.07 and 700 x 7.
  Before the fix, the explicit scale gives 701 x 8 and the box reduces the
  scale to 0.069.
- `capture-command.test.ts` captures that viewport both ways and gets a
  700 x 7 PNG with equal bytes.
- The existing over-limit tests and the deterministic PNG tests pass
  unchanged.

### 20.3 Plan grouping

Plans are named `car2-*`. Each plan:

- is about 150 lines or less;
- uses its own `CARGO_TARGET_DIR=target/car2-<plan>` and `artifactRoots
  ["target", "tmp/cad3d"]` (existing tests write measurements under
  `tmp/cad3d`). The dispatch manifest is
  `impl-plans/active/car2-r2b-dispatch.json`. It replaces
  `car2-r2-dispatch.json`, whose `["target", "tmp"]` roots contained its
  evidence root `tmp/car2-r2`. The new manifest uses `taskId car2-r2b`
  (the evidence root must equal `tmp/<taskId>`) and keeps every other
  field except these changes:
  - every `artifactRoots` becomes `["target", "tmp/cad3d"]`;
  - every evidence path becomes `tmp/car2-r2b` (the `evidenceRoot` and the
    `tmp/car2-r2/<planId>/<attempt>/` constraint text). `tmp/car2-r2b` is
    outside every artifact root;
  - the `"tmp"` entry in every plan's `writePaths` becomes `"tmp/cad3d"`.
    An artifact root must equal a `writePaths` entry and must not lie
    inside another source path. A `"tmp"` source path would also contain
    the evidence root and about 500 MB of earlier evidence;
  - the four plans that run `native-parity/capture.test.ts` (a2-native-host,
    a2-core-wiring, a4-open-mesh-targets, a5-charged-walk) also list the two
    files that test writes, `tmp/capture/m09/timing.json` and
    `tmp/capture/m23/timing.json`. These plans are in different waves;
  - `reviewContext.finalIntegration` adds gates 3 and 4 below;
- runs only the tests next to the files it touches (`bun test <paths>`,
  `cargo test -p <crate>`, clippy and biome on touched files).

Workspace checks run once, at integration, after all 14 plans land. Every
gate must exit 0, and its command, exit status and complete log path are
recorded:

1. `bun run typecheck` and `bun run lint`;
2. `CARGO_TERM_QUIET=true mise run verify`;
3. `CARGO_TERM_QUIET=true mise run test-cli` (nodetto-native and
   nodetto-cli cargo tests, then the release binary with all of
   `apps/cli/src`, including native parity and MCP stdio);
4. after gates 2 and 3, a scan that fails on any match or scan error:
   `sh -c 'for root in target tmp; do if [ -d "$root" ]; then
   matches=$(find "$root" -name "*.test.ts" -print) || exit 1; if [ -n
   "$matches" ]; then printf "%s\n" "$matches"; exit 1; fi; fi; done'`.

A plan depends on another only when it edits a file, or uses
a contract, that the earlier plan creates. In wave 1, a1-rust-decoder and
c1-sweep both build the `nodetto-capture` crate. A compile failure caused
by a sibling's in-progress edit is rerun after that sibling finishes, and
is never fixed by editing the sibling's files.

| Plan | Findings | Owns | After |
| --- | --- | --- | --- |
| a1-rust-decoder | R2-D Rust half | `crates/capture/src/nmesh.rs` (`decode_inline_with`, `decode_with_stats`, `DecodedMesh::to_packet`; `decode_inline` and `InlineMesh::to_packet` unchanged); the `closed_by` extraction in `crates/capture/src/mesh.rs` and its unit tests | - |
| a1-ts-decoder | R2-D TS half | `packages/nmesh/src/{decode,index}.ts`, `packages/nmesh/src/codec.test.ts`, `packages/io/src/nmesh/{capture-decoder,index}.ts` (`decodeCaptureMeshWith`; `decodeCaptureMesh` unchanged), `capture-decoder.test.ts` | - |
| a3-loop-normalisation | R2-4 | `normaliseToolLoops` in `scene.ts`; `scene.test.ts` (probe and equivalence cases) | - |
| a5-point-rule | R2-3 shared rule | `scene-binary.ts`, `scene-binary.test.ts` | - |
| b-wireframe | R2-8, R2-9 | `svg-export/document.ts`, `cad/wireframe.ts`, `wireframe.test.ts`, `svg-export/cad.test.ts` | - |
| c1-sweep | R2-6 | `collect_candidates` in `interference.rs`; `crates/capture/tests/interference.rs` | - |
| p-picker-guard | R2-2 | `board-picker.tsx`, `test-dom/cad-sketch.dom.tsx`, `viewport.test.tsx` | - |
| r-raster-rounding | R2-10 | `raster-fit.ts`, `capture-artwork.ts`, `raster-fit.test.ts`, `capture-command.test.ts` | - |
| a2-native-host | R2-D native host | `apps/cli/native/src/engine.rs` (new `nmeshCapture`, `nmeshBounds`; `nmeshDecode` unchanged), `apps/cli/native/src/engine_tests.rs` (packet offsets), `apps/cli/src/native-engine.ts` (readers for both: writer and reader in one plan), `apps/cli/src/commands.ts` (new optional `decodeCaptureMesh` and `meshBounds`, typed structurally; `decodeMesh` unchanged) | a1-rust-decoder |
| c2-closure-once | R2-7 | `mesh.rs` (`MeshView::new(closed)`, `CLOSURE_EVALUATIONS`), `tool_view.rs`, `raster.rs`, `lattice.rs` (`_with` variants; `LatticeRequest` unchanged), `census.rs` (`resolve_with`), the classification, `_with` and `ViewCache` hunks of `interference.rs`, new `crates/capture/tests/closure_count.rs`. Not edited: `raster/reference.rs`, `crates/capture/tests/{boundary_fold,interference,census,mesh}.rs` | c1-sweep, a1-rust-decoder |
| a2-core-wiring | R2-D TypeScript callers, R2-5 shaded bounds | `CaptureMeshDecoder` in `cad-request.ts`; the mesh decode call and decoder `bounds` in `scene.ts`; `capture-command.ts` (passes `io.decodeCaptureMesh`); `capture-cad.ts` (default `decodeCaptureMeshWith`); `apps/desktop/src/shell/export-handlers.ts`; the fake decoders in `scene.test.ts`, `cad-request.test.ts`, `capture-cad.test.ts` and `export-handlers.test.ts`; a routing case in `capture-command.test.ts`; a routing case in `engine_tests.rs` | a2-native-host, a1-ts-decoder, a3 |
| a2-export-bounds | R2-5 export path | `svg-export/theme.ts`; the `meshBounds` forward in `document.ts`; the `meshBounds` path and test-only `stats` in `wireframe.ts`; `wireframe.test.ts`; `export-command.ts` and `export-command.test.ts`; `native-parity/export.test.ts` | a2-native-host, b |
| a4-open-mesh-targets | R2-1 | `cad/construction.ts`; the mesh visitor in `scene.ts`; `scene.test.ts`; `worker-host.test.ts`; an eligibility case in `engine_tests.rs`; `native-parity/capture.test.ts` | a2-core-wiring |
| a5-charged-walk | R2-3 | `buildCadCaptureModel` in `scene.ts`; `prepareCadCapture` in `cad-request.ts`; `scene.test.ts`; `cad-request.test.ts`; `engine_tests.rs`; `native-parity/capture.test.ts` | a4-open-mesh-targets, a5-point-rule |

The plans run in five waves:

1. The eight plans with no predecessor.
2. a2-native-host and c2-closure-once.
3. a2-core-wiring and a2-export-bounds.
4. a4-open-mesh-targets.
5. a5-charged-walk.

No two plans of one wave own the same file. `engine_tests.rs` is edited by
a2-native-host, a2-core-wiring, a4 and a5-charged-walk in waves 2, 3, 4
and 5, one at a time.

Staged decoder rollout. At the end of every wave, native CLI capture
decodes meshes in Rust; no completed wave uses the interpreter decoder on
the native CLI, no packet writer exists without its reader, and no type an
unchanged caller depends on changes:

- Wave 1 adds `decode_inline_with`, `DecodedMesh::to_packet` and
  `decodeCaptureMeshWith` beside the unchanged entry points. Nothing emits
  the new packet. Native capture still forwards `io.decodeMesh`
  (`capture-command.ts:255`), the Rust `nmeshDecode`.
- Wave 2 adds the `nmeshCapture` and `nmeshBounds` writers, their readers
  in `native-engine.ts` and the optional `CommandIo` members, all in
  a2-native-host. No caller uses them yet, so native capture is still the
  Rust `nmeshDecode` path.
- Wave 3 switches `capture-command.ts` from `io.decodeMesh` to
  `io.decodeCaptureMesh`, which the native host already implements, so
  native capture moves from one Rust decoder to the other in a single
  plan. Bun and the desktop use `decodeCaptureMeshWith`, as the TypeScript
  fallback. a2-export-bounds switches native export to `io.meshBounds` in
  the same wave.
- The `cad check` path (`nmeshDecode`, `CommandIo.decodeMesh`,
  `checkCadPage`) is untouched in every wave.

Routing evidence (Rust is really used):

- a2-core-wiring, `engine_tests.rs`: with the existing interception
  pattern (`engine_tests.rs:382-386`), a native capture of a document with
  one imported mesh calls `native.nmeshCapture` once and
  `native.nmeshDecode` zero times; `cad check` on the same document still
  calls `nmeshDecode` once. `capture-command.test.ts` asserts that a fake
  `io.decodeCaptureMesh` is the decoder that capture uses.
- a4, `engine_tests.rs`: the cut documents of R2-1 call `nmeshCapture`
  with `needTarget = true` for the targeted mesh. The single triangle
  returns `booleanTarget = false` and the cut reports `cad.body.missing`;
  the closed tetrahedron returns `true` and both targets get the
  difference step.

A single wave is not possible without two plans editing the same region
or contract at once:

- a2-native-host needs the Rust decoder.
- a2-core-wiring switches the caller only after the native host exists,
  needs the TypeScript decoder, and edits `scene.ts` after a3.
- a2-export-bounds needs the native `meshBounds` and b's wireframe.
- a4 needs a2-core-wiring's typed contract, and its native gate must run
  against a binary with `nmeshCapture` and the switched caller.
- a5-charged-walk rewrites the visitor a4 changes.
- c2 edits `mesh.rs` after a1-rust-decoder's `closed_by` extraction.

Gates of the native plans (each after its own release build,
`CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-<plan> cargo build
--release -p nodetto-cli`, with `NODETTO_CLI_TEST_BINARY` set to that
binary):

- a2-native-host: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-native-host cargo test -p nodetto-cli`,
  then `bun test apps/cli/src/native-parity/cad.test.ts
  apps/cli/src/native-parity/capture.test.ts`.
- a2-core-wiring: the same two commands with its own target directory.
- a2-export-bounds: `bun test apps/cli/src/native-parity/export.test.ts
  apps/cli/src/native-parity/cad.test.ts`.
- a4 and a5-charged-walk: `cargo test -p nodetto-cli` with their own
  target directory, then `bun test
  apps/cli/src/native-parity/capture.test.ts
  apps/cli/src/native-parity/cad.test.ts`. Because a4 runs after
  a2-core-wiring and a2-native-host, its release binary always contains
  the Rust capture host and the switched caller.
- c2-closure-once: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-c2-closure-once cargo test -p nodetto-capture`
  (all crate suites, including `closure_count.rs` and the reference
  renderer's unit tests).

`apps/desktop/src-tauri/src/capture.rs` is not edited (see the Hosts
bullet of R2-D).

Native parity always builds first:

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-<plan> cargo build
   --release -p nodetto-cli`
2. Set `NODETTO_CLI_TEST_BINARY="$PWD/target/car2-<plan>/release/nodetto-cli"`.

Oracle copies of pre-fix functions live inside the test files. They are
never kept as `*.test.ts` files under `target/` or `tmp/`.

### 20.4 Decisions

- Eligibility travels as `booleanTarget` in the R2-D result.
  - It is computed in Rust on the native CLI, and in TypeScript in the
    desktop webview and in Bun.
  - The Tauri payload does not change, because the desktop never decodes
    meshes in Rust.
- Group A is split by contract into nine plans with an explicit order
  (section 20.3) rather than given to one owner, to keep each plan near 150
  lines.
- The budgeted decoder is added beside the full-geometry decoder in every
  layer (`decode_inline_with`, `decodeCaptureMeshWith`, `nmeshCapture`,
  `CommandIo.decodeCaptureMesh`) instead of changing the existing entry
  points. `cad check` keeps its packet and its required-array type, and
  every packet writer lands in the same plan as its reader.
- The native host lands one wave before the caller switches to it, and
  the switch happens in one plan, so native capture is Rust-backed at
  every completed wave. Engine tests intercept the host functions to show
  which one capture and `cad check` actually call.
- The renderer classification reaches the lattice, census and analysis
  through crate-internal `_with` variants and a separate argument, not a
  new `LatticeRequest` field. The public struct and every existing
  signature stay, so the integration tests and the reference renderer
  compile unedited.
- Rust rule (a) reuses the renderer's closure code through
  `mesh::closed_by` with a position accessor, so the decoder reads
  quantized positions on demand and the renderer's `is_closed` result
  cannot drift from the eligibility rule's closure test.
- Closure instrumentation counts evaluations inside `closed_by` with a
  process-wide counter read by a single-test binary, so any duplicate
  evaluation, from any caller, fails the regression.
- The interference broad phase is a single-axis sweep on the axis with the
  fewest overlapping pairs, not a grid. A sweep needs no cell size, and
  its examined set is easy to compare with all-pairs enumeration.
- The shared point rule lives in `scene-binary.ts`, the writer's module,
  and the writer calls it, so the rule has one owner.
- After the point-limit excess, a mesh that a later feature targets may
  still allocate `target` scratch (bounded by the 1 MiB inline cap, freed
  per mesh, never capture geometry). Without it, that feature's status,
  and so the no-body message's error list, would differ from an admitted
  walk. No other decoder or capture geometry is allocated after the
  excess.
- Loop normalisation uses depth buckets rather than a "complete profile"
  shortcut. The bucketed result is provably the current one for every
  selection, so no difference between float and grid containment can
  change bytes.
- The wireframe treats an empty decoded mesh as a failure, as `cad check`
  and capture already do.

### 20.5 Risks

- In R2-4, same-depth siblings that each contain loops (for example many
  islands in many holes) still cost O(siblings x children) bounding-box
  checks. The audited case, the perforated plate, is linear.
- The R2-1 rule agrees with Manifold only on the nine fixtures (section
  19.1).
- If the implementation misses the R2-2 rule, the revision effect of the
  same batch can clear the notice. The DOM test checks the notice after
  the batch settles.
- Five waves lengthen the critical path (a1-rust-decoder, a2-native-host,
  a2-core-wiring, a4, a5-charged-walk). A slip in any of them delays R2-1
  and R2-3. The chain is kept because every step is a real contract and
  no completed wave may decode meshes in the interpreter on the native
  CLI.
- The `CLOSURE_EVALUATIONS` counter is process-wide. It is reliable only
  in its own single-test binary; another test binary that asserts on it
  would race.
- Native parity is meaningful only against a release binary built in the
  same plan.

## 21. Revision 10: audit round 3 corrections

Source: audit round 3 of `feat/ai-capture`, base `0a35708` (0.10.5) to
`a964ad5`, seven major findings (four high, three medium), no minor
findings. Issue reference: `round-3-audit:feat/ai-capture@a964ad5`; no
GitHub issue exists. This section states the capture rules (R3-1, R3-2,
R3-7) and the plan grouping of all seven. The CAD editor and core rules
(R3-3 to R3-6) are in `design-docs/specs/design-cad3d.md` section 20.

The common rules of sections 19 and 20 apply unchanged:

- Every fix ships a test that fails on `a964ad5` and passes after it.
  `crates/capture` and `apps/cli/src/native-parity/capture.test.ts` are
  byte-identical between `a964ad5` and `3f9ce78`, so for R3-1 and R3-2 that
  evidence is the new test failing in the working tree before the owning
  plan's edit and passing after it. No R3-1 or R3-2 plan builds an older
  commit or needs a pre-fix binary (revision 10a, section 21.5).
- A performance test asserts a deterministic count, never a wall clock.
- NCS1 bytes, PNG and SVG bytes, goldens, digests, error codes and messages
  do not change, except the pixels R3-2 names. Diagnostic precedence is
  kept.
- Indexed reads type-check under `noUncheckedIndexedAccess`. Per-pixel,
  per-vertex and per-byte work stays in Rust on the native CLI.
- No round-1 or round-2 finding may regress. Two of them protect code
  that round 3 edits: `performance-interference-boundary-fold` and
  `performance-interference-sparse-pairs` (`interference.rs`, `overlay.rs`),
  and `maintainability-capture-raster-rounding` (`capture-artwork.ts`).
  Their tests run unchanged in the owning plans.

### 21.1 Rules

R3-1 `function-capture-touching-cap-interference` (high).

Cause. Both rasterizers copy the shading intervals
(`PrismView::surface_intervals`, `FACETS = true`) into the per-body
interference witness (`raster.rs:204-208`, `raster/reference.rs:82-85`).
Shading intervals are closed at both caps (`prism.rs:221-224`). A ray that
lies in a cap plane shared by two touching bodies therefore gets material
from both bodies. `overlay::overlapping_pairs_iter` records a picture pair,
and `interference.rs:529-544` keeps that pair even though volume sampling
finds none. The volume mode (`FACETS = false`, `ToolView::intervals`)
already gives such a ray to exactly one side (`prism.rs:225-237`, and the
side rule at `prism.rs:296-330`).

Rule. A picture-interference witness uses volume-boundary ownership.
Shading keeps facet identity.

- Production rasterizer. `ToolView::surface_intervals` (prism and mesh)
  also reports whether the ray fell inside the volume-mode ownership band
  of any boundary. That covers three cases:
  - a coplanar slab within the cap error;
  - an edge endpoint within `c_error`;
  - a parallel crossing within `error`.

  The mesh flag covers whatever case `hits_impl::<false>` resolves
  differently from `hits_impl::<true>`. Outside these cases the two modes
  give the same `s` values bit for bit: the slab is the same, the crossing
  set is the same and the clamp has no effect. Only `face` ids differ, and
  the overlay does not read them.
- Shared history until divergence. For an analysed body, while
  `draw_interference` is on, the witness of a body on a ray is the shading
  accumulator itself, with no copy and no extra combine, until the first
  step whose cast reports the flag. At that step, before the shading
  combine:
  1. The volume interval is cast (`ToolView::intervals`).
  2. The witness becomes `combine(current, volume, op)` in a separate
     scratch accumulator.
  3. The shading accumulator then combines its surface interval as today.

  From then on, every later step of that body on that ray also combines
  the witness, with the volume interval on flagged steps and the surface
  interval otherwise. `body_intervals` is filled from the witness when the
  body diverged, otherwise from the shading accumulator, which is then
  identical.
- Budget. All extra work is charged through the existing worker budget:
  - Each volume recast is charged in full with
    `WorkerBudget::scan(scan_cost, 0)`. Admission paid for exactly one
    cast per step, so a zero admitted weight makes the whole second cast
    surplus.
  - Each witness combine is charged with `WorkerBudget::charge(witness.len()
    + tool.len())`, the same rule as the shading combine.

  A ray whose bodies never diverge performs and charges exactly the work
  of today. Over-budget scenes take the existing refusal path.
- Test-only statistics. `RenderStats` gains `charged`, the total published
  charge, and `witness`, the part charged for recasts and witness combines.
  These are counted like `reads`.
- Reference rasterizer (`raster/reference.rs`). It is an independent
  oracle. It always builds the witness from `ToolView::intervals` over the
  same steps, with no flag. The production-versus-reference equality tests
  therefore check that the flag misses no ownership-sensitive case on
  their fixtures.
- Shading, edges, liveness, the census and the lattice are unchanged.
  Genuine picture-only overlap, meaning a stretch longer than the
  tolerance, is still detected, because volume and surface intervals agree
  away from the ownership band.
- Intended visible change. R3-1 removes false hatch pixels and the false
  `--fail-on-interference` exit 1 for bodies that only touch. These are
  the only pixel and exit changes it permits. A golden or parity
  expectation that changes must be shown to be such a touching contact,
  and the plan records it. Any other change is a defect.

Tests (`crates/capture/src/raster/tests.rs`; every case compares the
production and reference rasterizers, reports and RGB bytes, at thread
count 0 (auto, the production default) and at every explicit count 1 to
8):

- Stacked caps. Two boxes with identical 16 x 8 mm footprints, the lower
  one at Z 0 to 0.9375 mm and the upper one at Z 0.9375 to 2 mm. The front
  view has 0.25 mm/px and is at least 64 x 512 pixels, so that eight
  workers each get at least one band of `BAND_ROWS` rows. The scene is
  placed so that a supersample row inside a band other than the first lies
  in the plane z = 0.9375. With the analysis on, assert:
  - no marked sample;
  - zero candidates and zero pairs;
  - RGB bytes equal to the same render with `draw_interference` off.
    This is the "shading otherwise unchanged" check.
- Shared side, opposed frames. Two boxes touch in the plane x = 8: the
  left one covers x = 0 to 8 and the right one covers x = 8 to 16. The
  view is from the top, so a supersample column lies in that plane.
  - The left box's sketch frame is rotated 180 degrees about Z, and its
    world bounds are kept. The ray then sits at local minimum X in both
    frames, so the surface rule (`qx > x`, `prism.rs:323-350`) gives
    material to both boxes. With identically oriented frames, the old rule
    already assigns the ray to one box only, and that case cannot fail
    before the fix.
  - Fail-before evidence. The owning plan writes this case first and runs
    it in the working tree before its rasterizer edit. It must report one
    pair and marked samples. The pair and marked-sample count are recorded
    as the baseline. After the fix, the same assertions as the stacked caps hold.
  - An identically oriented copy is kept as an unchanged control.
- Positive controls. Lowering the upper box by 0.01 mm, or overlapping the
  opposed side boxes by 0.01 mm, gives one pair and marked samples.
- Work accounting:
  - `disjoint_scene(50)` rendered with the analysis on has `witness == 0`,
    and its `reads` and `charged` equal the analysis-on values before the
    witness change. Those values are measured in the working tree: the
    owning plan first exposes the published charge as the test-only
    `charged` statistic, with no behaviour change, and records `reads` and
    `charged` at threads 0 and 1 to 8 as literals. Only then does it edit
    the witness path.
  - In the stacked-cap scene, `witness > 0` and `charged` equals the
    `charged` of the same render with the flag treated as never set (a
    test-only switch on `render_with`) plus `witness`.
  - The existing exact read-count tests pass unchanged.
- `apps/cli/src/native-parity/capture.test.ts` (release binary). Every
  capture uses `--size 64x64 --zoom 1.08 --fail-on-interference`.
  - Stacked caps: the stacked rectangle extrusions as a CAD document,
    captured with `--view front`. Expect exit 0 and `interference: 0`.
  - Shared side: two ordinary rectangle extrusions touching at x = 8,
    captured with `--view top`. Expect exit 0 and `interference: 0`.
  - The native cases are regression guards on the fixed binary. Their
    fail-before evidence is the Rust cases above, which share the
    rasterizer the binary links. No pre-fix binary is built or run.
  - Each case has a 0.01 mm overlap control that gives exit 1 and one
    pair.

R3-2 `function-capture-translucent-layer-visibility` (high).

Cause. Each sample keeps one translucent hit, the nearest
(`raster.rs:136`, `162-165`, `209-216`; `raster/reference.rs:34`, `53-55`,
`87-94`). A larger open sheet in front of a PCB reference wins every ray.
The board is then neither blended (`raster.rs:387-412`) nor marked drawn
(`raster.rs:261-270`), so the report classifies it `hidden`. Sections 4.2
and 6.7 say a body seen through translucent bodies counts as drawn, and
section 6.5 says reference bodies are mixed over whatever lies behind
them.

Rule:

- Layers. Every translucent hit on the ray is a candidate: the first
  surface hit of an open mesh, or the first interval boundary of a
  reference body. A candidate is a layer when its depth is nearer than
  the nearest opaque hit by more than `MERGE_EPS`; with no opaque hit,
  every candidate is a layer. Each body contributes at most one layer.
  Every layer is composited and marked drawn. Nothing is truncated.
- Order. Layers are sorted by `(depth.total_cmp, body index)`, which is a
  total and deterministic order.
- Storage. Each worker has exactly one layer arena, a single `Vec<Hit>`,
  shared by all its held sample rows. A sample stores its solid hit, its
  marked bit, and an offset and count into that arena. The sample buffer
  stays `samples_wide * (factor + 1)` entries.
- Row lifecycle. Each held row slot carries a `sampled` flag. A slot owns
  layers only while its flag is set.
  - Band restart. Before a band samples its first row (`raster.rs:330`),
    the arena is truncated to length 0 (capacity is kept), and every slot's
    `sampled` flag and layer counts are cleared. The previous band's
    lookahead row is resampled from scratch, as today, so the same row is
    never charged twice against the cap.
  - Sampling a row appends its layers at the end of the arena and sets the
    slot's flag. A lookahead row beyond the picture (`y >=
    samples_high`, which `raster.rs:349` skips) is not sampled. Its slot
    is cleared to zero layers with the flag unset, so its stale offsets
    can never be read.
  - Rotation. When `samples.copy_within` (`raster.rs:435`) moves the last
    held slot to the front:
    - if that slot is sampled, its layers are copied to the start of the
      arena, its offsets are rewritten and the arena is truncated after
      them;
    - if it is not sampled (the picture bottom), the arena is truncated to
      0 and the moved slot is cleared.

    In both cases, every other slot is cleared and marked unsampled until
    it is resampled.
  - Invariant. The arena holds exactly the layers of the currently sampled
    slots, and every `offset + count` of a sampled slot lies within the
    arena. A debug assertion checks this after every row. No per-row
    allocation exists.
  - Edge tests read a neighbour's layers only when the neighbour slot is
    sampled, which matches today's `sample_y + dy + 1 < samples_high`
    guard.
- Storage bound. `MAX_LAYER_WINDOW = 262_144` layers, which is about 15 MB
  per worker and 120 MB for eight workers, bounds the arena's retained
  capacity, not only its live length:
  - Growth is explicit. Before an append that needs more room, the
    capacity becomes `min(max(2 * capacity, needed), MAX_LAYER_WINDOW)`
    through `reserve_exact`. It never exceeds the cap.
  - When `needed > MAX_LAYER_WINDOW`, the worker stops the shared budget,
    exactly as an exhausted scan allowance does. The picture is refused
    through the existing path, `The scene is too heavy for this picture
    size (...). Use a smaller --size.`, and is never truncated.
  - Truncation and compaction never shrink below the live length and never
    grow, so the retained capacity of one worker is at most
    `MAX_LAYER_WINDOW` for the whole render.
  - The test-only `render_with` takes the cap as an argument, and
    production passes the constant. `RenderStats` gains `layer_capacity`,
    the largest arena capacity seen by any worker.
- Compaction copies are charged through `WorkerBudget::charge`, one per
  moved layer, only when the moved row has a sample with two or more
  layers.
- Work charges. A sample with at most one layer charges nothing new, so
  scenes without overlapping translucent bodies keep their exact reads,
  charges and bytes. A sample with `k >= 2` layers charges through
  `WorkerBudget::charge`:
  - `k` for storage;
  - `k * (k - 1) / 2` for the insertion ordering;
  - one per neighbour-layer probe in the edge test below.

  Over-budget scenes take the existing refusal.
- Colour. Start from the opaque colour: edge, lit body or background, as
  today. Then apply the layers from the farthest to the nearest:
  `colour = reference_mix(colour, layer_colour, reference_opacity)`. The
  layer colour is `palette.edge` when the layer is an edge, otherwise the
  lit body colour.
- Edge per layer. Find the right and lower neighbour's layer of the same
  body: a linear probe over that neighbour's layers, charged as above.
  Then apply `shade::is_edge` to the layer and that hit (`None` when the
  neighbour has no layer of the body). When at most one translucent body
  reaches each sample, this equals the current rule (`is_edge` against
  the neighbour's single translucent hit), because a different body and a
  missing layer both give an edge.
- Visibility. Every kept layer marks its body drawn
  (`visibility[body].1 = true`). The `hidden`, `drawn` and `outside` rule
  of section 6.7 is otherwise unchanged.
- Both rasterizers implement the rule. The reference keeps its simpler
  structure, with no tiles and no budget.

Goldens. A golden may change only when its scene has two or more
translucent bodies that overlap in screen space in front of the nearest
opaque surface. With at most one translucent layer per sample, the colour
and edge rules reduce to the current ones, so every other golden,
determinism digest and parity byte check stays identical. The plan runs
every capture golden and digest test unchanged. It regenerates a golden
only after showing that the golden's scene meets the overlap condition,
and records the name and reason in its result.

Tests:

- `crates/capture/src/raster/tests.rs`. Build a 10 x 10 mm reference box
  from z = 0 to 1 mm and an open two-triangle sheet covering x, y = -1 to
  11 mm at z = 3 mm. Capture from above. Assert:
  - against the sheet alone, interior pixels over the board differ;
  - the board's outline pixels are edge-mixed;
  - the report marks both bodies drawn.

  Controls:
  - Four sheets over the board (z = 3, 4, 5 and 6 mm, all larger than the
    board), five layers per board sample. Board interior pixels differ
    from the four sheets alone, the board's outline is edge-mixed, and
    all five bodies are reported drawn.
  - An opaque box placed above the board, below the sheet, hides the
    board. The board is reported `hidden` and the pixels inside the
    opaque box equal the sheet-over-opaque render.
  - Single layer: a scene with one reference body and no other
    translucent body, and no touching contact, gives RGB, report and
    `reads` identical to the values before the layer change. The owning
    plan measures them in the working tree before its `raster.rs` edit and
    records them as literals. The scene has no ownership-sensitive ray, so
    the earlier witness plan does not change them.
  - Storage cap: the four-sheet scene with `render_with`'s layer cap set
    below one window's layer count is refused with the existing message
    at every thread count, and no partial result is returned.
  - Staggered dense rows (retained capacity). Use a tall picture (at least
    64 x 512) with dense translucent stacks in separated horizontal
    stripes, placed so that each held row position meets a dense row at a
    different time. Set the test cap C to a little above the largest live
    window and below the sum of the per-stripe peaks. The render
    succeeds, contains every layer, matches the reference, and has
    `layer_capacity <= C` at threads 0 and 1 to 8. A per-row-arena design
    would fail this check.
  - Band-boundary stripe. Put a dense layer stripe on the first sample
    row of the second band. Set the cap C above the largest live window
    and below twice that stripe's layer count. At thread count 1, one
    worker processes both bands and carries the row as lookahead into the
    restart. At thread counts 0 and 1 to 8, assert:
    - the render succeeds and matches the reference;
    - `layer_capacity <= C`.

    A design that appended without the band-restart reset would refuse.
  - Final-row control. Put translucent layers on the last sampled row of
    the picture, at a picture height that leaves the lookahead slot
    unsampled. The render matches the reference at threads 0 and 1 to 8,
    and the debug invariant (no offset beyond the arena) holds.

  Every case except the storage cap compares the production and reference
  rasterizers (reports and RGB), at thread count 0 (auto) and at every
  count 1 to 8. The reference has no budget and no cap.
- `apps/cli/src/native-parity/capture.test.ts`. Write the PCB plus
  imported-STL-sheet document through the production importer (the
  existing STL-to-NMESH path), capture it from the top, and assert both
  bodies are listed without the `[hidden behind other bodies]` note.
- `docs/capture.md:74-78` states that every translucent body in front of
  the nearest solid is mixed in depth order and that a body visible
  through them counts as drawn. It also names the refusal for pictures
  whose stacked translucent layers exceed the per-worker storage bound.

R3-7 `performance-native-artwork-attachment-byte-roundtrip` (medium).

Cause. Native 2D capture resolves a raster attachment in two steps:
`io.readAttachment`, then `encodeRasterDataUrl`
(`apps/cli/src/capture-artwork.ts:112-120`). The bytes cross into Boa as
a `Uint8Array` (`native-engine.ts:178-179`). They become 8,192-byte
`String.fromCharCode` chunks (`packages/ir/src/image.ts:95-97`). The native
`btoa` then rebuilds them one character callback at a time
(`apps/cli/native/src/engine.rs:351`).

Rule. The native CLI resolves an attachment to its data URL in Rust, and
the attachment bytes never enter the interpreter.

- Rust function `raster_data_url(document, relative) -> io::Result<String>`
  next to `files::attachment` in `apps/cli/native/src/files.rs`. The steps
  run in the order the TypeScript path uses:
  1. `nodetto_native::attachments::read`. This is unchanged and keeps
     confinement, the regular-file check and the 32 MiB cap, with the
     same errors.
  2. More than `MAX_ATTACHMENT_IMAGE_BYTES` (30 MiB) fails with
     `Raster attachment exceeds the 30 MiB attachment limit.`.
  3. The MIME sniff of `encodeRasterDataUrl`: PNG, JPEG, GIF87a or
     GIF89a, and RIFF....WEBP, in that order. Otherwise it fails with
     `Attachment is not a supported raster image.`.
  4. `data:image/<png|jpeg|gif|webp>;base64,` followed by
     `base64::STANDARD`.

  The old path produced the same string: `btoa` is `native.base64`, which
  is `STANDARD.encode` of the same bytes, and the MIME is sniffed in the
  same order.
- Host function `attachmentDataUrl(document, path)` in `engine.rs`. It is
  registered in the `native` name list and returns a JS string. Errors go
  through `host_error`, which keeps the message.
- `CommandIo.readAttachmentDataUrl?(documentPath, relative): string` is a
  new optional member (`apps/cli/src/commands.ts`), wired in
  `native-engine.ts`. `readAttachment` stays for bundle and export.
- `capture-artwork.ts` `resolveAsset`. The cache lookup comes first, as
  today. When `io.readAttachmentDataUrl` exists, the resolver uses it,
  checks the result with `isRasterDataUrl(result,
  MAX_ATTACHMENT_IMAGE_BYTES)` (otherwise `Invalid raster attachment.`,
  the encoder's final check), and caches the result with
  `editor.assets.set`. Without it (Bun, tests), the path is
  `encodeRasterDataUrl(readAttachment(...))`, unchanged. The R2-10 raster
  planning code in the same file is not touched.
- Out of scope: `export-command.ts` and `bundle-command.ts` keep their
  current path. The finding names only capture.

Tests:

- `apps/cli/native/src/engine_tests.rs`:
  - `native.attachmentDataUrl` on generated PNG, JPEG, GIF and WEBP
    headers equals `'data:image/<mime>;base64,' + btoa(binary)` of the
    same bytes.
  - It refuses each of these with the messages above or the existing
    confinement error:
    - a text file named `artifacts/fake.png`;
    - a 30 MiB + 1 byte `artifacts/big.png`;
    - the symlink `artifacts/escape.png`, which points to a PNG outside
      the document directory. The path passes `isRasterAttachmentPath`,
      so the refusal comes from the native reader: `Attachment must be a
      file inside the document directory.`.
- The shared fixture, `MULTI_MIB_PNG`. It is a decodable 1100 x 1000 RGB
  PNG of xorshift32 noise (seed 1) in stored deflate blocks, about
  3.15 MiB. Rust (`engine_tests.rs`) and TypeScript
  (`capture-attachments.test.ts`) generate it with the same algorithm. Both
  assert its SHA-256 against one literal, so both tests provably use the
  same bytes. The page is 2D with two `image.raster` elements that share
  `artifacts/noise.png`. The capture options are fixed: `--output
  out.png --padding 0`.
- Legacy-versus-new oracle (`engine_tests.rs`, release only:
  `#[cfg_attr(debug_assertions, ignore = "release only")]`, because the
  legacy path makes millions of interpreted callbacks). This is the same
  Boa engine and renderer that the binary embeds.
  - Run A, the new path. Using the interception pattern of
    `engine_tests.rs:382-386`, `execute(["capture", ...])` records:
    - every `attachmentDataUrl`, `attachment`, `base64` and `btoa` call;
    - the SVG passed to the rasterize host;
    - the written PNG.

    Assert one `attachmentDataUrl` call and zero `attachment`, `base64`
    and `btoa` calls. This is the zero per-byte callback measure: the
    bytes never become a JS array or binary string. Before the fix, both
    `attachment` and `btoa` are called once.
  - Run B, the legacy path, in a fresh context. `native.attachmentDataUrl`
    is replaced by a test-only JS oracle: a verbatim copy of the
    pre-fix `encodeRasterDataUrl` body (MIME sniff, 8,192-byte
    `String.fromCharCode` chunks, `btoa`) applied to
    `new Uint8Array(native.attachment(document, path))`. This is exactly
    the pre-fix resolver.
  - Assert:
    - the data URL inside the rasterized SVG is identical in A and B;
    - the whole SVG is identical;
    - the PNG bytes are identical and their SHA-256 equals the literal
      `MULTI_MIB_CAPTURE_SHA256`, recorded from run B.
- New file `apps/cli/src/native-parity/capture-attachments.test.ts`. It is
  a separate file so that it shares nothing with the `car3-g1*` plans
  (section 21.5), and it runs against the release binary:
  - It generates `MULTI_MIB_PNG`, captures the same page with the same
    options, and expects exit 0. The PNG's SHA-256 equals
    `MULTI_MIB_CAPTURE_SHA256`, the legacy-oracle literal. This ties the
    shipped binary to the legacy bytes for the same multi-MiB external
    attachment. A second run repeats the bytes.
  - The refusals give the same stderr message and exit code as before.
    Both are literals measured with the `a964ad5` binary before the edit:
    - MIME: `artifacts/fake.png`;
    - size: the 30 MiB + 1 byte file;
    - confinement: the `artifacts/escape.png` symlink.

### 21.2 Plan grouping

Plans are named `car3-*`. Each plan:

- is about 150 lines or less;
- uses its own `CARGO_TARGET_DIR=target/car3-<plan>`;
- sets `artifactRoots ["target", "tmp/cad3d"]` exactly. The evidence root
  is `tmp/<taskId>`, outside both artifact roots;
- lists every edited file in `writePaths`, including docs and its plan
  file;
- runs only focused verification: `bun test <paths>`, `cargo test -p
  <crate>`, clippy on the touched crate, and biome on touched files.

`bun run typecheck` and `mise run verify` run once, at integration. The
first dispatch ran its five plans in one wave, and no two plans owned the
same file. Revision 10a (section 21.5) replaces the first row with seven
chained plans:

| Plan | Findings | Owns |
| --- | --- | --- |
| car3-g1-capture-raster (superseded by `car3-g1a` to `car3-g1g`, section 21.5) | R3-1, R3-2 | see section 21.5 |
| car3-cad-drag | R3-3 | see design-cad3d section 20 |
| car3-cad-evaluate | R3-4 | see design-cad3d section 20 |
| car3-g2-cad-history | R3-5, R3-6 | see design-cad3d section 20 |
| car3-native-attachment | R3-7 | `apps/cli/native/src/{files.rs,engine.rs,engine_tests.rs}`, `apps/cli/src/{commands.ts,native-engine.ts,capture-artwork.ts}`, new `apps/cli/src/native-parity/capture-attachments.test.ts`, `apps/cli/src/capture-command.test.ts` |

`interference.rs`, `overlay.rs` and `capture-interference-options.ts` are
not edited. R3-1 removes the false witness before it reaches them, so the
round-2 sweep and boundary-fold code stays as reviewed.

Both native plans build the `nodetto-cli` binary, which links
`nodetto-capture`. Because each plan has its own `CARGO_TARGET_DIR`, the
two builds do not race. A compile failure caused by a sibling's
in-progress edit is rerun after the sibling finishes. It is never fixed by
editing the sibling's files.

Gates. Each entry is one command that runs tests; lint and build
prerequisites are chained with `&&` into the test-bearing command:

- car3-g1a to car3-g1g: see section 21.5.
- car3-native-attachment:
  1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-native-attachment cargo clippy -p nodetto-cli --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-native-attachment cargo test --release -p nodetto-cli`.
     The test run includes the release-only legacy-versus-new oracle.
  2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-native-attachment cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car3-native-attachment/release/nodetto-cli" bun test apps/cli/src/native-parity/capture-attachments.test.ts apps/cli/src/capture-command.test.ts`
- The CAD plans: see design-cad3d section 20.

`cargo fmt --manifest-path` runs after Rust changes.

Integration gates. Each runs once, after all plans land (for revision 10a,
after g1f and g1g), must exit 0,
and records its command, exit status and complete log path:

1. `bun run typecheck` and `bun run lint`;
2. `CARGO_TERM_QUIET=true mise run verify`;
3. `CARGO_TERM_QUIET=true mise run test-cli`;
4. the `*.test.ts` scan of section 20.3, gate 4.

### 21.3 Decisions

- R3-1 tags ownership-sensitive rays at the cast instead of always
  casting twice.
  - The witness shares the shading history until the first flagged step,
    so rays without divergence do and charge exactly today's work.
  - Every extra recast is charged in full (`scan(cost, 0)`) and every extra
    combine through `charge`, so no added work escapes the allowance.
  - The reference rasterizer always uses volume intervals. It is a
    stricter oracle than a copy of the flag logic would be.
- R3-1 does not touch `interference.rs` or `capture-interference-options.ts`.
  The audit's exit-code chain starts at the false picture witness, and
  removing that witness fixes the exit code at its source.
- R3-2 composites every qualifying layer. A bounded number of layers
  would silently drop a visible body, which is the defect itself.
  Bounds come from refusal, never from truncation:
  - layer storage is capped per worker (`MAX_LAYER_WINDOW`);
  - multi-layer work is charged to the existing allowance.

  Both refuse through the existing "too heavy" message.
- R3-2 keeps the per-layer edge rule equivalent to today's rule when one
  layer is present, so only multi-layer scenes change bytes.
- R3-7 keeps all checks in their current order and messages in Rust, and
  validates the returned string with the same `isRasterDataUrl` that ends
  `encodeRasterDataUrl`.
  - Proof of zero per-byte callbacks comes from host interception in the
    real Boa engine, which is deterministic. No environment variable or
    counter is added to the shipped binary.
  - Legacy byte identity comes from a test-only oracle: a verbatim pre-fix
    resolver injected in the engine test, compared on the same multi-MiB
    file. Its PNG hash literal is then asserted against the release
    binary, so no production switch and no pre-fix checkout is needed.
- No user decision is pending, so no `design-docs/user-qa/` file is written
  for round 3.

### 21.4 Risks

- R3-1: if the cast flag misses an ownership-sensitive case, a false pair
  can remain on rare grazing rays. The reference rasterizer, which always
  uses volume intervals, catches any miss on the test fixtures. The flag
  is derived from the same error terms as the volume mode.
- R3-2: a picture with very deep translucent stacks, beyond 262,144 layers
  in one worker's held rows, is refused rather than drawn. The single
  capped arena bounds retained memory at about 15 MB per worker. The message
  asks for a smaller `--size`, which reduces the held rows.
- R3-2: golden regeneration is limited to scenes that meet the overlap
  condition. A golden outside that condition that changes is a defect, not
  a reason to regenerate.
- R3-7: the Rust MIME sniff and size check duplicate the TypeScript
  encoder's rules. The engine test compares the two on all four formats
  and both refusals.
- The audit did not measure native PNG bytes, desktop pixels, Boa elapsed
  time or cross-platform determinism. The gates above measure native PNG
  bytes and exit codes for the fixtures. They replace Boa elapsed time with
  host-call counts. Desktop pixels and cross-platform determinism stay
  unmeasured.

### 21.5 Revision 10a: split of the capture raster plan

`car3-g1-capture-raster` carried R3-1 and R3-2 in one plan. It was attempted
twice and left unfinished: its Rust gate still failed both production
regressions (`impl-plans/progress/car3-g1-capture-raster.md`). The rules of
section 21.1 are unchanged, except that no R3-1 or R3-2 step needs an older
commit or a pre-fix binary (the clauses edited in this revision). Only the
plan grouping changes. `tmp/audit/r3/g1-partial.patch`, the earlier attempt
at the reference witness, is a reference only and is not applied as is.

Contracts between plans:

- C1, ownership flag (g1a to g1c). `PrismView::surface_intervals`,
  `MeshView::surface_intervals` and `ToolView::surface_intervals` return a
  `bool`. It is true exactly when the cast hit one of the three
  ownership-band cases of R3-1, or for a mesh any case that
  `hits_impl::<false>` resolves differently. The intervals they write are
  unchanged.
- C2, reference witness (g1b to g1c). `render_reference` builds every
  witness from `ToolView::intervals`. The stacked-caps and shared-side
  builders, with their 0.01 mm controls, live in a `#[cfg(test)]` module of
  `raster/reference.rs`, visible to `crate::raster`, so g1c reuses them.
- C3, reference layers (g1d to g1e). `render_reference` composites every
  layer by the R3-2 rule. The sheet-over-board, four-sheet,
  opaque-foreground and final-row builders live next to the C2 builders.
- C4, production layers (g1e to g1f and g1g). The arena g1e activates is
  bounded from its first checkpoint: `MAX_LAYER_WINDOW`, capped growth
  through `reserve_exact`, refusal through the shared stop, and the cap
  argument of `render_with` all land in g1e. g1f adds only the test-only
  `layer_capacity` statistic and the retained-capacity and lifecycle
  cases. No checkpoint and no native build has an uncapped production
  arena.

| Plan | Aspect | Owns | dependsOn | Wave |
| --- | --- | --- | --- | --- |
| car3-g1a-cast-flag | R3-1 flag at the cast, with inline tests: a ray in a cap plane, at an edge endpoint and along a parallel side gives true; a generic ray gives false with identical intervals | `crates/capture/src/{prism.rs,mesh.rs,tool_view.rs}` | none | 1 |
| car3-g1b-reference-witness | R3-1 reference witness; tests: reference-only stacked caps and opposed-frame side give no pair and RGB equal to the analysis-off render; both 0.01 mm controls give one pair | `crates/capture/src/raster/reference.rs` | none | 1 |
| car3-g1c-production-witness | R3-1 production witness. Step 1, before any witness edit: add the test-only `charged` statistic (the published charge, no behaviour change) and record the analysis-on `disjoint_scene(50)` `reads` and `charged` literals at threads 0 and 1 to 8. Step 2: witness, recast and combine charges, `witness` statistic, never-flag test switch; all R3-1 tests of 21.1 against the reference at threads 0 and 1 to 8, including both disjoint literals with `witness == 0` and the stacked-cap delta `charged == never-flag charged + witness` | `crates/capture/src/{raster.rs,raster/budget.rs,raster/tests.rs}`; `crates/capture/tests/{render.rs,overlay.rs}` only for a golden shown to be a touching contact | g1a, g1b | 2 |
| car3-g1d-reference-layers | R3-2 reference compositing, colour, per-layer edges and drawn marks; reference-only sheet-over-board, four-sheet and opaque-foreground assertions | `crates/capture/src/raster/reference.rs` | g1b | 2 |
| car3-g1e-production-layers | R3-2 production layers with bounded storage: one worker arena, row lifecycle with its debug invariant, colour, per-layer edges, visibility, multi-layer charges, `MAX_LAYER_WINDOW`, capped growth, refusal through the shared stop, cap argument of `render_with`. Cases: sheet-over-board, four-sheet, opaque and single-layer against the reference at threads 0 and 1 to 8, plus the storage-cap refusal (existing message, no partial result) at every thread count | `crates/capture/src/{raster.rs,raster/budget.rs,raster/tests.rs,shade.rs}` (`shade.rs` only if a helper must change); `crates/capture/tests/{render.rs,overlay.rs}` only for a golden that meets the overlap condition | g1c, g1d | 3 |
| car3-g1f-layer-capacity | R3-2 retained-capacity instrumentation: test-only `RenderStats.layer_capacity`; staggered-stripes, band-boundary and final-row cases of 21.1 at threads 0 and 1 to 8. No behaviour change | `crates/capture/src/{raster.rs,raster/budget.rs,raster/tests.rs}` | g1e | 4 |
| car3-g1g-native-docs | Native parity cases of R3-1 and R3-2 and the `docs/capture.md` paragraph of R3-2, including the refusal sentence for the storage bound that g1e delivers | `apps/cli/src/native-parity/capture.test.ts`, `docs/capture.md`; `apps/cli/src/capture-docs.test.ts` only if it asserts the changed paragraph; gate outputs `tmp/capture/m09/timing.json` and `tmp/capture/m23/timing.json` (written by the existing timing cases at `capture.test.ts:178,317` and `749`) | g1e | 4 |

Every plan also owns its plan file and its progress file. Dependencies
exist only for a contract (C1 to C4) or a shared file:

- g1c and g1e share `raster.rs`, `budget.rs` and `tests.rs`;
- g1b and g1d share `reference.rs`;
- g1e and g1f share `raster.rs`, `budget.rs` and `tests.rs`.

g1g depends on g1e, because its parity cases need both fixes and the
storage bound in the binary. g1f changes no behaviour, so g1g runs beside
it. `capture-help.ts`
does not describe translucent bodies, so no plan edits it.
`interference.rs`, `overlay.rs` and `capture-interference-options.ts` stay
unedited, as in section 21.2.

Per-plan size. Each plan is one implementer sitting: one aspect, at most
four owned files, at most about 120 plan lines. Each plan's own regression
cases are written first and run in the working tree before its edit. A
case that already passes before the edit is reported as a control, not as
fail-before evidence.

Gates. Each plan uses `CARGO_TARGET_DIR=target/car3-<plan>` and sets
`artifactRoots ["target", "tmp/cad3d"]` exactly. Evidence goes to
`tmp/car3-r3b/<plan>`, outside both artifact roots.

- g1a to g1f, one command:
  `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-<plan> cargo clippy -p nodetto-capture --all-targets -- -D warnings && cargo fmt -p nodetto-capture --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-<plan> cargo test --release -p nodetto-capture`.
  The release run includes the reference comparisons and the round-1 and
  round-2 protections (`boundary_fold.rs`, `overlay_alloc.rs`,
  `boundary_read_counts_and_refusal_are_bounded`) unchanged. Each plan's
  new cases are named, and the plan's result names the passing count.
- g1g:
  `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1g cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car3-g1g/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/capture-docs.test.ts && bunx biome check apps/cli/src/native-parity/capture.test.ts`.
- A compile failure caused by a sibling's in-progress edit is rerun after
  the sibling finishes. It is never fixed by editing the sibling's files.
- `maintainability-capture-raster-rounding` (`capture-artwork.ts`) is not
  touched by these plans, and the integration gates run its tests.

Dispatch. One new manifest, `impl-plans/active/car3-r3b-dispatch.json`
(task `car3-r3b`), lists only the seven plans, in the waves above.
The checkpoint that creates it also:

- deletes `impl-plans/active/car3-r3-dispatch.json` and
  `impl-plans/active/car3-g1-capture-raster.md`;
- updates the plan index in `impl-plans/active/car3-00-overview.md`;
- archives the stray test copies (below) before any plan starts.

The manifest carries `tmp/capture/m09/timing.json` and
`tmp/capture/m23/timing.json` in g1g's `writePaths`, as
`car3-r3-dispatch.json` did for the superseded plan.

Stray test copies. 753 round-1 `*.test.ts` copies already fail gate 4 of
section 21.2: 7 under `tmp/car1-r1/car1-c-body-selection` and 746 under
`tmp/car1-r1/car1-d-pcb-page-kind`, exactly the list in
`tmp/car2-r2b/reconcile-wave-005/stray-tests.txt` (the open item in
`impl-plans/README.md:101-102`). The checkpoint owner that writes the
manifest handles them once, as a prerequisite of the dispatch:

- Scope: only the paths in that list, only in those two directories. The
  manifest records both directories as the checkpoint's authorized write
  paths. No plan owns them.
- Action: a reversible rename that appends `.archived`
  (`x.test.ts` to `x.test.ts.archived`). Contents and logs are kept. Bun
  does not discover the new names. Stripping the suffix restores them.
- Check: the scan of gate 4 exits 0 after the rename, before any plan
  starts. The command, exit status and log path are recorded under
  `tmp/car3-r3b/checkpoint`.

The other car3 plans are not dispatched again. Integration runs the gates
of section 21.2 once after g1f and g1g land. Integration runs the gate-4
scan twice: before `mise run verify` and after the last gate. Both scans
must exit 0.

Decisions:

- The cast flag is its own plan (g1a). It is the semantic core of R3-1,
  and folding it into the production witness gave six files, more than
  the size limit.
- Each reference rasterizer plan comes before the matching production
  plan. The reference is the oracle, so a reference-only test proves its
  rule first. The production plan then adds the equality tests at every
  thread count.
- The storage cap lands with the arena that needs it (g1e). Only the
  retained-capacity statistic and the stripe, band-boundary and final-row
  cases follow in g1f. These are test instrumentation on a bounded arena,
  so no intermediate checkpoint or native build is uncapped.
- The disjoint-scene charge baseline is an independent working-tree
  measurement taken before the witness edit. A comparison with the
  never-flag switch alone cannot see a charge added to both paths. The
  never-flag switch is kept only for the stacked-cap witness delta.
- The native cases are regression guards. Fail-before evidence is the Rust
  cases, so no older commit or pre-fix binary is built.

## 22. Revision 11: audit round 4 corrections

Source: audit round 4 of the 3D CAD pages and AI capture, base `0a35708`
to `audit/round-4` at `3f9ce78`. It has eight findings (two high, six
medium), none deferred. No GitHub issue exists; the round-4 workflow input
is the issue body. This section states the capture rules R4-1, R4-2, R4-3
and R4-6 and the plan grouping of all eight findings. The core rules R4-4,
R4-5, R4-7 and R4-8 are in `design-docs/specs/design-cad3d.md` section 21.
Where an earlier section and this one disagree, this section wins.

Common rules (those of sections 19 to 21, restated):

- Every fix ships a test that fails on `3f9ce78` and passes after it, in
  the working tree. A performance test asserts a deterministic operation,
  visit or byte counter, never a wall clock. For the two duplicated-rule
  findings (R4-7, R4-8) the failing-before test asserts the single-owner
  contract.
- These do not change: NCS1 bytes of documents without a hidden Boolean
  target, PNG, JPG and SVG bytes, goldens, standalone SVG export, error
  codes, existing messages and their precedence, package boundaries
  (`packages/io` never imports `@nodetto/core`; `packages/core/src/pcb`
  imports only itself) and strict indexed typing.
- Untouched: `crates/capture/src/raster.rs`, `crates/capture/src/raster/**`,
  `crates/capture/src/prism.rs`, `crates/capture/src/cast.rs`, the capture
  goldens and `docs/capture.md`. Every rule below is reachable without
  them.
- Per-pixel, per-vertex and per-byte work stays in Rust on the native CLI.

### 22.1 Rules

R4-1 `function-capture-hidden-target-empty-cut` (high).

Cause. `buildCadCaptureModel` registers the tool of a hidden body and then
drops the body (`packages/core/src/capture/scene.ts:220-226`). A later cut
or intersect attaches its step only to targets in the visible-body map
(`:311-315`). The evaluator rejects a Boolean that empties any target
before it commits any target (`packages/core/src/cad/evaluate.ts:294`,
`:827-837`). The app therefore keeps the visible body whole while the
capture applies the cut. Nothing in the scene records the hidden history,
so the census (`crates/capture/src/census.rs:77`) cannot see the emptying,
and the hidden-target scene is byte-identical to the visible-only control.

Rule. The capture carries the Boolean history of a hidden target that a
shared difference or intersection needs. Only the census evaluates it, and
the emptying step is reported against every visible body that shares it.

- Model (`scene.ts`). A hidden non-reference body (a hidden `op: "new"`
  extrude or a hidden mesh body) is kept in a separate hidden-body map. It
  follows the step rules of a visible body: its own union first, then
  every later add, cut or intersect step whose `targets` list it.
  - A hidden body is emitted in `CadCaptureModel.hiddenTargets` exactly
    when at least one of its difference or intersection steps also
    targets a visible non-reference body.
  - `hiddenTargets` is an optional field. It is absent or empty when there
    is no such body, and its entries are `{ id, steps }` in creation order.
  - `bodies`, `bounds` (camera fit), interference body indices and the
    report body list never contain a hidden body.
- NCS1 (`scene-binary.ts` writes it, `crates/capture/src/scene.rs` reads
  it).
  - The header word at offset 36, written as zero today, becomes
    `hiddenCount` (0..20,000).
  - After the `bodyCount` body records come `hiddenCount` records in the
    body record format, with flags 0. A reader rejects any set flag with
    `Invalid capture scene: hidden body flags must be zero.`
  - Step rules are those of a body: at least one step, a union first, and
    tool indices in range. The version stays 1.
  - With no hidden target the word stays 0 and no record follows, so those
    scenes are byte-identical to today.
  - `checkScenePreTool` bounds the hidden count like the body count, and
    `prepareCadCapture` (`cad-request.ts`) passes the count to it.
- Rust scene. `Scene` gains `pub hidden: Vec<Body>`.
  - The rasterizers and the interference analysis iterate `scene.bodies`
    only, so the protected raster files need no edit.
  - `Scene` struct literals exist only in
    `crates/capture/src/{scene.rs,tiles.rs,census.rs}` (in tests). The
    raster and integration tests build scenes by parsing fixtures, so they
    get an empty `hidden`.
- Hidden census. It lives in `census.rs` and is called from
  `lib.rs::render_parsed` after `render_rgb`, only when `scene.hidden` is
  not empty. Every host goes through `render_parsed`:
  `apps/cli/native/src/engine.rs:193` directly, and
  `apps/desktop/src-tauri/src/capture.rs` through `render_scene`.
  1. `tool_view::classify(scene)` is computed once for this pass.
  2. Hidden bodies are taken in order, at most `CENSUS_LIMIT` of them, and
     only those whose first tool is solid. Each is sampled with the census
     lattice exactly as a picture-absent body (section 6.7): the same cell
     (`target_cell`), the same weight rule and the same per-axis loop.
  3. The hidden census has its own allowance, of the same size as the
     picture census: `budget_million_rays * 10^6` when analysing, and
     24,000,000 otherwise. The check therefore does not depend on the
     interference options.
  4. `lattice::sample_body_axis_with` resolves a body index
     `i >= bodies.len()` to `hidden[i - bodies.len()]`. Nothing else in
     `lattice.rs` changes.
  5. A hidden body whose sampling ends incomplete makes no claim.
     Otherwise, let `j` be its first step after which no material remains.
     If step `j` is a difference or intersection with tool `t`, consider
     every visible body `b` that is not open-source and has a step with
     the same tool and op; let `k` be the first such step. Body `b` gets
     the candidate `k` only when its own `emptied_by_step` is -1 or greater
     than `k`. The smallest candidate per body wins.
- Report JSON (`report.rs`). `to_json` keeps its output.
  `to_json_with_hidden(&[Option<i32>])` appends
  `,"hiddenEmptiedByStep":k` after `"open"` inside a body object, only
  when that body has a candidate. Reports of scenes without hidden targets
  are therefore byte-identical. `BodyReport` and `Report` keep their
  fields, because the protected `raster.rs` constructs both.
- TypeScript report (`report.ts`, `describe.ts`).
  - `SolidBodyReport` gains an optional `hiddenEmptiedByStep`. It is
    either absent or a safe integer >= 0; anything else fails
    `parseSolidReport`.
  - In `describeBodies`, when the key is present and `body.steps[k]` names
    a tool, the body's error replaces the `emptiedByStep` error:
    `{ id: tool.feature, code: "cad.result.empty", text: "(sampled): leaves no material in a hidden target body; the app rejects this feature and keeps \"<name>\" as it was, this picture applies it" }`.
  - The body gets `[differs from the app, see errors]` under the existing
    state condition. The existing `emptiedByStep` text is unchanged.
- Callers need no change: `apps/cli/src/capture-command.ts:241`,
  `apps/cli/src/capture-cad.ts:126` and
  `apps/desktop/src/shell/export-handlers.ts:262` already pass the
  `describeBodies` errors to `errors:` and to the exit code.

Tests. The fixture has a visible `wide` (20 x 10 x 4 mm), a hidden
`hidden` (2 x 2 x 4 mm) and a cut `trim`, a 5 x 10 mm strip through `wide`
that covers `hidden`. The names are test data of this design, not user
data. Each case runs with the target lists `[wide, hidden]` and `[wide]`,
with interference off.

- `scene.test.ts`.
  - Both lists give `bodies` = `[wide]` and equal `bounds`.
  - Only the two-target list gives a hidden target, with steps
    `[union hidden-tool, difference trim-tool]`.
  - The two scenes differ. The control has word 36 = 0 and its pre-change
    length.
  - Existing scene and golden byte tests pass unchanged.
- `scene-binary.test.ts`: the writer layout of one hidden record and the
  hidden-count bound.
- `crates/capture/tests/scene.rs`: a hidden record parses. A set hidden
  flag, a count over the limit and truncated data are rejected. Existing
  fixtures parse with `hidden` empty.
- `crates/capture/tests/census.rs`, through `render_parsed` with options 0:
  - the two-target scene's JSON has `"hiddenEmptiedByStep":1` on `wide`;
  - the control's JSON has no such key;
  - an exhausted hidden allowance adds no key;
  - 1 and 5 threads give the same output.
- `report.test.ts` and `describe.test.ts`.
  - The parser accepts the optional key and rejects -1, 1.5 and strings.
  - The two-target report gives exactly one `cad.result.empty` error, with
    id `trim`, naming `wide`. The control gives none.
- `apps/cli/src/native-parity/capture.test.ts`: the native CLI with
  `--no-interference` prints the `trim` sampled error for the two-target
  document and no error for the control. In both, `wide` is the only
  listed body.

R4-2 `performance-capture-repeated-attachment-svg-expansion` (high).

Cause. `resolveAsset` in `apps/cli/src/capture-artwork.ts:114-134` returns
the full data URL, and `packages/core/src/svg-export/shapes.ts:189-200`
writes it into every placement. The attachment is read only once, but the
renderer input holds one payload copy per placement. For a 33,234-byte PNG
placed 1, 8 and 32 times, the input was 44,810, 356,447 and 1,424,930
bytes. The whole string also passes through font coverage and rendering
(`apps/cli/native/src/engine.rs:239-252`).

Rule. In capture only, the SVG embeds each distinct attachment exactly
once, in an unrendered carrier, and every placement refers to it by a
deterministic URL. Both real renderers resolve that URL from the carrier.
Neither renderer ever receives a per-placement copy of the payload.

Contract between the capture SVG and both renderers (owned by this
section, implemented by car4-f2a and car4-f2b):

- Carrier block. One `<defs>` element inserted directly after the root
  `<svg ...>` start tag. It contains, for `n = 0, 1, ...` in ascending
  order, exactly
  `<image id="nodetto-capture-asset-<n>" href="<data URL>"/>`.
  `<n>` is decimal and the data URL is the validated
  `data:image/(png|jpeg|webp|gif);base64,<payload>`. A `<defs>` child that
  nothing references is never rendered (SVG 1.1 section 5.3.2; usvg
  converts only referenced or rendered elements), so the carrier adds no
  pixels.
- Placement reference. Each placement's `href` is
  `https://nodetto.invalid/capture-asset/<n>`. The `.invalid` top-level
  domain never resolves (RFC 2606), and neither renderer fetches anything.
  The URL is HTTPS-shaped because resvg-js reports only such hrefs through
  `imagesToResolve()`; the step-3 reviewer probe showed that custom-scheme
  tokens stay unresolved.
- Uniqueness. A carrier start sequence `<image id="nodetto-capture-asset-`
  cannot come from document content: text escapes `<`, attribute values
  escape `"`, and the exporter writes no `id` on `<image>`
  (`shapes.ts:189-200`). Only `capture-artwork.ts` writes carriers.

Data flow.

- `capture-artwork.ts`.
  - `resolveAsset(source)` still reads and validates the attachment once
    and caches it in `editor.assets`.
  - It returns the placement URL for index `n`, where `n` is the position
    of `source` in first-resolution order (export traversal order, so
    deterministic). The first time, it records the data URL for carrier
    `n`.
  - Otherwise the SVG is the exporter's output, so fitting, cropping
    (`preserveAspectRatio` and the cropping `<svg overflow="hidden">`),
    opacity, corner clips and masks are untouched. Every placement keeps
    its own `<image>` element.
  - After `pixelFrame`, the carrier block is inserted. `fontCoverage` and
    `backend.rasterize` both receive this one SVG.
  - `CaptureBackend.rasterize` keeps its signature. A source that is not an
    attachment still throws `Missing attachment`.
- Native renderer (`apps/cli/native/src/render.rs`). `render::png` scans
  the SVG once for carriers, in Rust.
  1. Indices must run 0, 1, 2, ... in order. A carrier that is malformed,
     out of order or carries an invalid data URL fails with
     `Invalid raster attachment.`.
  2. Each payload is decoded once (with the `base64` crate, already a
     dependency) into an `Arc<Vec<u8>>`, and its MIME type is kept.
  3. Only when at least one carrier exists, `render::png` sets
     `usvg::Options::image_href_resolver.resolve_string`. It maps
     `https://nodetto.invalid/capture-asset/<n>` to
     `ImageHrefResolver::default_data_resolver()(mime, arc.clone(), options)`,
     the call usvg makes for an inline data URL. Every other string goes
     to the default string resolver.
  4. Each placement therefore gets the same `ImageKind` as an inline data
     URL, so the render tree is unchanged.

  An SVG without carriers, such as every raster export, takes today's path
  unchanged. The `png` host, `engine.rs` and `native-engine.ts` keep their
  signatures.
- Bun reference renderer (`apps/cli/src/capture-backend.ts`, pinned
  `@resvg/resvg-js` 2.6.2).
  1. It scans the same carriers in the SVG string, keeping each carrier's
     MIME type with its index, and passes that string unchanged to
     `new Resvg`.
  2. It resolves each distinct URL once (`new Set(imagesToResolve())`). One
     `resolveImage` call resolves every placement of that URL, as the
     step-3 carrier probe showed.
  3. It resolves a URL only when the carrier's MIME type is one the pinned
     backend draws from an inline data URL: `image/png`, `image/jpeg` and
     `image/gif`. The buffer for `n` is decoded once.
  4. A carrier of `image/webp` is left unresolved. Version 2.6.2 omits an
     inline WebP image and renders the rest; its external resolver throws
     `Unsupported image types` for WebP (step-3 probe `0ddaad`). Leaving the
     URL unresolved keeps today's successful, image-less Bun output.
  5. Any other `resolveImage` error propagates unchanged.

  No payload is reinlined at any point. The native renderer resolves every
  validated MIME type, WebP included (usvg 0.48), so native WebP behavior
  is unchanged.

Renderer-input bound. Let `M` be the largest single placement markup. At
both real boundaries:

- the native boundary, the string passed to `native.png`, which
  `native-engine.ts` passes unchanged to the Rust host;
- the Bun boundary, the string passed to `new Resvg` plus the distinct
  buffers passed to `resolveImage`;

the input for 32 placements minus the input for 1 placement is at most
`31 * M`, and each payload occurs exactly once.

Tests.

- `capture-command.test.ts`, fake backend (this is the native boundary
  string, because `native-engine.ts` forwards it unchanged). One page has
  1, 8 and 32 placements of one attachment, with different sizes, fits and
  a crop. Assert:
  - one read;
  - exactly one `base64,` occurrence, inside the carrier;
  - every placement `href` is the placement URL;
  - the length bound above.
- Bun boundary, in `capture-command.test.ts`. `capture-backend.ts` exports
  the pure step it runs before rendering, `captureRenderInput(svg)`, which
  returns the string given to `Resvg` and the map from URL to buffer;
  `rasterize` uses it.
  - For 1, 8 and 32 placements: the map holds one distinct buffer, and the
    string length obeys the bound.
  - PNG parity: the Bun PNG of the capture SVG equals the Bun PNG of the
    independently embedded SVG, which has every placement's own data URL
    and no carrier. The cases are meet, slice, fill and crop placements of
    different sizes, at scales 1 and 2.37.
  - MIME parity: four placements of one attachment, once per MIME type
    (PNG, JPEG, GIF and WebP). Each capture succeeds, and its Bun PNG
    equals the inline control byte for byte. For WebP this means the
    image-less output of today; the map holds no WebP entry, and the
    string still holds exactly one WebP payload.
  - The GIF and WebP fixtures are small byte literals in the test. The
    WebP is generated once with
    `cwebp -quiet -lossless apps/desktop/src-tauri/icons/32x32.png -o -`;
    the GIF is a hand-built 2 x 2 image. Neither comes from user data.
- `apps/cli/native/src/engine_tests.rs`. This is the first gate of
  car4-f2a and must pass before car4-f2b starts.
  - For the same four placement kinds at scales 1 and 2.37, the `png` host
    output for the carrier SVG equals that of the independently embedded
    SVG.
  - `transcode` to JPG gives the same bytes for both.
  - The carrier scan of a 32-placement SVG yields one decoded payload.
  - A malformed or out-of-order carrier fails with
    `Invalid raster attachment.`.
  - An SVG without carriers renders the same bytes as before.
- New `apps/cli/src/native-parity/capture-attachment-reuse.test.ts`, run
  with the release binary. Document A places one attachment three times.
  Document B places three byte-identical attachment files once each, with
  the same geometry. The native capture PNG and JPG bytes of A equal those
  of B.
- Standalone SVG export is untouched. Only `capture-artwork.ts` writes
  carriers and placement URLs, and the existing export tests run in the
  integration gates.

Evidence status.

- Observed by the step-3 reviewer, all exit 0:
  - `bun tmp/round4-design/resvg-resolve.ts`: HTTPS placeholders gave PNG
    bytes identical to inline data URLs at zoom 1 and 2.37.
  - The carrier PNG probe (`d0641f`): the carrier SVG gave identical PNG
    bytes at both scales, and one `resolveImage` call per URL resolved
    all four placements.
  - The carrier WebP probe (`0ddaad`): inline WebP succeeds without the
    image, while `resolveImage` throws. This is the reason for step 4
    above.
- Not yet observed: the GIF and JPEG Bun cases, and the usvg 0.48
  resolver path. The engine test and the Bun MIME parity test are the
  first gates of their plans. A failure is reported as blocked; it is
  never worked around by reinlining.

R4-3 `performance-capture-loop-normalization-pair-scans` (medium).

Cause. `normaliseToolLoops` (`scene.ts:105-130`) scans every loop of a
depth bucket from the start for each deeper loop. N separate rings
therefore cost N(N+1)/2 probes: 125,250, 500,500 and 2,001,000 at 500,
1,000 and 2,000 rings.

Rule. Each depth bucket gets a uniform grid with bounded replication and
an oversized list.

- Dimensions: `cols = clamp(round(sqrt(n * w / h)), 1, n)` and
  `rows = clamp(round(sqrt(n * h / w)), 1, n)`, for `n` loops and a bucket
  span of `w` by `h`. A zero span gives one cell on that axis. There are
  O(n) cells, and the aspect term keeps a single row or column of rings at
  about one ring per cell.
- One monotonic cell mapping, `min(cells - 1, floor((x - min) / span *
  cells))`, serves both insertion and query.
- Bounded materialization. A loop's cell range is computed from its bounds
  before anything is stored.
  - If the range covers at most `MAX_LOOP_CELLS = 16` cells, the loop is
    inserted into each of those cells.
  - Otherwise the loop is appended once to the bucket's oversized list.

  Total entries are therefore at most `16 n + n`, whatever the overlap of
  the bounds, and this bound holds before the tool-point charge
  (`scene.ts:282-285`).
- Each stored entry keeps the loop's original bucket position. Cell lists
  and the oversized list are filled in bucket order, so each is sorted by
  position.
- Query for a point. A two-pointer merge walks the oversized list and the
  single cell that holds the point (no cell when the point is outside the
  bucket bounds) in ascending bucket position, and stops at the first
  containing loop.
- Probe bound.
  - A loop whose bounds contain the point is either oversized or stored
    in that cell, so the first containing loop in merged order is the
    first containing loop in bucket order, the one today's scan stops at.
  - The examined candidates are therefore a subsequence of today's
    examined prefix. For every query and every input, probes are at most
    today's count, and early exit is preserved.
- The candidate test is unchanged: bounds first, then `containsPoint`. The
  result depends only on whether some loop of depth `k` contains the
  point, never on which one, so the retained loops and their order are
  identical.
- `stats` gains an optional `indexEntries`, which counts every stored
  entry (cell insertions plus oversized appends). `ancestorProbes` keeps
  counting the candidates examined.

Tests (`scene.test.ts`, next to the perforated-plate test at `:632`).

- Separate rings (an outer square plus one hole) for N = 500, 1,000 and
  2,000, in a square layout and in a single row. For each doubling of N,
  `ancestorProbes` and `indexEntries` each grow by at most 2.5 times.
- The step-3 diagonal strips: N disjoint loops
  `[0, s, 1000, 1000 + s, 1000, 1000 + s + 0.005, 0, s + 0.005]` with
  `s = i * 0.01`, plus one hole
  `[1, 1.001, 2, 2.001, 2, 2.004, 1, 1.004]` inside the first loop, for
  N = 1,200, 2,400 and 4,800.
  - `indexEntries` is at most 17N, so construction is linear.
  - `indexEntries + ancestorProbes` grows by at most 2.5 times per
    doubling.
  - All loops are retained, in order.
  - The reviewer measured 1,428,000, 5,726,208 and 22,420,824 entries for
    the unbounded grid; each of these strips spans more than 16 cells and
    goes to the oversized list.
- The step-3 mixed fixture checks early exit.
  - The outer square `[500, 0, 504, 0, 504, 4, 500, 4]` comes first in
    its bucket, followed by N of the diagonal strips above.
  - N disjoint 0.02 mm square holes lie in that square, at
    `x = 500.01 + (i % 50) * 0.07` and `y = 0.01 + floor(i / 50) * 0.07`,
    for N = 500, 1,000 and 2,000.
  - `ancestorProbes` equals N, one probe per hole, as today. The rejected
    oversized-first order made 250,500, 1,001,000 and 4,002,000.
  - `indexEntries` is at most 17 times the bucket size.
- For every fixture, the retained loops equal those of the oracle, a
  verbatim copy of the current function kept in the test, and the NCS1
  bytes written from both are equal.
- The perforated-plate test passes unchanged.

R4-6 `maintainability-capture-glyph-attribution-scope` (medium).

Cause. `capture-artwork.ts:157-170` and `apps/cli/src/export-command.ts:601-616`
each attribute missing glyphs to every element of the page when the target
is a group or frame. The renderer draws only the expanded membership
(`packages/core/src/svg-export/document.ts:775-779`, `:796-804`).

Rule. Membership has one owner, and the CLI has one attribution helper.

- Core (`document.ts`).
  - The membership that `renderSelectionSvg` and `renderArtboardSvg`
    compute today (`expandContainers`, the page filter, the artboard's
    `excludeIds` and `selfContained`) moves into one internal function.
    Both renderers use it, so their output is unchanged.
  - `svgExportMemberIds(store, registry, pageId, ids)` returns the ids of
    that list for the selection path. As in `renderSelectionSvg`, a single
    frame id takes the artboard path.
  - It is exported from `packages/core/src/index.ts`.
- CLI (`apps/cli/src/glyph-coverage.ts`, already the attribution owner).
  `attributeTargetGlyphs({ document, page, target, editor, missing })`
  works as follows.
  - Without a target, it keeps today's page-wide list.
  - With a target, it keeps the page's `document.elements` whose id is in
    `svgExportMemberIds(editor.store, editor.registry, page.id,
    [target.id])`, in document order.
  - It then calls `attributeMissingGlyphs`.
  - `capture-artwork.ts` and `export-command.ts` both call it and keep
    their warning text and order.
  - Page-level fallback warnings and image bytes do not change.

Tests.

- Capture (`capture-command.test.ts`) and raster export
  (`export-command.test.ts`) use a group and a frame. Each has an inside
  label and an outside label containing U+03BB, and injected coverage
  reports U+03BB as missing.
  - For the group and for the frame, only the inside id is warned.
  - A whole-page run warns both.
- A core test asserts that `svgExportMemberIds` equals the element set of
  `renderSelectionSvg` and `renderArtboardSvg` for the same fixtures.
- Existing SVG export tests pass unchanged.

### 22.2 Plan grouping

Plans are named `car4-*`. Each plan:

- covers one finding aspect, at most about four files and about 150
  lines, and has a non-empty `acceptanceCriteria`;
- uses its own `CARGO_TARGET_DIR=target/car4-<plan>`;
- sets `artifactRoots ["target", "tmp/cad3d"]` exactly. The evidence root
  `tmp/<taskId>` is outside both;
- lists every edited file in `writePaths`, including its plan file;
- runs only its focused gates (below), biome on its touched files, and
  `cargo fmt --manifest-path` plus clippy after Rust changes.

Plans that edit the same file are chained with `dependsOn`:

| Plan | Finding | Owns | dependsOn |
| --- | --- | --- | --- |
| car4-f1a-capture-scene | R4-1 TS model and writer | `packages/core/src/capture/{scene.ts,scene-binary.ts,cad-request.ts,scene.test.ts,scene-binary.test.ts}` | none |
| car4-f1b-ncs1-hidden-reader | R4-1 Rust reader | `crates/capture/src/{scene.rs,tiles.rs}`, `crates/capture/src/census.rs` (test `Scene` literal only), `crates/capture/tests/scene.rs` | none |
| car4-f1c-capture-report | R4-1 report and text | `packages/core/src/capture/{report.ts,describe.ts,report.test.ts,describe.test.ts}` | none |
| car4-f1d-hidden-census | R4-1 census, JSON, end to end | `crates/capture/src/{census.rs,lattice.rs,report.rs,lib.rs}`, `crates/capture/tests/census.rs`, `apps/cli/src/native-parity/capture.test.ts` | f1a, f1b, f1c |
| car4-f2a-native-assets | R4-2 native carrier resolution | `apps/cli/native/src/{render.rs,engine_tests.rs}` | none |
| car4-f2b-capture-assets | R4-2 capture carrier and Bun resolution | `apps/cli/src/{capture-artwork.ts,capture-backend.ts,capture-command.test.ts}`, new `apps/cli/src/native-parity/capture-attachment-reuse.test.ts` | f2a |
| car4-f3-loop-index | R4-3 | `packages/core/src/capture/{scene.ts,scene.test.ts}` | f1a |
| car4-f4-swept-extents | R4-4 | see design-cad3d section 21 | none |
| car4-f5-ear-index | R4-5 | see design-cad3d section 21 | none |
| car4-f6a-export-members | R4-6 core | `packages/core/src/svg-export/document.ts`, `packages/core/src/index.ts`, new `packages/core/src/svg-export/members.test.ts` | none |
| car4-f6b-glyph-attribution | R4-6 CLI | `apps/cli/src/{glyph-coverage.ts,capture-artwork.ts,export-command.ts,capture-command.test.ts,export-command.test.ts}` | f2b, f6a |
| car4-f7-nmesh-reader | R4-7 | see design-cad3d section 21 | none |
| car4-f8-face-resolution | R4-8 | see design-cad3d section 21 | f4 |

Waves:

1. f1a, f1b, f1c, f2a, f4, f5, f6a and f7;
2. f1d, f2b, f3 and f8;
3. f6b.

The chains exist only for shared files (`scene.ts`, `capture-artwork.ts`,
`capture-command.test.ts` and `history.ts`) and for the f1d end-to-end
test, which needs the TS writer, the reader and the text.

Gates. Each entry exits 0 and runs at least one test that the plan makes
pass. Lint and build prerequisites are chained with `&&`:

- f1a: `bun test packages/core/src/capture/scene.test.ts packages/core/src/capture/scene-binary.test.ts packages/core/src/capture/cad-request.test.ts packages/core/src/capture/determinism.test.ts`
- f1b: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f1b cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f1b cargo test --release -p nodetto-capture`
- f1c: `bun test packages/core/src/capture/report.test.ts packages/core/src/capture/describe.test.ts`
- f1d:
  1. the f1b command with `target/car4-f1d`;
  2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f1d cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car4-f1d/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
- f2a: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f2a cargo clippy -p nodetto-cli --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f2a cargo test --release -p nodetto-cli`
- f2b:
  1. `bun test apps/cli/src/capture-command.test.ts`;
  2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f2b cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car4-f2b/release/nodetto-cli" bun test apps/cli/src/native-parity/capture-attachment-reuse.test.ts`.
     `apps/cli/src/native-parity/capture.test.ts` is owned by f1d, which
     runs at the same time, so it is not in this gate. f1d's gate and
     integration gate 3 run the full native capture suite.
- f3: `bun test packages/core/src/capture/scene.test.ts packages/core/src/capture/determinism.test.ts`
- f6a: `bun test packages/core/src/svg-export/members.test.ts packages/core/src/svg-export.test.ts packages/core/src/frame-title.test.ts packages/core/src/rotation-export.test.ts packages/core/src/svg-paint-order.test.ts`
- f6b: `bun test apps/cli/src/capture-command.test.ts apps/cli/src/export-command.test.ts apps/cli/src/glyph-coverage.test.ts`
- f4, f5, f7 and f8: see design-cad3d section 21.

A compile failure caused by a sibling's in-progress edit is rerun after
the sibling finishes. It is never fixed by editing the sibling's files.
Timing tests may be retried up to three times under load. A failure after
that is compared in isolation before it is reported.

Integration gates run once, after every plan lands. Each records its
command, its exit status and the path of its complete log:

1. `bun run typecheck` and `bun run lint` (biome);
2. `CARGO_TERM_QUIET=true mise run verify`;
3. `CARGO_TERM_QUIET=true mise run test-cli`;
4. no `*.test.ts` file under `target/` or `tmp/` (the scan of section
   20.3, gate 4).

### 22.3 Decisions

- R4-1 carries hidden histories in a trailing NCS1 section, counted by the
  former zero word at offset 36.
  - Version 1 is kept, because the reader and the writer ship together and
    old scenes have a zero there.
  - A hidden record never enters `bodies`, so drawing, camera fit,
    interference and the report body count are unchanged by construction.
- R4-1 runs the hidden census in `lib.rs` after rendering, not inside
  `census::resolve_with`. The caller of `resolve_with` and the
  `BodyReport` and `Report` literals live in the protected `raster.rs`.
  The JSON key is emitted only when set, so every report without a hidden
  target is unchanged.
- R4-1 reports only the first emptying step of a hidden body, and only
  when it is a shared step earlier than the visible body's own emptying
  step. This is the rule of section 6.7: after the first rejected step,
  the capture and the app no longer agree.
- R4-2 embeds each payload once, in an unreferenced `<defs>` carrier, and
  keeps every placement's `<image>` element as the exporter writes it.
  Only the `href` changes.
  - `<use>` or `<symbol>` reuse was rejected. `<use>` cannot set the
    geometry or `preserveAspectRatio` of an `<image>`, and a wrapper
    transform changes the usvg render tree, so byte parity would hold only
    by accident.
  - Resolving the placement URL in each renderer to the carrier's decoded
    bytes gives the same image data and the same element geometry, so the
    render tree is unchanged.
  - The `.invalid` HTTPS URL is the form resvg-js reports for resolution
    (step-3 probe).
  - The carrier is scanned in Rust on the native path (per-byte work stays
    out of Boa) and in Bun on the reference path.
- The R4-3 index and the R4-5 index keep existence semantics: only whether
  a blocking candidate exists matters. The index changes visit counts and
  never results.
- R4-3 bounds replication per loop (at most 16 cells) and sends larger
  loops to an oversized list that is stored once. Queries merge that list
  with the point's cell in original bucket position. This keeps
  construction linear for any overlap of bounds, and keeps every query at
  or below today's probe count with today's early exit. Walking the
  oversized list first was rejected in step-3 review: on the mixed
  fixture it raised the probes from 2,000 to 4,002,000.
- R4-6 extracts membership in core instead of reimplementing it in the
  CLI, so the renderer and both CLI callers share one owner.
- No user decision is pending, so no `design-docs/user-qa/` file is
  written for round 4.

### 22.4 Intentional differences from the workflow input

- R4-2 has no difference. The capture SVG embeds one payload per distinct
  attachment, and both real renderer inputs grow only by placement markup.
  (Revision 11 as first drafted carried the payload beside the SVG; the
  step-3 review rejected that and it is withdrawn.)
- R4-2 edits `apps/cli/native/src/render.rs`, which the workflow input
  lists only as related context. A correct fix needs it, and the workflow
  scope allows any file a correct fix needs. `engine.rs` is not edited.
- R4-6. The helper lives in the existing `apps/cli/src/glyph-coverage.ts`
  instead of a new module, because that file already owns CLI attribution.

### 22.5 Risks

- R4-1 at most doubles census work, and only for scenes with hidden targets
  of shared cuts. The hidden allowance is bounded like the picture census.
  A hidden body that the allowance cannot settle makes no claim, so the
  discrepancy can go unreported there, as for an `unknown` body.
- R4-1 changes the meaning of NCS1 offset 36 for new scenes. A reader
  older than this revision rejects a scene with hidden targets as "nonzero
  padding". Both ship in one binary.
- R4-2. Byte parity of the carrier form is shown only by the first gates of
  f2a (usvg 0.48) and f2b (resvg-js 2.6.2). The step-3 probe covers the
  HTTPS-placeholder path without a carrier. If parity fails, the plan
  stops and reports blocked; reinlining is not an allowed fallback.
- R4-2. A placement URL without its carrier renders no image, because both
  renderers drop an unresolved image. Only `capture-artwork.ts` writes
  either, and it always writes both.
- R4-3. A bucket with many oversized loops that precede the containing
  loop in bucket order still costs as much as today's scan, never more.
  Separate rings in regular layouts, the diagonal strips and the mixed
  square-and-strips fixture are linear.
- Not measured by the audit or by these gates: native image bytes of real
  user documents, peak memory, Boa elapsed time, desktop latency, and full
  workspace verification before integration.

## 23. Revision 12: audit round 5 corrections

Source: audit round 5 of the 3D CAD pages and AI capture, base `0a35708`
to `70977f4`. It has six blocking findings (three high, three medium),
none deferred. No GitHub issue exists; the round-5 workflow input is the
issue body. This section states the capture rules R5-1, R5-3, R5-4 and
R5-6, and the plan grouping of all six findings. The core rules R5-2 and
R5-5 are in `design-docs/specs/design-cad3d.md` section 22. Where an
earlier section and this one disagree, this section wins.

Common rules (those of sections 19 to 22, restated):

- Every fix ships a test that fails on `70977f4` and passes after it, in
  the working tree. A performance test asserts a deterministic operation,
  visit, allocation or inspection counter, never a wall clock.
- These do not change: NCS1 bytes, PNG, JPG and SVG bytes of every
  existing fixture, goldens, error codes, existing messages and their
  precedence, package boundaries (`packages/io` never imports
  `@nodetto/core`; `packages/core/src/pcb` imports only itself) and strict
  indexed typing. No golden is regenerated.
- Untouched: `crates/capture/src/raster.rs`, `crates/capture/src/raster/**`,
  `crates/capture/src/prism.rs`, `crates/capture/src/census.rs`,
  `crates/capture/src/lib.rs`, `crates/capture/src/report.rs`, the capture
  goldens and `docs/capture.md`. Every rule below is reachable without
  them.
- Per-pixel, per-vertex and per-byte work stays in Rust on the native CLI.

### 23.1 Rules

R5-1 `function-capture-visible-sibling-cut-report` (high; merges
`maintainability-capture-visible-shared-cut-attribution`).

Cause. The evaluator stages every target of a Boolean and rejects the
whole feature when any target becomes empty
(`packages/core/src/cad/evaluate.ts:827`). The capture model appends the
shared step to every visible target (`packages/core/src/capture/scene.ts:441`).
The census then records the emptying step only on the emptied body
(`crates/capture/src/census.rs:106`). The R4-1 rule covers only hidden
targets, so `describeBodies` (`packages/core/src/capture/describe.ts:164`)
has nothing that marks the trimmed visible sibling. The app keeps that
sibling whole while the picture shows it cut.

Rule. Attribution is done in TypeScript, in `describeBodies`, from data the
report and the model already carry. No Rust, NCS1 or report JSON change.

- Existing attribution. This is exactly what `describeBodies` selects
  today (`describe.ts:137-156`), and it is kept unchanged:
  - first, the hidden attribution: `hiddenEmptiedByStep = h` is present
    and `body.steps[h]` names a tool. Its step is `h` and its text is the
    hidden-target text. It wins over the own emptying whatever the indices.
    The test at `describe.test.ts:188` (`emptiedByStep 0`,
    `hiddenEmptiedByStep 1`) expects the hidden text;
  - otherwise, the own attribution: `emptiedByStep = e != -1` and
    `body.steps[e]` names a tool. Its step is `e` and its text is the
    existing own text;
  - otherwise, none.
- Sources. A visible body `a` is a source when all of these hold:
  - its existing attribution is the own attribution, at step `j`;
  - `report.bodies[a].open` is false;
  - `model.bodies[a].steps[j]` is a `difference` or `intersection` step
    with tool `t`.

  This reuses the census claim already reported on `a`. A body whose
  sampling was incomplete has `emptiedByStep = -1` and state `unknown`
  (`census.rs:86-104`), so it is never a source, and the sibling note is
  exactly as confident as the existing note on `a`.
- Sibling candidate. For every other visible body `b` with `open` false,
  let `k` be the index of the first step of `b` with the same tool `t` and
  the same op. Among all sources, `b` takes the smallest `k`. A tie goes to
  the source that comes first in `model.bodies`.
- Selection. Each body still gets at most one sampled error. The sibling
  candidate `k` replaces the existing attribution only when there is no
  existing attribution, or when `k` is strictly smaller than the existing
  attribution's step. On a tie, or when the existing step is earlier, the
  existing attribution and its text are kept. So:
  - a hidden attribution at step `h <= k` keeps the hidden text, and R4-1
    output does not change;
  - if `b`'s own emptying is step `k`, `b` was emptied by the same feature
    and keeps its own text.
- Text. With `e` the emptied source and `b` the sibling:
  `{ id: tool.feature, code: "cad.result.empty", text: "(sampled): leaves no material in \"<e name>\"; the app rejects this feature and keeps \"<b name>\" as it was, this picture applies it" }`.
  Names go through `plain()` as today. The emptied body `e` keeps its
  existing error. Errors stay in `model.bodies` order.
- Body note. `[differs from the app, see errors]` is also added when a
  sibling candidate stands, under the existing state condition (`drawn`,
  `hidden` or `outside`).
- Sources are computed in one pass from the raw report values. A chain
  (a source that is itself the sibling of an earlier rejected step) is not
  resolved further. It is still reported at its first discrepancy.
- Callers need no change. `apps/cli/src/capture-cad.ts:146-151` (CLI text
  and JSON `errors` with `sampled: true`) and
  `apps/desktop/src/shell/export-handlers.ts` both consume the
  `describeBodies` errors.

Tests.

- `packages/core/src/capture/describe.test.ts`, with model and report
  literals:
  - `rail` (steps `[union 0, difference 2]`, `emptiedByStep -1`) and `tab`
    (steps `[union 1, difference 2]`, `emptiedByStep 1`, state `empty`). The
    result gives one sibling error on `rail` with id of tool 2, naming
    `tab` and `rail`. It keeps `tab`'s existing error. `rail` gets
    `[differs from the app, see errors]`.
  - Control with `rail` only: no error and no note.
  - `rail` with its own `emptiedByStep` 1: only the own text.
  - Earlier sibling. `rail` has steps `[union 0, difference 2, difference
    3]` and its own `emptiedByStep 2`, and `tab` is emptied by tool 2 at
    step 1. `rail` gets the sibling text for tool 2 (step 1 < 2), not its
    own text for tool 3.
  - Equal-step hidden. `rail` has `hiddenEmptiedByStep 1`, and `tab` is
    emptied by the same tool 2, so the sibling candidate is also step 1.
    Only the hidden text appears on `rail`.
  - Later sibling. `rail` has `hiddenEmptiedByStep 1`, and the sibling
    candidate is step 2. Only the hidden text appears.
  - An open sibling, or an open or incomplete (`unknown`, -1) source:
    no sibling error.
  - The existing hidden-target test, including the
    `emptiedByStep 0` / `hiddenEmptiedByStep 1` assertion at `:188`,
    passes unchanged.
- New `packages/cad-kernel/src/shared-cut.test.ts` checks the editor side
  with the real Manifold kernel, using the evaluator and worker host as in
  `worker-host.test.ts:22`. On the native fixture below:
  - with targets `[rail, tab]`, `slot` fails with `cad.result.empty`, and
    the `rail` body keeps 800 mm^3;
  - with targets `[rail]`, `slot` succeeds, and `rail` measures 600 mm^3.

  This is the retained editor volume that the capture note refers to.
- `apps/cli/src/native-parity/capture.test.ts`, native binary, with
  `--view top --no-interference`. The fixture has a visible `rail`
  (20 x 10 x 4 mm), a 2 x 2 x 4 mm `tab` and a cut `slot` (5 x 10 mm)
  through `rail` that covers `tab`. These names are test data of this
  design, not user data.
  - Visible `tab` with targets `[rail, tab]`. Text lists `rail` with the
    note, and one `slot` error naming `tab` and `rail`. `--json` has the same
    error in `errors` with `sampled: true` and the full feature id.
  - Hidden `tab`: the R4-1 output, unchanged.
  - Targets `[rail]` only: `errors: 0` and no note.

R5-3 `performance-interference-mesh-triangle-scans` (high).

Cause. `AxisFold::cast` (`crates/capture/src/lattice.rs:256`) and the
census cast (`:733`) call `ToolView::intervals` before charging anything.
The boundary charge counts only `current.len()`, which is zero at the first
step of each body. A mesh bin is scanned in full (`mesh.rs:278`), so a body
made of one large mesh is never charged. Stacked plates admit more than
1.31e9 triangle visits within the default ray budget.

Rule. Charge the projected scan cost before every scan, against a
deterministic allowance tied to the rays already cast.

- `BoundaryBudget` gains `scans: u64` and
  `charge_scan(&mut self, count: usize) -> bool`. The allowance is
  `SCAN_ENTRIES_PER_WEIGHTED_RAY * weight * (rays + 16)`, with a new
  constant `SCAN_ENTRIES_PER_WEIGHTED_RAY: u64 = 1_024`, saturating
  arithmetic, and the `weight` of `BoundaryBudget::new`. Going over sets the
  existing `exhausted` flag and returns false, as `charge` does.
- Both casts call `view.scan_cost(&ray)` and `charge_scan` immediately
  before `intervals`, for every view that passes the bounds test. That
  includes a scan whose intervals turn out empty. On false they take the
  existing boundary-exhaustion exit: `Stretch::default()` in the pair
  sampler, `(false, false, true)` in the census.
- Propagation is unchanged and already proven: an exhausted pair sample is
  `capped` and `boundary_exhausted` (`interference.rs:257-281`), so it goes
  to `cappedCount` or `cappedWithoutHit`, never to a clean result. An
  exhausted census sets `budget_left` to 0, and the body becomes `unknown`
  or makes no hidden claim. It never claims emptiness.
- The charge happens in each pair's or body's own sequential ray order, so
  the output does not depend on the worker count.
- The constant is 1,024 entries per weighted ray on average, with 16 rays
  of slack. The slack lets the first ray of a pair or body scan a bin of
  up to 17,408 entries (`1_024 * (1 + 16)` at weight 1). A mesh bin sized by `MeshView::new` averages a
  few entries, and prism buckets in the existing fixtures hold far fewer
  than 1,024, so no existing fixture should reach the allowance. The gate
  is the full crate test run, goldens included. If an existing test
  changes, the plan stops and reports blocked. It never edits that test,
  and it never raises the constant to a value at which the new regression
  stops failing before the change.

Tests.

- Counter. `tool_view.rs` gets a `#[cfg(test)]` thread-local counter that
  `ToolView::intervals` increases by `self.scan_cost(ray)`. That is the
  number of bin or bucket entries the scan visits. It is independent of
  the lattice charge.
- New `#[cfg(test)] mod scan_tests` in `lattice.rs`, on the test thread:
  - Fixture: two closed mesh tools, each a stack of 2,048 coincident 10 x
    10 mm boxes 0.01 mm thick, so every Z-axis bin holds at least 8,192
    entries. The request is sized so that the unbounded scan would visit
    more than ten times the bound below.
  - `sample_pair` on the two bodies: visited entries at most
    `1_024 * weight * (rays + 16)` and below 1,000,000, and the result is
    `capped`.
  - `sample_body_axis_with` on one body: the same bound, and `capped`.
  - Two 12-triangle cube meshes that overlap by a known box: not capped,
    and the volume and bounds equal the expected values within the existing
    interference tolerance.
- `crates/capture/tests/interference.rs`, through `render_parsed`. Only an
  interference run with at least two checked pairs and more than one
  thread takes the worker path (`interference.rs:342`).
  - Multi-pair scene. Two overlapping stacked-plate mesh bodies form the
    dense pair. Two overlapping cube-mesh bodies, placed apart from them,
    form an admitted pair. At least two pairs are checked.
    - The complete report JSON and the encoded image bytes are equal for 1
      and 5 threads.
    - The dense pair is reported capped (`cappedCount` at least 1, with
      the dense pair in `cappedWithoutHit` or a capped pair entry).
    - The admitted pair is not capped.
  - Admitted pin. A scene with only the cube-mesh pair. Its expected volume,
    its complete report JSON string and `support::digest` of its RGB are
    written into the test as literals. They are recorded by running that
    case on the working tree before the lattice change, so it is the
    plan's first step. After the change, 1 and 5 threads must still give
    exactly those literals. No older binary or checkout is used.
- Existing interference, census, golden and determinism tests pass
  unchanged.

R5-4 `performance-open-mesh-nearest-hit-allocation` (medium).

Cause. `MeshView::first_surface_hit` (`crates/capture/src/mesh.rs:336`)
builds a new `Vec`, collects every facet hit and sorts it, once per covered
open-mesh sample (`raster.rs:191`, `raster/reference.rs:61`).

Rule. A single pass with constant scratch space.

- The per-facet test of `hits_impl` (`mesh.rs:278-315`: edge test, normal,
  depth `s`, finiteness) moves into one private helper. `hits_impl` and
  `first_surface_hit` both call it, so the arithmetic is identical.
- `first_surface_hit` walks the bin in order and keeps the first candidate,
  replacing it only when `s.total_cmp(&best.s)` is `Less`. `sort_by` is
  stable, so this picks exactly today's first element. That includes
  `-0.0` before `+0.0`, and the earliest facet in bin order on equal depth.
  It returns `Boundary { s, tool, face: i }` as today.
- `ToolView::first_surface_hit` and the raster callers are unchanged.

Tests.

- `mesh.rs` unit tests. An oracle in the test runs
  `hits_impl::<true>` into a `Vec` and takes the first element. It must
  equal `first_surface_hit` for overlapping triangles at different depths,
  two triangles at equal depth in both stored orders, `-0.0` and `+0.0`
  depths, and a grid of rays over an open square. The existing
  `first_surface_hit` test passes.
- `crates/capture/tests/overlay_alloc.rs`. Fixture: a 200 x 200 mm open
  square mesh (two triangles, not closed), 1024 x 1024 pixels,
  `supersample = 2`, field of view inside the square. With one thread, the
  allocations of `render_rgb` stay below `samples / 16`, as in the existing
  solid test. The RGB output for 1 and 4 threads is equal.
- Rendered ordering cases, in the same `overlay_alloc.rs`. Shading uses the
  facet normal (`mesh.rs:341-355`, `shade.rs:24-32`), and adjacent
  triangles give a shared-edge sample one owner (`mesh.rs:287-294`). Both
  fixtures therefore make several facets eligible for the same samples:
  - Overlap. An open mesh of two triangles with different normals at
    different depths. Their projections overlap on a large area, and each
    triangle also has an area that the other does not cover.
  - Equal depth. An open mesh of a horizontal triangle and a tilted
    triangle whose planes cross along a line `x = x0`. All coordinates,
    the camera and `x0` are dyadic and lie on sample centres, so the
    depths there are exactly equal. The mesh is stored in both orders, AB
    and BA. The test asserts that the AB and BA images differ, so the tie
    winner is visible.
  - For each fixture and order, `support::digest` of the RGB is a literal
    in the test, recorded on the working tree before the change (the
    plan's first step). After the change, 1 and 4 threads give exactly
    those digests.

R5-6 `maintainability-capture-diagnostic-id-scope` (high).

Cause. `errorLines` and the sampled lines in
`apps/cli/src/capture-cad.ts:108` and `:150` call `shortIds` over the
page-scoped CAD input that `capture-command.ts:242` passes in. `cad check`
(`cad-command.ts:72`) and `edit` (`edit/selectors.ts`, exact id first)
work on the whole document. A capture token can therefore be the exact id
of an unrelated element on another page.

Rule. One document-wide short-id map serves both text diagnostic
formatters.

- `renderCadCapture` gains a required second parameter
  `documentElements: readonly Element[]`. It builds
  `shortIds(documentElements.map(({ id }) => id))` once. `errorLines`
  takes that map instead of an element list, and the structural lines and
  the sampled lines both use it. Geometry still comes from the page-scoped
  `elements`.
- `capture-command.ts` passes `document.elements`. `cadInputMessage`
  already receives `document.elements` and builds its map the same way.
- JSON `errors` keep full ids. Text format, order and counts are unchanged.

Tests (`apps/cli/src/capture-cad.test.ts`, in-memory harness and fake
`renderSolid`).

- Structural. A cad3d page with a failing feature `collar-groove`
  (`cad.reference.missing`) and an element `collar` on another page. These
  ids are test data of this design; the audit's ids are not reused. The
  colliding id has exactly `MIN_PREFIX` (6) characters. The page-scoped
  map therefore shortens `collar-groove` to `collar`, the exact id of the
  other element, while the document-wide map gives `collar-`. The capture
  prints `collar- cad.reference.missing`, the same line as `cad check`.
  `editCommand` deleting the printed token removes `collar-groove`, and
  `collar` survives. JSON has `"id":"collar-groove"`.
- Sampled. The fake report sets `emptiedByStep` on a body whose step tool
  feature (for example `sleeve-cut`) collides by exact prefix with a
  6-character element on another page (`sleeve`). The
  sampled line's token equals the document-wide short id and resolves in
  `editCommand` to the feature. JSON keeps the full id.
- The existing comparison with `cad check` (`:118-150`) passes.

### 23.2 Plan grouping

Plans are named `car5-*`. Each plan:

- covers one finding aspect, at most about four files and about 120 to
  150 plan lines, and has a non-empty `acceptanceCriteria`;
- uses its own `CARGO_TARGET_DIR=target/car5-<plan>`;
- sets `artifactRoots ["target", "tmp/cad3d"]` exactly, with the evidence
  root `tmp/<taskId>` outside both;
- lists every edited file in `writePaths`, including its plan file;
- runs only its focused gates (below), biome on its touched files, and
  `cargo fmt` plus clippy after Rust changes.

| Plan | Finding | Owns | dependsOn |
| --- | --- | --- | --- |
| car5-f1-sibling-cut | R5-1 | `packages/core/src/capture/{describe.ts,describe.test.ts}`, `apps/cli/src/native-parity/capture.test.ts`, new `packages/cad-kernel/src/shared-cut.test.ts` | none |
| car5-f2-kernel-strict | R5-2 | see design-cad3d section 22 | none |
| car5-f3-lattice-scan | R5-3 | `crates/capture/src/{lattice.rs,tool_view.rs}`, `crates/capture/tests/interference.rs` | none |
| car5-f4-open-mesh-hit | R5-4 | `crates/capture/src/mesh.rs`, `crates/capture/tests/overlay_alloc.rs` | none |
| car5-f5-pcb-outline-index | R5-5 | see design-cad3d section 22 | none |
| car5-f6-diagnostic-ids | R5-6 | `apps/cli/src/{capture-cad.ts,capture-command.ts,capture-cad.test.ts}` | none |

There is one wave, with all six plans in parallel. The intake's possible
overlaps are designed away:

- R5-1 needs no Rust (`census.rs`, `lib.rs`) and no `capture-cad.ts`
  change.
- R5-3 counts visits in `tool_view.rs` and does not edit `mesh.rs`.

No two plans share a file.

Gates. Each exits 0 and runs at least one test that its plan makes pass:

- f1:
  1. `bun test packages/core/src/capture/describe.test.ts packages/cad-kernel/src/shared-cut.test.ts`;
  2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car5-f1 cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car5-f1/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
- f3: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car5-f3 cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car5-f3 cargo test --release -p nodetto-capture`
- f4: the f3 command with `target/car5-f4`.
- f6: `bun test apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts`
- f2 and f5: see design-cad3d section 22.

f1, f3 and f4 compile `nodetto-capture` from one working tree. A compile
failure caused by a sibling's in-progress edit is rerun after the sibling
finishes. It is never fixed by editing the sibling's files. Timing tests
may be retried up to three times under load. A failure after that is
compared in isolation before it is reported.

Integration gates run once, after every plan lands. Each records its
command, its exit status and the path of its complete log:

1. `bun run typecheck` and `bun run lint` (biome);
2. `CARGO_TERM_QUIET=true mise run verify`;
3. `CARGO_TERM_QUIET=true mise run test-cli`;
4. no `*.test.ts` file under `target/` or `tmp/` (the scan of section
   20.3, gate 4).

### 23.3 Decisions

- R5-1 lives in `describeBodies` only. The report already carries the
  emptying step of every visible body, and the model carries every body's
  steps with tool identity. A Rust or report change would add a key that
  duplicates derivable data. It would also force chaining with R5-3 on
  `census.rs` and `lib.rs`.
- R5-1 keeps today's precedence: a valid hidden attribution, else the own
  emptying. The sibling candidate replaces that choice only when it is
  strictly earlier, so every existing output is unchanged (step-3 review,
  `describe.test.ts:188`).
- R5-3 and R5-4 prove preservation of admitted output with literals pinned
  from the unmodified working tree as the plan's first step: report JSON
  and RGB digests. This needs no older binary or checkout. Worker paths are
  reached only with at least two checked pairs (R5-3) or several render
  threads (R5-4).
- R5-1 inherits the emptied body's census claim instead of making a new
  one. An incomplete census therefore yields no sibling note, as R4-1 does
  for hidden bodies.
- R5-3 reuses the `exhausted` flag of `BoundaryBudget`. Exhaustion thus
  takes the capped and incomplete paths that rounds 2 to 4 already verified
  never claim emptiness or a clean result. The allowance is per weighted
  ray, like the boundary allowance, so it scales with the work the user's
  ray budget admits, and it is deterministic.
- R5-3 counts visits in `ToolView::intervals` under `cfg(test)` instead of
  adding a field to `AxisSample`. The count is independent of the charge
  it checks, and no public type changes.
- R5-4 keeps `hits_impl` for closed meshes and as the test oracle. Only the
  open-mesh nearest-hit path changes.
- R5-6 passes the document's elements instead of a precomputed map, so the
  single caller cannot pass a page-scoped map by mistake. `shortIds` is
  reused unchanged.
- No user decision is pending, so no `design-docs/user-qa/` file is
  written for round 5.

### 23.4 Intentional differences from the workflow input

- The intake listed `crates/capture/src/census.rs`, `lib.rs` and
  `apps/cli/src/capture-cad.ts` as possible R5-1 files, and
  `crates/capture/src/mesh.rs`, `census.rs` and `interference.rs` as
  possible R5-3 files. Neither fix needs them, so neither plan edits them.
  This removes every chain and keeps one wave.
- R5-1's CLI JSON check is in the native parity test, not in
  `capture-cad.test.ts`. That file belongs to R5-6.

### 23.5 Risks

- R5-1. A sibling note depends on the census settling the emptied body. A
  body that the census leaves `unknown` gives no note, as for R4-1 hidden
  bodies.
- R5-1. A chain of rejected shared steps across several visible bodies is
  resolved only to each body's first discrepancy. This is the rule of
  section 6.7.
- R5-3. Average bin occupancy above 1,024 entries per weighted ray now caps
  the pair or the census sample instead of scanning. A real dense mesh at
  that occupancy reports `capped` or `unknown`, never a wrong claim.
  Existing fixtures are expected to stay below it, and the full crate test
  run is the check.
- R5-3 and R5-4 pinned literals must be recorded before the code change.
  A literal recorded after the change proves nothing, so the plan's
  evidence must show the pin run first. R5-4's equal-depth fixture must
  make the tie visible (AB differs from BA). If no dyadic fixture does, the
  plan reports blocked instead of dropping the case.
- R5-1, R5-3 and R5-4 build the same crate in one working tree. Sibling
  compile failures are retried and not fixed across plans.
- Not measured by the audit or by these gates: native elapsed time and RSS
  for the stacked-plates and open-square cases, Boa and desktop timings,
  and native image bytes of real user documents.

## 24. Revision 13: audit round 6 corrections

Source: audit round 6 of the 3D CAD pages and AI capture, base `0a35708`
to `6f58a74` plus the uncommitted round 5 working tree. Four blocking
findings (three high, one medium), none deferred. No GitHub issue exists;
the round-6 workflow input is the issue body. Rules R6-1 to R6-4 below.
Where an earlier section and this one disagree, this section wins. In
particular the "untouched" list of section 23 no longer applies to
`crates/capture/src/report.rs`, `crates/capture/src/census.rs` and
`docs/capture.md`.

Common rules (sections 19 to 23, restated):

- Every fix ships a regression test that fails before the change and
  passes after it, run in this working tree. No older binary or checkout.
  A performance test asserts a deterministic visit counter, never a clock.
- Unchanged: NCS1 bytes, PNG, JPG and SVG bytes of every existing fixture,
  goldens, error codes, the JSON error shape, existing messages when the
  new state is absent, the edit selector grammar, refinement-only cap
  behaviour and exit status, hidden-target and sibling shared-cut
  attribution (R4-1, R5-1), package boundaries and strict indexed typing.
  No golden is regenerated. Every new report key is emitted only when it
  is non-empty, so every existing report and CLI JSON string is
  byte-identical.
- Per-ray, per-entry and per-byte work stays in Rust.
- The round 5 uncommitted changes are the baseline and are preserved.

### 24.1 Rules

R6-1 `function-capture-diagnostic-selector-prefix` (high; merges
`maintainability-diagnostic-id-selector-collision`).

Cause. `shortIds` (`apps/cli/src/ids.ts:10-31`) returns the shortest
prefix of at least `MIN_PREFIX` (6) characters that is unique among ids.
`resolveElementReference` (`apps/cli/src/edit/selectors.ts:60`) tries the
exact id, then reads `name:` as a label selector and `@` as a batch
reference, and only then a unique prefix. A stored id that starts with
`name:` or `@` (CAD feature ids may) is therefore printed as a token that
the editor resolves as a selector. Capture text (structural lines and
sampled lines, `capture-cad.ts:150` and `:186`) and `cad check`
(`cad-command.ts:73`) all use `shortIds`.

Rule. In `shortIds`, an id that starts with `name:` or `@` maps to itself
(the full stored id). Every other id keeps today's prefix. Because every
prefix of such an id of length 6 or more also starts with the reserved
text, the test is on the id, not on the computed prefix. The exact-id
branch of the resolver then resolves the token to the stored element. The
fix is in the shared formatter, so capture structural lines, capture
sampled lines, `cadInputMessage`, `cad check` and every other `shortIds`
consumer (inspect, diff, arrange, edit candidate lines) print a token that
resolves to the element it names. Output of those other consumers changes
only for ids that start with `name:` or `@`, which are the same hazard.
`resolveId`, `selectors.ts`, `batch.ts` and the selector grammar are not
changed. JSON keeps full ids, as today.

Tests (test data of this design; the audit's ids and labels are not
reused):

- New `apps/cli/src/ids.test.ts`: `shortIds` over
  `["name:latch-bore", "name:latch-pin", "@spindle-cut", "collar-groove", "collar"]`
  maps the `name:` and `@` ids to themselves and keeps `collar-` and
  `collar` exactly as today.
- `apps/cli/src/capture-cad.test.ts`, in-memory harness and fake
  `renderSolid`, four cases. The token is read from the actual text output
  line and passed to `editCommand` as a delete target:
  - structural, label: failing feature `name:latch-bore` on the cad3d page
    and a text element labelled `l` on another page. Before the change the
    token is `name:l` and the edit deletes the labelled element. After it,
    the token is `name:latch-bore`, the feature is deleted, the labelled
    element survives, the edit exits 0, and capture JSON has the full id.
  - structural, batch reference: failing feature `@spindle-cut`. The edit
    batch first binds ref `spind` to another element (the existing `select`
    operation with `ref`), then deletes the printed token. Before: `@spind`
    deletes the bound element. After: the feature is deleted and the bound
    element survives.
  - sampled, label and sampled, batch reference: the same two ids as the
    step tool feature of a body whose fake report sets `emptiedByStep`, so
    the token comes from the sampled error line.
- `apps/cli/src/cad-command.test.ts`: `cad check` on the structural label
  document prints `name:latch-bore`, never `name:l`.

R6-2 `function-capture-coarse-scan-reported-as-refinement` (high; merges
`maintainability-capture-coarse-exhaustion-reported-as-refinement`).

Cause. `AxisSampler::sample` (`crates/capture/src/lattice.rs:396-502`)
casts coarse rows one row ahead of accumulation (`:408-415`, `:424-436`)
and stops at boundary or scan exhaustion (`:410`, `:421`, `:427`, `:433`,
`:470`). `sample_axes` (`:573`) then returns empty samples for the axes
that follow. Two things go wrong:

- a coarse hit that was cast but not yet accumulated (rows `y` and `y + 1`
  are buffered in `rows`) is dropped, because `hit` comes only from the
  accumulated volume (`:485`);
- the pair is only `capped` (`interference.rs:257`, `:373-378`), and the
  hosts describe every cap as refinement-only (`describe.ts`,
  `refinement capped ...` line). `interferenceExitCode`
  (`capture-interference-options.ts:61-68`) fails only on hits or unchecked
  pairs.

So a pair whose coarse grid was abandoned reads as checked, a pair whose
overlap was already observed can read as a miss, and
`--fail-on-interference` exits 0.

Rule (Rust, `lattice.rs`, `interference.rs`, `report.rs`). It applies to the
analysis pair sampler only; the census sampler is unchanged.

- Successful coarse cast. A level-0 cast (`divisions == 1`, sub `[0, 0]`)
  is successful when `budget.exhausted` is still false after it returns. A
  cast that exhausts the budget returns `Stretch::default()` and is not
  successful. `AxisSampler` keeps a per-axis count `coarse_ok` of successful
  coarse casts.
- Coarse coverage. `AxisSample` gains `#[doc(hidden)] pub coarse_complete:
  bool`, set to `coarse_ok == width * height` for the analysis sampler. It
  depends only on the coarse casts. Exhaustion during refinement after the
  final coarse cast leaves it true, and exhaustion before the final coarse
  cast leaves it false. `empty_sample` sets false; the census sampler sets
  true when its coarse loop ended without exhaustion (it is not read there).
- Witness preservation. When the sampler leaves the row loop because the
  budget ran out (any of the exits above, including the preload at
  `:408-415`), it first accumulates the successful coarse casts that were
  not yet accumulated:
  - the remaining cells of row `y` (from the interrupted cell onward) and
    every successfully cast cell of the preloaded rows (`y + 1`, and rows 0
    and 1 when the preload itself was interrupted). Each is added at its
    coarse weight (`result.add(grid, corner, grid.side, coarse)`), exactly
    like an unrefined cell. Only hits add volume, so a failed cast (default
    stretch, a miss) adds nothing;
  - for the cell whose refinement was interrupted, refined sub-rays that
    succeeded stay accumulated as today. If none of them hit, its coarse
    stretch is added, which is the rule for a finished cell (`:479-481`).
    Every cell is accumulated at most once.
  So `hit` and `volume` include every observed overlap. The sample is
  already `capped`, so the hosts call it approximate.
- An uninterrupted sampler runs exactly as today, so every completed-run
  report and image byte is unchanged.
- `PairSample` gains `coarse_complete = axes.iter().any(|a| a.coarse_complete)`.
  One axis whose coarse grid was fully cast gives the coverage that today's
  refinement-only cap already promises: every coarse cell column was probed.
- `report::Analysis` gains `incomplete: Vec<(u32, u32)>`. In
  `analyse_scene_with`, a pair that is `capped`, has no report (no witnessed
  hit, preserved witnesses included) and `!coarse_complete` is pushed to
  `incomplete`, in candidate order. It also stays in `capped_count` and
  `capped_without_hit`, so `incomplete` is a subset of `capped_without_hit`.
  `checked` is unchanged. A pair with a hit keeps its capped `PairReport`
  and is never incomplete.
- JSON: inside `analysis`, after the `cappedWithoutHit` array, the key
  `"incomplete":[[a,b],...]` is written only when the list is non-empty. No
  list limit, like `cappedWithoutHit` (it is bounded by `checked`).
- Picture-only pairs (`add_view_pairs_with`, `overlay.rs:111-118`) are
  found pairs and are not classified. A pictured overlap for an incomplete
  candidate keeps both records: the view-source pair in `pairs` and the
  candidate in `incomplete`. The text rule below describes them
  consistently.
- The other `Analysis` literals get `incomplete: Vec::new()`:
  `report.rs:203` (unit test), `crates/capture/tests/interference.rs:90`
  and `crates/capture/tests/render.rs:426`.
- Test instrumentation: `AxisSample` gains `#[cfg(test)] pub coarse_casts:
  Vec<(u64, bool)>`, with the pair budget's `triangles` (R6-3) after each
  successful coarse cast and whether it hit, in cast order. It is empty in
  `empty_sample` and the census sampler.
- Classification depends only on each pair's own sequential sampling and
  its pre-dispatch allowance and share (R6-3), not on thread count.

Rule (TypeScript).

- `packages/core/src/capture/report.ts`: `SolidAnalysisReport` gains
  `readonly incomplete?: readonly (readonly [number, number])[]`. The
  parser accepts the key absent, or an array validated exactly like
  `cappedWithoutHit`; any other value is rejected through the existing
  parse error.
- `describeInterference` (`describe.ts`), with `k` the length of
  `analysis.incomplete ?? []` and `checked = analysis.checked`:
  - headline when `uncheckedCount > 0`: unchanged;
  - headline when `uncheckedCount === 0` and `k > 0`:
    `interference: <found> found, <k> of <checked> checked candidate pair[s] incomplete (cell <cell> mm)`
    ("pair" when `checked === 1`). `<found>` counts every pair record, view
    pairs included, as today;
  - after the not-checked lines, one line for each of the first 20
    incomplete pairs. The line never calls interference unknown when a
    record exists for the same bodies:
    - when `report.pairs` has no record with the same `a` and `b`:
      `  incomplete: <a name> x <b name>; the coarse check stopped before covering this pair, interference not determined`;
    - when it has one (always a view-source record, since an analysis hit is
      never incomplete):
      `  incomplete: <a name> x <b name>; the coarse check stopped before covering this pair, the overlap listed above was found in the picture only`;
    - then `  ... and <k - 20> more incomplete; narrow with --interference-bodies`
      when `k > 20`;
  - the refinement line counts only refinement caps. It is printed when
    `cappedCount - k > 0` and shows `cappedCount - k` and
    `max(0, cappedWithoutHit.length - k)`. With `k = 0` every line is
    byte-identical to today;
  - JSON (`CaptureInterferenceJson`): optional
    `incomplete?: readonly (readonly [string, string])[]` (body ids), set
    only when `k > 0`. `pairs` keeps every record unchanged;
  - the return value gains `incomplete: number` (`k`).
- `interferenceExitCode` returns 1 with `--fail-on-interference` also when
  `(report.analysis?.incomplete?.length ?? 0) > 0`. A refinement-only cap
  still exits 0.
- The desktop save note already appends `describeInterference(...).lines`
  (`export-handlers.ts:294-302`). It inherits the same text and needs no
  code change for R6-2. Its test is in the car6-f4 plan (24.2).
- `docs/capture.md`: the interference paragraph (lines 40-41 and 97)
  describes the `incomplete` state, its JSON key, the picture-only wording
  and the exit status.

Tests.

- `lattice.rs` `scan_tests`, unit level. Each test runs a pair twice through
  `sample_axes` on the test thread: once with an unlimited triangle limit,
  to read `coarse_casts` and the total `triangles`, and once with an exact
  triangle limit (R6-3 `triangle_limit`) derived from that record. So every
  cut point is based on the actual cast outcomes. The triangle limit is the
  only cut used; the per-ray allowance does not trip in these fixtures:
  - abandoned coarse miss: two disjoint plate meshes perpendicular to X
    that both span the request's Y-Z extent, so every axis-0 ray scans
    triangles of both and none overlaps. Axis 0, refinement 0. The limit is
    the `triangles` of the second-to-last record, so the final coarse cast
    fails (the test asserts from the record that this cast scans at least
    one triangle). Assert no hit, `capped`, `coarse_complete` false.
    Through `sample_pair` with the same limit, assert a pair sample that
    `analyse_scene_with` would list in `incomplete` (no report and
    `!coarse_complete`);
  - buffered hit followed by exhaustion: two overlapping cube meshes, with
    the request box equal to their overlap so every ray scans triangles of
    both. Refinement 0. The limit is the `triangles` of the first record
    with `hit == true`, so that cast succeeds and the next cast fails before
    its row is accumulated. Assert `hit`, `capped` and a non-zero volume.
    Before the change the sample has no hit;
  - fully probed miss capped during refinement: body 0 is a small prism
    cube whose loop is marked small (`SMALL_LOOP_CELLS`) and sits in the
    last coarse row of axis 0, so its cells are refined after the final
    coarse cast. Body 1 is a mesh slab, disjoint from the cube along X, that
    spans the request's Y-Z extent, so every coarse and refined ray scans
    its triangles. The prism marks the cells, and the mesh spends the
    triangle allowance. The test first asserts the precondition from the
    record: the last coarse record's `triangles` is below the unlimited
    total, so triangle scans happen after the final coarse cast. The limit is
    the unlimited total minus 1. Assert no hit, `capped`, `coarse_complete`
    true, so the pair is not incomplete.
- `crates/capture/tests/interference.rs`, through `render_parsed`, 64 x 64,
  `target_cell = 0.25`, default budget, camera cropped away from the bodies
  so no picture pair exists. In each case report and image bytes are equal
  at 1 and 5 threads:
  - buffered hit (the audit's cropped overlapping dense pair): two
    coincident closed meshes, each 512 disjoint 1 x 10 x 10 mm boxes on a
    2 mm X pitch (6,144 triangles). Assert `pairs` has `(0, 1)`, `capped`
    and source `analysis`, and `incomplete` is empty. Before the change
    `pairs` is empty;
  - abandoned miss: two closed meshes of 512 boxes each, interleaved so
    they never overlap (body 0 on even 2 mm slots, body 1 on odd slots),
    plus one 1 mm cube present in both meshes in the cells of axis 0 that
    are cast last. Assert `pairs` empty, `incomplete == [(0, 1)]`, and the
    JSON contains `"cappedWithoutHit":[[0,1]],"incomplete":[[0,1]]`. Before
    the change there is no such field or key;
  - refinement-only control: the existing
    `cap_without_a_hit_is_retained_in_the_report_and_json` gains
    `analysis.incomplete.is_empty()` and asserts the JSON has no
    `"incomplete"` key.
  If a fixture does not reach the stated branch, the plan resizes the
  fixture (box count, slot pitch) until it does. It never weakens an
  assertion. The admitted-cube pin and every other test pass unchanged.
- `packages/core/src/capture/report.test.ts`: the key absent, a valid list,
  and a malformed list (rejected).
- `packages/core/src/capture/describe.test.ts`:
  - `k = 1` of 1 checked, no pair record: the new headline, the "not
    determined" line, no refinement line;
  - mixed state: `incomplete = [[0, 1]]` and a capped view-source pair
    record for bodies 0 and 1. The found-pair line is today's picture-only
    line, the incomplete line uses the picture-only wording and does not
    contain "not determined", the headline counts 1 found, and the JSON has
    both the `pairs` record and `incomplete`;
  - `k = 1` with one further refinement-only cap: the refinement line
    shows 1;
  - `k = 0`: lines byte-equal to today's; no JSON `incomplete` key.
- `apps/cli/src/capture-interference-options.test.ts`: exit 1 for an
  incomplete pair with the flag, 0 without it, 0 for a refinement-only cap.
- `apps/cli/src/capture-cad.test.ts`: a fake report shaped like the
  abandoned-miss regression gives the incomplete lines, JSON
  `interference.incomplete` with body ids and `exitCode` 1 with
  `--fail-on-interference`. The existing ordinary-cap case (`:445-456`)
  keeps exit 0.
- `apps/cli/src/native-parity/capture.test.ts` (release binary, owned by
  car6-f2c), a `nativeTest` case `native capture fails on a cropped dense
  pair that the coarse check cannot finish`. The document is generated in
  the test with the existing helpers (`encodeNmesh`, `canonicalize`,
  `toInline`, `cadElement` with `cad.mesh`, as at `:706-721`): the two
  coincident 512-box meshes above, plus a 1 mm cube body about 3,000 mm away
  on X. The binary runs `capture <doc> --view top --size 64x64 --zoom 8
  --fail-on-interference --output dense.png --force`, which centres the
  frame between the bodies and crops both dense meshes out of the picture.
  It runs once for text and once with `--json`. Assertions:
  - exit status 1 in both runs;
  - text contains no `(found in the picture only)`, and either the pair
    line for the two dense bodies ending in `, approximate` or their
    `incomplete:` line (the outcome the Rust regression proves is the
    approximate hit);
  - JSON agrees with the text: the matching `interference.pairs` record with
    `approximate: true` and `source: "analysis"`, or the pair in
    `interference.incomplete`.
  The case is spawned directly (as at `:830-848`), not through `compare`,
  and is skipped only when `NODETTO_CLI_TEST_BINARY` is unset. The car6-f2c
  gate builds the binary first, so the case runs.

R6-3 `performance-interference-mesh-triangle-scans` (high; recurrence).

Cause. The round 5 allowance (`lattice.rs:32-44`) grows by 1,024 entries
per weighted ray. A pair whose meshes see fewer than 1,024 entries per ray
never runs out, so the total scan work grows with the lattice and the pair
count (lower bound 2,013,265,920 visits for one 64 x 64 capture). The census
has the same per-ray allowance and no total.

Rule. A request-wide absolute ceiling on mesh triangle-bin entries, fixed
before any sampling and split into fixed phase allowances. Every value is a
pure function of the request, so outputs do not depend on threads. Prism
edge-bucket visits are not charged against it. They keep only the round 5
per-ray accounting, so a scene without meshes behaves exactly as today.

- Triangle cost. `ToolView` gains `triangle_cost(&self, ray) -> usize`:
  `MeshView::scan_cost(ray)` for a mesh view and 0 for a prism view
  (`tool_view.rs:67-72` dispatches the same way). The round 5 combined
  `scan_cost` is unchanged.
- New constant `REQUEST_TRIANGLE_ENTRIES_PER_BUDGET_RAY: u64 = 32` in
  `lattice.rs`. For a ray budget `B` (actual rays, as each phase already
  receives it), the request ceiling is `R = 32 * B` triangle entries, with
  saturating arithmetic (default `B = 24,000,000`, `R = 768,000,000`).
  Phase allowances, each computed by the phase from its own `B`:
  - analysis pairs (`interference::analyse_scene_with`,
    `B = budget_million_rays * 1e6`): `R / 2`;
  - visible census (`census::resolve_with`, its `budget_rays`): `R / 4`;
  - hidden census (`census::resolve_hidden`, its `budget_rays`,
    `lib.rs:68-79`): `R / 8`;
  - picture-only pair sampling (`interference::add_view_pairs_with`,
    `raster.rs:870-872`, scene `B`): `R / 8`.
  The sum is at most `R`.
- `BoundaryBudget` gains `triangles: u64` and `triangle_limit: u64`.
  `charge_scan(count, triangles)` takes the combined `scan_cost` and the
  `triangle_cost` of the same view and ray. It fails, sets `exhausted` and
  returns false when the combined total would exceed the round 5 per-ray
  allowance (unchanged, combined edges and triangles) or when the triangle
  total would exceed `triangle_limit`. Otherwise it adds both. Both cast
  paths (`lattice.rs:273` and `:753`) pass both costs immediately before
  `intervals`. `BoundaryBudget::new` keeps `triangle_limit = u64::MAX`, so
  `sample_axis`, `sample_body_axis` and `analyse_pair` (public single-call
  APIs, not a request) are unchanged. `sample_axes` and `sample_pair` take
  a `triangle_limit` argument and give it to the pair's one
  `BoundaryBudget`, which spans its axes.
- Pair shares, assigned before dispatch. `analyse_scene_with` computes
  `shares: Vec<u64>` for `candidates[..checked]` before the serial path
  and before `thread::scope` (`interference.rs:333-365`), with
  `shares[i] = allocate(R / 2, pair.work(cell), work)`. Workers and the
  serial path read the share by candidate index; no share is computed or
  changed inside a worker. The sum is at most `R / 2`.
- Picture-only pairs are sampled sequentially in `seen` order. Each takes
  the remainder of the phase allowance as its limit, and the triangles it
  spent are subtracted (`PairSample` gains `triangles: u64`, the pair
  budget's `triangles`). An exhausted sample is reported `capped` with
  `from_view`, as today (`interference.rs:529-544`). A picture witness is
  never dropped.
- Census. `sample_body_axis_with` gains `triangles_left: &mut u64`. Its
  `BoundaryBudget` gets `triangle_limit = *triangles_left`, and
  `*triangles_left` is reduced by the budget's `triangles` on return.
  `census::sample_body` threads
  one counter through all bodies and axes of one `resolve_with` or
  `resolve_hidden` call, initialised to that phase's allowance, and never
  resets it per body. Exhaustion takes the existing paths: the visible body
  becomes `unknown` with `emptiedByStep -1`, and an incomplete hidden census
  attributes nothing. Neither claims emptiness. `sample_body_axis` passes a
  local `u64::MAX`.
- Charging stays immediately before every `intervals` call, coarse and
  refined, in both casts (round 5 rule), so the counted visits never exceed
  the charged total.
- Exhaustion of a share is an ordinary exhaustion: before car6-f2a lands it
  is `capped`; after it, a capped hit, a refinement-only capped miss, or an
  `incomplete` pair. Never a clean result.
- Value selection by measurement. The plan implements 32 and runs the full
  `nodetto-capture` test suite. If an existing pin, golden or assertion
  changes, it raises the constant to 64 (the only other allowed value) and
  reruns. If 64 still changes an existing test, it stops and reports
  blocked; it never edits that test. The regression fixtures below are
  sized against 64, so they fail before the change at either value. The
  chosen value and the measured visits are recorded in the plan's progress
  file.

Tests.

- Counter. `tool_view.rs` gains a second `#[cfg(test)]` thread-local
  counter, `triangle_visits` with `reset_triangle_visits`, which
  `ToolView::intervals` increases by `self.triangle_cost(ray)`, next to the
  round 5 `scan_visits` counter (combined edges and triangles). It counts
  only what the ceiling bounds.
- Measurement, in `lattice.rs` `scan_tests`, on the test thread,
  `budget_million_rays = 1` (`B = 1,000,000`, so `A = R / 4` for the
  visible census and `R / 8` for the hidden census). Picture painting is
  not run, so only lattice and census scans are counted. `A` names the
  allowance of the phase under test. Mesh plate stacks keep every ray below
  1,024 combined entries per pair, so the per-ray allowance never trips. The
  four phase entry points are called in request order on one scene, the
  triangle counter is read after each, and each phase must do non-zero
  work:
  1. Visible census, `census::resolve_with` with all liveness false, two
     suspect bodies in this order:
     - `E` (finisher): a union of a plate stack and a difference by a
       coincident stack, on a small enough lattice that its census scans
       the whole lattice and settles `empty` with `emptied_by_step == 1`.
       A separate call with `E` as the only suspect measures its triangles
       `e`; the test asserts `A / 4 <= e <= A / 2`, and that `E` used less
       than half of the census ray budget, so rays remain for the next body;
     - `N` (never settles): the same shape on a large lattice, whose
       unbounded census alone needs more than `64 * B / 4` triangles.
     Assert: phase triangles at most `A`; phase triangles greater than `e`
     (so `N` scanned under the shared counter); `E` is `empty` with
     `emptied_by_step == 1`; `N` is `unknown` with `emptied_by_step == -1`,
     never `empty`. A per-body reset would give `N` a fresh `A`, which it
     would spend in full (it needs more), so the phase total would be
     `e + A > A` and the limit assertion fails.
  2. `interference::analyse_scene_with(&scene, 1, &solid)` over four
     coincident moderate-occupancy mesh bodies (fewer than 512 triangles per
     mesh; six pairs together need more than `64 * B / 2` unbounded). Assert
     triangles at most `R / 2`, at least one capped pair, and every capped
     pair is a capped report or in `capped_without_hit`.
  3. `interference::add_view_pairs_with` with at least two `ViewPair`s over
     those coincident bodies, each of which alone would need more than
     `64 * B / 8` unbounded. Each sample is called even when the remainder
     is 0, so a per-pair reset breaches the limit. Assert triangles at most
     `R / 8`, and every added record has `from_view` and `capped` (volume 0
     or a capped estimate).
  4. Hidden census, `census::resolve_hidden`, with the same two-body pattern
     over `A = R / 8`: a finisher hidden body `HE` whose difference tool
     `t1` matches a step of visible body `V1`, and a never-settling hidden
     body `HN` whose difference tool `t2` matches a step of visible body
     `V2`. `e` is measured with `HE` alone, with `A / 4 <= e <= A / 2`.
     Assert: phase triangles at most `A` and greater than `e`; the result
     attributes `V1` (from `HE`, which completed) and leaves `V2` `None` (no
     attribution from the exhausted `HN`).
  Then assert the sum of the four counts is at most `R`. Each phase
  assertion fails before the change: unbounded, `N` settles `empty`, `HN`
  attributes `V2`, and the counts exceed their allowances.
- Prism-only control, in the same module. Two coincident prism bodies, each
  32 disjoint 2 mm-wide rectangular loops on a 4 mm X pitch with 128 mm Y
  and Z spans, `budget_million_rays = 1`, `target_cell = 0.25`. Through
  `analyse_scene_with(&scene, 1, &solid)`: the combined `scan_visits` count
  exceeds `64 * B / 2` (the control exceeds the numerical threshold in edge
  visits), `triangle_visits` is 0, and the pair report's `min`, `max` and
  `capped` equal literals recorded on the working tree before the change
  (the plan's first step, as for the R5-3 pins). So prism work alone never
  truncates the overlap bounds.
- `crates/capture/tests/interference.rs`, through `render_parsed`: the
  four-body scene. Complete report JSON and encoded image bytes are equal at
  1 and 5 threads (six checked pairs take the worker path), and the report
  has `cappedCount >= 1`.
- Unchanged: `admitted_cube_mesh_pin` (volume, report and image literals),
  `dense_and_admitted_pairs_are_deterministic`, the round 5 `scan_tests`
  (their `sample_pair` and `sample_body_axis_with` calls pass `u64::MAX`
  and a local `u64::MAX` counter), goldens and determinism tests.

R6-4 `maintainability-desktop-omits-incomplete-body-census` (medium).

Cause. `describeBodies` puts the `[not sampled]` note of an `unknown` body
only into `line`, which the desktop does not show; the desktop save note
(`export-handlers.ts:294-302`) appends only `errors`. The CLI prints the
line and the JSON body state.

Rule.

- `describeBodies` returns a new field `notSampled: readonly string[]`:
  the `plain` names of every body whose report state is `unknown`, in
  `model.bodies` order, all of them (not limited by the eight-name
  summary). `line`, `errors` and their order are unchanged. No error is
  added for an unknown body; it never produces `cad.result.empty` on its
  own account.
- The desktop save note appends, after the error lines and before
  `N features failed.`, one line when `notSampled` is non-empty:
  `not sampled (material unknown): <name>, <name>, ...`.
- The CLI is unchanged: its text keeps the body line and its JSON keeps
  every body with `state: "unknown"`.

Tests (test data of this design; the audit's body names are not reused).

- `packages/core/src/capture/describe.test.ts`: ten bodies `Bracket`,
  `Rib-1` ... `Rib-8`, `Gusset`; `Bracket` (index 0) and `Gusset` (index 9)
  `unknown` with `emptiedByStep -1`, zero pairs, no feature errors.
  `notSampled` is `["Bracket", "Gusset"]`; `errors` is empty.
- `apps/desktop/src/shell/export-handlers.test.ts`, real handler with the
  in-memory writer, fed that report: the message contains
  `not sampled (material unknown): Bracket, Gusset` and no
  `cad.result.empty`. A second case feeds the R6-2 mixed-state report and
  asserts the incomplete headline, the picture-only incomplete line and the
  picture-only pair line in the desktop message (R6-2 desktop acceptance).
- New `apps/cli/src/capture-cad-census.test.ts` (a new file, so this plan
  does not share `capture-cad.test.ts`): the same ten-body report through
  `renderCadCapture` with a fake `renderSolid`. The text body line contains
  `Bracket [not sampled]`, JSON `bodies[9]` is `Gusset` with
  `state: "unknown"`, and no error has code `cad.result.empty`.

### 24.2 Plan grouping

Plans are named `car6-*`. Each plan covers one finding aspect, at most
about four or five files and 120 to 150 plan lines, has a non-empty
`acceptanceCriteria`, uses `CARGO_TARGET_DIR=target/car6-<plan>` for any
cargo command, sets `artifactRoots ["target", "tmp/cad3d"]` exactly with the
evidence root `tmp/<taskId>` outside both, lists every edited file
(including its plan and progress files and docs) in `writePaths`, and runs
biome on its touched files plus `cargo fmt` and clippy after Rust changes.

| Plan | Rule | Owns | dependsOn |
| --- | --- | --- | --- |
| car6-f1-diagnostic-tokens | R6-1 | `apps/cli/src/ids.ts`, new `apps/cli/src/ids.test.ts`, `apps/cli/src/capture-cad.test.ts`, `apps/cli/src/cad-command.test.ts` | none |
| car6-f2b-incomplete-describe | R6-2 core | `packages/core/src/capture/{report.ts,report.test.ts,describe.ts,describe.test.ts}` | none |
| car6-f3-request-scan-budget | R6-3 | `crates/capture/src/{lattice.rs,interference.rs,census.rs,tool_view.rs}`, `crates/capture/tests/interference.rs` | none |
| car6-f2a-coarse-incomplete | R6-2 Rust | `crates/capture/src/{lattice.rs,interference.rs,report.rs}`, `crates/capture/tests/{interference.rs,render.rs}` | car6-f3 |
| car6-f4-not-sampled-notes | R6-4, R6-2 desktop test | `packages/core/src/capture/{describe.ts,describe.test.ts}`, `apps/desktop/src/shell/{export-handlers.ts,export-handlers.test.ts}`, new `apps/cli/src/capture-cad-census.test.ts` | car6-f2b |
| car6-f2c-incomplete-cli | R6-2 CLI and native | `apps/cli/src/{capture-interference-options.ts,capture-interference-options.test.ts,capture-cad.test.ts}`, `apps/cli/src/native-parity/capture.test.ts`, `docs/capture.md` | car6-f1, car6-f2b, car6-f2a |

Waves: f1, f2b and f3 first; then f2a and f4; then f2c. Every chain is a
real contract or a shared file:

- f3 before f2a: shared `lattice.rs`, `interference.rs` and
  `tests/interference.rs`, and the f2a unit tests use the f3
  `triangle_limit`;
- f2b before f4: shared `describe.ts` and `describe.test.ts`;
- f1 before f2c: shared `capture-cad.test.ts`;
- f2b and f2a before f2c: the report type, and the native case needs the
  Rust producer.

Gates. Each exits 0 and runs at least one test that its plan makes pass:

- f1: `bun test apps/cli/src/ids.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/cad-command.test.ts`
- f2b: `bun test packages/core/src/capture/report.test.ts packages/core/src/capture/describe.test.ts`
- f3: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f3 cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f3 cargo test --release -p nodetto-capture`
- f2a: the f3 command with `target/car6-f2a`.
- f4: `bun test packages/core/src/capture/describe.test.ts apps/desktop/src/shell/export-handlers.test.ts apps/cli/src/capture-cad-census.test.ts`
- f2c:
  1. `bun test apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts`;
  2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f2c cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car6-f2c/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`.
  The evidence shows the new native case as passed, not skipped.

The crate gate includes the release-only timing tests in
`crates/capture/src/tiles.rs`, notably the `tiles.rs:444` deadline
(1000 ms) in `tiles::tests::many_tools_exceed_limit_within_budget`, and
`tiles::tests::many_sparse_bodies_build_within_budget` (`:339`). Rule for
both Rust plans (f3 and f2a, each with its own target directory):

1. A full crate gate that fails only on a timing assertion is retried, up to
   three attempts in total. Each attempt records its command, exit status,
   the reported elapsed time and the complete log path.
2. If all three fail, the failing test alone is run once with its exact
   name, never a module or substring filter:
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-<plan> cargo test --release -p nodetto-capture --lib tiles::tests::many_tools_exceed_limit_within_budget -- --exact --nocapture`
   (or `tiles::tests::many_sparse_bodies_build_within_budget` if that one
   failed). The transcript must show `running 1 test` and one executed test.
   The plan records the printed elapsed time, the exit status and the
   complete log path next to the three full-gate attempts.
3. The plan reports both results faithfully: the full-gate failures and the
   isolated outcome. A passing isolated run does not turn the full gate into
   a pass, and a failing one is reported as a failure.

The deadlines, both timing tests, the full crate gates and the retry limit
never change. A compile failure caused by a sibling's in-progress edit is
rerun after the sibling finishes and is never fixed in the sibling's files.

Integration gates, once, after every plan lands, each recording command,
exit status and complete log path:

1. `bun run typecheck` and `bun run lint`;
2. `CARGO_TERM_QUIET=true mise run verify`;
3. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`, then
   `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`,
   which runs the new cropped dense case with the Rust producer and the CLI
   consumer both landed, plus every existing native case;
4. no `*.test.ts` file under `target/` or `tmp/`.

### 24.3 Decisions

- R6-1 fixes `shortIds` itself, the formatter the audit names
  (`ids.ts:28`). A capture-only wrapper would leave `cad check`, inspect
  and edit candidate lines printing selector-shaped tokens. Full ids are
  already valid input through the exact-id-first resolver, so no grammar
  change is needed.
- R6-2 defines coverage from successful level-0 casts, not from the shared
  exhaustion bit. That separates a genuinely unprobed grid from exhaustion
  after the final coarse cast (step-3 review). Refinement-only caps
  therefore keep their classification and exit 0.
- R6-2 accumulates every successful coarse cast before leaving on
  exhaustion. An observed overlap is a witness and is reported as a capped,
  approximate hit, never dropped (step-3 review). Uninterrupted runs are
  unchanged.
- R6-2 marks a subset of the existing capped-without-hit list instead of
  replacing the `capped` flag. Every existing count, list and report string
  stays valid. `checked` is unchanged, because changing it would alter
  budget-planning output and every headline.
- R6-2 wording never calls a pictured overlap unknown. Both records stay in
  JSON, and the incomplete line names the picture-only source (step-3
  review). Both hosts inherit the text from `describeInterference`.
- R6-2 is verified end to end with the release CLI on the cropped dense
  pair (car6-f2c, integration gate 3), in addition to `render_parsed` and
  the injected-report tests (step-3 review).
- R6-3 uses fixed phase fractions of one request ceiling instead of passing
  leftover budget between phases. Each phase stays self-contained (no
  `lib.rs` or `raster.rs` change), the total is still bounded by `R`, and
  every value is known before sampling. The ceiling scales with the ray
  budget the user already controls (`1..=256` million rays). The
  measurement covers all four phases (step-3 review).
- R6-3 charges the ceiling in mesh triangle-bin entries only. The finding is
  about triangle scans. Prism edge buckets are already bounded per ray by
  the round 5 allowance, and charging them would truncate prism-only
  scenes whose output must not change (step-3 review). The prism-only
  control pins this.
- R6-3 census measurement uses a finisher body followed by a
  never-settling body in each census phase, so the second body actually
  draws on what the first left. A per-body reset would breach the phase
  limit (step-3 review).
- R6-3 runs before R6-2's Rust plan so that the R6-2 unit tests can cut a
  pair at an exact triangle count with `triangle_limit`. The R6-2
  refinement-only cut uses a prism to mark small cells and a mesh to spend
  triangles after the final coarse cast.
- R6-3 keeps the round 5 per-ray allowance (combined edges and triangles)
  and adds the triangle ceiling beside it. Public single-call APIs keep an
  unlimited ceiling.
- R6-4 adds a field instead of parsing `line`, so the desktop gets every
  name, not the eight-name summary. Its CLI check is a new test file, so f4
  waits only for f2b.
- No user decision is pending, so no `design-docs/user-qa/` file is
  written for round 6.

### 24.4 Intentional differences from the workflow input

- The intake listed `crates/capture/src/mesh.rs` for R6-3. The existing
  `MeshView::scan_cost` is enough, so it is not edited. `tool_view.rs` is
  edited only for `triangle_cost` and the test counter.
- The intake's wording "request-wide absolute scan-entry budget" is
  implemented as a budget on triangle-bin entries, as its acceptance
  criterion says ("bounds total triangle bin entries"). Prism edges keep
  only their per-ray bound.
- R6-2 desktop text needs no `export-handlers.ts` change. Its desktop test
  is in car6-f4, which owns `export-handlers.test.ts`.
- The intake allowed the budget values to be chosen by measurement. This
  design fixes the structure and allows exactly 32 or 64 triangle entries
  per budget ray, with a blocked outcome beyond that. So the plan cannot
  drift to a value at which the regression stops failing before the change.
- The intake's ordering notes chained F2 before F3. This design runs F3
  first, because the R6-2 unit tests need its `triangle_limit`.

### 24.5 Risks

- R6-3. A real pair or census body that needs more than its share now
  reports `capped`, `incomplete` or `unknown` instead of an answer. That is
  the intended trade. Existing mesh fixtures are expected to stay below 32
  or 64 triangle entries per budget ray, and the full crate run is the
  check. Prism-only scenes are not affected.
- R6-3 bound at the default budget is 768 million (or 1,536 million at 64)
  triangle-entry visits per request. Prism edge visits remain bounded only
  per ray, as in round 5. Native elapsed time for the worst case is not
  measured.
- R6-3 census fixtures need a finisher body that settles within a quarter
  to a half of the phase allowance. The test asserts that window from a
  separate measurement, and the plan tunes the lattice size instead of
  weakening the assertion.
- R6-2 witness preservation can turn an existing capped miss under
  exhaustion into a capped hit. The existing dense test accepts either
  outcome. If any exact literal changes, the plan reports it rather than
  editing the literal.
- R6-2 fixtures (interleaved slots, small marked loops) must reach the
  stated branch. The unit tests assert their preconditions from the cast
  record, and the plan resizes a fixture instead of weakening it.
- The native case adds a document with two 6,144-triangle meshes. It
  stops early on the scan allowance, but its runtime is not yet measured;
  it uses the file's existing 30 s per-test timeout pattern.
- R6-1 changes `inspect`, `diff` and `arrange` output for ids starting with
  `name:` or `@`. No existing test is expected to pin such an id.
- The `tiles.rs:444` deadline failures under parallel load (round 5) have
  no known cause. The f3 and f2a crate gates may hit them and follow the
  retry-then-isolated rule.
- Not run by these gates: Tauri IPC, MCP delivery and `mise run test-cli`.

## 25. Revision 14: audit round 7 corrections

Source: audit round 7 of the 3D CAD pages and AI capture, base `0a35708`
to `2be9db1` plus the uncommitted round 6 working tree. Two high findings
and one low fixture typing error, none deferred. No GitHub issue exists;
the round-7 workflow input is the issue body. Where an earlier section and
this one disagree, this section wins. The common rules of section 24
(regression test that fails before and passes after in this tree,
deterministic counters instead of clocks, unchanged bytes, goldens, error
codes and existing messages, per-ray and per-entry work in Rust, the round
6 tree preserved) apply unchanged.

State of round 6. car6-f1, car6-f2b, car6-f3 and car6-f4 landed (progress
logs under `impl-plans/progress/`). car6-f2a (R6-2 Rust producer) and
car6-f2c (R6-2 exit rule, docs, native case) never ran. So the parser
(`report.ts:25`, `:102-108`), the shared text (`describe.ts:78-126`) and the
desktop note (`export-handlers.ts:299`, tested at
`export-handlers.test.ts:719`) already handle `analysis.incomplete`, but
nothing produces it and nothing exits on it. Round 7 plans `car7-*`
supersede car6-f2a and car6-f2c; those two plan files stay as history and
are not executed.

### 25.1 Rules

R7-1 `function-capture-coarse-scan-reported-as-refinement` (high, verified
recurrence; merges
`maintainability-capture-coarse-exhaustion-reported-as-refinement`).

The rule is R6-2 of 24.1 ("Rule (Rust)", the exit and docs items of "Rule
(TypeScript)", and its Rust and CLI tests), unchanged in substance.
Amendments:

- Current code positions (after car6-f3). `AxisSampler::sample` starts at
  `lattice.rs:408`: preload of rows 0 and 1 at `:421-428`, the row-top exit
  at `:434`, the row `y + 1` preload and its exits at `:437-448`, the
  refined sub-ray exit `break 'sampling` at `:484`, and `hit` from
  accumulated volume at `:498`. `sample_axes` is `:537`, `empty_sample`
  `:616`, `sample_pair` `:651`. `PairSample` is `interference.rs:206`,
  built in `sample` at `:243-275`; the classification loop is `:396-428`.
  `Analysis` is `report.rs:36` and `cappedWithoutHit` is written at `:106`.
  The `Analysis` literals to extend are `report.rs:203`,
  `tests/interference.rs:90` and `tests/render.rs:426`.
- Exit rule. `interferenceExitCode` (`capture-interference-options.ts`)
  returns 1 when `failOnInterference` and any of: `report.pairs.length > 0`,
  `uncheckedCount > 0`, `(report.analysis?.incomplete?.length ?? 0) > 0`.
  Otherwise 0. A pair capped only during refinement (in `cappedWithoutHit`,
  not in `incomplete`) keeps exit 0.
- Help text (its exit contract would otherwise be false).
  `capture-help.ts` exit paragraph: `1 only with --fail-on-interference for
  an interfering pair, an unchecked candidate or an incomplete coarse
  check`. `capture-help/interference.ts` flag line: `Exit 1 for
  interference, unchecked or incomplete pairs.` Lines keep the existing wrap
  width; `capture-docs.test.ts` keeps passing unchanged.
- `docs/capture.md`. Line 33 table cell: `Exit 1 on interference, unchecked
  candidates or incomplete coarse checks; default off.` The output
  paragraph (`:38-43`) gains: an `incomplete:` line names a checked pair
  whose coarse check stopped before covering it; it ends with `interference
  not determined`, or with `the overlap listed above was found in the
  picture only` when a picture-only record names the same bodies; JSON lists
  such pairs as body ids in `interference.incomplete` (report key
  `analysis.incomplete`, body indices), present only when non-empty. Line
  104 says `interference, unchecked candidates or incomplete coarse checks`.
  Exit line 109: `1: only with --fail-on-interference, when a pair
  interferes, a candidate was not checked, or a checked pair's coarse check
  is incomplete. A pair capped only during refinement does not change the
  exit status.`
- Fixture typing. `packages/core/src/capture/report.test.ts:55` becomes
  `const incomplete = [[0, 1]] as const;`. Production types are unchanged.
- Buffered-hit unit test (replaces the R6-2 "non-zero volume" assertion).
  The two cubes overlap in a 4 x 4 x 4 mm cube, the request box equals that
  overlap, the target cell is 1 mm and refinement is 0. `side_count`
  (`lattice.rs:140-142`) clamps each transverse dimension to at least 16
  cells, so `Grid::new` (`:159-163`) gives 16 x 16 cells of 4 / 16 = 0.25
  mm. The test asserts that grid from the sample (`cell == 0.25`) and that
  every unlimited coarse record is a hit. The cut is the `triangles` of the
  first record, so exactly one coarse cast succeeds (`coarse_casts.len() ==
  1` in the cut run) and the next fails. Assert `hit`, `capped`,
  `coarse_complete == false` and `volume == 0.25` mm3 (one 0.25 x 0.25 mm
  cell times the 4 mm stretch, tolerance 1e-9). A lost witness gives 0.0
  and a duplicated one 0.50; both fail.
- Native release case (replaces the R6-2 native case; owned by the Rust
  plan). Name `native capture keeps the analysis hit of a cropped dense
  pair`. The document is generated in the test with the existing helpers
  (`encodeNmesh`, `canonicalize`, `toInline`, `cadElement` with
  `cad.mesh`, as at `capture.test.ts:706-721`): exactly the audit trigger,
  two coincident closed meshes of 512 disjoint 1 x 10 x 10 mm boxes on a
  2 mm X pitch (6,144 triangles each), and no other body. The binary is
  spawned directly (as at `:830-848`) with `capture <doc> --view top --size
  64x64 --target 2000,2000,0 --zoom 10 --fail-on-interference --output
  dense.png --force`, once plain and once with `--json`. Assertions, in
  both runs: exit status 1. Text: the pair line for the two bodies ends in
  `, approximate`, and the text has no `incomplete:` line and no `(found in
  the picture only)`. JSON: `interference.pairs` has exactly one record,
  for the two bodies, with `approximate: true` and `source: "analysis"`,
  and `interference.incomplete` is absent. An incomplete outcome or a
  picture-only record fails the case. Before the Rust change the run exits
  0 with no pair. The outcome needs no exit-rule change, so the case does
  not wait for the CLI plan.
- Thread parity for all three Rust classifications. Each of the three
  `crates/capture/tests/interference.rs` cases (buffered hit, abandoned
  miss, refinement-only control) renders at requested threads 1 and 5 and
  asserts equal `report.to_json()` and equal PNG bytes
  (`nodetto_capture::encode::png::png_rgb8` of the RGB output). For the
  refinement-only control, the existing
  `cap_without_a_hit_is_retained_in_the_report_and_json` (`:571`, today
  only `render_rgb(&scene, 5)`) gains the threads-1 render and the
  comparison; its existing assertions are kept and it also asserts
  `analysis.incomplete.is_empty()` and no `"incomplete"` key.
- CLI tests, injected reports, flagged, text and `--json` each
  (`capture-interference-options.test.ts` for the predicate,
  `capture-cad.test.ts` for text, JSON and exit): a capped analysis hit
  with no `incomplete` exits 1; `incomplete [[0,1]]` with
  `cappedWithoutHit [[0,1]]` and no pairs exits 1, prints the "not
  determined" line and JSON `interference.incomplete`; a refinement-only
  capped miss exits 0; each case unflagged exits 0. A report without the
  `incomplete` key keeps today's exit and text (legacy compatibility). The
  existing ordinary-cap case is not edited.
- `crates/capture/tests/interference.rs:989` (multi-pair, accepts hit or
  miss) is neither loosened nor rewritten; the single-pair `render_parsed`
  regressions of R6-2 carry the finding.
- Not edited: `describe.ts`, `report.ts`, `export-handlers.ts`,
  `capture-cad.ts`, `capture-command.ts`, the census sampler.

R7-2 `performance-capture-picture-mesh-triangle-scans` (high, new).

Cause. `Raster::sample` (`raster.rs:149`) calls `WorkerBudget::scan`
(`raster/budget.rs:108-117`) before a mesh traversal, which charges only
the bin length above the tool's admitted weight
(`tiles::tool_weight(average_occupancy)`, `raster.rs:687-693`). Admission
bounds weighted work at `tiles::WORK_LIMIT` (4,000,000,000) and the surplus
at `SCAN_ALLOWANCE` (16,000,000,000), so a picture can traverse about 2e10
mesh-bin entries. Three diagonal-strip slabs at 64 x 64 need at least
1,610,612,736 and are admitted. Mesh traversals in painting are
`first_surface_hit` for open bodies (around `:186-193`),
`surface_intervals` for solid steps (around `:210-218`) and the witness
recast `intervals` (around `:222-228`), each a full pass over one bin
(`mesh.rs:307-321`, `:339-352`).

Rule (Rust, `raster.rs` and `raster/budget.rs` only).

- `const PICTURE_TRIANGLE_LIMIT: u64 = 768_000_000;` in `raster.rs`: the
  round 6 request ceiling at the default 24 million ray budget
  (`lattice::request_triangles(24_000_000)`), written as a literal so the
  lattice constant stays uncoupled. It is absolute and request-wide: it
  does not scale with `--size`, supersampling, threads or the interference
  budget, and applies with or without `--no-interference`.
- Value check. The plan runs the full `nodetto-capture` suite with 768M.
  If any existing test, pin or golden changes, it uses 1,536,000,000 (the
  only other allowed value) and reruns; if that still changes an existing
  test, it stops and reports blocked. Both values are below the fixture's
  lower bound 1,610,612,736. The chosen value is recorded in the progress
  log.
- Reservation before traversal. Immediately before each of the three mesh
  traversals, `Raster::sample` calls the new
  `WorkerBudget::traverse(entries)` with `ToolView::triangle_cost(&ray)` of
  the same view and ray (full bin length for a mesh, 0 for a prism). The
  full length is reserved, including the part covered by the admitted
  weight. The traversal runs only when `traverse` returns true; on false,
  `sample` returns `Sample::default()` as the existing budget failures do.
  For the recast, the reservation precedes the `intervals` call; the
  existing `recast` call after it stays. Existing `scan`, `charge`,
  `recast`, `charge_witness` and `flush` accounting (the chunked surplus
  account), `stats.charged` and `stats.reads` are unchanged.
- Shared balance, not chunked. `ScanBudget::new(allowance, triangle_limit)`;
  only `render_tuned` constructs it, passing `PICTURE_TRIANGLE_LIMIT`, so
  the `render_with` and `render_tuned` signatures and every existing test
  call stay. `ScanBudget` gains `triangle_limit`, `triangles: AtomicU64`
  (every reservation request, granted or not) and `visited: AtomicU64`
  (entries actually traversed). `traverse(entries)`:
  1. `entries == 0` returns true and touches no counter;
  2. otherwise `after = triangles.fetch_add(entries) + entries`, directly on
     the shared atomic, never through a worker-local pending count;
  3. `after > triangle_limit`: set `stopped` and return false (the bin is
     not traversed, not even partly);
  4. else add `entries` to the worker's local `visited` and return true.
  `Drop` of `WorkerBudget` adds its local `visited` to the shared
  `visited`; that is a measurement only and grants nothing. `RenderStats`
  gains `triangles` and `visited`.
- Hard ceiling, any number of simultaneous workers. All reservations are
  ordered by the one atomic `fetch_add`, so each granted reservation ends at
  a distinct cumulative total `after <= triangle_limit`, and the granted
  entries are disjoint parts of that prefix. Their sum, which equals the
  traversed entries, is therefore at most `triangle_limit` exactly, with no
  per-worker or per-chunk slack. Rejected requests only raise `triangles`.
- Refusal. The existing path after `paint` (`raster.rs:847-849`) returns
  the existing string verbatim, `The scene is too heavy for this picture
  size (picture boundary scans over <allowance>). Use a smaller --size.`,
  as the layer-storage stop already does. No new message, error code, docs
  line or help line.
- Determinism. Band boundaries do not depend on the thread count and each
  sample's requests are a pure function of that sample, so the demand `D`
  (sum of all requests of a complete paint) is the same at any thread
  count. If `D <= limit` no request is rejected, the picture is admitted
  and `visited == triangles == D` at every thread count. If `D > limit`,
  the paint cannot complete without the request that crosses the limit
  being rejected, so the picture is refused. Other stop reasons refuse
  with the same string, so the error text is identical at one and five
  threads.
- Scope. Census, analysis pairs and picture-only pair sampling keep the
  round 6 phase shares; `lattice.rs`, `census.rs`, `interference.rs`,
  `mesh.rs`, `tool_view.rs` and `tiles.rs` are not edited.

Tests (`crates/capture/src/raster/tests.rs`, release only like the other
heavy cases: `#[cfg_attr(debug_assertions, ignore = "release only")]`).

- Builder `diagonal_strip_scene(strips, bodies, height)` (test data of this
  design): for strip boundary `i` in `0..=strips`, points `(x, x + (i -
  strips/2) * 32 / strips, z)` for `x = -128, 128` mm and `z = 0, 1`; two
  triangles per strip on each broad face, and the two long sides and two
  end quads close the slab (8,192 strips give 65,540 triangles; every edge
  has two incident triangles). Scene from `base()`: width 64, the given
  height, supersample 2, top view centred on the origin with
  `mm_per_pixel` 0.0486, `bodies` coincident bodies, each one union step of
  its own copy of the mesh, `analyse` and `draw_interference` false.
- Audit case: `(8192, 3, 64)`, threads 1 and 5 through `render_with(&scene,
  threads, SCAN_ALLOWANCE)`. A 64-pixel picture has two bands, so the
  threads-5 run starts two workers; assert `stats.workers` is 1 and 2.
  Assert: the error string above, equal at both thread counts;
  `stats.visited <= PICTURE_TRIANGLE_LIMIT` (strict, no slack term);
  `stats.triangles > PICTURE_TRIANGLE_LIMIT`; `stats.charged <=
  SCAN_ALLOWANCE` (the new account refused it); empty liveness; zero census
  rays.
- Five-worker case: `(8192, 2, 160)`, five bands. Threads 1 and 5; assert
  `stats.workers == 5` for the threads-5 run, the same error string at both,
  `stats.visited <= PICTURE_TRIANGLE_LIMIT` and `stats.triangles >
  PICTURE_TRIANGLE_LIMIT`. Its demand lower bound is 2 x 40,960 samples x
  32,768 cap facets = 2,684,354,560, above both allowed limits. If the tile
  work limit refuses the scene before painting (a `work` error, zero
  workers), the plan lowers `strips` to 6,144 (lower bound 2,013,265,920)
  and keeps every assertion.
- Admitted control: `(256, 3, 160)`, threads 1 and 5. Both succeed; assert
  `stats.workers == 5` for threads 5; RGB bytes,
  `encode::png::png_rgb8` bytes, `report.to_json()` and `stats.visited` are
  equal; `0 < stats.visited == stats.triangles <= PICTURE_TRIANGLE_LIMIT`.
- Fail-before order: the plan first adds only the measurement (`traverse`
  always returns true and counts `visited`; no limit, no refusal), runs the
  audit case and records that the picture is admitted with `visited >=
  1,610,612,736`, so the ceiling assertion fails. It then adds the
  reservation check and records the passing run.
- Unchanged and rerun: every raster test (including
  `a_view_zoomed_onto_a_dense_bucket_is_refused_by_the_scan_budget`,
  `boundary_read_counts_and_refusal_are_bounded`,
  `layers_storage_cap_refuses`), mesh and render pins, goldens, and the
  `tiles.rs:444` deadline.

### 25.2 Plan grouping

Plans `car7-*`, one wave, no `dependsOn`: no two plans share a file. Each
plan has a non-empty `acceptanceCriteria`, uses
`CARGO_TARGET_DIR=target/car7-<plan>`, sets `artifactRoots ["target",
"tmp/cad3d"]` exactly with evidence under `tmp/car7-r7/<planId>/`, lists
every edited file including its plan and progress files in `writePaths`,
and runs biome on touched TypeScript plus rustfmt and clippy after Rust
changes.

| Plan | Rule | Owns |
| --- | --- | --- |
| car7-f1a-coarse-witness | R7-1 Rust producer and native case | `crates/capture/src/{lattice.rs,interference.rs,report.rs}`, `crates/capture/tests/interference.rs`, `crates/capture/tests/render.rs` (one literal), `apps/cli/src/native-parity/capture.test.ts` |
| car7-f1b-incomplete-exit | R7-1 exit rule, help, docs, fixture | `apps/cli/src/{capture-interference-options.ts,capture-interference-options.test.ts,capture-cad.test.ts,capture-help.ts}`, `apps/cli/src/capture-help/interference.ts`, `docs/capture.md`, `packages/core/src/capture/report.test.ts` |
| car7-f2-picture-triangle-bound | R7-2 | `crates/capture/src/raster.rs`, `crates/capture/src/raster/{budget.rs,tests.rs}` |

Gate outputs that are not source edits but must be listed in `writePaths`:
car7-f1a lists `tmp/capture/m09/timing.json` and
`tmp/capture/m23/timing.json`, which the full native capture suite writes
(`capture.test.ts:317-320` and `:1002-1007`), as car6-f2c did. Only these
two exact files are added; `tmp` itself is never a write path or an
artifact root, and `artifactRoots` stays exactly `["target", "tmp/cad3d"]`.
No other plan runs the native suite.

Gates (each exits 0 and runs at least one test the plan makes pass):

- f1a: `rustfmt --edition 2021` on its Rust files, then
  `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f1a cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f1a cargo test --release -p nodetto-capture`;
  then `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f1a cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car7-f1a/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
  (the new case listed as passed, not skipped; both timing files written).
- f1b: `bunx biome check` on its TypeScript files, then
  `bun test apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/capture-docs.test.ts packages/core/src/capture/report.test.ts`.
- f2: the f1a crate command with `target/car7-f2`.

The two Rust gates follow the 24.2 timing rule (three full attempts, then
the failing timing test alone with `--exact`, both results reported). A
compile or bundle failure caused by a sibling's in-progress edit in the
shared tree is rerun after the sibling finishes, never fixed in the
sibling's files.

Integration, once after all three land: `bun run typecheck` (exit 0 once
`report.test.ts:55` is typed), `bun run lint`, `CARGO_TERM_QUIET=true mise
run verify`, the release CLI build with the native capture suite, and no
`*.test.ts` under `target/` or `tmp/`.

### 25.3 Decisions

- R7-1 reuses the R6-2 rules; its design was accepted in round 6 and only
  the Rust producer, exit rule and docs were never implemented. Only the
  tests are tightened (below).
- R7-1 is split into a Rust plan and a CLI plan so that each stays within
  the plan-size limit and both run in the first wave. Injected reports make
  the CLI plan independent of the Rust producer.
- R7-1 updates the CLI help text with the docs because the exit contract it
  states would otherwise be false.
- R7-2 reserves the full bin length from one shared atomic balance before
  each traversal instead of using the chunked worker accounting. Chunked
  pending charges authorize traversals that a later flush cannot undo (a
  one-worker overshoot of 667,260 entries at the 768M limit with 32,772-entry
  bins, step-3 review). One `fetch_add` per mesh traversal is cheap next to
  the traversal itself and gives an exact ceiling. Leaving the surplus
  account untouched keeps every existing `charged` and `reads` assertion and
  prism-only behaviour unchanged.
- R7-2 tests a real five-worker run on a five-band picture, because a
  64-pixel picture clamps to two workers (`raster.rs:726-727`).
- R7-1 tightens the inherited R6-2 tests: an exact one-cell volume rejects
  double accumulation, the native case uses exactly the audit fixture and
  accepts only the retained analysis hit, and all three Rust
  classifications compare report and PNG bytes at threads 1 and 5
  (step-3 review).
- R7-2 reuses the existing picture refusal string, as the layer-storage
  stop does. The error is then identical across thread counts whichever
  account crosses first, and no docs change is needed, so R7-2 shares no
  file with R7-1.
- R7-2 takes its ceiling from the round 6 request constant at the default
  budget instead of a new scale, with one fallback value, so the plan
  cannot drift to a value at which the regression stops failing.
- No user decision is pending; no `design-docs/user-qa/` file.

### 25.4 Intentional differences from the workflow input

- The intake planned two plans; this design has three (R7-1 split), still
  one wave with no shared file.
- The intake listed `mesh.rs` for R7-2. `ToolView::triangle_cost` already
  returns the bin length, so `mesh.rs` is not edited.
- The intake listed `crates/capture/tests/render.rs` for R7-2. Its tests are
  unit tests in `raster/tests.rs`, which can read `RenderStats`; this keeps
  `render.rs` with the R7-1 plan only.
- The intake listed `export-handlers.ts`, `describe.ts` and `report.ts`.
  They already handle the field (car6-f2b, car6-f4) and are not edited; the
  desktop delivery is covered by `export-handlers.test.ts:719`.

### 25.5 Risks

- R7-2 may refuse a real dense-mesh picture that was admitted before. That
  is the intended trade; the full crate suite checks existing pins, with
  one fallback value.
- R7-2 tests traverse up to the limit (768M or 1,536M entries) per refused
  run, four refused runs in all (release only), and the pre-change evidence
  run about 1.6e9; they share the crate gate with
  the `tiles.rs:444` deadline and may trigger the retry rule. Native
  elapsed time and peak memory of the fixture are not measured.
- R7-1 witness preservation can turn an existing capped miss under
  exhaustion into a capped hit; the multi-pair test accepts either. An
  exact literal that changes is reported, not edited.
- The R7-1 native case accepts only the analysis hit. If the release run
  yields `incomplete` instead, the case fails and the plan reports it as a
  producer defect (the `render_parsed` buffered-hit test on the same meshes
  must then fail too); it never relaxes the case.
- Sibling Rust plans compile each other's in-progress edits in one tree.
- Not run by these gates: Tauri IPC, MCP delivery and `mise run test-cli`.

## 26. Revision 15: audit round 8 corrections

Source: audit round 8 of the 3D CAD pages and AI capture, base `0a35708`
to `fc22c03`. Two performance findings, none deferred. No GitHub issue
exists; the round-8 workflow input is the issue body. Where an earlier
section (including F8 of `design-cad3d.md` section 19) and this one
disagree, this section wins. The common rules of section 24 apply
(a regression test that fails before and passes after in this tree,
deterministic work counters instead of clocks, and unchanged bytes,
goldens, error codes, messages and caller interfaces), except that the
timing disposition is the round-8 timing rule of 26.2.

### 26.1 Rules

R8-1 `performance-sketch-profile-pair-scans` (high, recurrence of F8).

Cause. `overlappingPairs` (`packages/core/src/cad/loops.ts:215-258`) picks
one sweep axis for the whole sketch and enumerates every pair that overlaps
on it before rejecting on the other axis. Holes along two perpendicular
edges put one row inside a single slab of either axis, so both segment
intersection and contour containment become quadratic (1,024 holes:
24,213,509 segment and 131,840 contour candidate visits).

Rule. Only the body of `overlappingPairs` changes. Its signature
`(boxes, visit, count)`, both callers (`intersection` and the depth loop in
`buildProfileLoops`), `segmentIntersection`, `contains`, the `(minX, minY)`
sort of `segments`, `buildLoops`, `buildProfileLoops` and `LoopStats` keep
their shapes.

- Pair contract (unchanged, now stated). `visit(i, j)` is called exactly
  once for every unordered pair of distinct boxes whose closed bounds
  overlap on both axes (`minX <= other.maxX && other.minX <= maxX`, same
  for Y), and for no other pair. Both callers depend only on this set: the
  intersection keeps `first = min(first, i, j)` over intersecting pairs
  and the depth loop adds symmetrically, so the reported segment and every
  depth are identical to today whatever the visiting order. Argument order
  inside a pair is not part of the contract (today it already depends on
  the chosen axis). `visit` stays guarded by the existing four-comparison
  test.
- Query. X sweep with a static interval index on Y:
  1. `byMinX`: box indices sorted by `(minX, index)`. `byMaxX`: sorted by
     `(maxX, index)`. `byMinY`: sorted by `(minY, index)`; a box's
     position in `byMinY` is its leaf, and `minYs` holds the sorted minY
     values.
  2. A complete binary tree over the leaves (array layout; typed numeric
     arrays allowed) stores in each node the largest `maxY` among active
     leaves below it, `-Infinity` when none.
  3. For each box `a` in `byMinX` order: first deactivate (leaf set to
     `-Infinity`, ancestors recomputed) every box from the `byMaxX`
     pointer with `maxX < a.minX` (strict, so touching boxes stay active);
     then query; then activate `a` (leaf set to `a.maxY`, ancestors
     updated).
  4. Query: `limit` = number of leaves with `minY <= a.maxY` (upper-bound
     binary search on `minYs`). Descend from the root, skipping any node
     whose leaf range starts at or after `limit` or whose stored max is
     `< a.minY`. Every leaf reached is active (so `b.minX <= a.minX <=
     b.maxX`) and overlaps `a` in Y, so it is a true overlap and is
     visited.

  Every overlapping pair is found exactly once, by the later box in
  `byMinX` order. Boxes with equal `minX` find the earlier ones because
  those are still active. Cost is O(n log n) for build and updates plus
  O((k + 1) log n) per query for k reported pairs.
- Work counter. `count()` is called once per tree node entered by a query,
  pruned nodes and reported leaves included. `stats.segmentPairs` and
  `stats.containmentPairs` keep their names and now count these query
  steps (candidate-search work). No new export.
- Typing. Indexed reads of arrays and typed arrays are guarded for
  `noUncheckedIndexedAccess` (for example `?? Number.NEGATIVE_INFINITY`).
  Tree depth stays below about 30 at the page and loop limits, so a
  recursive descent is safe; an explicit stack is equally acceptable.

Tests (`packages/core/src/cad/loops.test.ts`, appended; existing tests
unchanged and passing):

- "holes along two perpendicular edges have near-linear candidate counts".
  For `h` in 128, 256 and 512 holes (half per row): plate
  `rectangle("plate", 0, 0, L, L)` with `L = 9 + 3 * (h / 2)`; horizontal
  row `circle("h-<k>", [6 + 3k, 2.5], 1)` and vertical row
  `circle("v-<k>", [2.5, 6 + 3k], 1)` for `k < h / 2`. All holes are
  disjoint from each other and from the plate. `buildLoops(entities,
  undefined, stats)` returns `loops` with `h + 1` loops: the plate loop at
  depth 0 and every hole at depth 1. Per doubling, both
  `stats.segmentPairs` and `stats.containmentPairs` are positive and grow
  by at most 2.5 times. Before the fix the growth is about 3.9 (audit:
  388,869 to 1,531,397 to 6,077,445 segment visits), so the test fails;
  after it the expected growth is about 2.1 to 2.3.
- In the same test, the 128-hole fixture with hole `h-0` moved to `[6, 1]`
  (tangent to the plate edge `y = 0`) returns
  `{ error: "cad.profile.intersect" }` with `at` defined. This checks
  inclusive bounds against a zero-height edge box under the new query.
- First-error identity, touching contours, nesting and the single-row
  counts stay covered by the existing tests at `loops.test.ts:51`, `:125`,
  `:209` and `:234`, which must pass unedited.

R8-2 `performance-capture-sibling-attribution-rescans` (medium).

Cause. `describeBodies` (`packages/core/src/capture/describe.ts:190-200`)
runs `body.steps.findIndex` once per other source for every closed body.
One cut that empties B bodies gives B sources with the same key, so the
cost is O(B^2) (2,048 bodies: 16,775,168 step-property reads).

Rule. The R5-1 attribution of 23.1 is kept exactly; only its evaluation
changes. `describeBodies` keeps its signature and return value.

- Source index. After `sources` is built (unchanged, model order), build
  once a nested map `tool -> op -> first two sources` holding, per
  `(step.tool, step.op)` key, the first two entries of `sources` in model
  order. Each body yields at most one source, so they are distinct bodies.
  Nested maps keyed by the numeric tool and the op string avoid composed
  string keys.
- No-sibling shortcut (preserves today's zero reads). The history walk
  below is skipped, and the body has no sibling candidate, when `sources`
  is empty or when its only entry is the body itself (`sources.length ===
  1 && sources[0].i === i`). Today's loop reads no step in either case. A
  page whose bodies have no eligible sources therefore still reads no
  `op` or `tool` of any step for sibling attribution.
- Sibling candidate. Otherwise, for a body `i` with `state.open` false,
  walk `body.steps` once in order. At step `k`, look up its key; the
  candidate
  is the first indexed source whose `i` differs from the body's own index,
  else the second. Stop at the first `k` that yields a candidate:
  `sibling = { index: k, source }`. This equals today's result: the
  smallest first-match index over all other sources is the first step
  whose key has any other source, and at that step the earliest other
  source in model order is the first or second indexed entry
  (self-exclusion needs at most one skip).
- Unchanged. `sources`, `existingIndex`, the strict `<` that lets the
  existing hidden or own attribution win at an equal index, the error
  texts, error order (model order of bodies), names, notes and
  `notSampled`.

Tests (`packages/core/src/capture/describe.test.ts`, appended; existing
tests unchanged and passing):

- "a cut shared by many emptied bodies is attributed with linear step
  reads". For `B` in 256, 512 and 1024: one union tool per body (feature
  `base-<i>`) plus one shared cut tool (feature `cut`); bodies `e-<i>` with
  steps `[{ op: "union", tool: <own union> }, { op: "difference", tool:
  <cut> }]` and state `{ state: "empty", open: false, emptiedByStep: 1 }`,
  plus one last body `stand` with the same two steps and state
  `{ state: "drawn", open: false, emptiedByStep: -1 }`. Every step object
  exposes `op` and `tool` through getters that increment one shared
  counter (test-only instrumentation; no production hook). Assert:
  `errors` has `B + 1` entries in body order, each `e-<i>` with the own
  text and `stand` last with the sibling text naming `e-0` (first-source
  tie-break); per doubling the read count grows by at most 2.5 times.
  Before the fix it grows by about 4 (step-3 reviewer getter counts on
  this fixture: 394,241 to 1,574,913 to 6,295,553 reads), so the test
  fails.
- No-source zero reads, in the same appended test. 256 bodies, each with
  256 instrumented steps, state `{ state: "drawn", open: false,
  emptiedByStep: -1 }` and no `hiddenEmptiedByStep`: `describeBodies`
  returns no errors and the getter counter stays at 0. This holds before
  and after the fix and guards the no-sibling shortcut.
- Self-exclusion through the second index entry: body `a` with steps
  `[union, difference cut, difference cut]` and `emptiedByStep: 2`, body
  `b` with `[union, difference cut]` and `emptiedByStep: 1`. `a` gets the
  sibling text naming `b` (index 1 < own 2, its own entry skipped); with
  `a` alone it gets its own text.
- Equal-index precedence, hidden precedence, open bodies and unknown
  bodies stay covered by the existing tests at `describe.test.ts:243` and
  `:290`, which must pass unedited.

### 26.2 Plan grouping

Plans `car8-*`, one wave, no `dependsOn`: the two plans share no file.
Each has a non-empty `acceptanceCriteria`, uses
`CARGO_TARGET_DIR=target/car8-<plan>` (no Rust is built), sets
`artifactRoots ["target", "tmp/cad3d"]` exactly with evidence under
`tmp/car8-r8/<planId>/`, lists every edited file including its plan and
progress files in `writePaths`, and leaves no `*.test.ts` under `target/`
or `tmp/`. Each plan first adds its test and records the failing run, then
applies the fix and records the passing run.

| Plan | Rule | Owns |
| --- | --- | --- |
| car8-f1-loops-box-query | R8-1 | `packages/core/src/cad/loops.ts`, `packages/core/src/cad/loops.test.ts` |
| car8-f2-describe-source-index | R8-2 | `packages/core/src/capture/describe.ts`, `packages/core/src/capture/describe.test.ts` |

Gates (each exits 0 and runs the new test):

- f1: `bunx biome check packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts && bun test packages/core/src/cad/loops.test.ts`.
- f2: `bunx biome check packages/core/src/capture/describe.ts packages/core/src/capture/describe.test.ts && bun test packages/core/src/capture/describe.test.ts`.

Integration, once after both land, in this order:

1. `bun run typecheck`, `bun run lint` and `CARGO_TERM_QUIET=true mise run
   verify` (determinism and golden tests run there without regenerating
   goldens).
2. Native CAD determinism, which `mise run verify` skips because it does
   not set `NODETTO_CLI_TEST_BINARY`
   (`apps/cli/src/native-parity/harness.ts:6-13`):
   `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts --test-name-pattern '^CAD capture is deterministic, discoverable, and within the native budget$'`.
   The binary is built from the integrated working tree. Evidence: build
   exit 0, exactly one matching case reported as passed (not skipped),
   its repeated PNG byte assertions passing, and the timing output that
   the case already writes at `tmp/capture/m09/timing.json`. Native
   assertions, deadlines and NCS1 goldens are not edited. This step is
   integration-only and is never part of either plan gate.
3. No `*.test.ts` under `target/` or `tmp/`.

Round-8 timing rule (replaces the 24.2 disposition for this round; 24.2
itself is unchanged). It applies to every plan gate and integration
command. Only existing timing or deadline tests are covered (for example
`packages/core/src/capture/scene-binary.test.ts` "the Plate fixture is
stable and serializes within 100 ms", the native budget case above, tile
deadlines and `release_*_budget`):

- A command may be rerun up to three times in all when its only failures
  are such timing tests.
- If a timing-only failure remains, each failing timing test is rerun
  alone (for example `bun test packages/core/src/capture/scene-binary.test.ts --test-name-pattern '^the Plate fixture is stable and serializes within 100 ms$'`).
  An isolated pass satisfies that timing failure. The evidence keeps every
  original nonzero exit status, the complete aggregate logs and the
  complete isolated log; the earlier failures are never rewritten as
  passes.
- Skipped checks still run. A command that chains stages with `&&` stops
  at the failing stage, so an isolated pass alone never closes the gate.
  Every stage after the failing one is then run separately, in chain
  order, each with its own exit status and complete log and each under
  this same rule. `CARGO_TERM_QUIET=true mise run verify` expands
  (`mise.toml:73-107`) to `bun run typecheck && CARGO_TERM_QUIET=true
  cargo check --workspace`, then `mise run lint-ts && mise run fmt-check
  && mise run lint-rust`, then `bun run typecheck && bun test &&
  CARGO_TERM_QUIET=true cargo test --workspace`. Example: when the Plate
  serialization test (`scene-binary.test.ts:316-336`) is the only failure
  of `bun test` and passes alone, `CARGO_TERM_QUIET=true cargo test
  --workspace` must then run and exit 0, or exit nonzero only on timing
  tests that pass alone (for example `cargo test --workspace --
  <test name> --exact`). Only then does step 1 pass.
- The gate passes only when every stage of every listed command has either
  exited 0 or failed solely on timing tests that each passed alone. Each
  numbered integration step starts only after the previous one has passed.
- Any functional failure, or a timing test that also fails alone, fails
  the gate. Deadlines and assertions are never relaxed.

### 26.3 Decisions

- R8-1 uses an X sweep with a static max-augmented tree over the minY
  order instead of a uniform grid. A grid degrades when one box (the plate
  contour or a long edge) covers every cell; the tree costs
  O((k + 1) log n) per query for any box sizes. The sweep axis is fixed to
  X and the axis heuristic is removed, because the Y index makes it
  unnecessary.
- R8-1 keeps the `LoopStats` field names and redefines their unit as query
  steps, so the existing single-row test keeps its 2.5 bound unedited
  (expected growth about 2.1 per doubling there) and no caller changes.
- R8-2 counts work with getters on fixture step objects instead of a
  production counter, so `describeBodies` gains no test-only parameter.
- R8-2 keeps today's skip when no other source exists, so pages without
  emptied bodies read no step history at all (step-3 review R8-D1).
- The round-8 timing rule lets an isolated pass satisfy a timing-only
  aggregate failure, as the workflow input requires, while keeping every
  nonzero status and log (step-3 review R8-D2).
- Integration runs the existing native CAD determinism case with a release
  binary built from the integrated tree, because `mise run verify` skips
  it without `NODETTO_CLI_TEST_BINARY` (step-3 review R8-D3). It stays out
  of the plan gates, which build no Rust.
- No user decision is pending; no `design-docs/user-qa/` file.

### 26.4 Intentional differences from the workflow input

- The workflow input lists `history.ts`, `construction.ts`,
  `cad-request.ts`, `scene.ts`, `capture-cad.ts` and `export-handlers.ts`
  as possible callers to change. Neither rule changes an interface, so
  they are not edited.
- The workflow verification hint lists `bun run typecheck` per plan; per
  the input's own constraint it runs once at integration only.

### 26.5 Risks

- If the new query ever missed or duplicated a pair, first-error identity
  or depths would change; the existing first-error, touching and nesting
  tests plus the new tangent and depth checks guard this.
- The 2.5 bound carries a log factor; at the chosen sizes the expected
  growth is about 2.1 to 2.3. If a bound fails after a correct fix, the
  plan reports the measured counts; it never relaxes the bound.
- Not measured: Boa elapsed time, desktop latency, peak memory, end-to-end
  CLI or desktop runs, Tauri IPC, MCP delivery and native parity.

## 27. Revision 16: audit round 9 corrections

Source: audit round 9 of the 3D CAD pages and AI capture, base `0a35708`
to `aede81d`. Two findings, none deferred. No GitHub issue exists; the
round-9 workflow input is the issue body. Where an earlier section and
this one disagree, this section wins. The common rules of section 24 and
the round-8 timing rule of 26.2 apply unchanged: a regression test that
fails before and passes after in this tree, deterministic work counters
instead of clocks, and unchanged bytes, goldens, error codes, messages,
NCS1 layout and caller interfaces.

### 27.1 Rules

R9-1 `performance-cad-containment-perimeter-rescans` (high).

Cause. Two point-in-contour predicates walk every edge of the enclosing
contour for each query: `contains` in `packages/core/src/cad/loops.ts`
(about 342-360, called from the depth pass at about 490-493) and
`containsPoint` in `packages/core/src/capture/scene.ts` (about 79-95,
called from `normaliseToolLoops` at about 237). H holes in a plate with
P = H + 3 edges cost H(H+3) edge reads per pass (67,133,440 at H = 8,192).

Rule. A new internal module `packages/core/src/cad/edge-y-index.ts` holds
a static per-contour index of edge Y intervals. It is not re-exported from
`packages/core/src/cad/index.ts` or `packages/core/src/index.ts`, and it
imports nothing (it reads plain numbers).

Revision 17 note: section 28 supersedes three parts of this rule. R10-2
replaces the Y-only query `forEachEdgeAtY` with a ray-origin parity
query and stops indexing horizontal edges. R10-4 replaces the
floating-point capture predicate described under "Exactness" below with
the grid predicate. R10-3 adds a parent-forest fallback to the depth
pass. The text below records revision 16.

- Edge numbering. For a flat array of n vertices, edge `e` runs from
  vertex `(e + n - 1) % n` to vertex `e`, the order both predicates
  already walk (they start at the last vertex).
- Build: `buildEdgeYIndex(points: ArrayLike<number>, stats?)`. For every
  edge, `lo = min(ay, by)` and `hi = max(ay, by)` come from the caller's
  own array (grid integers in `loops.ts`, millimetre doubles in
  `scene.ts`; both are exact doubles, so nothing is converted). Horizontal
  edges are kept. Edges are sorted by `(lo, e)`. A complete binary tree in
  array layout (typed arrays allowed) stores in each node the largest `hi`
  below it. Cost O(n log n).
- Query: `forEachEdgeAtY(index, y, visit, stats?)`. `limit` is the number
  of leaves with `lo <= y` (upper-bound binary search). Descend from the
  root and skip a node whose leaf range starts at or after `limit` or whose
  max `hi < y`. Every leaf reached has `lo <= y <= hi` (closed) and is
  passed to `visit(e)` exactly once. Cost O((k + 1) log n) for k reported
  edges. Tree depth stays below 30 at the loop limits, so recursion and an
  explicit stack are both acceptable.
- Exactness. The closed stab is a superset of every edge the existing
  predicates can count, because `ay > y !== by > y` implies
  `lo <= y < hi`. Each caller keeps its own predicate unchanged and applies
  it to each reported edge: `loops.ts` keeps `ay > y !== by > y` with
  `gridCross(...) > 0 === by > ay` on grid numbers; `scene.ts` keeps
  `ay > y !== by > y && x < ax + ((bx - ax) * (y - ay)) / (by - ay)` on
  millimetre numbers. Parity is an XOR, so the visiting order does not
  matter, and every depth, kept loop and error is identical to today.
- Counters: `EdgeIndexStats { builds: number; visits: number;
  inspections: number }`, exported from the new module for the two callers
  and tests only. `builds` grows by n per index built, `visits` by 1 per
  tree node a query enters (pruned nodes included), and `inspections` by 1
  per reported edge (the caller's exact predicate runs once for each).
- `loops.ts`. `contains` keeps its bounds early exit, then queries the
  profile's index. Indexes are built lazily, at most once per profile per
  `buildProfileLoops` call (kept in an array next to `profiles`), so a
  profile rejected by bounds never pays for a build. `LoopStats` gains an
  optional `edges?: EdgeIndexStats`. `segmentPairs`, `containmentPairs`,
  `overlappingPairs`, `intersection`, the first-error rule, the
  `buildLoops` and `buildProfileLoops` signatures and results, `CadLoop`
  and the `pcb-outline.ts` caller are unchanged.
- `scene.ts`. `containsPoint` keeps its predicate and uses the index of
  its `LoopEntry`, built lazily at most once per entry per
  `normaliseToolLoops` call and stored on that local entry. The bucket
  grid, probe order, `ancestorProbes`, `indexEntries`, kept-loop order,
  the return value of `normaliseToolLoops` and `prepareCadCapture` are
  unchanged. Its stats parameter gains an optional
  `edges?: EdgeIndexStats`.
- One module, two index instances. `loops.ts` indexes grid outlines and
  `scene.ts` indexes the counter-clockwise millimetre `CadLoop.points`.
  `CadLoop` cannot carry an index without changing its shape, so each
  pass builds its own, once per contour.

Detailed-rim fixture (both tests). One sketch with a plate from x = 0 to
256. Its bottom edge is y = 0 and its left and right sides are vertical.
Its top is H `cad.line` segments from `(256 i / H, y_i)` to
`(256 (i + 1) / H, y_(i+1))`, with `y_i = 512` for even i and `513` for
odd i, so P = H + 3 lines. It also has H circles of radius 1 at
`(2.5 + 3 (k % 64), 2.5 + 3 floor(k / 64))`. Sizes: H = 256, 512, 1024.
Each test file builds it with its own element helpers.

Tests (appended; existing tests unchanged and passing):

- `packages/core/src/cad/loops.test.ts`, "a detailed rim with many holes
  queries the perimeter through one edge index". For each H,
  `buildLoops(entities, undefined, stats)` with `stats = { segmentPairs:
  0, containmentPairs: 0, edges: { builds: 0, visits: 0, inspections: 0
  } }` returns H + 1 loops: one at depth 0 whose members contain a rim
  line, and H at depth 1. Each of the three edge counters is positive.
  `builds` is at most the sum of the edge counts of the returned loops, so
  no contour is built twice. `inspections <= 4 * H`. Per doubling,
  `builds + visits + inspections` grows by at most 2.5 times. Before the
  fix the counters stay 0, so the test fails (the old predicate reads
  H(H+3) edges).
- `packages/core/src/capture/scene.test.ts`, "normalisation queries the
  detailed rim through one edge index". For each H, the fixture's loops
  (through the file's `selectedLoops` helper) go through
  `normaliseToolLoops` with `stats = { ancestorProbes: 0, indexEntries:
  0, edges: { builds: 0, visits: 0, inspections: 0 } }`. The result equals
  `oracleNormalise` element by element, and `indexedSceneBytes` of both
  are equal. The same counter assertions apply: `builds` is at most the
  total edge count of the input loops, `inspections <= 4 * H`, and growth
  is at most 2.5 per doubling. Before the fix the counters stay 0, so the
  test fails.
- Kept unedited and passing: touching contours and first-error identity
  (`loops.test.ts` "touching or overlapping contours count as an
  intersection" and "intersection reports the first segment in the
  original nested scan"), nesting depth, the round-8 two-row and
  single-row tests, `pcb-outline.test.ts`, and in `scene.test.ts` the
  omitted-intermediate-ancestor tests ("omits leading odd levels ...",
  the `nestedSelections` table, "finds the containing ancestor among two
  disjoint islands ...") and the oracle and scene-byte checks of
  `checkIndexedLoops`.

R9-2 `function-mcp-inline-image-replaced-before-readback` (medium).

Cause. Both MCP servers build the inline attachment by reopening the
output path after the command returns. In `apps/cli/src/mcp.ts` the write
wrapper (about 100-103) keeps only the path and `inlineContent` reads it
(about 40). In `apps/cli/native/src/mcp.rs`, `read_inline_image` (about
75-90) runs from `capture_content` after `engine::run`. Another writer can
replace the file in between.

Rule. The attachment is the call's own write. At a successful write the
server takes a per-call record `{ path (absolute), byteLength, bytes when
byteLength <= 1,048,576 }` and builds the attachment from it.

- Recording. Only inline calls record. Only the outcomes `written` and
  `identical` record; `exists` and a thrown write do not. A later recorded
  write in the same call replaces the earlier record, which is today's
  "last successful write" rule for `writtenPath`. The bytes are the array
  that the command passed to the write.
- Content (both servers; order and texts unchanged). If the exit code is
  not 0 or 1, or there is no record, no block is added (failed-write
  suppression). Otherwise the stdout path (`capturedImage` /
  `captured_image`, unchanged) must equal the record's path; if it does
  not, the existing "could not read the written path from capture output.
  Try --json." note is added. When stdout has no path, Bun still adds that
  note and native still adds no block (today's behaviour of each). Native
  also keeps its `capture_path_matches` check before the comparison. Then
  `byteLength > 1,048,576` gives the existing "Image not inlined: <n>
  bytes exceed 1048576. ..." text; otherwise the block is an image with
  the base64 of the recorded bytes and the MIME type from the extension.
  `structuredContent`, `isError`, exit codes and path reporting are
  unchanged.
- Bun (`apps/cli/src/mcp.ts`). The per-request `capture.write` wrapper
  stores the record. It keeps a reference to `bytes` without copying, and
  for an oversize image only the length. `inlineContent` takes the record
  instead of a reader. The third parameter of `createMcpServer` becomes an
  options object, `{ run?: typeof runCliAsync }` (default `runCliAsync`).
  `run` is a test seam that lets tests control the written bytes and the
  write order. `readLocalInlineBytes` and the reader are removed, and
  `serveMcp` passes no options. Callers that pass two arguments
  (`cad-command.test.ts`, `mcp.test.ts`) are unaffected.
- Bun staging inside p3 (so the regression fails on the old readback, not
  on a signature). Stage 1 changes only the parameter: the options object
  is `{ readInlineBytes?, run? }`. `readInlineBytes` defaults to
  `io.readBytes` as today, `serveMcp` passes `{ readInlineBytes:
  readLocalInlineBytes }`, `execute` calls `run` instead of `runCliAsync`,
  and the path readback is unchanged. The new two-writer test, which passes
  only `{ run }`, is added and run. The plan records that both writes
  complete, both responses report exit 0, and A's attachment equals B's
  bytes, so the test fails on A's byte comparison. Stage 2 adds retention,
  removes `readInlineBytes` and `readLocalInlineBytes`, and reruns the same
  unchanged test, which passes both byte comparisons.
- Native (`apps/cli/native/src/engine.rs` and `mcp.rs`). `HostState`
  gains `retain_capture: Cell<bool>` and
  `capture: RefCell<Option<CaptureWrite>>`, with
  `pub struct CaptureWrite { pub path: PathBuf, pub len: u64,
  pub bytes: Option<Vec<u8>> }`. When `retain_capture` is set, the
  `writeCapture` host op computes `std::path::absolute` of its path
  argument before writing. That argument is already `native.path(...)`, so
  the result equals `captureAbsolute`. After a `written` or `identical`
  result the op stores the record and moves into it the `Vec<u8>` it
  already copied out of Boa. There is no second copy and no per-byte work
  in JavaScript. A new
  `pub fn run_inline(args, input) -> (CommandResult, Option<CaptureWrite>)`
  shares the body of `run` with retention on, and takes the record from
  the context after `execute`. It is built from two crate-internal
  helpers that the tests also use: `inline_context(input, directory)`
  (`context` with `retain_capture` set) and
  `take_capture_write(&Context) -> Option<CaptureWrite>`. `run` keeps its
  signature and never retains. `CommandResult` and its serialization are unchanged, so the
  bytes never enter it. The inline limit constant moves to `engine.rs` as
  `pub(crate) const MCP_INLINE_MAX_BYTES: usize = 1_048_576`, and `mcp.rs`
  uses it. `call_tool` calls `run_inline` when `wants_inline_image(&args)`
  and `run` otherwise. `capture_content(args, output,
  written: Option<&CaptureWrite>)` builds the block as above.
  `read_inline_image` is removed. The per-server mutex is unchanged.
- Native staging inside p4 (so the regression fails on the old readback,
  not on compilation). Stage 1 adds the engine retention, the two helpers
  and `run_inline`, and gives `capture_content` the `written` parameter.
  It uses the parameter only for presence (no record means no block) and
  still builds the image with `read_inline_image` from the path. The new
  two-context test is added and run, and the plan records that it fails on
  A's byte comparison (A's attachment equals B). Stage 2 builds the block
  from the record, removes `read_inline_image`, and reruns the same
  unchanged test, which passes both byte comparisons.

Tests (fail before, pass after; existing assertions kept):

- `apps/cli/src/mcp.test.ts`, new "MCP inline capture attaches each call's
  own write". Two servers from `createMcpServer(io, "test", { run })`, one
  per call, share one memory `io`. Its `capture.write` stores into a map and its `readBytes`
  returns the current map entry, so a readback would see the replacement.
  Images A and B have equal length and different content. Fake run A
  writes A to `/mock/shared.png`, resolves a barrier, waits until B has
  written, then returns `path: /mock/shared.png`. Fake run B waits for A's
  write, writes B to the same path and returns. Both calls report exit 0.
  The map entry for the shared path then holds B. A's decoded attachment
  equals A and B's equals B. Before stage 2 (see the Bun staging above) it
  fails because A's attachment equals B. The same test also checks, with one server
  each: exit 1 after a write (image present, `isError` true,
  `structuredContent` equal to the fake result); an inner write that
  returns `identical` (image equal to the call's bytes); an inner write
  that returns `exists` with exit 2, and an inner write that throws (one
  content block only); exactly 1,048,576 bytes (an image whose decoded
  length is 1,048,576); 1,048,577 bytes (text containing "1048577 bytes
  exceed 1048576"); and a `.jpg` path (`image/jpeg`).
- `apps/cli/src/mcp.test.ts`, existing "MCP capture appends opt-in images
  and read notes while preserving the CLI result". Its `large` and
  `unreadable` scenarios, whose fake `readBytes` returns other data or
  throws, now expect an image equal to `direct.bytes.get(path)` (the
  call's own bytes), and `reads` must be `[]` (no readback). All other
  scenarios and assertions are unchanged. The oversize note moves to the
  new test above, with a real 1,048,577-byte write.
- `apps/cli/native/src/engine_tests.rs`, new "capture writes are retained
  per call only when inline". In a context with `retain_capture` set:
  `native.writeCapture` of a 1,048,576-byte array records `len` 1,048,576
  with equal bytes and the absolute path; a 1,048,577-byte write records
  only `len` (`bytes` is None); an `identical` write records; an `exists`
  write leaves the previous record; a write into a missing directory
  throws and records nothing. With `retain_capture` unset, nothing is
  recorded.
- `apps/cli/native/src/mcp.rs` tests, new
  `inline_capture_attaches_each_calls_own_write`. Two independent
  invocation contexts, A and B, come from `engine::inline_context` on the
  same temporary folder. Both write the explicit path
  `<tmp>/shared.png` through the real `writeCapture` host op with
  `replace` true. A is 4,096 bytes with `A[i] = i & 255`, and B is 4,096
  bytes with `B[i] = 255 - (i & 255)`. Each context builds its array in
  the evaluated script (`Uint8Array.from({ length: 4096 }, ...)`), and the
  test computes the same expected arrays in Rust, so they have equal length
  and different content. Order: A
  writes, and the test saves A's bytes; then B writes, and the test saves
  B's bytes; then both responses are built. Each record is taken with
  `take_capture_write`. Each response is built by
  `capture_content(args, output, Some(&record))`, where `args` is
  `capture doc.jsonl --inline --output <tmp>/shared.png` and `output` is
  exit 0 with stdout `path: <tmp>/shared.png`. Assertions: the file at the
  shared path equals B; A's decoded attachment equals A's saved bytes and
  B's equals B's. With stage 1 readback, A's comparison fails (A receives
  B), and the plan records that run. A second new test,
  `run_inline_retains_the_written_capture`, runs a real
  `capture <doc> --inline --json --output <tmp>/one.png` on a one-element
  freeform document through `engine::run_inline`. It checks that the
  record's bytes equal the file and its `len` equals the reported
  `bytes`, which covers the wiring of `run_inline`. The existing
  `inline_capture_preserves_exit_one_and_checks_file_size_and_path` now
  passes records instead of files and keeps every assertion: an exit-1
  image of exactly 1,048,576 bytes with `image/jpeg`, the 1,048,577 note,
  "Try --json", and no block at exit 2.
  `explicit_output_is_matched_inside_the_cwd_folder` stays unedited.
- `apps/cli/src/mcp-stdio.test.ts` stays unedited. Its single-call
  comparison with the file on disk is still valid.

### 27.2 Plan grouping

Plans `car9-*` run in one wave, except for one real dependency. Each plan
has a non-empty `acceptanceCriteria`, sets `artifactRoots ["target",
"tmp/cad3d"]` exactly, keeps evidence under `tmp/car9-r9/<planId>/`, uses
its own `CARGO_TARGET_DIR=target/car9-<plan>`, lists every edited file
(its plan and progress files included) in `writePaths`, and leaves no
`*.test.ts` under `target/` or `tmp/`. Each plan first adds its test and
records the failing run, then applies the fix and records the passing run.
p3 and p4 do this through the two stages described in 27.1, so the
recorded failure is A receiving B's bytes, not a type or compile error.
Focused regression commands for those runs:
`bun test apps/cli/src/mcp.test.ts --test-name-pattern '^MCP inline capture attaches each call.s own write$'`
and
`CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car9-p4 cargo test -p nodetto-cli inline_capture_attaches_each_calls_own_write`.
Each runs exactly one case. The stage 1 failure log is evidence only and
is never listed as a gate.
This revision already updates sections 4.5 and 11, so no plan edits this
document.

| Plan | Rule | Owns | dependsOn |
| --- | --- | --- | --- |
| car9-p1-edge-index-loops | R9-1 index and depth pass | new `packages/core/src/cad/edge-y-index.ts`, `packages/core/src/cad/loops.ts`, `packages/core/src/cad/loops.test.ts` | - |
| car9-p2-scene-edge-index | R9-1 ancestor pass | `packages/core/src/capture/scene.ts`, `packages/core/src/capture/scene.test.ts` | p1 |
| car9-p3-mcp-bun | R9-2 Bun | `apps/cli/src/mcp.ts`, `apps/cli/src/mcp.test.ts` | - |
| car9-p4-mcp-native | R9-2 native | `apps/cli/native/src/engine.rs`, `apps/cli/native/src/mcp.rs`, `apps/cli/native/src/engine_tests.rs` | - |

Gates (each exits 0 and runs its new test):

- p1: `bunx biome check packages/core/src/cad/edge-y-index.ts packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts && bun test packages/core/src/cad/loops.test.ts packages/core/src/cad/pcb-outline.test.ts`.
- p2: `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts`.
- p3: `bunx biome check apps/cli/src/mcp.ts apps/cli/src/mcp.test.ts && bun test apps/cli/src/mcp.test.ts apps/cli/src/mcp-image.test.ts apps/cli/src/mcp-stdio.test.ts`.
- p4: `CARGO_TERM_QUIET=true cargo fmt -p nodetto-cli -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car9-p4 cargo clippy -p nodetto-cli --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car9-p4 cargo test -p nodetto-cli`.

At most two `bun test` or `cargo test` processes run at once.

Integration runs once after all plans land, in this order and under the
round-8 timing rule:

1. `bun run typecheck`, `bun run lint`, and `CARGO_TERM_QUIET=true mise
   run verify`. Goldens are checked and never regenerated.
2. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`, then,
   with `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli"`,
   `bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/mcp-stdio.test.ts`.
   This covers native CAD determinism and parity, and inline capture over
   stdio with the compiled binary.
3. No `*.test.ts` remains under `target/` or `tmp/`.

### 27.3 Decisions

- R9-1 uses a max-augmented static tree over edges sorted by `lo`, the
  same structure as R8-1, instead of an interval tree or Y buckets. A query
  costs O((k + 1) log n) for any edge lengths, and the code shape has
  already been reviewed.
- R9-1 returns a closed superset and leaves the exact predicate with each
  caller, so endpoint conventions, horizontal edges and numeric
  representation cannot drift.
- R9-1 builds indexes lazily, once per contour per pass. The two passes do
  not share instances, because `CadLoop` keeps its shape.
- R9-1 counters are an optional nested `edges` object, so the existing
  stats literals in tests and callers type-check unchanged.
- R9-2 keeps a reference to the command's own array in Bun and moves the
  already-copied `Vec<u8>` in native. Inline calls retain at most 1 MiB
  each; other calls retain nothing.
- R9-2 turns the third parameter of `createMcpServer` into an options
  object with a `run` seam, because no real renderer can produce on demand
  two different images of equal length, or an image of exactly 1,048,576
  bytes. The object form lets stage 1 keep the old reader next to the seam,
  so the same test shows the readback failure before retention and passes
  after it (step-3 review car9-design-bun-regression-baseline).
- R9-2 native proves isolation with two independent invocation contexts
  that write the same path through the real host op. Both responses are
  built after both writes, so a record that one invocation replaced or
  consumed in another would fail a byte comparison. Stage 1 keeps the
  readback, so the failure is functional (step-3 review
  car9-design-native-two-call-coverage). Contexts are used instead of two
  real renders, because real renders cannot produce equal-length images on
  demand.
- R9-2 keeps native `capture_path_matches` and its test. The record
  comparison makes it redundant, but the fix does not need to remove it.
- Sections 4.5 and 11 are updated in this revision. `docs/capture.md`
  already states the intended behaviour and is not edited.
- No user decision is pending, so there is no `design-docs/user-qa/` file.

### 27.4 Intentional differences from the workflow input

- The intake gives the 4.5 and 11 edit to the Bun MCP plan. This design
  step makes it instead, so no implementation plan edits this file and P3
  and P4 stay disjoint.
- The `large` and `unreadable` scenarios and the `reads` list of the
  existing Bun capture test assert the readback that R9-2 removes. They
  become stronger per-call assertions: the call's own bytes despite a
  misleading or failing `readBytes`, and zero reads. The oversize note
  moves to a real 1,048,577-byte write. No scenario is deleted and no
  bound is loosened.
- The existing native inline test changes only its fixture (records
  instead of a file on disk); every assertion stays.
- Per-plan gates leave out `bun run typecheck` and `mise run verify`;
  those run once at integration.

### 27.5 Risks

- `cargo test -p nodetto-cli` bundles the TypeScript sources. While p1 or
  p2 is mid-edit in the shared tree, the p4 gate can fail for an
  unrelated reason. p4 is then rerun after p1 and p2 settle; such a
  failure is not a p4 defect.
- If the edge query missed or duplicated an edge, parity would flip. The
  oracle comparison, the scene-byte checks and the existing first-error,
  touching and nesting tests guard against this.
- The 2.5 growth bound carries a log factor (expected about 2.1 to 2.3).
  If it fails after a correct fix, the plan reports the counts and never
  relaxes the bound.
- Not measured: Boa elapsed time, desktop latency, peak memory, how often
  the race happens across real OS processes, and Tauri delivery. Compiled
  native MCP and JPEG inline delivery are covered only by the integration
  step and the `.jpg` cases of the tests above.

## 28. Revision 17: audit round 10 corrections

Source: audit round 10 of the 3D CAD pages and AI capture, base `0a35708`
to `43197ca`. Four findings, none deferred. No GitHub issue exists; the
round-10 workflow input is the issue body. Where an earlier section and
this one disagree, this section wins. The common rules of section 24 and
the timing rule of 26.2 still apply. Each fix needs a regression test that
fails before the change and passes after it in this tree. Performance is
asserted with deterministic work counters, never clocks. Bytes, goldens,
error codes, NCS1 layout, first-error identity, loop order, PCB-outline
results and the CLI, MCP and desktop contracts stay unchanged unless a
rule below says otherwise.

### 28.1 Rules

R10-1 `function-capture-failed-create-removes-successful-replacement`
(medium).

Cause. `write_new` (`crates/native/src/fs.rs:25-46`) and Bun `writeNew`
(`apps/cli/src/capture-io.ts:100-124`) create the public path
exclusively, write and sync it, and on failure unlink the public path.
Another invocation's forced replacement can publish into that path in
between: `replace_regular` calls `write_to_entry` and then `persist`, and
`writeCapture` calls `writeEntryAtomic` and then `renameSync`. The unlink
then deletes the other writer's completed capture.

Rule. A new capture is not visible at the public path until it is
complete. A failing invocation removes only the entry it owns.

1. Pre-check. `lstat` the target. If an entry exists (a link, a dangling
   link, a directory or a file), return today's identical-versus-exists
   decision (`existing_matches` / `existingMatches`) without staging
   anything. If the target is absent, continue. Any other lstat error is
   returned. This keeps the common repeat capture, whose default name is
   digest-based, a no-op, and keeps links refused.
2. Staging. Create a sibling staging file in the target's parent
   directory, exclusively, with today's creation mode (0o666 filtered by
   the umask). Write the bytes to it and sync it.
   The staging basename has a fixed short length that does not depend on
   the target basename. Any target name the old direct create accepted
   therefore still works (a 255-byte basename on a NAME_MAX = 255
   filesystem, for example).
   - Rust: `tempfile::Builder` with `permissions(0o666)` on unix, as
     `write_to_entry` does, and tempfile's default short random name
     (no prefix derived from the target), then `tempfile_in(parent)`.
     tempfile is already a dependency, so no new license is needed.
   - Bun: the name is `.nodetto-<16 hex>.tmp` (27 bytes; the hex comes
     from `randomBytes(8)`). It is joined to the parent by a new exported
     helper `siblingPath(target, name)` in `apps/cli/src/write-atomic.ts`.
     The helper is the parent-joining code that `writeEntryAtomic`
     already has, so parent traversal stays intact. `writeEntryAtomic`
     calls it with its own unchanged name. The file is opened with
     `openSync(staging, "wx", 0o666)`, written with
     `writeFileSync(descriptor, bytes)` (the existing test seam), then
     `fsyncSync` and `closeSync`.
3. Publish without clobbering. This is the only way a new capture reaches
   the public path; there is no direct-create fallback.
   - Rust: `NamedTempFile::persist_noclobber(path)`.
   - Bun: `linkSync(staging, path)`.
   - When publishing reports that the target already exists (Rust
     `ErrorKind::AlreadyExists`, Bun `EEXIST`), return the decision of
     step 1 for the public path.
   - Any other publish error is returned unchanged after cleanup (step
     4). The CLI reports it as today's `Cannot write <path>: <message>`
     with exit 2, and nothing is written to the public path.
   - Support depends on the backend, because the primitives differ:
     - Rust (the native CLI's `write_new`, reached through
       `write_capture` in `apps/cli/native/src/files.rs:67-76`) publishes
       wherever tempfile 3.27's
       `persist_noclobber` has a primitive. That is a no-clobber rename
       first (Linux `renameat2` `RENAME_NOREPLACE`, Apple `renamex_np`
       `RENAME_EXCL`), then a hard link where the rename is unavailable.
       Windows uses `MoveFileExW` without `MOVEFILE_REPLACE_EXISTING`. So
       Rust can publish onto a filesystem that has only one of these, for
       example Linux VFAT, which implements `RENAME_NOREPLACE` but has no
       hard links.
     - Bun (reference host) publishes only by hard link. Node offers no
       no-clobber rename. A filesystem without hard links therefore
       rejects a new Bun capture, even where Rust succeeds.
     - Neither backend picks a different primitive at run time or adds a
       platform adapter. 4.3 and 12 state the per-backend boundary.
     - Out of scope: desktop export. It saves through
       `write_export_atomic` and then `write_selected_file_atomic`
       (`apps/desktop/src-tauri/src/fs.rs`, `crates/native/src/fs.rs`),
       which R10-1 does not edit. Its support and UI error path stay as
       in section 13. p1 must not touch that writer.
4. Cleanup ownership. Every exit after step 2 created the staging file
   removes that staging file, and nothing else.
   - Rust: drop the `NamedTempFile` or `PersistError::file`.
   - Bun: `unlinkSync(staging)` in a `finally`, ignoring its error. After
     a successful `linkSync` this removes the staging name.
   - The original write, sync or publish error is returned unchanged.
     `write_new` and `writeNew` never create, write or unlink the public
     path directly, on any path.
5. Unchanged:
   - the `NewFile` / `"written" | "identical" | "exists"` results;
   - `replace_regular` and the Bun forced path for an existing regular
     file. Their NotFound branch goes through `write_new` / `writeNew`
     and so gets this rule.
   - link refusal and the readonly-directory `PermissionDenied` kind;
   - permissions of a new file;
   - `apps/cli/native/src/files.rs`, the MCP result and the image bytes.
6. Test seams.
   - Rust keeps `write_new_with(path, bytes, write_contents)` with its
     signature. It delegates to a crate-internal
     `write_new_inner(path, bytes, write_contents, publish)`, where
     `publish: impl FnOnce(NamedTempFile, &Path) -> Result<(), PersistError>`
     defaults to `|file, path| file.persist_noclobber(path).map(drop)`.
   - Bun needs no new seam (`spyOn(fs, ...)` with the original function
     saved first).

Tests (each new test fails before the fix and passes after it):

- `crates/native/src/fs.rs` tests, new
  `failed_new_capture_keeps_a_concurrent_forced_replacement`.
  - Setup: path `<tmp>/image.png` is absent, and `B` is
    `b"replacement capture"`. Call
    `write_new_with(&path, b"capture", |file| { file.write_all(b"cap")?; replace_regular(&path, B).unwrap(); Err(io::Error::other("injected write failure")) })`.
  - Assert: the error text is `injected write failure`, `fs::read(&path)`
    equals `B`, and the directory's entry names are exactly
    `["image.png"]`.
  - Before the fix, B replaces A's partial public file, A's cleanup
    deletes B, and the read fails.
- `crates/native/src/fs.rs` tests, new
  `failed_publish_keeps_a_concurrent_forced_replacement`.
  - Path `<tmp>/image.png` is absent. Call
    `write_new_inner(&path, b"capture", |file| file.write_all(b"capture"), publish)`.
    The injected `publish` first runs `replace_regular(target, B)`
    (asserting `Ok`), then returns
    `Err(PersistError { error: io::Error::new(io::ErrorKind::Unsupported, "injected publish failure"), file })`.
  - Assert: the error kind is `Unsupported` with the text `injected
    publish failure`, `fs::read(&path)` equals `B`, and the directory's
    entry names are exactly `["image.png"]` (the staging file is gone).
  - This covers the unsupported-filesystem outcome together with a
    competing writer.
- `write_new_removes_a_partly_written_file_on_error` and every assertion
  in `crates/native/tests/file_contract.rs` stay unedited and pass.
- `apps/cli/src/capture-io.test.ts`, new "a failed new capture keeps a
  concurrent forced replacement".
  - Save `const original = fs.writeFileSync` before `spyOn`. The mock's
    first call writes `cap` to its descriptor. It then checks that
    `captureIo.write(image, B, true)` returns `"written"`, and throws
    `failure`. Later calls delegate to `original`.
  - Assert: the outer call throws `failure`, `readFileSync(image)` equals
    `B`, and `readdirSync(folder)` equals `["image.png"]`.
  - Before the fix, B's `writeEntryAtomic` renames over A's partial file,
    and A's unlink deletes it.
- `apps/cli/src/capture-io.test.ts`, new "a failed publish keeps a
  concurrent forced replacement".
  - Save `const originalLink = fs.linkSync` before
    `spyOn(fs, "linkSync")`. The mock's first call checks that
    `captureIo.write(image, B, true)` returns `"written"`, then throws
    `publishFailure`, an `Error` with code `ENOTSUP`. Later calls
    delegate to `originalLink`, which B's own publish needs.
  - Assert: the outer call throws `publishFailure`, `readFileSync(image)`
    equals `B`, and `readdirSync(folder)` equals `["image.png"]`.
  - Before the fix `linkSync` is never called, so the test fails on the
    mock call count, which is asserted to be at least 1.
- `apps/cli/src/capture-io.test.ts`, new "a new capture accepts a
  near-limit basename". This guards behaviour; it passes before and
  after.
  - The target is `join(folder, "a".repeat(251) + ".png")` (255 bytes).
    A direct `writeFileSync` probe of a different 255-byte name in the
    folder (removed afterwards) decides support. The test returns early
    only if that probe fails with `ENAMETOOLONG`, so it runs on APFS,
    ext4 and tmpfs.
  - Assert: `captureIo.write(target, bytes, false)` returns `"written"`,
    the file holds the exact bytes, and the folder equals the target
    name alone.
- Existing test "capture removes a partly written file and returns the
  write error". One in-mock line,
  `expect(readFileSync(image, "utf8")).toBe("cap")`, asserts partial
  bytes at the public path, which R10-1 forbids. It becomes two checks:
  `lstatSync(image)` throws `ENOENT`, and the folder's single entry (name
  starting `.nodetto-`) holds `cap`. The thrown `failure`, the single
  call and the empty folder at the end stay unedited. See 28.4.
- `apps/cli/src/write-atomic.test.ts` stays unedited and passes.

R10-2 `performance-cad-containment-crossings-outside-ray` (high).

Cause. `forEachEdgeAtY` (`packages/core/src/cad/edge-y-index.ts:44-75`)
prunes only by Y. `contains` in `loops.ts` and `containsPoint` in
`scene.ts` therefore run their exact predicate on every edge at the query
height, including edges behind the ray origin. On a rim with T slots left
of H holes that is H(2T + 2) inspections per pass.

Rule. The index returns the crossing parity of the rightward ray from
`(x, y)` itself.

- Indexed edges. Only non-horizontal edges are indexed. A horizontal edge
  never satisfies `ay > y !== by > y`, so neither predicate counts it
  today. Edge numbering, the `(lo, e)` sort, lazy builds and
  `builds += n` per index (n = contour vertices) are unchanged.
- Node data. Array layout, typed arrays allowed. Each node stores
  `maxHigh` (existing), `minHigh`, `minX` and `maxX` over its edges'
  endpoint X. Padding leaves are neutral (+inf, +inf, -inf). A node's
  real-leaf count and its largest `lo` follow from its leaf range.
- Query:
  `crossingParity(index, x, y, exact: (edge) => boolean, stats?): boolean`.
  - `limit` is the number of leaves with `lo <= y`.
  - Skip a node when `start >= limit`, `maxHigh <= y` or `maxX < x`.
  - Resolve an internal node in bulk when `min(end, m) <= limit`,
    `minHigh > y` and `minX > x` (m = indexed edges). The parity flips
    when its real-leaf count is odd.
  - Otherwise inspect a leaf with `exact(edge)`, or descend into an
    internal node.
  - Leaves are never resolved in bulk, so `inspections` keeps counting
    exact work, and the round-9 "each counter positive" assertions hold.
- Exactness. `ay > y !== by > y` is exactly `lo <= y < hi`, and the
  crossing X of such an edge lies within its endpoint X range. Both
  callers use the grid predicate
  `gridCross(bx - ax, by - ay, x - ax, y - ay) > 0 === by > ay`. It
  counts an edge whose crossing is right of `x`, never one left of `x`,
  and decides a crossing at exactly `x` by direction. Skipping on strict
  `maxX < x` and bulk on strict `minX > x` are therefore exact, and ties
  go to `exact`. `scene.ts` gets this predicate from R10-4, so R10-2's
  scene plan follows R10-4.
- Counters. `EdgeIndexStats` gains an optional `bulk?: number`, which
  grows by 1 per bulk-resolved node when present. `visits` grows by 1 per
  node entered, including skipped and bulk nodes. `inspections` grows by
  1 per `exact` call. Existing stats literals still type-check.
- Callers keep their bounds early exits and lazy indexes. `contains`
  (`loops.ts`) and `containsPoint` (`scene.ts`) call `crossingParity`
  with their own predicate. Once both callers have moved,
  `forEachEdgeAtY` is removed.

Slotted-rim fixture. It is original and built in each test file with
that file's helpers. All elements are `cad.line`. Each contour is a
vertex list in counter-clockwise order (original orientation). Line j of
a contour runs from vertex j to vertex j + 1 (wrapping). Ids are
zero-padded and lexically ordered, because `buildLoops` sorts ids as
strings (`loops.ts:469-471`) and walks contours in that order
(`:538-543`). Plate lines are `a<jjjjj>` in list order, and hole k's
lines are `h<kkkkk>-<j>`. Since `a` sorts before `h`, the plate comes
first. Both test files use this same id contract in both orientations.
`buildLoops` therefore returns the plate first, then holes by k, and
walks every contour from its first listed vertex, in list order.

- Plate. W = 2T + 136. Vertex list:
  - (0,0), (W,0), (W,100), (2T,100);
  - then for i = T - 1 down to 0: (2i + 2, 10), (2i + 1, 10),
    (2i + 1, 100), (2i, 100);
  - the last of these is (0,100), and the closing line returns to (0,0).
  - So slot i spans x = 2i + 1 to 2i + 2 and reaches down to y = 10.
- Holes. H squares of 1 mm. Hole k has the vertex list (x0,y0),
  (x0+1,y0), (x0+1,y0+1), (x0,y0+1), where
  x0 = 2T + 4 + 2 (k % 64) and y0 = 12 + 2 floor(k / 64). H <= 2048
  keeps every hole below y = 76.
- Each hole's query height meets the two sides and the 2T slot sides.
  Only the right side is ahead of the ray origin.
- Mirrored orientation: x -> W - x for every vertex, with the same ids
  and list order. Then the 2T + 1 crossings ahead are genuine.
- Independent expectation, built only from the vertex lists, never from
  `buildLoops` or `normaliseToolLoops` output:
  - Loop order: the plate, then holes k = 0..H-1.
  - Depths: 0 for the plate, 1 for every hole.
  - Points: the original orientation lists its vertices as given
    (already counter-clockwise). A mirrored list v0..v(n-1) is clockwise,
    so it is expected as v0, v(n-1), ..., v1, the order
    `counterClockwise` produces for a clockwise outline.
  - Retained capture loops: all of them, because every hole's depth
    parity differs from the plate's.

Tests (new; existing tests unedited):

- `packages/core/src/cad/loops.test.ts`, "a slotted rim resolves hole
  containment without scanning crossings behind the ray".
  - Run both orientations at (T, H) in {(256,256), (512,256), (256,512),
    (512,512)} through `buildLoops(entities, undefined, stats)`. `stats`
    has `edges: { builds: 0, visits: 0, inspections: 0, bulk: 0 }`.
  - Loops: H + 1. Each loop's depth and exact `points` array equal the
    independent expectation, in order.
  - Work bounds, with q = visits + bulk + inspections:
    - q <= 16 H log2(4T + 4);
    - q(512,256) / q(256,256) <= 1.5 (T doubles, H fixed);
    - q(512,512) / q(256,256) <= 2.5 (both double);
    - `builds` is at most the total edge count of the returned loops.
  - Before the fix, `inspections` alone is H(2T + 2), which breaks the
    first two bounds in both orientations.
- `packages/core/src/capture/scene.test.ts`, "normalisation resolves
  slotted-rim holes without scanning crossings behind the ray". Same
  fixture, sizes and bounds, run through `selectedLoops` and
  `normaliseToolLoops`.
  - Ordered output: the retained loops' `points` arrays equal the
    independent expectation, in order.
  - Bytes: the actual retained loops' `indexedSceneBytes` equal the bytes
    serialized from the expected point lists with the same writer and
    camera. The file's serializer gets a points-only form
    `sceneBytesOfPoints(points[])`, and `indexedSceneBytes` delegates to
    it.
  - Ancestry: the result also equals `oracleNormalise` of the same
    input, as a separate check.
- Kept passing: the round-9 detailed-rim tests in both files, the round-8
  tests, first-error, touching and nesting tests, and
  `pcb-outline.test.ts`.

R10-3 `performance-cad-profile-depth-enumerates-all-ancestors` (medium).

Cause. The depth pass (`loops.ts:556-594`) runs `contains` on every pair
of contours whose boxes overlap. A chain of N nested contours has
N(N - 1)/2 such pairs, even when the extrusion selects only two loops.

Rule.

- New internal module `packages/core/src/cad/loop-forest.ts`. It is not
  re-exported and imports only `./vec.ts`. Its API is
  `loopForest(grids, windings, stats?): { parents: number[]; depths: number[] }`,
  where `grids` and `windings` come from `Profile`. It returns each
  contour's immediate parent index (or -1) and its nesting depth. Its
  precondition is what `intersection()` guarantees: the contours neither
  cross nor touch.
  `ForestStats { events: number; steps: number }`.
- Sweep. Move upward through the distinct Y values of the vertices.
  - The active set holds the non-horizontal edges with `lo <= y < hi`,
    ordered left to right just above `y`. It is a treap whose priorities
    are an integer hash of the insertion number, so it is deterministic
    and expected O(log E) per operation.
  - At each Y, in this order:
    1. remove edges with `hi = y`;
    2. insert edges with `lo = y`;
    3. in increasing x, answer each contour whose lowest-then-leftmost
       vertex v lies at that Y.
- Answer.
  - t is the rightmost active edge strictly left of v. The test is
    `gridCross` of v against t, which is never zero across contours. If
    no t exists, the parent is -1.
  - Otherwise Q owns t. v is inside Q exactly when t points downward in
    Q's counter-clockwise orientation: its stored direction is downward,
    XOR Q's winding is negative.
  - The parent is Q when v is inside Q, and Q's parent otherwise.
  - Q was answered before v, because its lowest vertex is lower, or at
    the same height and to the left.
  - Depth is resolved once, in the same answer step, from Q's
    already-resolved depth: no t gives 0, v inside Q gives depth(Q) + 1,
    and otherwise depth(Q). That is O(1) per contour. Nothing walks a
    parent chain, in the module or in `loops.ts`.
  - Why this is correct: the segment from t to v crosses no edge, so for
    every contour C other than Q, v is in C exactly when Q is in C.
- Edge order.
  - To compare two active edges s and t, take y_c = max(lo_s, lo_t).
    Test the lower endpoint at y_c against the other edge with
    `gridCross`.
  - A zero result means a shared lower endpoint, which only adjacent
    edges of one contour can have. In that case test one edge's upper
    endpoint against the other edge.
  - Removal searches with the same comparator plus edge identity.
- Counters. `events` grows by 1 per insert, removal and answer. The
  answer event includes the parent and depth resolution. `steps` grows by
  1 per comparison or tree node visited.
- Winding 0. A contour with winding 0 is treated as counter-clockwise.
  Its result is discarded, because the unchanged empty-profile check
  returns `cad.profile.empty` afterwards.
- Integration in `buildProfileLoops`, after the unchanged intersection
  validation:
  - Today's pair pass runs under a work budget of 32 E, where E is the
    total vertex count of all profiles.
  - Work is the pass's containment-pair count plus its edge-index builds,
    visits, bulk resolutions and inspections. It is always counted
    internally and added to `stats` when `stats` is given.
  - If the pass finishes within the budget, its depths are used, as
    today.
  - If not, `overlappingPairs` stops through a new optional `stop`
    callback (`intersection` passes none). The pass's depths are
    discarded and replaced by `loopForest(...).depths` as returned.
  - `LoopStats` gains an optional `forest?: ForestStats`.
  - Unchanged: `CadLoop` members, sources and order, all errors and
    their order, the signatures, and `pcb-outline.ts`.
  - 32 keeps ordinary sketches and the round-8, round-9 and R10-2
    fixtures on the pair path, and their counter assertions need that.
    The plan records each fixture's pair work against its budget. A
    nested chain leaves the pair path once N > 256.

Tests:

- `packages/core/src/cad/loop-forest.test.ts` (new).
  - Oracle: the smallest-area container, decided by an independent
    BigInt point-in-polygon determinant.
  - Fixtures: a nested rectangle chain; sibling islands inside holes;
    contours sharing vertex heights; rays through another contour's
    local-minimum and local-maximum vertex; triangles and diamonds in
    both windings.
  - Assert: parents and depths equal the oracle (depth = number of
    containers), and `events + steps` grows at most 2.5 times per
    doubling of the chain.
- `packages/core/src/cad/loops.test.ts`, "nested chains derive depth
  from immediate parents".
  - Fixture: N in {1025, 2049, 4097} rectangles. With S = 2N + 2, rect i
    has the counter-clockwise vertex list (i,i), (S-i,i), (S-i,S-i),
    (i,S-i). Each rectangle is four `cad.line` from vertex j to vertex
    j + 1, with zero-padded ids `r<iiiii>-<j>`. Loops therefore come
    back in rectangle order, starting at (i,i).
  - Selections, each checked at every N. Every returned loop's depth and
    exact `points` array must equal the expectation built from the vertex
    lists, in order:
    - all loops: N loops, rect i at depth i;
    - rect floor(N/2) omitted: N - 1 loops, the others keeping depth i;
    - sparse, rect 0 and rect N - 1: two loops at depths 0 and N - 1.
  - Work W = containmentPairs + edges.builds + visits + inspections +
    bulk + forest.events + forest.steps, where `forest.events` already
    counts each contour's one-time parent and depth resolution. The
    abandoned pair work is part of W. Assert W(2N) / W(N) <= 2.5 for
    each selection. Before the fix W grows about 4 times.
- `packages/core/src/capture/scene.test.ts`, "a sparse nested-chain
  selection keeps the 400-byte outer prism". This guards behaviour; it
  passes before and after.
  - Fixture: N = 1025, and the extrusion selects one line of rect 0 and
    one of rect N - 1.
  - Assert: `prepareCadCapture` gives a 400-byte scene whose only loop
    has rect 0's four corners.
- Kept passing unedited: first-error identity, touching contours,
  nesting, the round-8 and round-9 tests, `pcb-outline.test.ts`, and the
  omitted-ancestor tests in `scene.test.ts`.

R10-4 `maintainability-capture-hole-containment-precision` (medium).

Cause. `containsPoint` in `scene.ts:105` interpolates the crossing in
floating-point millimetres. Sketch construction decides the same question
on the nanometre grid (`loops.ts:425-427`). For the fixture below the
grid determinant is +1, but the interpolated crossing equals the tip X,
so capture drops the hole.

Rule.

- `normaliseToolLoops` decides ancestry on the grid. Each `LoopEntry`
  gets `grid = loop.points.map((v) => Math.round(v * NM_PER_MM))`, the
  expression `makeProfile` uses on the same values that `buildLoops`
  already validated.
- Entry bounds, the bucket grid, the query vertex and the edge index all
  use `grid`.
- The predicate equals the one in `loops.ts`:
  `ay > y !== by > y && (gridCross(bx - ax, by - ay, x - ax, y - ay) > 0 === by > ay)`.
- Unchanged: the kept `CadLoop` objects with millimetre points in input
  order, `makeTool`, face numbering, NCS1 bytes, the all-depth-0 early
  return, lazy indexing, stats and public types.
- The test oracle in `scene.test.ts` (`containsPoint` at about 586-603
  and the `oracleNormalise` bounds) moves to the same grid with its own
  BigInt determinant, so it no longer repeats the floating-point
  comparison. Its existing callers keep their assertions.

Tests:

- `packages/core/src/capture/scene.test.ts`, "capture keeps a
  sloped-rim triangular hole decided on the nanometre grid".
  - An XY sketch with a rim loop
    [[970,0],[1000,0],[1100.000003,100.000001],[970,100.000001]] and a
    triangle [[1050.000002,50.000001],[1010,65],[1000,35]], all
    `cad.line`.
  - Three variants: the triangle starting at its first vertex, the
    triangle starting at (1010,65), and a solid control with no
    triangle.
  - Each variant extrudes all loops 5 mm into a new body, and
    `prepareCadCapture` runs at 256x256 with a top view.
  - Oracle: the BigInt determinant of the edge (1000,0) ->
    (1100.000003,100.000001) and the tip, in nanometres, equals +1.
  - Assert: both perforated variants keep tool loop vertex counts
    [3, 4] in order, and each scene's bytes differ from the control's.
  - The plan records the control's SHA-256, which is expected to be
    `4e79a49509e7e31ca09f07bc252b57affc87f814f798a5d13b22584843ca93b0`.
  - Before the fix, the first start keeps only [4] and matches the
    control.
- NCS1 goldens and digest tests stay unedited.

### 28.2 Plan grouping

Plans `car10-*` follow the 27.2 rules:

- a non-empty `acceptanceCriteria`;
- `artifactRoots ["target", "tmp/cad3d"]` exactly;
- evidence under `tmp/car10-r10/<planId>/`;
- its own `CARGO_TARGET_DIR=target/car10-<plan>`;
- `writePaths` that list every edited file, including the plan's own plan
  and progress files;
- no `*.test.ts` left under `target/` or `tmp/`.

Each plan first adds its regression and records the failing run, then
fixes and records the passing run. A failing log is evidence only and is
never a gate.

This revision already updates sections 4.3, 6.1, 12 and 27.1, so no
plan edits this document and R10-1 stays independent of the geometry
plans.

| Plan | Rule | Owns | dependsOn |
| --- | --- | --- | --- |
| car10-p1-capture-write-rust | R10-1 Rust | `crates/native/src/fs.rs` | - |
| car10-p2-capture-write-bun | R10-1 Bun | `apps/cli/src/capture-io.ts`, `apps/cli/src/capture-io.test.ts`, `apps/cli/src/write-atomic.ts` | - |
| car10-p3-scene-grid-ancestry | R10-4 | `packages/core/src/capture/scene.ts`, `packages/core/src/capture/scene.test.ts` | - |
| car10-p4-edge-index-ray-origin | R10-2 index and `loops.ts` | `packages/core/src/cad/edge-y-index.ts`, `packages/core/src/cad/loops.ts`, `packages/core/src/cad/loops.test.ts` | - |
| car10-p5-scene-ray-origin | R10-2 `scene.ts` and removal of `forEachEdgeAtY` | `packages/core/src/capture/scene.ts`, `packages/core/src/capture/scene.test.ts`, `packages/core/src/cad/edge-y-index.ts` | p3, p4 |
| car10-p6-loop-forest | R10-3 module | new `packages/core/src/cad/loop-forest.ts`, new `packages/core/src/cad/loop-forest.test.ts` | - |
| car10-p7-profile-depth-forest | R10-3 integration | `packages/core/src/cad/loops.ts`, `packages/core/src/cad/loops.test.ts`, `packages/core/src/capture/scene.test.ts` | p4, p5, p6 |

Waves: p1, p2, p3, p4 and p6 run first, then p5, then p7. In p4,
`scene.ts` keeps calling `forEachEdgeAtY`. That is still exact, because
dropping horizontal edges removes only edges its predicate never counts.

Gates (each exits 0 and runs its new tests):

- p1: `CARGO_TERM_QUIET=true cargo fmt -p nodetto-native -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car10-p1 cargo clippy -p nodetto-native --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car10-p1 cargo test -p nodetto-native`.
- p2: `bunx biome check apps/cli/src/capture-io.ts apps/cli/src/capture-io.test.ts apps/cli/src/write-atomic.ts && bun test apps/cli/src/capture-io.test.ts apps/cli/src/write-atomic.test.ts`.
- p3: `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts`.
- p4: `bunx biome check packages/core/src/cad/edge-y-index.ts packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts && bun test packages/core/src/cad/loops.test.ts packages/core/src/cad/pcb-outline.test.ts`.
- p5: `bunx biome check packages/core/src/cad/edge-y-index.ts packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts packages/core/src/cad/loops.test.ts`.
- p6: `bunx biome check packages/core/src/cad/loop-forest.ts packages/core/src/cad/loop-forest.test.ts && bun test packages/core/src/cad/loop-forest.test.ts`.
- p7: `bunx biome check packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/cad/loops.test.ts packages/core/src/cad/loop-forest.test.ts packages/core/src/cad/pcb-outline.test.ts packages/core/src/cad/history.test.ts packages/core/src/capture/scene.test.ts`.

At most two `bun test` or `cargo test` processes run at once.

Integration runs once after all plans land, in this order and under the
26.2 timing rule:

1. `bun run typecheck`, `bun run lint`, then `CARGO_TERM_QUIET=true mise
   run verify`. Goldens are checked and never regenerated.
2. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`. Then, with
   `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli"`, run
   `bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/mcp-stdio.test.ts`.
3. Check that no `*.test.ts` remains under `target/` or `tmp/`.

### 28.3 Decisions

- R10-1 publishes with `persist_noclobber` in Rust and `linkSync` in Bun.
  It adds no dependency. Rust's tempfile selects the platform no-clobber
  rename or a hard link itself. A pathname identity check followed by an
  unlink was rejected, because it leaves a replacement window.
- R10-1 keeps the lstat pre-check, so an occupied target is still decided
  without writing anything. A collision at publish time falls back to
  the same decision.
- R10-1 has no direct-create fallback (step-3 review
  r10-design-unsafe-publish-fallback). A fallback that writes the public
  path and removes it on failure brings back the data-loss race, and no
  identity check binds the unlink to the checked entry. Any non-collision
  publish error is returned after the staging file is removed. Where the
  selected backend lacks its primitive (Rust: no-clobber rename or hard
  link; Bun: hard link), a new capture therefore fails cleanly instead of
  risking another writer's file (4.3, 12, 28.4; step-3 review
  r10-design-backend-publish-compatibility).
- R10-1 staging names have a fixed short length that does not depend on
  the target name (Bun `.nodetto-<16 hex>.tmp`, Rust tempfile's default
  name). A near-limit target basename therefore still works (step-3
  review r10-design-bun-staging-name-overflow). Forced replacement keeps
  `writeEntryAtomic`'s existing names; only the parent-joining helper is
  shared.
- R10-2 resolves parity from node aggregates instead of reporting
  crossings, so moving the scan inside the index cannot pass the
  counters. Leaves stay exact, so the existing inspection counters and
  the half-open endpoint and direction tie rules stay with the callers.
- R10-2 lands its scene half after R10-4. That way the scene's X pruning
  only ever meets an exact predicate.
- R10-3 keeps the existing pair pass, because it is fast in the native
  interpreter for ordinary sketches and the existing counter tests
  depend on it. It caps that pass at a linear budget and falls back to
  an O(E log E) parent sweep, so total work stays subquadratic,
  including the abandoned part.
- R10-2 and R10-3 regressions compare ordered points, depths and scene
  bytes with expectations built from the fixture vertex lists, not from
  the code under test. `oracleNormalise` remains a separate ancestry
  check (step-3 review r10-design-slotted-scene-shared-oracle).
- R10-3 uses a treap with hashed deterministic priorities. A sorted array
  with splices would hide quadratic element moves outside the counters.
- R10-3 resolves each depth once, at the contour's sweep answer, from
  its already-resolved neighbour. That work is counted in
  `forest.events` and included in W (step-3 review
  r10-design-nested-depth-verification-gap).
- R10-4 converts with `makeProfile`'s own expression, so capture and
  sketch construction decide containment on identical integers.
  Millimetre values are still what gets serialized.
- No user decision is pending, so there is no `design-docs/user-qa/`
  file.

### 28.4 Intentional differences from the workflow input

- The intake gives the design-document edits to the implementation
  plans. This step makes them instead, so p1 and p2 need no ordering
  against the geometry plans.
- R10-2 and R10-3 each become two plans (p4/p5 and p6/p7), to respect
  the limits of about four files and about 150 lines per plan.
- The existing Bun test "capture removes a partly written file and
  returns the write error" changes one in-mock line. That line asserts
  partial bytes at the public path, which is exactly what R10-1 removes.
  The line now checks that the public path is absent and the staging
  file holds the partial bytes. Every cleanup assertion stays.
- When the staging file cannot be created, the error keeps its
  `ErrorKind` or `code`. Its OS message may now name the staging file
  instead of the target, and the CLI still prefixes `Cannot write
  <path>:`. No test asserts that text.
- A new capture now fails with exit 2, instead of being written by a
  racy direct create, where the backend lacks its primitive. For Rust
  that means no no-clobber rename and no hard link; for Bun it means no
  hard link, for example on VFAT, where Rust still succeeds. Data safety,
  which the finding requires, outweighs that compatibility. `--force`
  over an existing regular file and all other targets are unchanged.
- The Bun regression for a failed write keeps the finding's
  write-failure ordering. A second regression per backend injects a
  publish failure while a competing forced writer completes.
- Per-plan gates leave out `bun run typecheck` and `mise run verify`.
  Those run once at integration.

### 28.5 Risks

- A wrong bulk or skip condition, or a comparator error in the forest,
  flips parity or depth. Guards: the oracle comparisons, scene-byte
  equality, the BigInt forest oracle, and the unedited first-error,
  touching and nesting tests.
- The R10-2 ratio bounds carry a log factor (expected about 1.1 and 2.2).
  If a bound fails after a correct fix, the plan reports the counts and
  never relaxes it.
- If an existing fixture exceeds the 32 E budget, it moves to the forest
  path and a round-9 counter assertion could fail. p7 records each
  fixture's pair work. A change to the constant must stay linear in E
  and be recorded.
- `cargo test -p nodetto-cli` and the parity tests bundle the TypeScript
  sources. While the geometry plans are mid-edit, those tests can fail
  for unrelated reasons, so they run at integration only.
- Users of the Bun reference host who write new captures onto a
  filesystem without hard links now get an error where they previously
  got a file. So do native CLI users on a filesystem with neither a
  no-clobber rename nor hard links. The message names the path and exits
  2. They can capture to the default directory and copy the file.
  Desktop export is unaffected.
- Not measured: Boa elapsed time and memory, Tauri delivery, real
  cross-process write races, and real VFAT, exFAT or network-filesystem
  publication. The per-backend boundary follows from the primitives'
  documented behaviour; no such filesystem was run.

## 29. Revision 18: audit round 12 corrections

Source: audit round 12 of the 3D CAD pages and AI capture, base `0a35708`
to `73f73b8`. Six findings (four high, two medium), none deferred. No
GitHub issue exists; the round-12 workflow input is the issue body. Where
an earlier section and this one disagree, this section wins. The common
rules of section 24, the timing rule of 26.2 and the plan rules of 28.2
still apply. Each fix needs a regression test that fails before the change
and passes after it in this tree. Performance is asserted with
deterministic work counters, never clocks. Bytes, goldens, error codes,
NCS1 layout, first-error identity, loop order and the CLI, MCP and desktop
contracts stay unchanged unless a rule below says otherwise.

Every new heavier path keeps the existing path for ordinary input and
engages only past a work threshold. A work-count test pins the ordinary
case, so the round-8 regression (39% slower ordinary checks) cannot repeat.

### 29.1 Rules

R12-1 `function-capture-mesh-prism-touching-face` (high).

Cause. `MeshView::facet_depth` (`crates/capture/src/mesh.rs:273-305`)
decides a ray that lies exactly on a projected triangle edge with the
view-dependent top-left rule `inclusive` (`mesh.rs:110-112`). Volume
queries (`intervals`, `hits`, `first_hit`) share that rule with shading.
For the back view (forward `[0,-1,0]`) the rim edge of a mesh box's top
face is a right-hand edge in view coordinates, so the mesh owns a ray in
its top plane. The prism above owns the same ray through its world-space
cap rule (`prism.rs:226-243`). Both bodies then hold `[-8, 0]` mm, the
picture records a witness pair (`raster.rs:301`, kept by
`interference.rs:585`), and `--fail-on-interference` exits 1. The front
view happens to agree with the prism. `MeshView::surface_intervals`
always returns `false`, so the raster never rechecks a mesh with its
volume rule.

Rule. Closed-mesh volume queries use the prism's world-space ownership:
a ray on a shared boundary belongs to the side that an infinitesimal world
displacement (+X first, then +Y, then +Z) moves it into. That is the
`increases_in_world` decision of `prism.rs:117-123`, used for caps at
`prism.rs:237-238` and for sides at `prism.rs:317-322` and `:343-347`.
Shading keeps today's rule.

1. Volume membership (`hits_impl::<false>`, reached by `intervals`,
   `hits` and `first_hit`, so by lattice sampling, pair analysis and the
   picture recheck). Triangle setup is unchanged: the same bin, the same
   zero-area skip, and the same order that makes the projected triangle
   counter-clockwise. For each oriented edge `(a, b)` of that order:
   - Canonical value. Let `c0, c1` be the edge's two vertices ordered by
     vertex index, lower first. `e' = edge(proj[c0], proj[c1], q)` and
     `e = e'` when `a` is `c0`, else `e = -e'`. The two triangles that
     share an edge therefore see exactly opposite values.
   - Band. `err = 8 * f64::EPSILON * (|dx| + |dy|) * S`, where
     `(dx, dy) = proj[c1] - proj[c0]` and `S` is the sum of the absolute
     projected coordinates of `c0`, `c1` and `q`. The value is the same
     for both orientations.
   - Decision. `e > err` admits the edge and `e < -err` rejects it.
     Otherwise the edge admits only when `increases_in_world(g)`, where
     `g[k] = -(b.y - a.y) * u[k] + (b.x - a.x) * v[k]` is the world
     gradient of `e` for this orientation, from projected coordinates and
     the view basis `[u, v]`. The reverse orientation has exactly `-g`, so
     exactly one of two triangles that share an edge owns a ray on it.
   - A triangle contains the ray when all three edges admit it. Depth
     `s` is computed as today.
2. Facet membership (`hits_impl::<true>`, `first_surface_hit`, `surface`)
   is unchanged bit for bit, so shading, edges, first hits and goldens
   keep today's output.
3. Sensitivity flag. For a closed mesh, `surface_intervals` returns
   `true` when some listed triangle has an edge with `|e| <= err` (using
   today's facet value of `e`) and its volume membership from step 1
   differs from its facet membership. Otherwise it returns `false`, as
   today. Outside the band the two rules cannot disagree, because `err`
   bounds the rounding difference between the facet value and the
   canonical value. Flags occur only at near-ties where the answers
   really differ, so ordinary pixels gain no recast.
4. The raster's existing recheck (`raster.rs:225-241`) and the reference
   renderer (`raster/reference.rs:81-85`) then recast the mesh with
   `intervals`. Neither file changes. `increases_in_world` becomes
   `pub(crate)` in `prism.rs`, with its body unchanged.
5. Unchanged: the CLI, Tauri, MCP, the NCS1 format, the report types,
   `interference.rs`, prism rules, open-mesh handling and mesh
   eligibility. The oblique-contact band is a conservative bound, not a
   proof. Only the axis-aligned fixtures below are tested.

Tests (each new test fails before the fix unless marked as a guard):

- `mesh.rs` unit test `contact_plane_rays_follow_prism_ownership`:
  - Lower box: the `cube()` topology at z in [-1, 0]. Upper box: z in
    [0, 1]. Rays lie in the plane z = 0 at x = 0.25. Back view: forward
    `[0,-1,0]`, origin y = 3. Front view: forward `[0,1,0]`, origin
    y = -2.
  - Lower box: `intervals` is empty in both views. This fails before the
    fix in the back view. `surface_intervals` returns two boundaries and
    `true` in the back view, and nothing and `false` in the front view.
  - Upper box: `intervals` has two boundaries one unit apart in both
    views. `surface_intervals` flags the back view (the facet rule
    excludes) and not the front view.
- `mesh.rs` unit test `volume_ties_are_watertight_for_oblique_rays`:
  - Use the cube with forward `normalize([1, 2, 3])`.
  - Take rays through a point of the bottom face's internal diagonal,
    displaced along the view-plane normal of the diagonal by
    `k * 1e-15` mm for k in -4..=4, plus rays through the cube's corner
    vertices projected into the face.
  - Every ray has an even number of volume hits. Every interior ray has
    exactly 2, and corner rays have an even count.
  - Each ray's two boundaries are compared with that ray's own analytic
    oracle, not with other rays: the slab entry and exit parameters
    `t_enter` and `t_exit` of the unit cube for the same origin and the
    same forward direction, with `|s - t| <= 1e-12` mm. Depths differ
    between rays, because the offset direction has a world Z component
    (step-3 review r12-mesh-oblique-depth-oracle).
  - This is a guard, because the old rule is also watertight inside one
    mesh.
- The existing test `cube_surface_casts_are_not_ownership_sensitive` is
  renamed `cube_surface_and_volume_casts_differ_only_at_ownership_ties`.
  All five points stay:
  - Points `[0.25,0.25]`, `[0.5,0.5]`, `[0.75,0.25]` and `[1.5,0.5]` keep
    the equal-depth assertion and the `false` flag.
  - Point `[0,0]` is a corner tie where the rules now differ by design.
    It asserts: facet output empty and unchanged; flag `true`; volume
    depths `[1, 2]`, because the world displacement moves the ray into
    the cube.
- `raster/reference.rs` fixture `mesh_under_prism(back: bool, overlap)`:
  - Tools and bodies as in `stacked_caps(overlap)`, except that tool 0 is
    a closed 12-triangle mesh box of the same extent (16 x 8 x 0.9375,
    outward winding). Tool 1 is unchanged.
  - Camera as `stacked_caps`. With `back`: forward `[0,-1,0]`, right
    `[-1,0,0]`, and the centre at y = 12 instead of -4.
- `raster/tests.rs`:
  - `production_touching_mesh_caps` runs `production_touching` on
    `mesh_under_prism(false, 0.0)` and `mesh_under_prism(true, 0.0)`.
    That means zero pairs, zero candidates, identical RGB at threads
    0..=8 and against the reference, and RGB equal to the
    `draw_interference = false` render. The back variant fails before the
    fix.
  - `production_overlap_witness` adds `mesh_under_prism(true, 0.01)` and
    `mesh_under_prism(false, 0.01)`, each with exactly one pair. This is a
    guard.
- Every other `mesh.rs`, raster, interference, lattice, census and golden
  test stays unedited and passes. If an existing exact work count moves
  only because of a step-3 recast, the plan reports both values and the
  tie that caused it. It never relaxes a bound.

R12-2 `performance-sketch-profile-pair-scans` (high).

Cause. `intersection()` (`packages/core/src/cad/loops.ts:373-414`) lists
every overlapping box pair through `overlappingPairs`. Past
`SWEEP_PAIRS_PER_BOX` (`:230`), the indexed path (`:285-370`) emits all
overlapping pairs, which is quadratic for parallel diagonal strips that
never touch.

Rule.

1. New module `packages/core/src/cad/segment-sweep.ts`, which imports only
   `./vec.ts`. It exports:

   ```text
   provesDisjoint(count, endpoints(i) -> [x0, y0, x1, y1],
                  touches(i, j) -> boolean, stats?) -> boolean
   ```

   The function returns `true` only when it has proved that `touches`
   holds for no pair. `false` means "not proved": either it found a pair
   for which `touches` is true, or the input is outside what the sweep
   handles. The caller must then run its exhaustive search. This one-sided
   contract means the sweep can never let an invalid profile through.
   - Contract on `touches`: it is called only for pairs whose bounding
     boxes overlap (closed intervals on both axes). It returns true for
     every such pair that shares a point, except pairs that share exactly
     one common endpoint and no other point; it may return false for
     those. The module enforces the box precondition itself before every
     call, because `segmentIntersection` alone reports collinear disjoint
     segments as touching. `segmentIntersection` meets the contract under
     that precondition.
   - Collapsed segments. Before building any event or treap node, the
     function scans the input. If any segment has identical endpoints (a
     zero-length segment, which grid construction keeps for repeated
     vertices), it returns `false` (not proved) without sweeping. Every
     segment the sweep handles therefore has distinct lower and upper
     endpoints, so no segment can be in both `L` and `U` at one event
     (step-3 review r12-sweep-collapsed-grid-segment).
2. Algorithm: a Shamos-Hoey sweep on exact grid integers, run only when
   no segment is collapsed.
   - Events are ordered lexicographically by `(y, x)`, the order
     `loop-forest.ts` already uses. A segment's lower endpoint is its
     lexicographically smaller endpoint.
   - The status is a treap with the deterministic hashed priorities of
     `loop-forest.ts`. Its order is the order along the sweep line just
     after the event point, decided by exact `gridCross` orientations.
     Segments that share a lower endpoint are ordered by the orientation
     of their upper endpoints, then by index.
   - Each distinct event point `p` is processed in four steps:
     - (a) Let `L` be the segments whose upper endpoint is `p` and `U`
       those whose lower endpoint is `p`. `U` and `L` are disjoint
       because no segment is collapsed. Take the members of `U ∪ L` in
       index order and test the first member against each of the others
       with `touches`, stopping at the first true test. A non-collapsed
       segment's endpoint at `p` is one vertex index, which is shared
       with at most one other segment, so the first member has at most
       one exempt partner. When three or more segments meet at `p`, a
       true test therefore occurs within two tests. When exactly two
       meet, the one test decides that pair.
     - (b) Remove each segment of `L`, then test its former predecessor
       against its former successor.
     - (c) Descend the treap with the sign of `gridCross(segment, p)`. An
       active segment with orientation 0 contains `p` in its interior.
       That is a contact, so the function returns `false` (not proved)
       and the caller runs its exhaustive search. Binary search for an
       equal key finds such a segment whenever one exists. Every contact
       branch, (a) to (d), returns `false`. Only reaching the end of the
       events returns `true`.
     - (d) Insert each segment of `U`, testing it against its predecessor
       and its successor. Each pair is tested when it becomes adjacent.
   - At the first true test, or the first contact found in step (c), the
     function returns `false` (not proved). It returns `true` (proved)
     only after the last event.
   - Correctness rests on the standard argument. The status order is
     valid before the lexicographically smallest contact point `X`, and
     some pair that meets at `X` is either adjacent and tested before `X`
     or handled by steps (a) and (c) at `X`. Because every segment has
     two distinct endpoints, each segment is inserted exactly once and
     removed exactly once, after its insertion.
   - Counters: `stats.events`, `stats.steps` (treap and comparator steps),
     `stats.tests` (`touches` calls) and `stats.collapsed` (inputs
     rejected by the collapsed-segment scan).
3. Integration in `loops.ts`:
   - `overlappingPairs` gains an optional `crowded?: () => boolean`. It is
     called once, only where the indexed path would start. If it returns
     false the function returns without listing pairs. Containment search
     does not pass it, so containment is unchanged.
   - `intersection()` passes a `crowded` that increments
     `stats.segmentFallbacks` and runs `provesDisjoint` over the same
     sorted `segments`, with `touches = segmentIntersection` (the module
     applies the box precondition before each call).
   - If the sweep proves disjointness, the result is "no crossing". If it
     does not (a contact or a collapsed segment), the existing indexed
     enumeration runs unchanged, so the first reported source ID (the
     minimum sorted index) is identical.
   - `LoopStats` gains optional `segmentTests` (every exact
     `segmentIntersection` call, on either path), `segmentFallbacks` and
     `sweep?: { events; steps; tests; collapsed }`.
   - `segmentPairs` keeps meaning "candidate segment pairs examined". On
     the crowded path it also counts the sweep's `touches` calls, so
     existing positive and ratio assertions stay meaningful.
   - `SWEEP_PAIRS_PER_BOX` stays 8. The measured threshold is the
     existing switch point. The plan records `segmentPairs`,
     `segmentTests` and `segmentFallbacks` for the ordinary fixture and
     for the strip fixture at each size.
4. Unchanged: the sparse sweep, containment, depth, the forest fallback,
   error codes, and loop order and orientation.

Tests:

- `segment-sweep.test.ts`, differential:
  - 3,000 seeded closed polylines, each with 3 to 7 vertices, on the
    integer grid 0..6. This produces many vertical, horizontal,
    collinear, T-touch, shared-vertex and repeated-coordinate cases.
  - Adjacency means consecutive in the same loop. `touches` is a local
    exact closed-segment test that excludes an adjacent pair sharing only
    their common vertex. The all-pairs oracle applies the same
    box-overlap precondition and the same `touches`.
  - Soundness on every case: whenever `provesDisjoint` returns true, the
    oracle finds no touching pair.
  - Completeness on every case without a collapsed segment:
    `provesDisjoint` returns true exactly when the oracle finds no
    touching pair.
  - The plan states its seed and four counts: proved, not proved with
    contact, not proved because of collapse, and oracle-disjoint. Each
    must be non-zero.
  - Before the module exists the import fails, so the test fails.
- `segment-sweep.test.ts`, deterministic collapsed case: the closed
  polyline (0,0), (4,0), (4,0), (4,4), (0,4). The segment (4,0)-(4,0)
  makes the function return false with `stats.collapsed === 1`, and no
  event is processed.
- `segment-sweep.test.ts`, deterministic T-touch case (no collapse):
  segments (0,0)-(0,4) and (0,2)-(1,3), not adjacent. The endpoint (0,2)
  lies inside the active vertical segment. Step (c) finds it and the
  function returns `false`, with `stats.collapsed === 0`. A swapped
  input order gives the same result.
- `segment-sweep.test.ts`, work: for N disjoint parallel diagonal
  segments at N = 1024, 2048 and 4096, `events + steps + tests` grows by
  at most 2.5x per doubling and `tests <= 3 * N`.
- `loops.test.ts` "diagonal strips search disjointness subquadratically":
  - N closed four-line strips with corners (0,b), (100,100+b),
    (100,100+b+w) and (0,b+w), where b = i/64 mm and w = 1/256 mm, at
    N = 64, 128 and 256.
  - Work `W = segmentPairs + sweep.events + sweep.steps + sweep.tests`.
    Each doubling at most 2.5x both `W` and `segmentTests`.
  - The ordered loops equal an oracle built from the strip vertex lists:
    every strip, in input order, at depth 0, counter-clockwise.
  - Before the fix, `segmentTests` grows about 4x (16,448 to 65,664 to
    262,400 in the audit).
- `loops.test.ts` crossing control: the 256-strip fixture plus one closed
  three-line triangle whose edges cross strips 10 and 11.
  - The result is `cad.profile.intersect`, with `at` equal to the source
    ID that an in-test BigInt all-pairs oracle selects. The oracle sorts
    segments by `(minX, minY)` exactly as `intersection()` does and takes
    the minimum sorted index of any intersecting pair.
  - `segmentFallbacks === 1`. This is a guard for first-error identity.
- `loops.test.ts` crowded repeated-vertex control (step-3 review
  r12-sweep-collapsed-grid-segment):
  - The fixture calls `buildProfileLoops(paths, undefined, stats)`
    directly with closed `CadProfilePath` records:
    - the 64 strips, each as one closed path with its four corners;
    - one closed path with ID `repeated-vertex` and points
      `[200,0, 204,0, 204,0, 204,4, 200,4]`, `closed: true`.
    `buildProfileLoops` gives a closed path a single source ID
    (`loops.ts:519-535`). Separate line entities would not work: an
    open line with equal endpoints fails with `cad.profile.empty` before
    the intersection search.
  - The 64 strips take the crowded path. The repeated vertex makes one
    collapsed segment, and the two non-zero segments that meet at
    (204,0) are not adjacent.
  - Assert the result is `cad.profile.intersect` with `at ===
    "repeated-vertex"`, `segmentFallbacks === 1` and
    `sweep.collapsed === 1`.
  - This is a guard: the existing path already reports this (the
    reviewer's probe needed 52,891 pair visits). The test pins it so the
    sweep cannot regress it.
- `loops.test.ts` ordinary baseline:
  - Build every sketch of
    `generateCadDocument({ features: 500, entitiesPerSketch: 18 })` with
    `buildLoops(entities, undefined, stats)` and one shared `stats`.
  - Assert `segmentFallbacks === 0`, `sweep` absent or all zero, and
    `segmentTests` equal to the value measured before the change. The
    audit's 164,000 is expected and the plan records the measured value.
- The existing doubling, two-row, tangent and `pcb-outline` tests stay
  unedited and pass.

R12-3 `performance-capture-selected-loop-ancestry-work` (high).

Cause. `normaliseToolLoops` (`packages/core/src/capture/scene.ts:213-276`)
searches every lower depth for each contour. Missing depth buckets are
looked up uncounted (D lookups each, so D x S in total). Every probe also
merges the oversized list, so N rims and N holes cost N^2 / 2 probes.

Rule.

1. Keep the all-depth-zero early return and the existing search as the
   first path. Count new `depthLookups` (every `k` iteration, including
   missing buckets) and keep `ancestorProbes`, `indexEntries` and the
   edge-index counters.
2. Linear budget: `ANCESTRY_WORK_PER_VERTEX = 32` times the total vertex
   count of `loops`. Work is `depthLookups + ancestorProbes +
   indexEntries + edge builds, visits, inspections and bulk`. It is
   counted internally even without `stats`.
3. When the work exceeds the budget, abandon the first path, increment
   `forestFallbacks`, and call `loopForest(grids, windings, stats.forest)`
   once over the rounded grids of `loops`. All windings are `1`, because
   every `CadLoop` is counter-clockwise: `buildProfileLoops` emits only
   `counterClockwise(...)` (`loops.ts:447-449`, `:648`), and PCB outlines
   come through it too (`pcb-outline.ts:179`).
   - The nearest selected ancestor is `parents[i]`, and its depth is
     `loops[parents[i]].depth`, or -1 when there is none.
   - Keep a loop when its depth is 0, or when
     `(depth - ancestorDepth) % 2 === 1`. The filter and the result order
     are unchanged.
   - The selected contours come from a validated profile on identical
     integers (R10-4) and do not touch. The parent from the minimum
     vertex therefore equals the parent from the first vertex.
4. `CaptureWalkStats` gains an optional
   `ancestry?: { ancestorProbes; indexEntries?; edges?; depthLookups?;
   forestFallbacks?; forest? }`, and `buildCadCaptureModel` passes it to
   `normaliseToolLoops`. The call order of normalization and `chargeTool`
   (`:435-438`) stays as it is. Normalization is now near-linear, and its
   loops determine the bounds and the charge.
5. Unchanged: the serialized scene bytes, retained loops, contour order
   and the original sketch depths.

Tests (`packages/core/src/capture/scene.test.ts`). Both shapes run as
real CAD documents through the production path (step-3 review
r12-ancestry-full-scene-oracle):

- Document fixtures (all within the 20,000-record page limit):
  - Deep. One XY sketch with D nested axis-aligned squares of `cad.line`
    entities and S unit-square islands in a grid inside the innermost
    square, with D even. One `new` extrusion of 5 mm selects only the
    islands' member IDs through `loops`, so every selected loop has
    sketch depth D and its D ancestors are omitted. Sizes: D = S = 256,
    512 and 1024 (at most 8,194 records). Every size takes the forest
    path, because D x S depth lookups exceed the budget 32 x 4S whenever
    D > 128.
  - Deep variant. The same document at D = S = 256, with the outermost
    square's members also selected. Only the outermost square is
    retained, because the islands are an even distance below it.
  - Shallow. One XY sketch with N disjoint slanted quadrilateral rims,
    each wide enough to be an oversized index entry, and one square hole
    inside each rim. One `new` extrusion selects every loop. Sizes:
    N = 1024 and 2048 (at most 16,386 records). Both take the forest
    path, because about N^2 / 2 probes exceed the budget 32 x 8N
    whenever N > 512.
- Work through production construction. For each size, call
  `buildCadCaptureModel(elements, page, { stats })` with
  `stats.ancestry` set. Total work is `depthLookups + ancestorProbes +
  indexEntries + edge work + forest.events + forest.steps`, which
  includes the abandoned first-path work. Each doubling at most 2.5x
  (deep: 256 to 512 to 1024; shallow: 1024 to 2048). Before the fix the
  deep total grows about 4x per doubling and the shallow probes grow
  about 4x.
- Helper doubling. `normaliseToolLoops` on the shallow raw loops at N =
  1024, 2048 and 4096 also stays within 2.5x per doubling, because 4096
  rims exceed the page limit as a document.
- Full-scene oracle. For each deep size, the deep variant and both
  shallow sizes:
  - Run `prepareCadCapture` with a fixed request (top view, 256 x 256,
    no interference) and keep its `scene` bytes and `model`.
  - Independently derive the retained contours. Call `buildLoops` on the
    sketch entities with the extrusion's `loops` selection, then the test
    file's existing brute-force `oracleNormalise`.
  - Build the expected model as the actual `model`, with the same bodies,
    feature and source IDs, bounds, camera and request metadata, but each
    prism tool's `loops` rebuilt in the test from the oracle contours in
    order: points copied into a `Float64Array`, and face IDs assigned
    `2 + n` in first-appearance order of the source IDs. This
    re-implements `makeTool` independently.
  - Assert that `writeCaptureScene(expected, options)`
    (`scene-binary.ts:244`) equals the prepared `scene` bytes byte for
    byte. `options` is rebuilt exactly as `prepareCadCapture` builds it
    (`cad-request.ts:190-198`): `width: request.width`,
    `height: request.height`, the literal `supersample: 2` (the
    production constant; `CadCaptureRequest`, `cad-request.ts:47-56`,
    has no supersample field), the returned `camera`,
    `colours: CAPTURE_THEMES[request.theme]`, `referenceOpacity: 0.45`
    and `interference: null`. The request API is unchanged.
  - Also assert that each body's bounds equal the bounds the test
    computes from the oracle contours: XY min and max of the points, and
    Z from 0 to 5 mm. A change in retained contours or their order
    therefore changes the expected bytes.
  - The existing `indexedSceneBytes` helper stays for the raw-loop
    checks only.
- Ordinary baseline: `buildCadCaptureModel` on
  `generateCadDocument({ features: 500, entitiesPerSketch: 18 })` with
  `stats.ancestry`. Assert `forestFallbacks === 0`, and `ancestorProbes`
  and `indexEntries` equal to the pre-change measured values (the audit
  measured 5,000 and 5,500). The plan records `depthLookups`.
- The existing ancestry, grid, slotted and ray-origin tests, including
  their exact `ancestorProbes` counts, stay unedited and pass. If one
  crosses the budget, the plan reports it and does not raise the
  constant past a linear bound.

R12-4 `performance-cad-side-face-member-rescans` (medium).

Cause. `createCadGeometry().sketch` (`history.ts:470-474`) runs
`tool.loops.some(loop => loop.members.includes(line.id))` for every
side-face sketch.

Rule.

1. The cap-face path and the base-plane path are unchanged and allocate
   nothing. A tool that is never queried for a side allocates nothing.
2. Each `createCadGeometry` instance keeps a lazily created
   `Map<ExtrudeGeometry, SideMembers>`. It creates an entry on a tool's
   first side query, as `{ budget: 4 * memberTotal, scanned: 0,
   members?: Set<ElementId> }`, where `memberTotal` sums
   `loop.members.length` over `tool.loops`.
3. Without `members`, a query scans as today, counting each comparison in
   `scanned` and in `cadGeometryWork.sideMemberVisits`. Once `scanned`
   reaches `budget`, the next query builds `members` from `tool.loops`
   once. That costs `memberTotal` visits and increments
   `cadGeometryWork.sideMemberIndexBuilds`. After that each query is one
   `has`, counted as one visit.
4. Because only the extrusion's selected loops are in `tool.loops`, lines
   that belong only to omitted loops are still rejected with
   `cad.reference.missing`. Per tool, total work is at most
   `7 * memberTotal + queries`: scans up to `budget + memberTotal`, one
   build, and the loop-count sum.

Tests (`packages/core/src/cad/history.test.ts`; counters reset before
each measurement):

- Three cases, each at M = S = 256, 512 and 1024:
  - Repeated: S sketches on the side of the last member of a closed
    M-line profile.
  - Distinct: S = M sketches, one per side.
  - Omitted: a profile with a 4-line rectangle and a disjoint M-line
    loop. The extrusion selects only the rectangle, and S sketches
    reference lines of the omitted loop.
- Each doubling at most 2.5x `sideMemberVisits`. Before the fix the
  repeated case grows about 4x.
- Frames for repeated and distinct sides equal the `faceFrame(...)`
  expectation for each line, and every omitted case returns
  `cad.reference.missing` with that line's ID.
- Ordinary baseline: checking
  `generateCadDocument({ features: 500, entitiesPerSketch: 18 })` gives
  `sideMemberIndexBuilds === 0`. The plan records `sideMemberVisits` and
  the largest per-tool ratio of `scanned` to `memberTotal`, which is the
  measured threshold margin.

R12-5 `performance-cad-inspector-target-membership` (medium).

Rule.

1. `packages/ui-solid/src/cad/extrude-targets.ts` adds:
   - `selectTargets(value: unknown): { ids: readonly ElementId[]; has(id): boolean }`.
     It validates the stored `bodies` the way `CadSection.tsx:83-88`
     does and builds one `Set`.
   - `orderExtrudeTargets(listed, stored)`, which makes the same two
     passes as `displayedExtrudeTargets` but tests membership with sets.
     Duplicates and missing stored IDs keep their order.
   - `displayedExtrudeTargets` keeps its signature and delegates, so
     `extrude-authoring.ts` is unchanged.
   - The exported counter `targetSelectionWork = { builds, visits, queries }`.
2. `CadSection.tsx`:
   - `selection = createMemo(() => selectTargets(semantic().bodies))`,
     with `targets = () => selection().ids`.
   - `listedIds = createMemo(() => earlierBodies().map(b => b.id))`.
   - `orderedTargets` becomes a memo over
     `orderExtrudeTargets(listedIds(), targets())`, keeping the
     `cad.extrude` and `new` guard.
   - Rows use `selection().has(body.id)` for `checked` and for the click
     guard.
   - Display order, the add-operation single target and every edit
     command are unchanged.

Tests:

- `extrude-targets.test.ts`: the exact existing order assertions stay.
  New assertions:
  - At N = 500 and 1000 selected bodies, one `selectTargets` call builds
    once, makes N visits, and answers N `has` queries with N queries.
  - `orderExtrudeTargets` visits equal `listed + stored`, so the work
    exactly doubles at 2N.
  - The exact order for selected, unselected and missing IDs.
- `test-dom/cad-inspector.dom.tsx`. It is launched by the existing test
  "CAD layers and inspector share selection, edits and statuses in light
  and dark" in `packages/ui-solid/src/inspector/cad-edits.test.ts:132-147`
  (browser conditions, `test-dom/setup.ts` preload, and output that must
  contain `ok light` and `ok dark`). `cad/viewport.test.tsx` does not run
  this file (step-3 review r12-inspector-regression-gate).
  - Render a mounted cut that targets N = 16 earlier bodies, and a second
    one that targets 2N = 32. For each, reset `targetSelectionWork` and
    uncheck one body through the real checkbox.
  - Assert, per size, that `builds === 1` for that one selection change
    and `queries > 0`. Across sizes, assert
    `queries(2N) === 2 * queries(N)`.
  - Assert the stored `bodies` order after the change, and that the
    single-target `add` behaviour is unchanged (checking another body
    replaces the target).
  - Before the fix there is no `selectTargets`, so the test fails.

R12-6 `maintainability-capture-touching-shell-mesh-eligibility` (high).

Cause. Welding (`canonical.ts:101`) makes two closed shells that touch
share vertices. An edge contact gives an edge used by four triangles. A
face contact also gives rim edges with four uses and, when both shells
triangulate the shared face alike, one opposite-oriented duplicate vertex
triple per shared triangle. The TypeScript `eligible`
(`capture-decoder.ts:37-122`), the Rust `closed_by` (`mesh.rs:56-66`) and
`target_eligible` (`nmesh.rs:229-288`) reject these meshes, but Manifold
pairs the halfedges and accepts them.

Rule. Balanced halfedge pairing (Manifold's condition) is necessary but
not enough. Two welded boxes [0,10]x[0,10]x[0,5] and [0,6]x[0,6]x[0,5]
share one balanced four-use edge and overlap by 180 mm^3. Ray parity then
cancels the shared volume, giving depths 0, 0, 5, 5 at x=2, y=3 (step-3
review r12-balanced-edge-overlap-eligibility). The new rule therefore
admits a welded contact only when it can show that the touching shells'
interiors are disjoint. Otherwise it keeps today's classification
(rejected).

- Fast path, unchanged. When no undirected edge has three or more uses,
  `closed_by`, the TypeScript `eligible` and the Rust `target_eligible`
  run exactly as today. Edges with one use still fail. That includes
  today's opposite-direction and duplicate-triple checks in eligibility,
  and no direction or duplicate check in `closed_by`. Previously eligible and previously closed meshes
  keep their classification, and the ordinary path allocates nothing new.
- Contact path. It runs only when some undirected edge has three or more
  uses, which today always fails. It runs the same steps, in this order,
  in `closed_by` (the picture closure, and step 1 of Rust eligibility)
  and in the TypeScript `eligible`. It returns false at the first failed
  step:
  - C1 Balance. Every edge's use count is even, and an edge with three
    or more uses has equal `(u, v)` and `(v, u)` counts. Eligibility, as
    today, also requires edges with two uses to have opposite directions.
  - C2 Cancelling patches. This step works on exact integer coordinates.
    Plane arithmetic uses `BigInt` in TypeScript and `i128` in Rust, and
    only on this path. Sub-steps:
    - Integer domain. TypeScript uses the NMESH quantized integers
      directly. Rust `closed_by` also serves raw NCS1 scene meshes
      (`scene.rs:117-122`, `:227-255`, via `tool_view.rs:120-127`), whose
      positions need not lie on the NMESH grid. For every vertex
      coordinate `v`, it computes `k = round(v * UNITS_PER_MILLIMETRE)`
      and requires all three of:
      - `k` is finite;
      - `|k|` is within the NMESH coordinate limit;
      - `k as f64 / UNITS_PER_MILLIMETRE` equals `v` bit for bit. This is
        the decoder's own expression, so decoded NMESH positions always
        pass.

      If any coordinate fails, the contact path returns false, which is
      today's result for any edge with three or more uses. So an off-grid
      raw scene keeps its prior open classification and cannot reach the
      plane arithmetic (step-3 review r12-contact-grid-domain).
    - Zero normals. If a triangle's integer normal
      `n = (b - a) x (c - a)` is the zero vector, the contact path
      returns false before any gcd is taken. The integer triangle is
      collinear even if its floating-point normal was not.
    - Plane key. For each triangle, its integer normal `n` is divided by
      the gcd of its components.
      The key is the reduced normal with its first non-zero component
      made positive, plus the offset `n . a`. The triangle's side is `+1`
      when the sign was kept and `-1` when it was flipped.
    - Patches. Within one (plane key, side) group, a patch is a connected
      component of triangles joined across an edge that exactly two
      triangles of the group use in opposite directions (union-find).
      The patch boundary is the multiset of its directed edges that are
      not cancelled inside the patch.
    - Matching. Two patches of the same plane key with opposite sides,
      whose boundaries are exact reverses of each other, form a
      cancelling pair: the shared face of a face contact, whatever its
      triangulation on either side. In a plane, a triangle 2-chain is
      determined by its boundary, so the two patches sum to the zero
      chain and cancel exactly. Coplanarity is required, because
      non-coplanar spans of one loop (two halves of a closed shell) do
      not cancel. Matching uses a sorted canonical boundary key, and
      each patch matches at most one other, in patch order.
    - A matched pair is cancelled only when every edge of its boundary
      has at least four uses in the input, so the shared face lies on
      contact edges. A matched pair with a boundary edge of two uses (a
      free double-sided triangle, sheet or fin, with any triangulation)
      fails.
    - Attachment. After all cancellations, every boundary edge of every
      cancelled patch must have exactly two remaining uses, one in each
      direction. Those are the two surviving shell faces that close the
      surface across the removed junction, as the rim edges of a face
      contact do. If any boundary edge has zero (or any other number of)
      remaining uses, the contact path returns false. So cancellation can
      never erase whole coincident shells: an outward cube and an
      identical inside-out cube cancel face by face and leave their edges
      with no remaining uses. This holds even when an unrelated valid
      shell survives elsewhere (step-3 review
      r12-contact-patches-erase-shells).
    - After cancellation, any vertex triple that still occurs more than
      once fails (a same-orientation copy or an unmatched duplicate), as
      today.
  - C3 Shells. Remove the cancelled patches and recount edge uses. Shells
    are the connected components of the remaining triangles, joined only
    across edges that have exactly two remaining uses (union-find over
    triangle indices). An edge with four or more remaining uses is a
    contact edge.
  - C4 Each shell closes on its own. At every contact edge, each shell
    that uses the edge uses it exactly once in each direction. A shell
    that uses a contact edge once (an open sheet, such as a shared face
    left uncancelled) or more than twice (a pinch) fails. Every shell's
    signed volume (the C6 sum over its triangles, on integers) must be
    non-zero, and all shells must have the same sign, so a zero-volume
    or inside-out shell fails.
  - C5 Disjoint interiors. For every contact edge and every two distinct
    shells using it, their axis-aligned bounding boxes, taken over the
    shells' vertex positions, must have disjoint interiors: on at least
    one axis `maxA <= minB` or `maxB <= minA`. Each shell's solid lies
    inside its box, so disjoint box interiors prove that the shells share
    no volume and that parity gives their union. Comparisons use the
    same exact integers as C2 in both languages, so both decide
    identically. A safe contact whose
    boxes overlap (for example, a box nested in an L-shaped notch) keeps
    today's rejection. This is conservative.
  - C6 Eligibility only: emptiness (d) runs unchanged on the original
    triangle list. A cancelled patch pair adds zero net signed volume.
- Results for the fixtures below:
  - Edge contact: one contact edge; shells A and B; boxes meet only on
    the line x = 10, y = 10, so the mesh is accepted.
  - Face contact with coinciding diagonals: A's and B's shared-face
    patches have reversed rim boundaries and cancel. The rim edges drop
    to two uses, and A and B form one closed shell, so the mesh is
    accepted.
  - Face contact with crossed diagonals: the same two patches (now with
    different interior diagonals) have the same reversed rim boundaries
    and cancel, so the mesh is accepted exactly as above (step-3 review
    r12-face-contact-triangulation-parity).
  - Double-sided fin: the fin's two sides match, but three of their
    boundary edges have two uses, so the mesh is rejected as today.
  - Welded overlap: C5 fails, because the boxes [0,10]^2 and [0,6]^2
    overlap in their interiors, so it is rejected as today in both
    decoders and in Rust closure.
  - Unbalanced edge: C1 fails. Open triangle: odd use counts fail as
    today.
  - Coincident shells: all six face pairs of the two coincident cubes
    match and cancel, and their boundary edges keep no remaining uses, so
    the Attachment check fails and the mesh is rejected as today. The
    disjoint third cube cannot mask this.
  - Off-grid raw scene (Rust closure only): the grid check fails before
    any plane arithmetic, so `closed_by` returns false without a panic,
    as today.
- Cost. The contact path is O(T log T) for T triangles: one plane key
  per triangle, two union-finds, sorted boundary keys, and one box and
  one volume per shell. Its extra allocations happen only on the contact
  path. The allocation counts asserted in
  `capture-decoder-budget.test.ts` and `AllocStats` therefore stay the
  same for every existing fixture.
- `target_eligible` keeps calling `closed_by` first. `closed_by`
  already applies C2's duplicate rule on the contact path. On the
  contact path, `target_eligible` then applies only C1's two-use
  direction rule in place of today's duplicate rejection, followed by
  (d).
- The TypeScript and Rust implementations stay independent and follow
  the same steps in the same order. `packages/io` imports nothing new.
  `tool_view.rs:123` and `scene.ts:428` need no change, because they
  consume these results.
- A genuinely ineligible target still makes the whole operation fail
  with `cad.body.missing`.

Fixtures (binary STL bytes built in each test, never copied from
issues):

- Edge contact: box A at x 0..10, y 0..10, z 0..5 and box B at x 10..20,
  y 10..20, z 0..5.
- Face contact: box A as above and box B at x 10..20, y 0..10, z 0..5.
- In both, each box has 12 outward triangles from one shared corner
  order, so the shared face's diagonals coincide.
- Plate: a 10 x 10 mm sketch rectangle at z = 5, extruded 5 mm as a new
  body.
- Cut: a 2 x 2 mm rectangle at x 1..3, y 1..3, extruded from z = 0 to
  10, targeting the mesh and the plate.
- Controls:
  - the uncut document;
  - separated shells: box B moved to x 12..22;
  - an open triangle: box A plus one extra triangle on an edge of box A;
  - an unbalanced edge: the edge-contact mesh with the winding of one
    box-B triangle at the shared edge reversed, so that edge has 4 uses
    with 3 in one direction;
  - a welded overlap: outward boxes [0,10]x[0,10]x[0,5] and
    [0,6]x[0,6]x[0,5], sharing the edge at x = 0, y = 0;
  - a double-sided fin: the edge-contact mesh plus a fin hanging from the
    shared edge into the empty quadrant x > 10, y < 10, with corners
    (10,10,0), (10,10,5), (13,7,5) and (13,7,0). One side is two
    triangles; the other side is two triangles with the other diagonal
    and opposite winding. The shared edge then has six balanced uses,
    and the fin's three free edges have two each;
  - coincident shells: an outward unit cube at [0,1]^3, an identical cube
    with every triangle's winding reversed, and a disjoint outward unit
    cube at x = 2..3. Today's decoder returns false for it, with 36
    triangles and 18 four-use edges (reviewer probe);
  - off-grid raw scene (Rust `closed_by` and `is_closed` only, built as a
    raw `Mesh`, not through NMESH): two closed boxes 0.0004 mm wide
    sharing a vertical edge. Their triangles round to collinear integer
    points, for example (0,0,0), (0,0.0004,0), (0.0004,0,0).
- Crossed-diagonal face contact, an acceptance fixture: the face-contact
  boxes, with box B's shared face split along the other diagonal and
  outward winding kept. The reviewer's real-worker probe exported a
  480 mm^3 plate for both triangulations.

Tests:

- `capture-decoder.test.ts`:
  - `booleanTarget` is true for edge contact, face contact,
    crossed-diagonal face contact and the separated control.
  - It is false for the open-triangle, unbalanced, welded-overlap,
    double-sided-fin and coincident-shell controls.
  - Edge, face and crossed-diagonal contact fail before the fix. The
    false controls are guards that keep today's classification.
- Rust:
  - `crates/capture/tests/mesh.rs`: `closed_by` on the same index and
    position arrays. It is true for edge, face and crossed-diagonal face
    contact, and false for the open-triangle, unbalanced,
    welded-overlap, double-sided-fin and coincident-shell controls. The
    separated control stays true.
  - Also in `crates/capture/tests/mesh.rs`: `is_closed` on the off-grid
    raw `Mesh` returns false without a panic, and so does `closed_by`
    with the same positions.
  - `nmesh.rs` unit tests: `target_eligible` through the decoder gives
    the same booleans as TypeScript for all nine NMESH meshes.
  - `closure_count.rs` stays unedited.
- Picture agreement: for the welded-overlap and coincident-shell
  controls, `is_closed` stays false, so the mesh still draws as open and
  is not checked, as today.
- `packages/core/src/capture/scene.test.ts`:
  - For edge, face and crossed-diagonal face contact,
    `buildCadCaptureModel` reports no `cad.body.missing`. Both the mesh
    body and the plate body end with a `difference` step, and the
    `prepareCadCapture` scene bytes differ from the uncut control.
  - The open-triangle and welded-overlap controls keep
    `cad.body.missing`, with bytes equal to the uncut control, and the
    separated control applies the cut. These are guards.
- `packages/cad-kernel/src/worker-host.test.ts`: the real worker cuts
  edge, face and crossed-diagonal face contact, and each exported plate
  is 480 mm^3 within the file's existing volume tolerance. This is a
  guard; the audit and the step-3 review observed the worker accepting
  these meshes.
- Native (R12-7 plan): the edge-contact, face-contact and
  crossed-diagonal top-view captures exit 0 without `cad.body.missing`,
  and each PNG differs from its uncut control.
- Docs: `docs/capture.md` (the closed-mesh paragraph after line 87) and
  `docs/cad3d.md:39` gain one sentence each: a closed mesh may consist
  of several closed shells, including shells that touch along an edge or
  a face when their bounding boxes do not overlap. Other touching shells
  stay display-only.

R12-7 Native parity for R12-1 and R12-6 (`apps/cli/src/native-parity/capture.test.ts`).

- Contact fixture from the finding:
  - Mesh: a closed binary-STL box at X -32..32, Y 0..8, Z -4..0, through
    `stlToInlineMesh`.
  - Upper body: the rectangle (-32,0)..(32,8) on `xy`, extruded 4 mm as
    a new body.
  - Run
    `capture <doc> --view back|front --size 64x64 --zoom 1.08 --target 0,0,0.25 --fail-on-interference --output <png> --force`.
  - Expect exit 0, stdout containing `interference: 0`, and PNG bytes
    equal to the same view captured with `--no-interference` (no
    hatch).
  - Overlap control: the sketch at base `xy` offset -0.01 with distance
    4.01. Expect exit 1 and `interference: 1` in both views.
  - Before R12-1, the back view exits 1.
- Touching shells: see R12-6. The test fails before R12-6, because the
  native decoder used `closed_by`.

### 29.2 Plan grouping

Plans `car12-*` follow the 28.2 rules, with evidence under
`tmp/car12-r12/<planId>/` and `CARGO_TARGET_DIR=target/car12-<plan>`.
Every plan sets `artifactRoots ["target", "tmp/cad3d"]` exactly and has
a non-empty `acceptanceCriteria`. Its `writePaths` include its own plan
and progress files. This revision already updates sections 19.1, 19.3
and 29, so no plan edits this document.

| Plan | Rule | Owns | dependsOn |
| --- | --- | --- | --- |
| car12-p1-mesh-volume-ownership | R12-1 | `crates/capture/src/mesh.rs`, `crates/capture/src/prism.rs` (visibility only), `crates/capture/src/raster/reference.rs`, `crates/capture/src/raster/tests.rs` | - |
| car12-p2a-segment-sweep | R12-2 module | new `packages/core/src/cad/segment-sweep.ts`, new `packages/core/src/cad/segment-sweep.test.ts` | - |
| car12-p2b-profile-sweep | R12-2 integration | `packages/core/src/cad/loops.ts`, `packages/core/src/cad/loops.test.ts` | p2a |
| car12-p3-selected-ancestry | R12-3 | `packages/core/src/capture/scene.ts`, `packages/core/src/capture/scene.test.ts` | - |
| car12-p4-side-face-members | R12-4 | `packages/core/src/cad/history.ts`, `packages/core/src/cad/history.test.ts` | - |
| car12-p5-inspector-targets | R12-5 | `packages/ui-solid/src/cad/extrude-targets.ts`, `packages/ui-solid/src/cad/extrude-targets.test.ts`, `packages/ui-solid/src/inspector/CadSection.tsx`, `packages/ui-solid/src/test-dom/cad-inspector.dom.tsx` | - |
| car12-p6a-ts-shell-eligibility | R12-6 TS and docs | `packages/io/src/nmesh/capture-decoder.ts`, `packages/io/src/nmesh/capture-decoder.test.ts`, `docs/capture.md`, `docs/cad3d.md` | - |
| car12-p6b-rust-shell-eligibility | R12-6 Rust | `crates/capture/src/mesh.rs`, `crates/capture/src/nmesh.rs`, `crates/capture/tests/mesh.rs` | p1 |
| car12-p6c-shell-capture-tests | R12-6 scene and worker | `packages/core/src/capture/scene.test.ts`, `packages/cad-kernel/src/worker-host.test.ts` | p3, p6a |
| car12-p7-native-parity | R12-7 | `apps/cli/src/native-parity/capture.test.ts` | p1, p2b, p3, p4, p5, p6a, p6b, p6c |

Waves:

- First wave: p1, p2a, p3, p4, p5 and p6a.
- Second wave: p2b, p6b and p6c.
- Last: p7.

p7 depends on every plan for two reasons. The release binary bundles the
TypeScript core, so it must build from a settled tree. And it is the only
plan that edits `capture.test.ts`.

Gates (each exits 0 and runs the plan's new tests):

- p1 and p6b:
  `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-<plan> cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-<plan> cargo test -p nodetto-capture`.
- p2a: `bunx biome check packages/core/src/cad/segment-sweep.ts packages/core/src/cad/segment-sweep.test.ts && bun test packages/core/src/cad/segment-sweep.test.ts`.
- p2b: `bunx biome check packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts && bun test packages/core/src/cad/loops.test.ts packages/core/src/cad/segment-sweep.test.ts packages/core/src/cad/pcb-outline.test.ts packages/core/src/cad/loop-forest.test.ts`.
- p3: `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts packages/core/src/cad/loop-forest.test.ts`.
- p4: `bunx biome check packages/core/src/cad/history.ts packages/core/src/cad/history.test.ts && bun test packages/core/src/cad/history.test.ts`.
- p5: `bunx biome check packages/ui-solid/src/cad/extrude-targets.ts packages/ui-solid/src/cad/extrude-targets.test.ts packages/ui-solid/src/inspector/CadSection.tsx packages/ui-solid/src/test-dom/cad-inspector.dom.tsx && bun test packages/ui-solid/src/cad/extrude-targets.test.ts packages/ui-solid/src/inspector/cad-edits.test.ts`.
  `cad-edits.test.ts` is run but not edited. Its inspector test launches
  the edited DOM file.
- p6a: `bunx biome check packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/capture-decoder.test.ts && bun test packages/io/src/nmesh/capture-decoder.test.ts packages/io/src/nmesh/capture-decoder-budget.test.ts`.
- p6c: `bunx biome check packages/core/src/capture/scene.test.ts packages/cad-kernel/src/worker-host.test.ts && bun test packages/core/src/capture/scene.test.ts packages/cad-kernel/src/worker-host.test.ts`.
- p7: `bunx biome check apps/cli/src/native-parity/capture.test.ts && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-p7 cargo build --release -p nodetto-cli && test -x "$PWD/target/car12-p7/release/nodetto-cli" && NODETTO_CLI_TEST_BINARY="$PWD/target/car12-p7/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`.
  Without the variable, `native-parity/harness.ts:6-13` selects
  `test.skip`, so the gate log must list the new R12-7 tests as passed,
  not skipped.

At most two `bun test` or `cargo test` processes run at once.

Integration runs once after all plans land, in this order and under the
26.2 timing rule:

1. `bun run typecheck`, `bun run lint`, then `CARGO_TERM_QUIET=true mise
   run verify`. Goldens are checked and never regenerated.
2. Run this self-contained command from the repository root, in the same
   shell or a fresh one (step-3 review r12-final-native-binary-binding):
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-p7 cargo build --release -p nodetto-cli && test -x "$PWD/target/car12-p7/release/nodetto-cli" && NODETTO_CLI_TEST_BINARY="$PWD/target/car12-p7/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/mcp-stdio.test.ts`.
   The build is a no-op if p7's binary is current. The saved log must
   show the native capture tests (including every R12-7 case) and the
   native MCP case of `mcp-stdio.test.ts:19-26` as passed, not skipped.
   A log in which they are skipped does not count as a pass.
3. Check that no `*.test.ts` remains under `target/` or `tmp/`.

### 29.3 Decisions

- R12-1 changes only the volume path. Shading keeps the top-left rule, so
  goldens and determinism are untouched. The picture rechecks a mesh only
  where the two rules disagree, through the existing prism recheck seam.
- R12-1 uses canonical (vertex-index-ordered) edge evaluation and a
  symmetric band. Two triangles sharing an edge then see opposite values
  and one tie decision. Without that, a band could double-count or drop a
  ray at its edge.
- R12-2 uses the sweep only to prove disjointness, with a one-sided
  contract (`provesDisjoint`). When a contact exists, or the input has a
  collapsed segment, the old enumeration runs and chooses the reported
  ID, so first-error identity cannot drift. Collapsed segments are handed
  off instead of being modelled in the sweep, because grid construction
  keeps them only for repeated vertices, which ordinary disjoint sketches
  lack. The sweep checks the bounding-box precondition itself before
  calling `segmentIntersection`. Degenerate cases are guarded by a
  3,000-case differential test (soundness on every case, completeness
  without collapse) and by the crowded repeated-vertex profile.
- R12-2 keeps `SWEEP_PAIRS_PER_BOX`, so ordinary sketches never reach the
  new code. That is pinned by `segmentFallbacks === 0` and the unchanged
  `segmentTests` on the 500-feature fixture.
- R12-3 reuses `loopForest` (R10-3) instead of a new structure, with a
  linear budget like R10-3's `DEPTH_WORK_PER_VERTEX`. Windings are all
  positive by the `counterClockwise` invariant, so `loops.ts` is not
  edited and p3 does not wait for p2b.
- R12-3 keeps normalization before `chargeTool`. With near-linear work,
  reordering would change diagnostics for no measurable gain.
- R12-4 builds a lazy per-tool set behind a `4 * memberTotal` scan budget.
  It does not reuse the profile member index (`history.ts:526-536`),
  because that index covers all profile loops, including omitted ones,
  and would need a selected-loop filter per query. So p4 edits only
  `history.ts` and is independent of p2b.
- R12-5 keeps `displayedExtrudeTargets` as a delegating wrapper, so
  `extrude-authoring.ts` and its tests are unchanged.
- R12-3's full-scene oracle reuses the real model's bodies and metadata,
  rebuilds only the tool loops from `oracleNormalise`, and serializes
  with `writeCaptureScene`. Real documents measure the production
  builder at sizes within the page limit. The raw helper covers the one
  shallow size that exceeds it.
- R12-6 admits a welded contact only on the contact path, C1 to C6:
  balanced halfedges; cancelling coplanar patch pairs with exactly
  reversed boundaries, so any triangulation of a shared face cancels;
  shells that each close with same-sign non-zero volume; and shells
  whose bounding boxes have disjoint interiors. Patch cancellation is
  exact because a planar triangle chain is determined by its boundary,
  and it needs no polygon overlay. It is guarded in two ways. It runs
  only on coordinates that round-trip losslessly through the NMESH grid,
  so off-grid raw scenes keep their prior open classification. And
  every cancelled boundary must stay attached to exactly two surviving
  opposite uses, so whole coincident shells cannot vanish. Box
  disjointness is the simplest exact, linear test that rules out shared
  volume. It is identical on integers in both languages, and it keeps
  today's rejection for every contact it cannot prove safe, including
  the reviewer's welded overlap. A full surface-intersection test was
  rejected as disproportionate.
- R12-6 leaves the fast path for meshes whose edges all have two uses
  untouched, in all three implementations. Previously eligible meshes
  therefore keep their classification and allocation counts.
- No user decision is pending, so there is no `design-docs/user-qa/`
  file.

### 29.4 Intentional differences from the workflow input

- The intake's suggested P6b/P6c split is regrouped. Worker and scene
  tests move to p6c, after p3. Every native parity assertion of R12-1 and
  R12-6 moves to one final plan, p7, so the release build runs once on a
  settled tree. p1 is verified by Rust raster tests, and its native
  assertions land in p7.
- R12-2 becomes two plans (p2a module, p2b integration), to respect the
  limits of about four files and about 150 lines per plan.
- The existing Rust test `cube_surface_casts_are_not_ownership_sensitive`
  is renamed and its `[0,0]` point asserts the new volume result. The
  finding requires the volume rule to differ from the facet rule at
  exactly such ties. The other four points keep their assertions, and the
  facet output at `[0,0]` is still pinned.
- In the native contact test, "no hatch" is asserted as PNG equality
  with the `--no-interference` capture. That is the CLI counterpart of
  the Rust `draw_interference = false` equality.
- The 0.01 mm overlap control requires a pair and exit 1, not a visible
  hatch. A 64 x 64 image need not have a sample row inside a 0.01 mm
  slab; the lattice analysis reports the pair either way.
- Per-plan gates leave out `bun run typecheck` and `mise run verify`.
  Those run once at integration.
- R12-6 is narrower than "accept whatever Manifold accepts". It admits
  only contacts it can prove safe (C1 to C6). It keeps today's rejection
  for the welded overlap, double-sided fins, and touching shells with
  overlapping boxes. The finding's edge and face fixtures, with either
  shared-face triangulation, are admitted.
- p5 runs `inspector/cad-edits.test.ts` without editing it, because that
  file is the only launcher of `cad-inspector.dom.tsx`.

### 29.5 Risks

- R12-1: a recast at a near-tie charges `recast` and `traverse` budget.
  Axis-aligned mesh fixtures whose pixel centres fall exactly on rim
  edges may change exact census counts in a test. The plan reports any
  such change and the tie that caused it; it never relaxes a bound.
- R12-1: the band is a bound, not a proof, for oblique and curved
  contacts. Only axis-aligned contacts and the oblique watertightness
  guard are tested.
- R12-2: a Shamos-Hoey degeneracy bug in the dangerous direction (missing
  a contact) would accept an invalid sketch. Guards: the one-sided
  contract, the collapsed-segment handoff, the box precondition, and the
  differential test on a small grid that is dense in degeneracies. The
  plan must report all four case counts as non-zero.
- R12-2: a crowded sketch that does contain a contact or a repeated
  vertex still pays the old quadratic enumeration on its error path. The
  finding's input is valid, and such a sketch is rejected either way.
- R12-3: if an existing fixture crosses the 32-per-vertex budget, its
  exact `ancestorProbes` assertion could change. The plan records each
  fixture's work.
- R12-6: the box test is conservative. Touching shells with overlapping
  bounding boxes but disjoint solids (an L-shape with a box in its
  notch), and partial face contacts whose two shared-face patches have
  different boundaries, stay display-only in capture, while the desktop
  worker may accept them. That is today's behaviour, and capture still
  reports it with `cad.body.missing`.
- R12-6: the contact path adds about 100 to 150 lines per language,
  including exact plane keys (`BigInt`, `i128`). p6a and p6b are at the
  upper plan-size limit. If either exceeds it, the plan may split the
  helper and its tests into a chained follow-up plan that owns the same
  files, recorded before dispatch.
- R12-6: Manifold's handling of the welded-overlap control was not
  measured. Capture keeps today's rejection for it.
- R12-6: shells that overlap without sharing any edge were already
  eligible, and still are. Only the edge-contact and face-contact
  fixtures, including the crossed-diagonal variant, are claimed (19.3).
- Not measured: Boa elapsed time, desktop frame time, native peak memory,
  Tauri IPC, MCP delivery and desktop WebGL.

## 30. Revision 19: audit round 13 corrections

Source: audit round 13 of the 3D CAD pages and AI capture, base `0a35708`
to `25b4e97` plus the uncommitted round-12 tree (28 modified tracked
files, 11 untracked). Four findings (three high, one medium), none
deferred. No GitHub issue exists; the round-13 workflow input is the issue
body. Where an earlier section and this one disagree, this section wins.
The common rules of section 24, the timing rule of 26.2, the plan rules of
28.2 and the ordinary-input rule of section 29 still apply. Each fix needs
a regression test that fails before the change and passes after it in
this tree. Performance is asserted with deterministic work counters, never
clocks. Bytes, goldens, error codes, NCS1 layout, report formats and the
CLI, MCP and desktop contracts stay unchanged unless a rule below says
otherwise.

Round-12 status carried in: car12-p1 to p6a and p6c are implemented.
car12-p6b (Rust welded-shell closure) is in progress: it added the
failing regression `welded_edge_contact_is_closed`
(`crates/capture/tests/mesh.rs`) but no implementation. car12-p7 (native
parity) never started. R13-4 finishes R12-6 in Rust, and R13-5 replaces
car12-p7. The rules of R12-6 (C1 to C6) and R12-7 stay valid; this
section only adds what the audit found missing.

### 30.1 Rules

R13-1 `function-capture-mesh-prism-touching-face` (high).

Cause. R12-1 aligned mesh and prism ownership only at an exact tie. A
prism cap admits a ray within a band that scales with extrusion height
(`prism.rs:211-240`); a closed mesh admits a ray within a band that
scales with its projected edge (`mesh.rs:309-344`). For a tall extrusion
seated on a short STL box the two bands differ by about two orders of
magnitude. At the fitted front or back view (3.24 mm/px, 64 x 64, 2x
supersampling) a sample row lands at Z = -7.1e-15 mm: outside the mesh
band, inside the prism band, so both bodies own an 8 mm depth interval.
The 3D candidate test (`interference.rs:131`) correctly rejects the
zero-thickness joint, but the picture witness (`raster.rs:299-318`)
records the pair, the hatch is drawn and `marks.picture_only` adds it to
the report (`interference.rs:585-597`). `--fail-on-interference` then
exits 1.

Rule.

1. Conservative body boxes. A body's box is the union of the bounds of
   the tools of its `Op::Union` steps, exactly as
   `interference.rs:325-339` computes the candidate boxes today. That
   code moves unchanged into `lattice::body_boxes(scene, tools) ->
   Vec<Bounds>`, and `interference.rs` calls it. Difference and
   intersection steps only remove volume, so the box contains the body.
   A body without a valid union tool gets the empty box.
2. Shared extent. `lattice::shares_extent(a, b) -> bool` is true when,
   on every axis, `min(maxA, maxB) - max(minA, minB) > 0.0`. The empty
   box shares extent with nothing. The threshold is exactly zero, not
   `scene.tolerance`: only pairs proven to have no common open interval
   on some world axis are dropped.
3. Witness filter. The production raster computes `body_boxes` once per
   render (stored next to `solid_tools`). In the sample loop, after
   `overlay::overlapping_pairs_iter` fills `scratch.overlaps`, a pair
   `(a, b, s0, s1)` whose boxes do not share extent is skipped before
   `marks.record` and before `marked` is set. The sample is not hatched
   and the pair never reaches `picture_only` or the report. The reference
   renderer (`raster/reference.rs:124-140`) applies the same filter at
   the same point, so the production-versus-reference comparisons stay
   exact.
4. Unchanged: facet shading, volume intervals, the lattice analysis and
   its candidate test, witness budgets and charges for kept pairs, the
   report types, the CLI, Tauri and MCP. Pairs whose boxes share any
   positive extent keep today's picture-only witness, including thin
   penetrations.
5. Why it is safe. Two bodies whose boxes share no positive extent on
   one axis cannot share volume, because each body lies inside its box.
   A dropped pair can only be a band artefact. Box rounding can hide at
   most a rounding-sized true overlap, far below the 0.001 mm
   interference tolerance (`docs/capture.md:105`).

Tests (each new test fails before the fix unless marked as a guard):

- `raster/reference.rs` fixture `tall_mesh_under_prism(back: bool,
  overlap: f64)`:
  - Tool 0: a closed 12-triangle outward mesh box at X -1..1, Y 0..8,
    Z -35.25..0. These are the positions the STL import produces for the
    finding's box (all values lie on the NMESH grid). Rust has no STL
    reader, so the end-to-end STL path is covered by R13-5.
  - Tool 1: a prism of the rectangle (-1,0)..(1,8) from
    Z = 0 - overlap to 156.75, so the top stays fixed.
  - Two `new` bodies, width and height 64, supersample 2.
  - Camera: the default-fit camera that `prepareCadCapture` returns for
    the finding's document in the front view and in the back view. The
    plan gets the exact f64 values from a one-off probe under its
    evidence directory (never a `*.test.ts` file) and copies them as
    literals with a comment naming the probe log.
- `raster/tests.rs`:
  - `production_touching_tall_mesh`: `production_touching` on
    `tall_mesh_under_prism(false, 0.0)` and `(true, 0.0)`. That means zero
    pairs, zero candidates, identical RGB at threads 0..=8 and against the
    reference, and RGB equal to the `draw_interference = false` render.
    The plan records the fail-before log. If neither view fails before
    the fix with the probed camera, the fixture is wrong and the plan
    fixes the camera, not the assertion.
  - `production_tall_mesh_penetration`: `tall_mesh_under_prism(back,
    0.01)` for both views, through `compare_every_thread_count`, gives
    exactly one pair `(0, 1)`. No RGB-difference assertion: at 3.24 mm/px
    no sample row need fall inside a 0.01 mm slab. This is a guard.
  - `shares_extent` unit cases: touching boxes on each axis (false),
    0.01 mm overlap (true), an empty box (false).
- `raster/reference.rs` `witness_tests`: `touching` on both tall views.
- Every existing raster, interference, witness, golden and determinism
  test stays unedited and passes, including `production_touching_*`,
  `production_overlap_witness` and
  `stacked_caps_witness_charge_is_the_delta`. If a census or charge count
  moves, the plan reports both values and the dropped pair that caused
  it; it never relaxes a bound.
- Native: see R13-5.

R13-2 `performance-cad-side-face-member-rescans` (high).

Cause. R12-4 keys the side scan budget and the lazy member set by the
`ExtrudeGeometry` object (`history.ts:482-513`). `extrude()` returns a
fresh object per extrusion (`history.ts:607`), even when its `loops` is
the shared whole-profile array (`history.ts:579`). K whole-sketch
extrusions of one M-member profile, each queried once for a late member,
cost M x K comparisons, and repeated queries build K copies of the same
member set.

Rule. Side queries resolve membership from the profile member index that
`extrude()` already builds once per sketch (`history.ts:565-575`,
`memberIndices`). No new work is added to ordinary documents.

1. The cap-face and base-plane paths are unchanged and allocate nothing.
2. Source lookup. For a side query on `feature`, let
   `source = history.byId.get(feature)`. When `source` is a
   `cad.extrude`, its `semantic.sketch` has a non-error entry in
   `profiles`, and `memberIndices` holds that sketch's index, the query
   uses rule 3 or 4. Otherwise (a `cad.pcb` tool, or a tool registered
   under an ID that is not in history, as some unit tests do) the R12-4
   budgeted path runs unchanged.
3. Whole profile: `tool.loops === profile.loops`. The answer is
   `index.has(line.id)`, counted as one `sideMemberVisits`. Nothing is
   allocated.
4. Explicit selection: `tool.loops !== profile.loops`. On the tool's
   first side query, build `Set<CadLoop>` from `tool.loops` once, kept in
   a lazily created `Map<ExtrudeGeometry, Set<CadLoop>>`. That costs
   `tool.loops.length` visits and adds the same number to the new counter
   `cadGeometryWork.sideSelectionEntries`. A query then reads
   `indices = index.get(line.id) ?? []` (one visit) and checks
   `selected.has(profile.loops[i])` for each index (one visit each). The
   selected loops are the same `CadLoop` objects as the profile's
   (`history.ts:584-589`), so identity is exact. A line that belongs only
   to an omitted loop finds no selected loop and returns
   `cad.reference.missing`, as today.
5. Bounds. A line borders at most two profile loops, so a query costs at
   most three visits. Per explicit tool the set costs at most the number
   of selected loops, which is at most twice the distinct IDs in its own
   `semantic.loops`. Total work is therefore at most `3 * queries` plus
   the selection input size, never M x K. Whole-profile tools retain no
   set.
6. `sideMemberIndexBuilds` keeps counting R12-4 member-set builds only.
   The frame for a hit is `faceFrame(tool.frame, tool.span, role, line)`
   as today.
7. This reverses the round-12 decision not to reuse the member index
   (29.3): the selected-loop set answers the omitted-loop objection with
   linear work.

Tests (`packages/core/src/cad/history.test.ts`; counters reset before
each measurement):

- Shared whole profile, through `checkCadPage` on real documents: one
  closed M-line profile, K whole-sketch `new` extrusions of distinct
  distances, and one side sketch per extrusion on the profile's last
  member. Sizes M = K = 256, 512 and 1024 (at most 3,073 records).
  Assert no errors, `sideMemberVisits === K`, `sideMemberIndexBuilds ===
  0` and `sideSelectionEntries === 0`. Before the fix visits are M x K.
- Shared explicit selection, through `checkCadPage`: a 4-line rectangle
  and a disjoint M-line loop in one sketch, K extrusions that each select
  the M-line loop by one member ID, and per extrusion four side sketches
  on M-loop members plus one on a rectangle line. Same sizes with
  K = M / 4. Assert exactly K `cad.reference.missing` errors, each with
  the rectangle line's ID, `sideSelectionEntries === K`,
  `sideMemberIndexBuilds === 0` and `sideMemberVisits <= K * (1 + 3 * 5)`.
- Frames: for the smallest size of each workload, drive
  `createCadGeometry(scanCadPage(elements))` with the extrusions
  registered under their real feature IDs, and assert each hit equals
  the `faceFrame(...)` expectation for its line.
- Ordinary baseline: the existing test on
  `generateCadDocument({ features: 500, entitiesPerSketch: 18 })` also
  asserts `sideSelectionEntries === 0`; `sideMemberVisits` and
  `sideMemberIndexBuilds` stay 0. That document has one extrusion per
  sketch and no side sketches (`cad/testing/generate.ts:100-113`), and
  its `profileBuilds` and `loopProbes` stay as measured before the
  change (the plan records both).
- The existing side-member tests (`history.test.ts:582-713`) stay
  unedited and pass. They register tools under IDs absent from history,
  so they keep exercising the R12-4 path and its exact counts.

R13-3 `performance-capture-shared-profile-ancestry-rebuilds` (medium).

Cause. `buildCadCaptureModel` calls `normaliseToolLoops(geometry.loops,
stats?.ancestry)` for every tool (`scene.ts:494`). K whole-sketch
extrusions share one loop array (`history.ts:579`), but each call
rebuilds the indexes and restarts the 32-per-vertex budget, so ancestry
work is K times one normalization.

Rule. The cache is threshold-gated, so ordinary single-use profiles and
explicit subsets take the direct path and pay no cache work (step-3
review r13-ancestry-cache-ordinary-work). Only `scene.ts` changes; no
caller or shared file is edited.

1. Direct path. Every tool whose feature is not a whole-sketch extrusion
   (a `cad.pcb` tool, or a `cad.extrude` with `semantic.loops` defined)
   calls `normaliseToolLoops` exactly as today, with no lookup and no
   insertion. Such arrays are fresh per extrusion and can never hit.
2. Work report (step-3 review r13-ancestry-cache-admission-undercount).
   `normaliseToolLoops` gains an optional third parameter
   `work?: { prepared: number; searched: number }`. When it is given,
   the function stores two separate measures. Neither changes the R12-3
   fallback budget, which still compares only the local `work` counter
   that starts at `scene.ts:243`.
   - `prepared` is the number of coordinates it rounded to the grid and
     scanned for bounds before that counter starts (`scene.ts:220-226`),
     that is the sum of `loop.points.length` over the input loops. It is
     0 for the all-depth-zero early return (`scene.ts:218`), which
     prepares nothing.
   - `searched` is the local `work` total at return. After a forest
     fallback it is the abandoned first-path total, which already exceeds
     the 32-per-vertex budget.
   Its result and its `stats` behaviour are unchanged.
   `buildCadCaptureModel` allocates one such object per walk and reuses
   it.
3. Admission. The admission cost of a normalization is
   `prepared + searched`. For a whole-sketch extrusion (`cad.extrude`,
   `semantic.loops === undefined`):
   - If the walk's cache exists, look up `geometry.loops` by identity.
     A hit reuses the stored loops and skips normalization, including
     preparation.
   - Otherwise normalize. Store the result under `geometry.loops` only
     when its admission cost is at least `PROFILE_CACHE_MIN_WORK = 4096`.
     The `Map<readonly CadLoop[], readonly CadLoop[]>` is created lazily
     at the first admission and is local to the walk, so nothing is
     shared between captures.
   - Calibration. On the ordinary fixture each sketch is an 8-line
     outline with 10 radius-1 circles (`cad/testing/generate.ts:54-99`).
     That is about 328 vertices (656 prepared coordinates; the reviewer's
     sparse probe implies 32 vertices per radius-1 circle), plus at most
     119 searched units as measured by the reviewer. The estimated cost
     of at most about 775 is below `4096 / 4`. The reviewer's sparse
     high-vertex profile costs 32,840 + 238 = 33,078, and one slanted-rim
     tool at N = 1024 costs over 500,000. Both are admitted.
   - The ordinary path therefore creates no map, makes no lookup and
     stores nothing. A sub-threshold whole profile shared by K
     extrusions costs below 4,096 units per tool, about 2,048 prepared
     coordinates at most. The remaining repeated work is therefore at
     most 4,096 units per tool, and those points are already charged
     against the point limit.
4. The key is array identity only. The rule depends only on the
   whole-profile reuse already present at `history.ts:579`, not on any
   R13-2 change (R13-2 does not alter that array or its identity).
5. Per tool, unchanged: `chargeTool` with the normalized loop counts (so
   each tool is charged its own points), `makeTool`, `sweptBounds` with
   the tool's own frame and span, face IDs and the body or step it
   creates. Cached loops are typed `readonly` and are never mutated.
6. Counters. `CaptureWalkStats` gains an optional
   `profileCache?: { lookups: number; admitted: number; hits: number;
   prepared: number; maxDirectWork: number }`. They are updated only
   when `stats.profileCache` is set:
   - `lookups` counts map lookups;
   - `admitted` counts stored entries;
   - `hits` counts reused results;
   - `prepared` sums the `prepared` coordinates of every normalization
     actually performed, for every tool kind;
   - `maxDirectWork` is the largest admission cost of a whole-sketch
     normalization that was not admitted (the threshold margin).

Tests (`packages/core/src/capture/scene.test.ts`):

- Shared fixture: the R12-3 shallow sketch at N = 1024 (slanted rims
  with one hole each) with K = 32 `new` extrusions of distinct distances,
  each selecting the whole sketch (no `loops`): at most 8,225 records and
  262,144 emitted points. Run `buildCadCaptureModel` with
  `stats.ancestry` and `stats.profileCache` on it and on the same sketch
  with K = 1. Assert that the total ancestry work (`depthLookups +
  ancestorProbes + indexEntries + edge work + forest.events +
  forest.steps`), `forestFallbacks` and `profileCache.prepared` are
  equal for K = 32 and K = 1, and that K = 32 gives `admitted === 1`,
  `lookups === 31` and `hits === 31`. Before the fix the ancestry work is
  32 times larger.
- Sparse high-vertex fixture (the reviewer's probe): one XY sketch with
  a 10 x 10 mm rectangle at the origin, a radius-1 circle hole at (5, 5)
  and 64 disjoint radius-100 circles on an 8 x 8 grid starting at
  (300, 300) with 300 mm spacing; K = 1 and K = 32 whole-sketch `new`
  extrusions with distances 1..K (at most 102 records). Assert no
  errors, no point-limit failure and zero `forestFallbacks`. Assert that
  ancestry work and `profileCache.prepared` are equal for K = 32 and
  K = 1, with `prepared` equal to the measured K = 1 value (the
  reviewer measured 32,840 coordinates), and that K = 32 gives
  `admitted === 1`, `lookups === 31` and `hits === 31`. A rule that
  admits on the searched units alone (238 here) fails this test.
- Scene oracle for the sparse fixture: the K = 32 scene bytes equal the
  oracle built as for the slanted-rim fixture.
- Scene oracle: for the K = 32 fixture, compare the prepared scene bytes
  with the R12-3 full-scene oracle (each tool's loops rebuilt from
  `oracleNormalise`, serialized with `writeCaptureScene`), and assert
  each body's bounds from its own distance.
- Explicit subsets: the same N = 1024 sketch with two extrusions that
  select different heavy subsets through `loops`. Each keeps its own
  retained contours (bytes equal the oracle), the ancestry work equals
  the sum of the two separate single-extrusion runs, and
  `profileCache` reports `lookups === 0`, `admitted === 0` and
  `hits === 0`.
- Ordinary guard: `buildCadCaptureModel` on
  `generateCadDocument({ features: 500, entitiesPerSketch: 18 })` with
  `stats.ancestry` and `stats.profileCache`. Assert `lookups === 0`,
  `admitted === 0` and `hits === 0`, the unchanged 5,000
  `ancestorProbes`, 5,500 `indexEntries` and 0 `forestFallbacks`, and
  `maxDirectWork * 4 <= PROFILE_CACHE_MIN_WORK`. The plan records
  `maxDirectWork` and `prepared`. The calibration above predicts at
  most about 775. If the measured value breaks the 4x margin, the plan
  sets the constant to the smallest power of two that is at least four
  times the measured value, provided it stays at most 32,768, so the
  sparse fixture (33,078) is still admitted. It records the change and
  never weakens an assertion. A measured value above 8,192 cannot meet
  both conditions, and the plan reports it as a design defect.
- The deep omitted-ancestor and shallow R12-3 tests, the existing
  ordinary baseline at `scene.test.ts:1727-1737` and the touching-shell
  scene tests stay unedited and pass.

R13-4 `maintainability-capture-touching-shell-mesh-eligibility` (high).

Cause. R12-6 landed in TypeScript only. Rust `closed_by` still rejects
any third use of an undirected edge (`mesh.rs:56-66`), and
`target_eligible` still requires every sorted edge pair to match with
opposite directions and every vertex triple to be unique
(`nmesh.rs:257-268`). The native decoder therefore reports the welded
mesh as not a boolean target, scene preparation marks it display-only and
`construction.ts:115-120` skips the whole cut (`cad.body.missing`). On
desktop, `tool_view.rs:123` classifies the mesh as open and the raster
takes the open-surface path. The `nmesh.rs:532` unit test compares
`is_closed` with the `closed_by` it calls, so it cannot catch this.

Rule. Implement R12-6 C1 to C6 in Rust exactly as specified there, with
these placement and wiring decisions:

1. New module `crates/capture/src/mesh_contact.rs` with
   `pub(crate) fn contact_closed(vertex_count, triangles, position) ->
   bool`. It runs the grid domain check, then C1 to C5, and returns false
   at the first failed step. It allocates only when called.
   - Staging (step-3 review r13-contact-module-independent-gate). In
     p4a, `lib.rs` declares the module as `#[cfg(test)] mod
     mesh_contact;`. Only the test build compiles it, where its unit
     tests are the callers. The non-test library has no unused item, so
     `cargo clippy --all-targets -- -D warnings` passes on its own.
   - In p4b, the same change that makes `closed_by` call
     `contact_closed` turns the declaration into `mod mesh_contact;`.
     The production registration and its first production caller
     therefore land together.
   - Grid domain (R12-6 C2): for every vertex coordinate `v` from
     `position`, `k = (v * UNITS_PER_MILLIMETRE).round()`; require `k`
     finite, `|k| <= COORDINATE_LIMIT` and `(k as i64) as f64 /
     UNITS_PER_MILLIMETRE == v` bit for bit. Those two constants in
     `nmesh.rs` become `pub(crate)`; no value changes.
   - Exact arithmetic: integer vertices as `i64`; normals, plane
     offsets, gcd, box comparisons and shell volumes in `i128` with
     `checked_*` operations. Any overflow returns false. A zero integer
     normal returns false before any gcd.
2. `closed_by` (`mesh.rs`) keeps its signature, its
   `CLOSURE_EVALUATIONS` increment and its fast path. When the sorted
   undirected edges contain a group of three or more uses, it returns
   `mesh_contact::contact_closed(...)` instead of false; C1 rejects any
   odd count. Meshes whose edges all have two uses never reach the new
   module, so their result and allocations are unchanged. `is_closed`
   gains the contact path through `closed_by`.
3. `target_eligible` (`nmesh.rs`) keeps calling `closed_by` first and
   then groups its sorted directed edges by undirected edge:
   - a group of two uses: today's rule (same pair, opposite directions);
   - a group of four or more: accepted here, because `closed_by` already
     proved C1 balance and C4 per-shell closure;
   - any other size: false.
   The vertex-triple duplicate check runs only when every group has two
   uses (the fast path). On the contact path `closed_by` has already
   applied C2's post-cancellation duplicate rule. The emptiness test (d)
   then runs unchanged on the original triangles (C6). `AllocStats` and
   the existing allocation and closure-count assertions stay the same
   for every existing fixture.
4. Unchanged: the TypeScript decoder (independent, no shared code),
   `tool_view.rs`, `scene.ts`, the atomic rejection in `construction.ts`
   and the worker.

Tests (fixtures are the nine R12-6 meshes, built in each test; the
expected booleans are written literally in each language, never
imported):

- `mesh_contact.rs` unit tests: edge contact true; welded overlap,
  coincident shells and a zero-normal integer triangle false; an
  overflow-scale input returns false without a panic.
- `crates/capture/tests/mesh.rs`: `welded_edge_contact_is_closed` (from
  car12-p6b) passes unedited. `closed_by` and `is_closed` are true for
  edge contact, face contact, crossed-diagonal face contact and the
  separated control, and false for the open triangle, unbalanced edge,
  welded overlap, double-sided fin and coincident shells. The off-grid
  raw mesh returns false through both entry points without a panic.
- `nmesh.rs` unit tests: each of the nine meshes is NMESH-encoded and
  decoded; `boolean_target` equals the expected boolean (the same table
  as `capture-decoder.test.ts`). The tautological assertion at
  `nmesh.rs:532` is replaced by an assertion against the expected closed
  classification of that fixture; its other assertions stay.
- Guards that stay unedited and pass: `closure_count.rs`, the
  `capture-decoder` and `capture-decoder-budget` tests, the scene
  touching-shell tests, and the worker 480 mm^3 export and atomic
  open-mesh rejection (`worker-host.test.ts:544`, `:568`).
- Native: see R13-5.

R13-5 Native parity for R13-1, R13-4 and the unlanded R12-7
(`apps/cli/src/native-parity/capture.test.ts`).

- Tall flush fixture: binary STL bytes of the outward 12-triangle box
  X -1..1, Y 0..8, Z -35.25..0, built in the test and imported with
  `stlToInlineMesh`; the rectangle (-1,0)..(1,8) on `xy` extruded
  156.75 mm as a new body. Run
  `capture <doc> --view front|back --size 64x64 --fail-on-interference --json --output <png> --force`
  with default framing. Expect exit 0, zero pairs and zero candidates in
  the JSON, and PNG bytes equal to the same capture with
  `--no-interference`.
- Tall penetration control: the sketch at base `xy` offset -0.01 with
  distance 156.76. Expect exit 1 and exactly one pair naming the two
  body IDs, in both views.
- R12-7 short mixed contact and its 0.01 mm overlap control, exactly as
  R12-7 specifies (it never landed).
- Welded shells: the R12-6 edge-contact, face-contact and
  crossed-diagonal documents (mesh plus plate plus cut), each with its own
  uncut control. Each is captured with
  `--view top --size 160x160 --json`. For every cut document:
  - exit 0 and no `cad.body.missing`;
  - the mesh body's existing report field `open` is `false`;
  - PNG bytes differ from the uncut control's.
- Through-hole proof for the welded shells (step-3 review
  r13-welded-native-both-target-proof). It uses the existing
  `cadPixels(...).world` helper (`capture.test.ts:270-289`), as the plate
  through-hole test does (`:390-400`):
  - First assert `camera.mmPerPixel <= 0.25` from the JSON. The pixel
    containing the hole centre then has every supersample within
    0.125 mm of it, inside the 2 x 2 mm opening (1 mm from each edge).
  - The hole centre `(2, 2, 10)` must equal the background colour in
    each cut capture. Only a cut through both the plate (z 5..10) and the
    mesh box (z 0..5) shows background there. If only the plate is cut,
    the mesh top shows.
  - The same point must not equal the background in each uncut control.
  - Adjacent solid samples must not equal the background in both the cut
    and the uncut capture: the plate at `(6, 6, 10)`, and the uncut mesh
    shell B at its top-face centre (`(15, 15, 5)` for edge contact,
    `(15, 5, 5)` for both face contacts). These check framing and
    visibility.
- The existing open-triangle and tetrahedron cases stay and keep the
  atomic open-mesh rejection.
- Before R13-1 the tall contact case exits 1; before R13-4 the welded
  cases report `cad.body.missing`.

### 30.2 Plan grouping

Plans `car13-*` follow the 28.2 rules, with evidence under
`tmp/car13-r13/<planId>/` and `CARGO_TARGET_DIR=target/car13-<plan>`.
Every plan sets `artifactRoots ["target", "tmp/cad3d"]` exactly, has a
non-empty `acceptanceCriteria`, and lists its own plan and progress files
in `writePaths`. This revision already updates this document, and
`docs/capture.md:87`, `:105` and `docs/cad3d.md:40` already state the
required behaviour, so no plan edits documentation.

| Plan | Rule | Owns | dependsOn |
| --- | --- | --- | --- |
| car13-p1-touching-witness | R13-1 | `crates/capture/src/lattice.rs`, `crates/capture/src/interference.rs` (move of the box code only), `crates/capture/src/raster.rs`, `crates/capture/src/raster/reference.rs`, `crates/capture/src/raster/tests.rs` | - |
| car13-p2-profile-side-index | R13-2 | `packages/core/src/cad/history.ts`, `packages/core/src/cad/history.test.ts` | - |
| car13-p3-shared-ancestry-cache | R13-3 | `packages/core/src/capture/scene.ts`, `packages/core/src/capture/scene.test.ts` | - |
| car13-p4a-contact-module | R13-4 module | new `crates/capture/src/mesh_contact.rs`, `crates/capture/src/lib.rs` (`#[cfg(test)]` registration), `crates/capture/src/nmesh.rs` (constant visibility only) | - |
| car13-p4b-contact-closure | R13-4 closure | `crates/capture/src/mesh.rs`, `crates/capture/src/lib.rs` (production registration), `crates/capture/tests/mesh.rs` | p4a |
| car13-p4c-contact-eligibility | R13-4 eligibility | `crates/capture/src/nmesh.rs` | p4b |
| car13-p5-native-parity | R13-5 | `apps/cli/src/native-parity/capture.test.ts` | p1, p2, p3, p4c |

Waves: p1, p2, p3 and p4a; then p4b; then p4c; then p5. The p4 chain is a
real contract: each step needs the previous API, p4a and p4b share
`lib.rs`, and p4a and p4c share `nmesh.rs`. Those shared files are
already ordered by the existing dependencies p4b -> p4a and p4c -> p4b.
p3 edits only `scene.ts` and its test; the R13-3 admission needs no
caller change. p5 needs a settled tree because the release binary bundles
the TypeScript core, and it is the only plan that edits
`capture.test.ts`. car12-p6b and car12-p7 are superseded: car13-p4b
adopts the existing `welded_edge_contact_is_closed` test, and car13-p5
carries R12-7.

Gates (each exits 0 and runs the plan's new tests). The Rust gates of p1
and p4a use `--lib`, because the integration test
`welded_edge_contact_is_closed` fails until p4b lands:

- p1 and p4a:
  `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-<plan> cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-<plan> cargo test -p nodetto-capture --lib`.
- p4b and p4c: the same with the full `cargo test -p nodetto-capture`.
  p4c adds
  `bun test packages/io/src/nmesh/capture-decoder.test.ts packages/io/src/nmesh/capture-decoder-budget.test.ts`
  (run, not edited) as the cross-language guard.
- p2: `bunx biome check packages/core/src/cad/history.ts packages/core/src/cad/history.test.ts && bun test packages/core/src/cad/history.test.ts`.
- p3: `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts packages/core/src/cad/loop-forest.test.ts`.
- p5: `bunx biome check apps/cli/src/native-parity/capture.test.ts && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p5 cargo build --release -p nodetto-cli && test -x "$PWD/target/car13-p5/release/nodetto-cli" && NODETTO_CLI_TEST_BINARY="$PWD/target/car13-p5/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`.
  The log must list the R13-5 tests as passed, not skipped
  (`native-parity/harness.ts:6-13`).

At most two `bun test` or `cargo test` processes run at once. p1 and p4a
edit the same crate in parallel; if a sibling's in-progress edit stops
the crate from compiling, the plan reruns its gate once the sibling's
save compiles and records both logs.

Integration runs once after all plans land, under the 26.2 timing rule:

1. `bun run typecheck`, `bun run lint`, then `CARGO_TERM_QUIET=true mise
   run verify`. Goldens are checked and never regenerated.
2. From the repository root:
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p5 cargo build --release -p nodetto-cli && test -x "$PWD/target/car13-p5/release/nodetto-cli" && NODETTO_CLI_TEST_BINARY="$PWD/target/car13-p5/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/mcp-stdio.test.ts`.
   A log in which the native cases are skipped does not count.
3. Check that no `*.test.ts` remains under `target/` or `tmp/`.

### 30.3 Decisions

- R13-1 filters picture witnesses with conservative body boxes instead
  of aligning the two tolerance bands. The bands protect watertightness
  inside each body and differ for good reasons. A box test is exact and
  cheap (one per witness pair), and it cannot drop a pair with shared
  volume. The threshold is strictly zero, so every positive-extent thin
  penetration keeps its witness.
- R13-1 reuses the candidate-box definition (moved, not copied), so the
  analysis and the picture agree on what a body's box is.
- R13-2 resolves the extrusion's sketch through `history.byId` instead
  of adding a field to `ExtrudeGeometry`, so the geometry type, its
  equality-based tests and every consumer stay unchanged.
- R13-2 builds a per-tool set of selected loops, not members. It is
  bounded by the extrusion's own selection input, so explicit subsets
  stay linear without a new budget.
- R13-3 caches by array identity for one walk only. It cannot leak across
  captures and cannot merge different selections. Admission is gated in
  two ways: only whole-sketch extrusions (the only arrays that can
  recur), and only normalizations whose admission cost (prepared
  coordinates plus searched units) is at least 4,096. The cost counts
  the per-coordinate rounding and bounds pass, because the searched
  units alone miss sparse high-vertex profiles (238 units for 32,840
  coordinates in the reviewer's probe). The R12-3 fallback budget is
  unchanged. This follows the section 29 rule of a heavier path only
  past a work threshold. Ordinary documents create no map, make no lookup and store
  nothing, and `profileCache` pins that. A reuse pre-pass over the
  features was rejected: it would add per-sketch entries to every
  ordinary capture to find reuse that only heavy profiles benefit from.
- R13-4 registers `mesh_contact` under `#[cfg(test)]` in p4a and for
  production in p4b, together with its first caller. Each gate then
  passes on its own under `-D warnings`.
- R13-5 proves the welded cut reaches both targets with a through-hole
  pixel and an uncut twin, not image inequality alone.
- R13-4 keeps the contact path in its own module, so the fast path in
  `mesh.rs` stays allocation-free and readable, and the TypeScript and
  Rust implementations stay independent.
- R13-4 makes `target_eligible` contact-aware by edge-group size instead
  of exposing a closure-kind enum. `closed_by` keeps its public
  signature, and `closure_count.rs` keeps its call count.
- No user decision is pending, so there is no `design-docs/user-qa/`
  file.

### 30.4 Intentional differences from the workflow input

- The finding asks for the tall fixture "imported through binary STL" in
  the Rust renderer tests. Rust has no STL reader, so the Rust fixture is
  the mesh the import produces (on-grid positions) with the probed
  default-fit camera. The real STL import and fit are exercised by
  R13-5.
- The tall 0.01 mm penetration in Rust asserts the pair, not a visible
  hatch, as in 29.4.
- No documentation edits: the user docs already state that touching
  faces do not interfere and that touching shells with disjoint boxes
  participate.
- R13-4 is split into three chained plans to respect the plan-size
  limit; R13-5 also carries the unlanded R12-7 cases.
- Per-plan gates leave out `bun run typecheck` and `mise run verify`;
  those run at integration.

### 30.5 Risks

- R13-1: the filter removes only pairs with zero box overlap. Oblique
  contacts whose boxes overlap (for example on a rotated sketch plane)
  keep today's band behaviour and may still report a picture-only pair.
  Untested: oblique and partial contacts, rotated frames and other named
  views.
- R13-1: the Rust fixture's camera literals come from a TS probe. If the
  TS fit changes later, the Rust test still guards the filter but may no
  longer reproduce the original sample; R13-5 remains the end-to-end
  guard.
- R13-2: a tool registered under an ID absent from history falls back to
  R12-4. Production registers every tool under its feature ID, so only
  unit tests take that path.
- R13-3: if any consumer mutated a normalized loop array, sharing would
  leak between tools. The plan checks `chargeTool`, `makeTool` and
  `sweptBounds` for mutation and types the cached value `readonly`.
- R13-3: whole profiles below the 4,096-unit admission cost that are
  shared by many extrusions still normalize once per tool. Each such
  call costs under 4,096 units and its points are already charged
  against the point limit, so the remaining repetition is bounded and
  linear in tools.
- R13-3: the ordinary calibration (at most about 775) is derived from
  source and the reviewer's measurements, not from a run in this step.
  The plan measures `maxDirectWork` and applies the bounded constant
  rule in R13-3 if needed.
- R13-4: complex exact geometry (i128, grid conversion, shell
  reconstruction). Misclassification could admit an open mesh. The nine
  fixtures in both languages, the off-grid control and the worker and
  atomic-rejection guards are the defence.
- Parallel Rust plans share one crate; see 30.2.
- Not measured: Boa elapsed time, native peak memory, allocator bytes,
  desktop frame time, desktop WebGL, Tauri IPC and MCP delivery, and
  encoded-byte determinism across platforms for the new fixtures.
