# kicad-pcb-04-kicad-reader progress

## Intent snapshot

- Add the plan-pinned PCB reader in `packages/io/src/kicad/pcb.ts`, using a
  one-pass root dispatch and per-list child maps, preserving diagnostics and
  supporting KiCad 5 through 9 board entities.
- Add focused tests and two hand-authored ASCII fixtures; extend fixture
  provenance and export the reader through both assigned IO entry points.
- Keep the existing schematic and netlist dispatch behavior intact.

Pre-edit hashes: see `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/pre-edit.sha256`.

## Implementation

Complete for the assigned plan scope. Added the original KiCad 5-9 PCB
reader with one root pass and one direct-child map per item; support includes
layers and aliases, nets, footprints/modules, pads and primitives, graphics,
KiCad 5 arcs, ordered tracks, vias, zones and fill polygons, skipped-kind and
unsupported-feature diagnostics, and pinned root/version/legacy errors.
`importKicadPcb` is exported from both IO entry points; `importKicad` now
returns `kicad.pcbRoot` for PCB roots without changing schematic/netlist
dispatch. Added hand-authored KiCad 8 and KiCad 5 ASCII fixtures and
provenance notes. Tests cover deterministic fixture parsing, semantic fields,
diagnostics, arc conversion, ordered polygon arc flattening, and 20,000
segments.

Every source edit's intended behavior is recorded in
`tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/edit-intents.md`. Pre-edit and
post-edit source hashes are in `pre-edit.sha256` and `post-edit.sha256`.

## Completion criteria

- Reader API and exports are present; board-root dispatch is explicit and
  existing schematic/netlist tests remain passing.
- Both self-authored fixtures are ASCII and listed in the README.
- Pinned KiCad 5-9 parsing and diagnostics are covered; deterministic double
  parse and 20,000-segment tests pass.
- All final-source gates below passed. The supplied macOS `grep` does not
  support `-P`; the equivalent byte-range Perl checks were used for fixture
  ASCII validation.

## Final-source verification

| Command | Exit | Evidence |
| --- | ---: | --- |
| `bun test packages/io/src/kicad` | 0; 26 passed, 0 failed | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/bun-test-final.log` |
| `bun run typecheck` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/typecheck.log` |
| `bunx biome check packages/io/src/kicad packages/io/src/index.ts --diagnostic-level=warn` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/biome.log` |
| `! grep -n '\.split(/' packages/io/src/kicad/pcb.ts` | 0; no matches | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/no-regex-split.log` |
| `LC_ALL=C perl -ne 'exit 1 if /[^\x00-\x7F]/' test-fixtures/kicad/two-layer.kicad_pcb` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/ascii-two-layer.log` |
| `LC_ALL=C perl -ne 'exit 1 if /[^\x00-\x7F]/' test-fixtures/kicad/kicad5.kicad_pcb` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/ascii-kicad5.log` |
| `grep -q 'two-layer.kicad_pcb' test-fixtures/kicad/README.md` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/readme-two-layer.log` |
| `grep -q 'kicad5.kicad_pcb' test-fixtures/kicad/README.md` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/readme-kicad5.log` |
| `test -s impl-plans/progress/kicad-pcb-04-kicad-reader.md` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/progress-nonempty.log` |
| `LC_ALL=C perl -ne 'exit 1 if /[^\x00-\x7F]/' impl-plans/progress/kicad-pcb-04-kicad-reader.md` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/progress-ascii.log` |

Earlier test and typecheck attempts were superseded by the passing final-source
runs. Retained test logs and the superseded typecheck diagnostic record are in
the same evidence directory. The final-source typecheck passed with sibling PCB
core edits currently in the shared tree.

## Test-integrity revision (comm-009912)

Addressed both assigned findings without changing reader behavior:

- `S534-P04-TI-1` (high): rerouted the existing GND B.Cu segment around the
  C1 VCC pad, extending copper to C1 GND pad 1 and U1 GND pad 1. Added B.Cu
  VCC routing from J1 pad 2 to C1 pad 2. Kept five footprints, ten pads, two
  vias on GND and SIG, one B.Cu GND zone, five Edge.Cuts graphics, the F.Cu
  arc, the single SIG segment, and J1 track endpoints. The fixture now has 13
  tracks.
