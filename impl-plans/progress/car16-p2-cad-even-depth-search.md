# car16-p2-cad-even-depth-search progress

Status: done. Finding: performance-cad-shared-perforated-profile-depth-rescans.

- history.ts SHA-256: before 3452bc82d23f4c0b0fb0401598146039a056fd4fc054e4e7ae0e11c0d95be97e; instrumented 788e59af75c8885d149f430f5a8a32814d5be0571b6e3539a6e8942f735c6429; final 5e975cd95d00b49959a80c86c697731ff914d86fd263796ce992e8fa560564fb.
- check.test.ts SHA-256: before a9c8873f813ee3f1df507e1499d884145971d41ab0cc65a39f7a1e88baf93581; instrumented 102e73cedafc13dd0359377d40013ffd811ea2347228ef07c24a1c788afb6449; final e3ac5de0bbfc1ef621871b1418a2ca74b387c7413863084e20f3a00c0293d5a1.
- Plan before SHA-256: 132ff20c62fd8f5fd0a3054ed62371e8ddf44064c5b6d59b2bbe4df7130e8605; post-edit hash and all per-edit intentions are in the evidence directory.
- Counter-only `bun test packages/core/src/cad/check.test.ts`: exit 1, 20 pass, 3 fail, log `tmp/car16-r16/car16-p2-cad-even-depth-search/fail-before.log`. Visits: 257, 8224, ordinary 5500. The shell wrapper attempted to assign zsh's readonly `status` after the runner exited; the complete runner log reports the three expected failures and the wrapper exited 1.
- `bunx biome format --write packages/core/src/cad/check.test.ts`: exit 0, log `tmp/car16-r16/car16-p2-cad-even-depth-search/format.log`.
- `export CARGO_TARGET_DIR=target/r16-cad-depth && bunx biome check packages/core/src/cad/history.ts packages/core/src/cad/check.test.ts && bun test packages/core/src/cad/check.test.ts packages/core/src/cad/history.test.ts`: exit 0, 45 pass, 0 fail, log `tmp/car16-r16/car16-p2-cad-even-depth-search/gate.log`. Whole-profile visits are 0 for both plate counts and the ordinary document; selection guards pass.
- Formal review and workspace-wide typecheck, lint and verify are owned by downstream integration. No Rust or dependency changes.
