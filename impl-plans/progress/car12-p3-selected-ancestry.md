# car12-p3-selected-ancestry progress

Status: done (implementation; formal review and integration remain downstream).

- Source SHA-256 before: scene.ts `dd366be31d1893d0ecc299ddf1e7be21ce094465e83b8a834c9d78ea6db97ae1`; scene.test.ts `653f1128967bb213636644e7ca2984f5d3db9665f9e563265d8533ee14f9f261`.
- Source SHA-256 after: scene.ts `9175c3da1a77486d776db45ed3d3d5fb79db245724e54ae26162e9a3fa7a52ee`; scene.test.ts `d25cf691e9ff12276085b8bc4a756c46a3499e262fa51eec46a90b55d0e1db4c`. Per-edit intentions and hashes are in `tmp/car12-r12/car12-p3-selected-ancestry/`.
- `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts`: exit 0, `biome-gate.log`.
- `bun test packages/core/src/capture/scene.test.ts packages/core/src/cad/loop-forest.test.ts`: exit 0, 43 passed, `test-gate.log`.
- Negative control disabling fallback: exit 1, `fail-before.log`; fallback assertion fails. Source restored to the exact hash above.
- Deep work at 256/512/1024: 43320/86728/174808; shallow document at 1024/2048: 516847/1040080; raw shallow at 1024/2048/4096: 518094/1040878/2093280. Ordinary baseline: 5000 probes, 5500 index entries, 5000 depth lookups, zero fallbacks.
- Earlier fixture errors and their resolved logs are `tests.log` and `tests-final.log`; the shallow geometry was corrected to be valid and within CAD limits.
- Workspace-wide typecheck, lint, verify and release parity are assigned to serial integration; shared-tree status includes sibling plan files.
