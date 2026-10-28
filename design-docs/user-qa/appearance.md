# Appearance: open owner decisions

Design: `design-docs/specs/design-appearance.md`. Each question has a
default that the design implements; answering differently changes only the
named section.

## Q1. Default element paint on a dark diagram canvas (section 5.3)

Elements without stored colours draw with the light document defaults (dark
ink strokes, off-white fills). On a dark diagram canvas, default connectors
and unfilled outlines have low contrast.

- Default: keep the light document defaults on every canvas. The canvas
  then matches every export, and no document colour changes with a
  setting.
- Alternative: give element defaults a dark-canvas variant. On-screen
  rendering would then differ from SVG/PNG/PDF exports, which keep the light
  defaults.

## Q2. Native title bar follows the app theme (section 3.3)

- Default: in the desktop host, `Window.setTheme` follows the app theme
  (`null` for System). This needs the `core:window:allow-set-theme`
  capability.
- Alternative: leave the title bar on the macOS appearance. With Dark
  selected on a light macOS, the title bar then stays light.

## Q3. Dark palette values (sections 4.1, 5.2)

- Default: the neutral dark values in the design tables, adjusted only
  where the contrast test needs it. The PCB dark canvas uses the same
  `#15191b` as the dark diagram canvas.
- Alternative: a KiCad-style navy board background (`#001023`) for PCB
  pages only. This needs a separate PCB dark canvas set.
