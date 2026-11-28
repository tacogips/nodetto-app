# fv-00-overview: Lean 4 formal verification, first delivery

- Design (accepted, source of truth): `design-docs/specs/design-formal-verification.md`
  (cited below as "design"), plus the D1, D2 and D4 texts in
  `design-docs/specs/design-table-sheet.md`, `design-docs/specs/design-cli-layout-merge-lint.md`
  (B1) and `design-docs/specs/design-breadboard.md` (4.2).
- Issue: none. Workflow `opus-terra-design-and-implement-review-loop-session-942`.
- Branch `feat/lean-spec`, base `940d669`. No push, rebase, merge, worktree or branch.
- Evidence root: `tmp/fv-s942/<planId>/` (git-ignored; logs, `.txt` and `.json` only,
  never `*.test.ts`).
- Progress log: `impl-plans/progress/<planId>.md` (each worker edits only its own).

## User problem

Prove in Lean 4 that eight core nodetto specifications hold, with executable models
tied to the real TypeScript by Lean-generated test vectors, and fix every
counterexample in code or design text.

## Non-goals

- No Mathlib, Batteries or other Lake dependency; no Rust models.
- `prove` is not added to `verify`, `test`, `ci` or `.github/workflows/linux.yml`.
- Schematic-mode modules (design section 11) are not implemented.
- No change to `packages/core/src/index.ts`, no new npm dependency, no
  `THIRD_PARTY_NOTICES.md` change.

## Plans and DAG

| Wave | Plans (dependsOn) |
| --- | --- |
| 1 | fv-01-scaffold, fv-02-audit, fv-03-merge-fix |
| 2 | fv-04-stubs-a (01), fv-05-stubs-b (01) |
| 3 | fv-10-fractional-model (01,02,04), fv-12-nmesh-primitives-model (01,02,04), fv-13-tsv-model (01,02,04), fv-14-rotate-model (01,02,05), fv-15-undo-model (01,02,05), fv-16-merge-model (01,02,05), fv-17-overlap-model (01,02,05) |
| 4 | fv-11-zorder-model (02,04,10), fv-18-nmesh-codec-model (12), fv-20-fractional-midpoint (10), fv-29-tsv-proofs (13), fv-30-rotate-proofs (14), fv-31-undo-stack-proofs (15), fv-33-merge-canon (16), fv-37-overlap-sweep (17), fv-40-fractional-conformance (10), fv-43-tsv-conformance (13), fv-44-rotate-conformance (14), fv-45-undo-conformance (15), fv-46-merge-conformance (03,16), fv-47-overlap-conformance (17) |
| 5 | fv-21-fractional-keys (20), fv-22-zorder-target (11), fv-25-nmesh-varint (18), fv-32-undo-store-proofs (31), fv-34-merge-diff (33), fv-38-overlap-tree (37), fv-41-zorder-conformance (11), fv-42-nmesh-conformance (18) |
| 6 | fv-23-zorder-relative (22), fv-26-nmesh-indices (25), fv-35-merge-value (34) |
| 7 | fv-24-zorder-reorder (21,23), fv-27-nmesh-armor (26), fv-36-merge-records (35) |
| 8 | fv-28-nmesh-payload (27) |
| 9 | fv-50-docs (every other plan) |

`writePaths` are disjoint except the module root `formal/Nodetto/<M>.lean`, which is
created by the module's model plan and gets one import line per proof plan; those
plans are chained by `dependsOn`, so no two run at once. `formal/Nodetto.lean`,
`mise.toml`, `README.md` and `docs/formal.md` belong only to fv-50.

Every plan's `writePaths` also contain `target`, `tmp/cad3d` and `formal/.lake`, which
are its `artifactRoots` (exactly these three), plus its progress log and evidence
directory.

## Rules for every worker

- Read the plan, this overview and the cited design sections first.
- Before each edit of an existing file, read it fresh and record `git hash-object
  <file>` in the progress log; record it again after the edit. If a file changed
  since your last record, re-read and re-apply only your own hunk.
- Edit only your `writePaths`. If another file must change, stop and report it.
- No git state changes, `lake clean`, `cargo clean`, lockfile changes or broad
  formatters. `bunx biome check`/`format --write` only on your own files.
- Lean: only `cd formal && mise exec -- lake build <target>` or
  `mise exec -- lake exe <exe>` (and the audit, which calls Lake the same way).
  Build only your own module targets. If a build fails on a lock, wait and retry
  (up to 3 times) and log it.
- At most two `bun test`/`cargo test` processes at a time across all plans: run your
  bun tests in one process.
