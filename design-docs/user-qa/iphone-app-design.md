# iPhone app design: owner decisions

Design: `design-docs/specs/design-iphone-app-design.md`. Q2 is resolved. Q1,
Q3 and Q4 are open, and the design implements their defaults. A different
answer changes only the section named in the question.

## Q1. System bars and reference alignment (Reproduction, Decision 10.2)

The private reference screenshots show the app's web content only, at
390×844 points, with no iOS status bar. The request asks for 390×844 frames
that add a status bar and home indicator, and for at most 4 points of drift
from the screenshots. Both cannot hold at the same coordinates.

- Default: each screen is a 390×844 frame laid out the way the device would
  show it.
  - The status bar takes the top 47 points.
  - Top-anchored content is shifted down 47 points.
  - Bottom-anchored content (tab bar, floating buttons, composer) keeps its
    distance from the bottom of the safe area, with the home indicator below
    it.
  - The empty middle of each screen absorbs the difference.
  - `compare` uses two bands per screen: rows above a split line at dy +47,
    and rows below it at the bottom offset. The split line is chosen in empty
    space for each screen.
- Alternative A: draw the content 1:1 with the screenshots, with the status
  bar and home indicator as overlays on top of it. Comparison needs no bands,
  but the bars cover content.
- Alternative B: make the frames taller (390×925) so nothing moves. This
  breaks the "390×844 frames" requirement.

## Q2. Comparison helper in the desktop app (Decisions 10.2, 10.3) - RESOLVED 2026-11-10

The acceptance criteria require per-frame export and comparison from both the
desktop app and `nodetto-cli`, so the earlier CLI-only default was withdrawn
(design review DR-01).

- Decision: the desktop app has **Compare with reference...**. It compares
  in-memory reference PNGs with the rendered artboard or artboards, using the
  same `composeComparisonSvg` as the CLI. It shows the same three panels and
  saves a PNG, or a ZIP for all artboards.
- The reference images are never added to the document.

## Q3. Size of the icon set (Decision 2.1)

- Default: vendor the full Lucide set as a lazily parsed JSON string.
- Fallback: if the native bundle size or the `mise run test-cli` deadlines
  regress, vendor a curated subset of about 300 app-UI icons, chosen by tag
  (navigation, communication, files, media, status, editing). Custom path
  icons cover anything else.

## Q4. Where the presentation runs (Decision 8.6)

- Default: extend the existing in-window, full-window prototype preview
  overlay.
- Alternative: open a separate Tauri window. This needs new window
  capabilities and state sync, and is not planned.
