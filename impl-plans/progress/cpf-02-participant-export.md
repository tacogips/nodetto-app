# cpf-02 participant export progress

Implementation complete for this plan; formal review and combined-tree wiring remain downstream. The accepted E2 design and plan agree on unchanged geometry and a shared notation contract. Dependencies: none.

- Shared notation supplies actor circle/open body and database cylinder, with style overrides and bounded label boxes. SVG retains the original service and missing-kind markup; CLI types describes rendering.
- Tests cover notation, captured literal baseline, style, message geometry, palette edits, PNG differences with a space-only name, PDF, types, and long labels.
- `centredLabel` wraps and vertically centres lines without clipping. Long actor names can overflow their 20 px label band; the regression confirms the lifeline and visual bounds remain unchanged. No label layout change was made.
- Pre-edit service markup: `tmp/cpf-s748/cpf-02-participant-export/baseline-markup.txt`. Pre-edit basic-shapes hash: `2b49c98c523d5c5f0bb78816648aa51c84f1195a`.
- `git hash-object` before -> final: notation absent -> `7fd0cc7a59e1e8224e8b4154c03f7e50399273d2`; notation test absent -> `630be64e9afeb608a0bf99876f29d8c7c3d5ebf1`; basic-shapes `2b49c98c523d5c5f0bb78816648aa51c84f1195a` -> `35bdff1169b2a9982260c2d064881e9ff107646c`; types `82bcd0f16bd8cdee9771cc22b73854f55e6c2971` -> `3d7bdd021e976d0e89a60f045a196f6513e2a5ce`; export test absent -> `0c33c73bba59edc2814fd91b8b9d2e8a43ef29c8`. Per-edit intentions and intermediate hashes are in `tmp/cpf-s748/cpf-02-participant-export/intent-*.txt`. Progress file was absent before creation; its post-edit hash is recorded in `progress-hash.txt`.
- Focused tests: 4 passed, 0 failed (`focused.log`). Regression suite: 94 passed, 0 failed (`regression-final.log`). `bun run typecheck` and scoped Biome check passed (`typecheck-final.log`, `biome-final.log`). These ran on a moving shared tree, not the final serial combined tree.
- `git diff --quiet 1e8f43d -- packages/core/src/sequence-layout.ts packages/core/src/shapes/sequence.ts packages/core/src/shapes/connector` passed (`unchanged.log`). The first focused attempt failed on JavaScript floating point string spelling; corrected assertion and final focused run passed (`test-attempt-1.log`, `focused.log`).

## Review revision: db rim fill

Reversed the cylinder rim subpath winding so the fill covers the top lens without changing its outline, band or label box. The new resvg test samples red fill at (70,24), (70,32), (70,44), and the blue background at (5,100). The old path failed the rim-lens assertion with exit 1 (`revision-negative.log`); the corrected focused suite passed 5 tests, exit 0 (`revision-final-focused.log`). Service/missing-kind baseline and lifeline assertions remain unchanged and pass.

Revision `git hash-object` before -> after: notation `7fd0cc7a59e1e8224e8b4154c03f7e50399273d2` -> `20fdf65a9fc2621afcb6950d892f9f82b5576489`; notation test `630be64e9afeb608a0bf99876f29d8c7c3d5ebf1` -> `becf09f83dbdcec1176d4a8a83f0af0e1a514a81`; export test `0c33c73bba59edc2814fd91b8b9d2e8a43ef29c8` -> `673d35b100dc13a78386542a7a182d5d5baa6ae0`; progress `930095fd67edb98c9b041ed74501beba7f3fbf0d` -> hash in `revision-progress-hash.txt`. Basic-shapes remains `35bdff1169b2a9982260c2d064881e9ff107646c`; types remains `3d7bdd021e976d0e89a60f045a196f6513e2a5ce`.

Final-source moving-tree checks: focused 5 passed; regression 94 passed; typecheck, scoped Biome and unchanged-geometry diff each exited 0. Logs are `revision-final-{focused,regression,typecheck,biome,unchanged}.log`. The first scoped Biome attempt exited 1 for an extra blank line, corrected before final checks (`revision-biome.log`). Independent review and combined-tree verification remain downstream.