- `S534-P04-TI-2` (mid): retained the existing literal-layer assertion and
  added checks for the R1 Reference text and board text `Nodetto`, both
  authored with `F.Silkscreen` and imported as `F.SilkS`. Also assert that no
  graphic retains the user alias. These checks fail if the alias mapping is
  removed.

The source fixture first reproduced the reported two-line ratsnest in
`ratsnest-probe-before.log`. The final probe imports the fixture to a PCB
document and reports `initial=0`, `trackPadOverlaps=[]`, then one SIG line
after deleting its sole track, between `fp-J1/2` and `fp-R1/1`. The overlap
check samples track centerlines against pad outlines expanded by half the
track width on matching copper layers.

| Command | Exit | Evidence |
| --- | ---: | --- |
| `bun tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/ratsnest-probe.ts` | 0; empty initial ratsnest, one SIG line after deletion, no different-net track/pad overlap | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/ratsnest-probe-final.log` |
| `bun test packages/io/src/kicad` | 0; 26 passed, 0 failed | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/bun-test-review-final.log` |
| `bun run typecheck` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/typecheck-review-final.log` |
| `bunx biome check packages/io/src/kicad packages/io/src/index.ts --diagnostic-level=warn` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/biome-review-final.log` |
| `LC_ALL=C perl -ne 'exit 1 if /[^\x00-\x7F]/' test-fixtures/kicad/two-layer.kicad_pcb` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/ascii-review-final.log` |

Pre-repair hashes are recorded in `review-pre-edit.sha256`; final fixture,
test and progress hashes are in `review-post-edit.sha256`. All changed files
are within plan 04 write paths. No `packages/core/**` file was changed.

## Adversarial revision (comm-009930)

Addressed `S534-P04-ADV-1` (mid) in the permitted reader and test files. The
footprint `fp_text` branch now takes the text payload from the third atom
(`fpAtoms[2]`), while retaining the existing role, layer, hide and rotation
handling. Property text and board `gr_text` parsing were not changed.

The KiCad 5 fixture test now checks reference text `R1` and value text `10k`.
An inline KiCad 7 footprint test checks reference `R7`, hidden value `10k`,
and user text `LBL`, including their roles and original string content. The
two-layer fixture content and the earlier TI-1/TI-2 assertions remain intact.
The tests also confirm the two-layer `J1`, `Conn_01x03`, and `Nodetto` strings
remain intact.

| Command | Exit | Evidence |
| --- | ---: | --- |
| `bun test packages/io/src/kicad` | 0; 27 passed, 0 failed, 323 assertions | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/bun-test-adversarial-final.log` |
| `bun run typecheck` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/typecheck-adversarial-final.log` |
| `bunx biome check packages/io/src/kicad packages/io/src/index.ts --diagnostic-level=warn` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/biome-adversarial-final.log` |
| `! grep -n '\.split(/' packages/io/src/kicad/pcb.ts` | 0; no matches | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/no-regex-split-adversarial-final.log` |
| `bun tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/ratsnest-probe.ts` | 0; empty initial ratsnest, one SIG line after deletion, no sampled pad overlap | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/ratsnest-probe-adversarial-final.log` |
| `LC_ALL=C perl -ne 'exit 1 if /[^\x00-\x7F]/' test-fixtures/kicad/two-layer.kicad_pcb` | 0 | `tmp/kicad-pcb-s534/kicad-pcb-04-kicad-reader/ascii-adversarial-final.log` |

Pre-repair reader, test and progress hashes are in
`adversarial-pre-edit.sha256`; reader and test hashes after the source change
are in `adversarial-post-source-v2.sha256`.

The first scoped Biome check in this revision found only a formatter difference
in `pcb.test.ts` (exit 1); the file was formatted and the same final check
passed. The superseded diagnostic is retained in
`biome-adversarial-attempt1.log`.
