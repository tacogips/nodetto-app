# ipd-06-geo-strokes progress

Plan blob: `8df4df72fedef7fcaa85f909e852e6611abd9796`. Dependency `ipd-07a-icon-shape` accepted by dispatch. Work is on the shared moving tree; later integration must reverify.

Implemented thin rect geometry, explicit rectangle stroke alignment and side strips, shared SVG and canvas paths, and geo label padding. Existing rect rendering retains its legacy branch when no stroke options are set. The CLI raster regression checks the dark rows and adjacent white rows for a 1-unit divider.

Final verification logs under `tmp/ipd-s772/ipd-06-geo-strokes/final/`: continuation final focused suite 74 pass, 0 fail; label compatibility suite 28 pass, 0 fail; typecheck exit 0; scoped Biome exit 0. Logs are `final/c1-gate1.log` through `final/c1-gate4.log`. Earlier failed fixture and SSR attempts are retained in the evidence directory.

Visual inspection: `final/strokes.png`, exported from `fixture.jsonl` by the CLI at scale 2, shows three distinct horizontal dividers at 0.5, 1 and 2 units; three rectangular outlines with inside, center and outside alignment; and a rounded light card with a black left border following the rounded edge. No obvious missing element in this fixture.

The Solid component regression uses the existing Vite Solid SSR compiler to render `RectStrokes` itself and verifies its rounded clip path, unique ID, single painted 4-unit strip, and absence of a uniform stroke. Its middleware server is closed in a finally block; its cache is plan-local. Formal review and integration are downstream.
