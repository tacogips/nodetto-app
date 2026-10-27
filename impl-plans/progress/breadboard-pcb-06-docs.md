# Progress: breadboard-pcb-06-docs

## Intent snapshot
Updated only `docs/breadboard/pcb.md` and `README.md` for the assigned docs plan. The guide now covers used outline behavior and its 1.0 mm margin, clipping at the board boundary, dropped outside labels, bottom-left origin, the 100 x 100 mm tier, desktop full-board behavior, 0.15 mm mask-opening and 0.2 mm edge clearances, mark placement or omission, three-decimal millimetre drill coordinates, the exact plan 03 warning and advice, the used-mode command, and example golden files. README adds the used-mode CLI line and one sentence in the breadboard paragraph.

## Change evidence

Initial SHA-256:
- `docs/breadboard/pcb.md`: `450461c39751675f7e646fe0646ba13a243805e77a572c7df002a594f2e1634b`
- `README.md`: `502e61d0ee85f4e6d7a13b833a74a2d9fe3469fc530f02dddf1c5d8ea944499d`

Final source SHA-256:
- `docs/breadboard/pcb.md`: `28956aed3dfe36cda3a83241a6e2d6ebc4e5210db0895e73fbd938f7b36f9be6`
- `README.md`: `141d763643d4b54e123124253f165eacf3ffe0e8018de3cc10e3ab5df37aba67`

Per-edit intent snapshots are in `tmp/breadboard-pcb-s501/breadboard-pcb-06-docs/`.

## Verification

- `mkdir -p tmp/breadboard-pcb-s501/breadboard-pcb-06-docs` — exit 0; complete log: `tmp/breadboard-pcb-s501/breadboard-pcb-06-docs/mkdir.log`.
- `grep -n 'outline used' docs/breadboard/pcb.md README.md` — exit 0; both files show the option; complete log: `tmp/breadboard-pcb-s501/breadboard-pcb-06-docs/outline-used-final2.log`.
- `grep -n '0.15 mm' docs/breadboard/pcb.md` — exit 0; pad clearance appears in the silkscreen and ordering text; complete log: `tmp/breadboard-pcb-s501/breadboard-pcb-06-docs/clearance-final2.log`.
- `grep -n 'has no room clear of the pads' docs/breadboard/pcb.md` — exit 0; exactly one matching warning; complete log: `tmp/breadboard-pcb-s501/breadboard-pcb-06-docs/warning-grep-exact-final2.log`.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/breadboard/docs.test.ts` — exit 0; 3 tests passed, 0 failed; complete log: `tmp/breadboard-pcb-s501/breadboard-pcb-06-docs/docs-test-final2.log`.
- `git diff --stat -- docs/breadboard/pcb.md README.md` — exit 0; 2 files, 28 insertions, 8 deletions; complete log: `tmp/breadboard-pcb-s501/breadboard-pcb-06-docs/diff-stat-final2.log`.
- `test -s impl-plans/progress/breadboard-pcb-06-docs.md` — exit 0; complete log: `tmp/breadboard-pcb-s501/breadboard-pcb-06-docs/progress-nonempty-final2.log`.

Scope check: the assigned changes are limited to the guide, README breadboard examples/paragraph, and this progress record. Shared-tree sibling files were left untouched.
