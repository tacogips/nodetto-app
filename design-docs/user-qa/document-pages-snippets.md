# Document authoring (snippets, page frames, document export): owner decisions

Design: `design-docs/specs/design-document-pages-snippets.md`. Owner
decisions (a) to (f) from the workflow input are final and are not
reopened here. Nothing below blocks the work: the design implements each
default. A different answer changes only the section named in the
question.

## Q1. How light and dark snippet palettes are chosen (section 2.1) - OPEN, default applied

- Default: the palette follows the snippet's own panel fill.
  - The dark palette applies when the fill's relative luminance is below
    0.18. Otherwise the light palette applies.
  - The inspector "Snippet theme: Light / Dark" control writes the fill to
    the light or dark surface value.
  - The palettes are anchored to the existing `--nodetto-*` light and dark
    token values.
  - This keeps appearance invariant 1 of `design-appearance.md`: element
    paint and exports never depend on the app or canvas theme, and SVG
    stays byte-identical between app and CLI.
- Alternative: follow the canvas theme on screen. Exports would then need an
  appearance input, which breaks invariant 1 and app/CLI byte identity.

## Q2. Selectable text in PDF (section 7.3) - OPEN, default applied

- Finding: PDF export in this repository is raster today. In the app,
  pdf-lib embeds a PNG. The native CLI uses pdf-writer with one image page.
  The vector `svgToPdf` described in `export.md` was never implemented.
  Decision (b) assumed that SVG text keeps PDF text selectable, which does
  not hold for this pipeline.
- Default:
  - Keep raster pages for the visual appearance.
  - Add an invisible text layer (render mode 3) for `text.code` and
    `text.markdown` runs. It uses generated Type3 fonts with empty glyph
    procedures, widths that match the layout, and ToUnicode CMaps
    (design section 7.3.1).
  - Every Unicode character is preserved exactly, including CJK and
    supplementary characters (surrogate pairs in the CMap). Nothing is
    dropped or substituted.
  - No font file is embedded and no dependency is added. The app, the Bun
    CLI and the native CLI write the same objects from one core
    description, and tests check exact extracted text for all three.
- This default does not narrow decision (b): snippet text stays selectable
  and searchable for every character.
- Alternative: implement vector PDF (`svgToPdf` with PDFKit and
  svg-to-pdfkit). This adds dependencies and a Boa/native port. It is a
  separate project.

## Q3. Markdown export packaging in the app (section 7.5) - OPEN, default applied

- Default: the desktop app and the web build both save one stored ZIP. It
  holds `<base>.md` and `<base>.assets/*.svg`, written with the existing
  `encodeStoredZip` and `saveZip`. The layout and bytes equal the CLI's
  `--output file.md` result. No new Tauri command or dependency is needed.
- Alternative: a single `.md` with `data:` URI SVGs. It is supported by the
  core function (`embed: true`), but produces large unreadable files.

## Q4. Markdown subset boundaries (section 4.2) - OPEN, default applied

- Default: these render as literal text:
  - math, raw HTML, images and footnotes (decided in (c));
  - indented code blocks, lazy blockquote continuation, reference-style
    links and bare-URL autolinks.

  All lists are rendered tight. Only `http`, `https` and `mailto` links
  become SVG anchors.
- Alternative: add any of these later as additive parser features.

## Q5. Page-frame gap and "Add page" anchor (section 5.3) - OPEN, default applied

- Default:
  - The gap is 48 px.
  - The anchor is the selected page frame, else the page frame containing
    the single selection, else the last page frame in flow order.
  - Without any page frame, the first frame goes at (0, 0) on an empty page,
    or after the page content bounds plus the gap.
  - The new frame copies the anchor's size and orientation. It defaults to
    A4 portrait for vertical flow and 16:9 landscape for horizontal flow.

## Q6. Slideshow precedence (section 6) - OPEN, default applied

- Default: page frames take precedence over the document slide size, the
  page slide origin and the artboard rule on the same nodetto page. Moving
  between two slides on the same nodetto page is a cut, because slide-link
  animation pairs elements across pages.

## Q7. Pages included in document export (section 7.1) - OPEN, default applied

- Default: every nodetto page in tab order, including pages hidden from
  presentation. A page without page frames becomes one PDF page or one
  Markdown section of its content. Empty pages are skipped. Documents with
  more than 500 resulting pages are rejected for PDF.

## Q8. Page-frame navigation keys (section 5.4) - OPEN, default applied

- Default: PageDown is next and PageUp is previous, on the canvas only,
  outside text editing. Both keys are unbound today. The actions also
  appear in the toolbar or menu.

## Q9. CLI flag name (section 7.4) - DECIDED by repository convention

- The intake wrote `--out file.md`. The existing export command uses
  `--output`, and the design keeps it: `--output file.md` writes
  `file.assets/` next to the Markdown file.
