# car2-b-wireframe progress

Status: done (implementation; formal review and integration remain downstream).

The plan matches design section 20.2 R2-8/R2-9; dependencies: none. CAD SVG uses collected eligible PCB input. Invalid or empty mesh decode fails the visitor and dependent cuts; valid meshes decode once and retain their wireframe.

SHA-256, before -> after:
- packages/core/src/svg-export/document.ts: 3fa504786b5232a0fbce6cef3eef0c40c97b5d03c57fb3b6064be258f9916015 -> eeb35895eebfdea3d15a052f9a3e36413ae5121d0e92562068dbef71786ad28d
- packages/core/src/cad/wireframe.ts: f8cebc7ed800c58a0781e5634893d83ad58ef4f8e3c76bafe0238ebe5a1f69e7 -> 0a2fc697b65010c49922b97703f7b726ff8f7b844a448dea111418fc5b9c4794
- packages/core/src/cad/wireframe.test.ts: 971fb5945de8abf1e2824c7b0bb7b4db4f49349b5353d7aa3a354095be41035d -> 19355fdebb88774bd60505178ba228e45fdda163cb9ad55f55022cd293cc1ee2
- packages/core/src/svg-export/cad.test.ts: cd70bb12687392ddf6ea8577593c10b8f2e602e93a1cf06345e879c0d9fd566d -> 0c50b1238aafc25dd31775de8bc9def5d75269ad1f2ad911340cc6316034ef14
- impl-plans/progress/car2-b-wireframe.md: absent -> see `tmp/car2-r2b/car2-b-wireframe/attempt-1/progress.sha256` (avoids self-referential digest).

Evidence: `tmp/car2-r2b/car2-b-wireframe/attempt-1/`; logs also copied under `target/car2-car2-b-wireframe/logs/`.
- Before source fixes, `bun test packages/core/src/cad/wireframe.test.ts packages/core/src/svg-export/cad.test.ts`: 8 pass, 2 fail; `negative.log`. Both target regressions reproduced. The surrounding shell returned 1 after zsh rejected assignment to its read-only `status` variable.
- `bun test packages/core/src/cad/wireframe.test.ts packages/core/src/svg-export/cad.test.ts packages/core/src/cad/check.test.ts`: exit 0, 24 passed, 0 failed; `final-test.log`.
- `bunx biome check --diagnostic-level=warn packages/core/src/svg-export/document.ts packages/core/src/cad/wireframe.ts packages/core/src/cad/wireframe.test.ts packages/core/src/svg-export/cad.test.ts`: exit 0; `biome.log`.
- `git diff --check -- packages/core/src/svg-export/document.ts packages/core/src/cad/wireframe.ts packages/core/src/cad/wireframe.test.ts packages/core/src/svg-export/cad.test.ts`: exit 0; `diff-check.log`.

Workspace typecheck, lint and integration verification are reserved for integration as directed by dispatch. No Rust files changed.
