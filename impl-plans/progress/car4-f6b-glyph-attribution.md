# car4-f6b-glyph-attribution progress

- Done: shared `attributeTargetGlyphs` uses `svgExportMemberIds` for targeted capture and raster export; page attribution retains document order and fallback.
- Added group and frame regressions for both callers and whole-page controls. Pre-fix tests failed on outside attribution (`tmp/car4-r4/car4-f6b-glyph-attribution/pre-fix.log`).
- Focused Biome and Bun gate passed: 62 tests, 0 failures (`tmp/car4-r4/car4-f6b-glyph-attribution/gate-complete.log`).
- Formal reviews and workspace typecheck, lint, verify and CLI tests are integration work.
