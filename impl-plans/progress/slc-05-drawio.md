# slc-05 draw.io progress

Intent: implement exact actor import/export and native UML component, interface and port export, with scoped tests and documentation. Preserve other mappings.

Pre-edit SHA-256:
- style.ts: 9fefc4e6636d421dfff4f89c59df07fd967dbd224fafbf13aaf5ebe3aeb8fd76
- export-shape-style.ts: 438202c1a6f9c004402786d8e0e451979e977073a98cbb4cd9a2ee5e1df6f737
- export-page.ts: 64199c5a6808f669e7b143e057e48516ef29c7549f78e754b054f531faf44001
- drawio.test.ts: bdde58890449e2bac5f87964902a00e354056e2871357ca3d2c14b103a607d67
- docs/import-export.md: c7c5eacc260ee889fbee736b05769ba3d40b989d5acd55f4c79fe07c31c06549

Shape-name evidence: https://github.com/jgraph/drawio-mcp/blob/main/shared/style-reference.md section 3.3 lists `umlActor`, `component`, and `requiredInterface`; the reference states its data was extracted from draw.io source.

Final source SHA-256:
- style.ts: 8ed71a449d0d161ac182cc1714f26368ccba9faac3a755f31135ded1a0e96667
- export-shape-style.ts: 07bbfb62e5a43f0a1a872a4bb63eae69219200150ff8b6f91bb22b2162c55013
- export-page.ts: 38510035eb5fcc65bd6ea4a089d42583e959458794c446b2c636336641432a31
- drawio.test.ts: 1c97bc30d9b29e382e4e18fea27c045e56de9a19ea5c47b6b713ef5788b97395
- docs/import-export.md: 9f6306b47f4ef485b5c8b3188f34daa397e041e8d0b7fd18b16d400367815ebc

Verification on moving shared tree, logs under tmp/shape-lateral-s544/slc-05-drawio/:
- BUN_OPTIONS=--jsx-runtime=classic bun test packages/io/src/drawio: exit 0, 22 pass, drawio-final.log.
- BUN_OPTIONS=--jsx-runtime=classic bun test packages/io: exit 0, 257 pass, 1 skip, io-final.log; pending serial join while siblings work.
- bunx tsc -p tsconfig.json --noEmit: exit 2, tsc-final.log; sibling slc-02 packages/ir/src/validate.test.ts:645 readonly assignment TS4104. Rerun after sibling repair.
- bunx biome check on four owned TypeScript files: exit 0, biome-final.log.
- grep actor mapping: exit 0, count 1, grep-actor.log; grep obsolete documentation text: exit 1, count 0, grep-doc.log (expected absence).
- git diff --check on owned tracked files: exit 0, diff-check.log.

Continuation 1: bunx tsc -p tsconfig.json --noEmit exited 2; tmp/shape-lateral-s544/slc-05-drawio/tsc-continuation-1.log still reports sibling-owned packages/ir/src/validate.test.ts:645 TS4104. Owned source hashes remain unchanged (continuation-1-hashes.log).

Continuation 2: bunx tsc -p tsconfig.json --noEmit exited 2; tsc-continuation-2.log confirms the same sibling-owned TS4104 at packages/ir/src/validate.test.ts:645.

Current-source rerun: the six pre-node snapshots match the current owned sources; prior TS4104 is resolved by slc-02. Shape-name evidence also confirms native rectangle for the planned square port: https://github.com/jgraph/drawio-mcp/blob/main/shared/style-reference.md#33-uml-shapes.
- BUN_OPTIONS=--jsx-runtime=classic bun test packages/io/src/drawio: exit 0, 22 pass, 0 fail; drawio-rerun.log.
- BUN_OPTIONS=--jsx-runtime=classic bun test packages/io: exit 0, 257 pass, 1 skip, 0 fail; io-rerun.log. Pending serial join: slc-03 and slc-04 are not done.
- bunx tsc -p tsconfig.json --noEmit: exit 0; tsc-rerun.log. Pending serial join: slc-03 and slc-04 are not done.
- bunx biome check packages/io/src/drawio/style.ts packages/io/src/drawio/export-shape-style.ts packages/io/src/drawio/export-page.ts packages/io/src/drawio/drawio.test.ts: exit 0; biome-rerun.log.
- grep -c 'umlActor: { geo: "actor" }' packages/io/src/drawio/style.ts: exit 0, count 1; grep-actor-rerun.log.
- grep -c 'umlActor (approximated)' docs/import-export.md: exit 1, count 0 (expected absence); grep-doc-rerun.log.
- git diff --check on owned tracked files: exit 0; diff-rerun.log.

STATUS: done
