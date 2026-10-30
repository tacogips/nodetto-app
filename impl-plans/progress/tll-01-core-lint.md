# tll-01-core-lint progress

Intent: implement renderer-derived text-layout lint, exported deterministic width measurement, fixture builders and focused renderer agreement and edge-case tests. Intent snapshots and fresh pre-edit content are recorded in `tmp/text-layout-lint-s551/tll-01-core-lint/` and `continuation-1/`. New files did not exist before implementation. Geo fixture semantics require `geo: "rect"` for validation. The dense fixture now uses a deterministic Editor RNG after a two-build comparison exposed random fractional indices.

Pre-implementation SHA-256 (existing shared files):
```
a5d95f37e044ac4345ad97e547ac945ad02afd60c20bc10b4ceb6d5bc9894451  packages/core/src/text-layout.ts
e0ce10d14dba2a462ab7212f9cbb53721fba96e1f65b9430d0eb3ada740a8e62  packages/core/src/index.ts
```
Final SHA-256 (assigned source and tests):
```
4f0f735d473c8aa023b96f0dcb178bdbd20c8888e192b7cd0e6043a359fc89f6  packages/core/src/text-layout.ts
426e9841d710d582fa9c0fef2b36210998b462a1633787574c0e535cd79ef98f  packages/core/src/index.ts
5a6f620095675d585789b73d0cf91c9974e840b3802d57fb11790cd4c4c8fa68  packages/core/src/text-layout-lint/engine.test.ts
cf48fdd2734c1a3ad79e50f2d834402e445ee01ffcc289c1e0187432b7eb795b  packages/core/src/text-layout-lint/engine.ts
9b42c3ab6d7c7111998a0590b93c562e47aef25c8912602e2a8ede1e404760b7  packages/core/src/text-layout-lint/index.ts
f67e8b96185778217a22214b9cd86f6c0c528c9c00014628e0bc562af7b72e1d  packages/core/src/text-layout-lint/rules.test.ts
2b1fc9fbb94f57dacec3b6b8d98453e625797a47dbe90d4274bdaf0945c23f2f  packages/core/src/text-layout-lint/rules.ts
c56eeea30d4511ed81a2350a2f18daf05ba67c9831f5827c304a2d56d2ac63f8  apps/cli/src/__fixtures__/text-layout.ts
```
Continuation pre-edit snapshots and hashes are in `continuation-1/`.

Verification on the moving shared tree (complete logs under `tmp/text-layout-lint-s551/tll-01-core-lint/continuation-1/`):
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/text-layout-lint`: exit 0, 10 pass, 0 fail; `final-core-lint.log`.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/text-layout.test.ts packages/core/src/label-layout.test.ts packages/core/src/node-label.test.ts packages/core/src/svg-export.test.ts`: exit 0, 70 pass, 0 fail; `final-core-render.log`.
- `bun tmp/text-layout-lint-s551/tll-01-core-lint/fixture-check.ts`: exit 0; `final-fixture-check.log`.
- `bunx biome check packages/core/src/text-layout-lint packages/core/src/text-layout.ts packages/core/src/index.ts apps/cli/src/__fixtures__/text-layout.ts`: exit 0; `final-biome.log`.
- `bunx tsc -p tsconfig.json --noEmit`: exit 0; `final-tsc.log`. Pending join: tll-02 is not yet done, so repeat on the stable shared tree.
- `git diff --quiet -- packages/core/src/svg-export packages/core/src/label-layout.ts packages/core/src/node-label.ts packages/core/src/shapes`: exit 0; `final-renderer-diff.log`.
- `git diff --quiet a9728e6 -- packages/core/src/svg-export packages/core/src/label-layout.ts packages/core/src/node-label.ts packages/core/src/shapes packages/io/src/bpmn apps/cli/native packages/io/src/__fixtures__`: exit 0; `protected-diff.log`.
- Both required export grep checks exit 0; `final-export-lint.log`, `final-export-width.log`.

Fixture-check output:
```
problem [
  {
    "elementId": "node-clipped",
    "ruleId": "label-overflow",
    "severity": "warning",
    "message": "Label needs 3 lines (46.8 high) but the box is 30 high at 13px; export clips 2 lines."
  },
  {
    "elementId": "node-narrow",
    "ruleId": "label-overflow",
    "severity": "warning",
    "message": "Label line 1 of 15 is 7.2 wide but the text area is 4 wide at 13px; export clips it."
  },
  {
    "elementId": "node-narrow",
    "ruleId": "label-overflow",
    "severity": "warning",
    "message": "Label needs 15 lines (234 high) but the box is 60 high at 13px; export clips 12 lines."
  },
  {
    "elementId": "geo-spill",
    "ruleId": "label-overflow",
    "severity": "warning",
    "message": "Label needs 3 lines (46.8 high) but the box is 30 high at 13px; the text spills outside the shape."
  },
  {
    "elementId": "edge-grpc",
    "ruleId": "label-collision",
    "severity": "warning",
    "message": "Label box 28.2x18.3 overlaps the label of edge-https by 28.2x18.3."
  },
  {
    "elementId": "edge-audit",
    "ruleId": "label-collision",
    "severity": "warning",
    "message": "Label box 40.3x18.3 overlaps node.generic node-audit by 40.3x18.3."
  },
  {
    "elementId": "note-retry",
    "ruleId": "note-overflow",
    "severity": "warning",
    "message": "Text needs 5 lines (90 high with padding) but the box is 30 high; export drops 4 lines."
  },
  {
    "elementId": "note-cache",
    "ruleId": "note-overflow",
    "severity": "warning",
    "message": "Text ends 3.8 above node.generic node-queue; keep 6 clear."
  }
]
clean []
freeform [
  {
    "elementId": "node-clipped",
    "ruleId": "label-overflow",
    "severity": "warning",
    "message": "Label needs 3 lines (46.8 high) but the box is 30 high at 13px; export clips 2 lines."
  },
  {
    "elementId": "node-narrow",
    "ruleId": "label-overflow",
    "severity": "warning",
    "message": "Label line 1 of 15 is 7.2 wide but the text area is 4 wide at 13px; export clips it."
  },
  {
    "elementId": "node-narrow",
    "ruleId": "label-overflow",
    "severity": "warning",
    "message": "Label needs 15 lines (234 high) but the box is 60 high at 13px; export clips 12 lines."
  },
  {
    "elementId": "geo-spill",
    "ruleId": "label-overflow",
    "severity": "warning",
    "message": "Label needs 3 lines (46.8 high) but the box is 30 high at 13px; the text spills outside the shape."
  },
  {
    "elementId": "edge-grpc",
    "ruleId": "label-collision",
    "severity": "warning",
    "message": "Label box 28.2x18.3 overlaps the label of edge-https by 28.2x18.3."
  },
  {
    "elementId": "edge-audit",
    "ruleId": "label-collision",
    "severity": "warning",
    "message": "Label box 40.3x18.3 overlaps node.generic node-audit by 40.3x18.3."
  },
  {
    "elementId": "note-retry",
    "ruleId": "note-overflow",
    "severity": "warning",
    "message": "Text needs 5 lines (90 high with padding) but the box is 30 high; export drops 4 lines."
  },
  {
    "elementId": "note-cache",
    "ruleId": "note-overflow",
    "severity": "warning",
    "message": "Text ends 3.8 above node.generic node-queue; keep 6 clear."
  }
]
dense fixture deterministic
```

Prior failed attempts are retained in the evidence directory. Formal review and downstream CLI integration remain separate workflow steps.

STATUS: done