- Timing tests that fail under load but pass alone count as passing; log both runs.
- Record every command with its exit code and the full log path under
  `tmp/fv-s942/<planId>/` in the progress log.

## Proof integrity (every Lean plan)

- Never write `sorry`, `admit`, `axiom`, `native_decide`, `unsafe`, `partial`,
  `opaque`, `implemented_by`, `extern`, `skipKernelTC` or `#exit` in any
  `formal/**/*.lean` file, not even in comments. No `set_option maxHeartbeats` above
  400000 (and never 0). `decide` only on small literals.
- Core Lean has no `lemma` keyword: declare helper lemmas with `theorem` (or
  `private theorem`), with names different from every design statement name.
- Theorems are declared inside `namespace Nodetto.<M>` with exactly the name,
  binders and conclusion of design section 6 (copy them). Add lemmas freely; never
  add a hypothesis, narrow a type or change a conclusion.
- Counterexample procedure: if a required statement is false, stop. Record in the
  progress log a Lean `example`/`#eval` that exhibits it, the matching TypeScript
  input and the observed TypeScript output, and mark the plan blocked
  (`needs_design_revision`). Do not alter the statement or the TS code on your own.
- Model files: total, executable, structured like the TS function, each definition
  with a doc comment naming the source path and function, for example
  `/-- Mirrors packages/core/src/fractional.ts keyBetween. -/`. Models import only
  other model files (never `Lean`, never `Nodetto.Json`).

## Shared contracts

`formal/Nodetto/Json.lean` (fv-01), namespace `Nodetto.Json`:

```lean
inductive Value | null | bool (b : Bool) | num (n : Int) | str (units : List Nat)
  | arr (items : List Value) | obj (fields : List (String × Value))
def render : Value → String           -- compact; fields in the given order
def ofAscii (s : String) : Value       -- .str of the string's code units (ASCII keys/text)
def ofE (e : String) : Option Value    -- decode design B1 encoding E; none if malformed
def ok (v : Value) : Value             -- {"ok":v}
def err (code : String) : Value        -- {"error":code}
def document (module : String) (sources : List String) (generator : String)
    (cases : List (String × Value × Value)) : String   -- (fn, in, out)
def lcg (seed : Nat) : Nat             -- (seed * 6364136223846793005 + 1442695040888963407) % 2^64
```

`render` writes a `.str` code unit that is printable ASCII (0x20-0x7e) other than
`"` and `\` as itself, and every other unit as `\uXXXX` with lowercase hex
(design section 7). `document` prints the header line
`{"module":"<m>","sources":[...],"generator":"<path>","cases":[`, then one case per
line `{"fn":...,"in":...,"out":...}` with a trailing comma on every case but the
last, then `]}` and a newline.

Each `formal/Nodetto/<M>/Vectors.lean` defines `def main : IO Unit` that prints
`Nodetto.Json.document ...` for its module, deterministically (enumerations plus
`lcg`). Vector file names: fractional, z-order, nmesh, tsv, rotate, undo, merge,
overlap (design section 4). Regenerate with
`cd formal && mise exec -- lake exe vectors-<file> > vectors/<file>.json`.

Audit (fv-02): `formal/scripts/audit --list | --module <M> --vectors |
--module <M> --theorem <name>... | (no args: full)` per design section 8.
`--theorem` may repeat, and each occurrence takes one or more names
(`--theorem a --theorem b` equals `--theorem a b`); the module and every name are
validated against the design before any Lake call (`unknown module`,
`unknown statement <name>`).

Vector values are integers only (`Value.num : Int`): a non-integer quantity is
emitted pre-scaled to an exact integer (for example the Rotate fixture fields
`localBox2`/`pinDefs2` hold 2 times the pitch values), never as a fraction.

## Gate kinds

- Model plan: `lake build Nodetto.<M>`; `formal/scripts/audit --module <M> --vectors`.
- Proof plan: `lake build Nodetto.<M>`; `formal/scripts/audit --module <M> --theorem
  <each statement it completes>`; a lemma-only plan runs `--vectors` instead.
- Conformance plan: `lake build Nodetto.<M>.Model` (the model target it depends on;
  the root `Nodetto.<M>` may be mid-edit by a concurrently running proof plan of the
  same module, so the conformance gate builds the model module the vectors come
  from), then its single `bun test` process.

## Final verification (fv-50 and integration)

`mise run prove`, then `bun run typecheck`, `bun run lint`, `mise run verify`,
`mise run test-cli` (integration step, after all plans land).
