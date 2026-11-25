# car4-00-overview: audit round 4 corrections

- Task: `car4-r4`; dispatch manifest `impl-plans/active/car4-r4-dispatch.json`.
- Source: round-4 audit of the 3D CAD pages and AI capture, base `0a35708`, head
  `audit/round-4` at `3f9ce78b9599d35945a7e29fb449a5ca3e89b431`, eight findings (two
  high, six medium). No GitHub issue exists; the workflowInput is the issue body.
- Design (accepted by step 3): `design-docs/specs/design-ai-capture.md` section 22
  (R4-1, R4-2, R4-3, R4-6, plan grouping, gates) and `design-docs/specs/design-cad3d.md`
  section 21 (R4-4, R4-5, R4-7, R4-8). Where they and an earlier section disagree, they
  win.
- Evidence root: `tmp/car4-r4/<planId>/` (outside every artifact root).

## Plans and waves

| Wave | Plan | Finding | dependsOn |
| --- | --- | --- | --- |
| 1 | car4-f1a-capture-scene | R4-1 TS model and NCS1 writer | none |
| 1 | car4-f1b-ncs1-hidden-reader | R4-1 Rust NCS1 reader | none |
| 1 | car4-f1c-capture-report | R4-1 report parser and text | none |
| 1 | car4-f2a-native-assets | R4-2 native carrier resolution | none |
| 1 | car4-f4-swept-extents | R4-4 shared loop extrema | none |
| 1 | car4-f5-ear-index | R4-5 reflex candidate list | none |
| 1 | car4-f6a-export-members | R4-6 core membership owner | none |
| 1 | car4-f7-nmesh-reader | R4-7 one NMESH reader | none |
| 2 | car4-f1d-hidden-census | R4-1 hidden census, JSON, end to end | f1a, f1b, f1c |
| 2 | car4-f2b-capture-assets | R4-2 capture carrier and Bun resolution | f2a |
| 2 | car4-f3-loop-index | R4-3 bounded grid, merged query | f1a |
| 2 | car4-f8-face-resolution | R4-8 one single-feature update | f4 |
| 3 | car4-f6b-glyph-attribution | R4-6 CLI helper and callers | f2b, f6a |

Chains exist only for shared files (`scene.ts`, `scene.test.ts`,
`capture-artwork.ts`, `capture-command.test.ts`, `history.ts`, `history.test.ts`,
`census.rs`) and for real contracts (NCS1 hidden section, report key, carrier format,
`svgExportMemberIds`). No two plans of one wave own the same file.

## Cross-plan contracts (pinned; do not change them in a plan)

- NCS1 hidden section (f1a writes, f1b reads, f1d samples): header word at byte offset
  36 is `hiddenCount` (0..20,000); after the body records come `hiddenCount` records in
  the body record format with flags word 0. Zero hidden targets -> word 0 and no
  records, bytes identical to today.
- Report key (f1d writes, f1c parses): per body object, `,"hiddenEmptiedByStep":k`
  after `"open"`, only when set; `k` is a step index of that visible body (>= 0).
- Error text (f1c): `(sampled): leaves no material in a hidden target body; the app
  rejects this feature and keeps "<name>" as it was, this picture applies it`.
- Capture carrier (f2b writes, f2a and the Bun backend read): one `<defs>` directly
  after the root `<svg ...>` start tag holding, for n = 0, 1, ... ascending,
  `<image id="nodetto-capture-asset-<n>" href="data:image/<png|jpeg|gif|webp>;base64,<payload>"/>`;
  each placement `href` is `https://nodetto.invalid/capture-asset/<n>`.
- Membership (f6a exports, f6b uses):
  `svgExportMemberIds(store, registry, pageId, ids): ReadonlySet<ElementId>`.

## Worker rules (every plan)

1. Edit only the plan's `writePaths`. Your progress log is
   `impl-plans/progress/<planId>.md`; never edit another plan's log, this overview, the
   manifest, `impl-plans/README.md`, lockfiles, indexes or design docs.
2. Before each file edit read the file fresh and record its sha256 in the progress
   log; record the post-edit sha256. If a file changed since your last read and you did
   not change it, stop editing it, record the drift and re-read.
3. Write the regression test first, run it on the unmodified code and record the
   failing output (or baseline counts). Performance tests assert deterministic
   counters, never wall-clock time.
4. Cargo always runs with `CARGO_TERM_QUIET=true` and `CARGO_TARGET_DIR=target/<planId>`.
   Run `rustfmt` on touched Rust files only.
5. TypeScript: strict typing, indexed reads type-check under
   `noUncheckedIndexedAccess`, Biome clean on touched files (one variable per
   declaration). `packages/io` never imports `@nodetto/core`; `packages/core/src/pcb`
   imports only itself. English only, no emojis.
6. Never relax or delete an existing test, threshold or deadline. Timing tests may be
   retried up to three times under load, then run in isolation before reporting.
7. Never edit `crates/capture/src/raster.rs`, `crates/capture/src/raster/**`,
   `crates/capture/src/prism.rs`, `crates/capture/src/cast.rs`, capture goldens or
   `docs/capture.md`. Never regenerate goldens.
8. Native parity runs only after
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/<planId> cargo build --release -p nodetto-cli`
   in the same plan, with `NODETTO_CLI_TEST_BINARY` set to that binary.
9. Per-plan verification is focused. `bun run typecheck`, `bun run lint`,
   `mise run verify` and `mise run test-cli` run once at integration.
10. Evidence goes under `tmp/car4-r4/<planId>/`. No `*.test.ts` may remain under
    `target/` or `tmp/` when the plan finishes.
11. A failure caused by a sibling's in-progress edit is rerun after the sibling's
    progress log reads `done`; never fix it by editing the sibling's files.
12. Only read-only git (`git diff`, `git show`, `git status`). No commits, branches,
    stashes or worktrees.
13. Progress log: status (`in-progress` / `done` / `blocked`), edited files with
    pre/post sha256, every verification command with exit status and complete log path
    under `target/<planId>/logs/`, the pre-fix failing evidence, measured counters.
    A fixed gate that cannot pass is reported `blocked`, never relaxed.

## Integration gates (after all 13 plans are done; each exits 0)

1. `bun run typecheck && bun run lint`
2. `CARGO_TERM_QUIET=true mise run verify`
3. `CARGO_TERM_QUIET=true mise run test-cli`
4. `sh -c 'for root in target tmp; do if [ -d "$root" ]; then matches=$(find "$root" -name "*.test.ts" -print) || exit 1; if [ -n "$matches" ]; then printf "%s\n" "$matches"; exit 1; fi; fi; done'`
