# fv-02-audit

- planId: fv-02-audit
- planPath: impl-plans/active/fv-02-audit.md
- progressPath: impl-plans/progress/fv-02-audit.md
- wave: 1
- dependsOn: none
- Design: section 8 (audit and modes), section 6 header (fence format), section 7
  (counts).
- writePaths: `formal/scripts/audit`, `formal/scripts/audit.ts`, `tsconfig.json`,
  `biome.json`, `impl-plans/progress/fv-02-audit.md`, `tmp/fv-s942/fv-02-audit`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

The audit is the machine check of proof integrity, statement fidelity and vector
freshness. Every later Lean plan gates on it, and `mise run prove` is the audit with
no arguments.

## Changes

- `formal/scripts/audit`: executable bash wrapper (`chmod +x`):
  `exec bun "$(dirname "$0")/audit.ts" "$@"`.
- `formal/scripts/audit.ts`: strict TypeScript for Bun (imitate the style of
  `apps/cli/scripts/build-sidecar.ts`; `Bun.spawnSync`, `node:fs`). Paths are
  resolved from the script location (repo root = two levels up).
  - Module table: Fractional/fractional, ZOrder/z-order, Nmesh/nmesh, Tsv/tsv,
    Rotate/rotate, Undo/undo, Merge/merge, Overlap/overlap.
  - Arguments: `--list` and `--vectors` are flags; `--module <M>` takes exactly one
    value; `--theorem` may appear any number of times and each occurrence takes one
    or more following arguments that do not start with `--` (so
    `--theorem a --theorem b` and `--theorem a b` are equivalent). An unknown flag,
    a flag missing its value, `--theorem` or `--vectors` without `--module`,
    `--theorem` together with `--vectors`, or `--list` with any other flag exits 1
    with a usage message. After parsing the design blocks and before step 1 or any
    Lake/mise call, validate: an unknown module exits 1 with `unknown module <M>`;
    a theorem name that is not a statement of that module exits 1 with
    `unknown statement <name>`.
  - Parser: read `design-docs/specs/design-formal-verification.md`; take fenced
    blocks whose info string is `lean Nodetto.<M>` (required) or
    `lean Nodetto.<M> open`; each statement starts at a line `theorem <name>` and
    ends at the next blank line or fence end. Split into name, binder text (the
    leading balanced `()`, `{}`, `[]` groups) and conclusion (after the first
    top-level ` :` that follows the binders).
  - Modes and steps exactly as design section 8 (table "The modes run these
    steps"). Step 1 regex: word boundary `\b(sorry|admit|axiom|native_decide|unsafe|partial|opaque|implemented_by|extern|skipKernelTC)\b`,
    literal `#exit`, and `maxHeartbeats\s+(\d+)` failing when the number is 0 or
    above 400000. Step 3 writes `formal/.lake/audit/Check<M>.lean`
    (`import Nodetto.<M>`, `namespace Nodetto.<M>`, one
    `example : ∀ <binders>, <conclusion> := @<name>` per statement, or
    `example : <conclusion> := @<name>` without binders, `end Nodetto.<M>`, then
    `#print axioms Nodetto.<M>.<name>` per statement), runs
    `mise exec -- lake env lean .lake/audit/Check<M>.lean` from `formal/`, fails on a
    non-zero exit, and parses each `depends on axioms: [...]` list (it may wrap
    over lines) allowing only `propext`, `Classical.choice`, `Quot.sound`
    ("does not depend on any axioms" passes). Step 4 runs
    `mise exec -- lake exe vectors-<file>`, writes `formal/.lake/audit/<file>.json`,
    compares bytes with `formal/vectors/<file>.json`, then `JSON.parse`s it and
    checks at least 200 cases and at least 20 per `fn` other than `fixture`.
  - Full-mode open rule: an open statement whose name has no
    `theorem <name>` declaration in `formal/Nodetto/<M>/*.lean` is skipped only if
    `docs/formal.md` contains a line in an "Open" section naming it; required
    statements are never skipped. Full mode also builds `Nodetto`.
  - Output: one line per check and a final `audit: ok` or `audit: FAILED (<n>)`;
    exit 1 on any failure.
- `tsconfig.json`: add `"formal/scripts"` to `include`.
- `biome.json`: add `"formal/scripts/**/*.ts"` to `files.include`.

## Pitfalls

- `--list` must not invoke Lake or mise (it runs before any module exists).
- The `∀` transformation must keep binder brackets verbatim; implicit `{C : Type}`
  stays implicit.
- Do not write into `formal/vectors/`; only compare.
- `--theorem` names are short names (`keyBetween_between`); qualify them with
  `Nodetto.<M>.`.
- Strict typing: no `any`; indexed reads guarded (`noUncheckedIndexedAccess`).

## Tests (self-check commands; no test file is added)

- `formal/scripts/audit --list` -> 69 lines plus a summary `required 66, open 3`.
- `formal/scripts/audit --module Nope --vectors` -> exit 1 with "unknown module".
- `formal/scripts/audit --module Fractional --theorem keyBetween_between --theorem no_such_statement`
  -> exit 1 with `unknown statement no_such_statement` before any Lake call, and
  `--theorem` is never reported as a statement name.
- `formal/scripts/audit --theorem keyBetween_between` (no `--module`) -> exit 1 with usage.

## Acceptance criteria

- The list mode reports 66 required and 3 open statements, grouped as Fractional 10,
  ZOrder 15, Nmesh 9 (+1 open), Tsv 4, Rotate 6, Undo 10, Merge 10, Overlap 2 (+2 open).
- Biome and the TypeScript compiler accept the script.

## Verification (each must exit 0)

1. `formal/scripts/audit --list > tmp/fv-s942/fv-02-audit/list.log` and
   `grep -q 'required 66, open 3' tmp/fv-s942/fv-02-audit/list.log`.
2. `sh -c '! formal/scripts/audit --module Nope --vectors'`.
2a. `sh -c '! formal/scripts/audit --module Fractional --theorem keyBetween_between --theorem no_such_statement' > tmp/fv-s942/fv-02-audit/args.log 2>&1`,
    then `grep -q 'unknown statement no_such_statement' tmp/fv-s942/fv-02-audit/args.log`
    and `! grep -q 'unknown statement --theorem' tmp/fv-s942/fv-02-audit/args.log`
    (Lean-free: runs before formal/ exists).
2b. `sh -c '! formal/scripts/audit --theorem keyBetween_between'`.
3. `bunx biome check formal/scripts/audit.ts tsconfig.json biome.json`.
4. `bunx tsc --noEmit -p tsconfig.json > tmp/fv-s942/fv-02-audit/tsc.log 2>&1; ! grep '^formal/scripts' tmp/fv-s942/fv-02-audit/tsc.log`
   (no errors in the owned file; errors in sibling in-progress files are ignored here
   and checked at integration).
