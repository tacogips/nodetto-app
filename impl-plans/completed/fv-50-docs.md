# fv-50-docs

- planId: fv-50-docs
- planPath: impl-plans/active/fv-50-docs.md
- progressPath: impl-plans/progress/fv-50-docs.md
- taskId: fv-s959 (finishing run; previously wave 9 of fv-s942)
- wave: 7
- dependsOn: fv-24f-reorder-spec. Every other fv plan of fv-s942 is already
  accepted and is not in the fv-s959 manifest.
- Design: sections 3 (B1-B8), 5 (D1-D7), 6 (statements), 8 (prove task), 9
  (documentation, including the Open list and known limitations), 12.
- writePaths: `docs/formal.md`, `README.md`, `mise.toml`, `formal/Nodetto.lean`,
  `impl-plans/progress/fv-50-docs.md`, `tmp/fv-s959/fv-50-docs`, `target`, `tmp/cad3d`,
  `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent and context

Close the delivery so that `mise run prove` (full audit mode) passes on the
whole project, and document precisely what is proved. Before this plan,
neither `formal/Nodetto.lean` nor a `[tasks.prove]` entry in `mise.toml`
exists, and full mode needs both (`lake build Nodetto`).

## Changes (file-level)

- `formal/Nodetto.lean` (new): import exactly the eight roots
  `Nodetto.Fractional`, `Nodetto.ZOrder`, `Nodetto.Nmesh`, `Nodetto.Tsv`,
  `Nodetto.Rotate`, `Nodetto.Undo`, `Nodetto.Merge`, `Nodetto.Overlap`. Imports only.
- `mise.toml`: add `[tasks.prove]` exactly as design section 8
  (`description = "Build the Lean proofs, audit them and check the committed vectors"`,
  `run = "formal/scripts/audit"`). Do not touch `verify`, `test`, `ci` or any
  other task, and do not add prove to `.github/workflows`.
- `docs/formal.md` (new), per design section 9:
  - How to run: `mise install`, `mise run prove`, regenerating one vector file
    (`cd formal && mise exec -- lake exe vectors-<file> > vectors/<file>.json`),
    and that conformance tests run in `bun test`.
  - One table, one row per design section 6 statement (66 required plus 3 open
    gives 69 rows). Each row starts with "| `" and gives the theorem name, the
    design section and the specification it formalises, the source function,
    and the status (`proved` or `open`). Derive the rows from
    `formal/scripts/audit --list` output. A status is `proved` only if the full
    audit checked it.
  - Trust assumptions B1-B8 (design section 3) and findings D1-D7 with their
    fixes and regression tests (design section 5).
  - `## Open` heading: list each open statement that has no declaration, by
    exact name. Check first with
    `grep -rnE "theorem (decodeNmesh_encodeNmesh|treeSearch_visits_overlaps|overlappingPairs_visits_overlaps)( |$)" formal/Nodetto`.
    At design time all three were undeclared. Write them under the heading
    with one line each on what they would state.
  - "What is NOT proved" list from design section 9, including
    `mergeDocumentVersions` and the both-added page example.
  - "Known limitations of the conformance evidence" from design section 9:
    (1) the `mergeById` conformance test compares records through a `Map`, so
    output order and duplicate ids are not checked; (2) the NMESH vectors meet
    the minimums but cover the boundary categories with few cases each. Do
    not state per-category counts unless you measure them from
    `formal/vectors/nmesh.json`.
- `README.md`: add one sentence to the "Development" section pointing to
  `formal/` and `docs/formal.md`.

## Pitfalls

- The audit's Open-section regex reads from `## Open` to the next `## `
  heading. Put only the open statements there, with no other `##` heading
  inside.
- Do not copy statuses from plans. Verify each against the Lean sources and
  the prove log.
- `docs/formal.md` must not use `lean Nodetto.` fences (only the design doc
  holds theorem fences).
- English only, no emojis. Do not modify any `.lean` file other than
  `formal/Nodetto.lean`.
- Run `mise run prove` alone (it builds everything and runs all vector exes).
  Retry once on a build-lock failure.

## Non-goals

Fixing the two known limitations (decided in design 9: recorded, not fixed),
proving the open statements, and changes to tests, models or packages.

## Acceptance criteria

- `mise run prove` exits 0 and its log ends with `audit: ok`.
- `docs/formal.md` has at least 69 statement rows, an `## Open` section naming
  every undeclared open statement, B1-B8, D1-D7, the not-proved list and the
  known limitations. README mentions `docs/formal.md`.

## Verification (each must exit 0)

1. `mkdir -p tmp/fv-s959/fv-50-docs`
2. `mise run prove > tmp/fv-s959/fv-50-docs/prove.log 2>&1 && grep -q 'audit: ok' tmp/fv-s959/fv-50-docs/prove.log`
3. `test "$(grep -c '^| `' docs/formal.md)" -ge 69`
4. `sh -c 'for n in decodeNmesh_encodeNmesh treeSearch_visits_overlaps overlappingPairs_visits_overlaps; do grep -rqE "theorem $n( |$)" formal/Nodetto || grep -q "$n" docs/formal.md || exit 1; done'`
5. `grep -n '^## Open' docs/formal.md`
6. `sh -c 'for t in B1 B8 D1 D7 mergeDocumentVersions mergeById; do grep -q "$t" docs/formal.md || exit 1; done'`
7. `grep -n 'docs/formal.md' README.md`

## Progress log

`impl-plans/progress/fv-50-docs.md`: hashes before and after each edited file,
the prove log path and exit code, and the grep result for the open statements.

## Implementation status

Implemented the umbrella module, prove task and documentation; plan gates passed. Formal review and integration gates remain downstream. See `impl-plans/progress/fv-50-docs.md` and `tmp/fv-s959/fv-50-docs/`.
