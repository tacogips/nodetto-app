# zorder-04-paint-consumers progress

Implementation complete on the shared moving tree. SVG roots use `containerPaintOrder` with the existing backdrop partition; `hitTestPoint` scans `pagePaintOrder`. The original SVG definition loop and group member order are unchanged.

The new SVG cases cover filled frames, selection, backdrop and group ordering, byte equality, and pool/lane inversion. Hit tests cover single-layer and connector-layer behavior. Existing golden and layer tests were not changed.

The plan's focused tests, existing regressions, typecheck, scoped Biome check, and owned-production strict-index gate passed. Logs and per-edit intentions and hashes are in `tmp/zorder-s734/zorder-04-paint-consumers/`. A transient typecheck failure included a sibling CLI test being edited and an invalid fixture fill; the fixture was corrected and the final typecheck passed.

Formal integrity, adversarial and combined-tree integration reviews and final serial verification remain downstream.
