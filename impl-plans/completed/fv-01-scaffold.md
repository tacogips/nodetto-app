# fv-01-scaffold

- planId: fv-01-scaffold
- planPath: impl-plans/active/fv-01-scaffold.md
- progressPath: impl-plans/progress/fv-01-scaffold.md
- wave: 1
- dependsOn: none
- Design: sections 2, 4, 7 (vector printing), 8 (artifact roots).
- writePaths: `formal/lakefile.toml`, `formal/lean-toolchain`, `formal/lake-manifest.json`,
  `formal/Nodetto/Json.lean`, `.gitignore`, `impl-plans/progress/fv-01-scaffold.md`,
  `tmp/fv-s942/fv-01-scaffold`, `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Create the Lake project so every later plan can build its module and its vector
executable, and the shared JSON printer every `Vectors.lean` uses.

## Changes

- `formal/lean-toolchain`: one line `leanprover/lean4:v4.36.0`.
- `formal/lakefile.toml`: exactly design section 2: `name = "Nodetto"`,
  `version = "0.1.0"`, `defaultTargets = ["Nodetto"]`, `[leanOptions]` with
  `autoImplicit = false` and `relaxedAutoImplicit = false`, one `[[lean_lib]]` named
  `Nodetto`, and eight `[[lean_exe]]` entries `vectors-<file>` with roots
  `Nodetto.<M>.Vectors` for (M, file) = (Fractional, fractional), (ZOrder, z-order),
  (Nmesh, nmesh), (Tsv, tsv), (Rotate, rotate), (Undo, undo), (Merge, merge),
  (Overlap, overlap). No `[[require]]`.
- `formal/lake-manifest.json`: whatever Lake writes on the first build (no
  packages). Commit it as generated; do not hand-edit.
- `.gitignore`: add one line `formal/.lake/` (keep everything else).
- `formal/Nodetto/Json.lean`: the contract in the overview "Shared contracts", in
  `namespace Nodetto.Json`, importing nothing. `ofE` decodes groups of four lowercase
  hex digits into code units and returns `none` on a length not divisible by 4 or any
  other character.

## Pitfalls

- Do not create `formal/Nodetto.lean`: fv-50 owns it. Do not create any
  `Vectors.lean` (fv-04/fv-05).
- Escaping must be per UTF-16 code unit (values already are code units); never
  emit raw non-ASCII.
- No `partial def` in `render`: use structural recursion on the nested inductive
  (for example via `List.attach` or mutual helper functions) or `termination_by`.
- `lcg` and all arithmetic on `Nat` (no `UInt64` overflow surprises).

## Tests (Lean `example`s in Json.lean, proved by `rfl`/`decide` on small literals)

- `render (.str [0x61, 0x22, 0xd800])` -> `"a\"\ud800"` (as Lean string `"\"a\\\"\\ud800\""`).
- `render (.obj [("ok", .num (-3))])` -> `{"ok":-3}`.
- `ofE "0061d800"` -> `some (.str [0x61, 0xd800])`; `ofE "006"` -> `none`; `ofE "00G1"` -> `none`.
- `document "x" [] "g" []` -> header line, then `]}` and a newline.

## Acceptance criteria

- `formal/lakefile.toml` parses and declares exactly the eight exes; `Nodetto.Json`
  builds with no forbidden token; `.gitignore` ignores `formal/.lake/`.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Json > ../tmp/fv-s942/fv-01-scaffold/build.log 2>&1`
2. `git check-ignore -q formal/.lake/x` (ignored).
3. `! grep -rnwE 'sorry|admit|axiom|native_decide|unsafe|partial|opaque|implemented_by|extern|skipKernelTC' formal/Nodetto/Json.lean`
4. `grep -c '^\[\[lean_exe\]\]' formal/lakefile.toml` prints `8`.

## Implementation status

Implementation and the four plan-local gates passed; formal review and integration
remain downstream workflow steps. See `impl-plans/progress/fv-01-scaffold.md`.
