# car1-b1-shared-contours progress

Implementation complete; formal review, integration, and commit are downstream.

- Memoized full profiles per sketch; selection preserves whole-sketch validation and depth. Construction retains tools only for referenced faces. Counters verify one profile and point array across 64 and 1,000 extrusions, and one retained face-referenced tool.
- Checked all `extrudes.get` readers: construction's map serves face resolution; `geometryFor` and evaluator have separate maps. Evaluator keys serialize geometry, not object identities. No mutation of shared points or sources found in CAD/capture.
- Before/after SHA-256: history.ts `380a66446d201114b3ac1bff153813f7499c47cc6f47ad760cfa9120dec93669` / `b26f331269d74eb5e12302771d85cfde8b4a5aeb535c66350713d5196b19da16`; construction.ts `e3dd233de31fc6a8ab682f5cceba847e413484c68961fb26dd6891558be923af` / `2945561250d9260dba1b102a4e179bafe29e4760dca809686696b13de5d0139b`; history.test.ts `7c7e85935268eb0b3ee75cf17c58580e329e961aded54026f2013a38316c5b6c` / `7342f65d9ab1babb422c1af367ac5e3fe0575119dda0e8c4391f49048c4fe959`. Plan pre-hash `4020b75a2ccd928218a6624d0283743abeded5d6ff2c068d247bf40145dce067`; progress absent before edit. Per-edit intentions and hashes: `tmp/car1-r1/car1-b1-shared-contours/`.
- Pre-fix `bun test packages/core/src/cad/history.test.ts` exited 1, 8 passed, 2 failed on missing counters; `target/car1-car1-b1-shared-contours/logs/negative-test-2.log`.
- Final `(export PATH="$PWD/node_modules/.bin:$PATH"; biome check packages/core/src/cad/history.ts packages/core/src/cad/construction.ts packages/core/src/cad/history.test.ts && bun test packages/core/src/cad)` exited 0, 196 passed; `target/car1-car1-b1-shared-contours/logs/cad-gate-final.log`.
- Final `bun run typecheck && bun test packages/core/src/capture packages/core/src/cad/history.test.ts` exited 0, 126 passed; `target/car1-car1-b1-shared-contours/logs/typecheck-capture-final.log`.
- Earlier concurrent CAD run exited 1 on existing timing deadline under load; serial retry passed. Earlier shared-tree typecheck exited 2 on sibling `cad-inspector.dom.tsx` edits and passed on final rerun. Logs: `cad-gate.log`, `cad-gate-retry.log`, `typecheck-capture-gate.log` in the same log directory.
- Final status: done for implementation; independent review pending.
