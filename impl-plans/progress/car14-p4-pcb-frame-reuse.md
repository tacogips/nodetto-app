# car14-p4-pcb-frame-reuse

Status: done (implementation; formal review and integration follow).

Dependency p3 was accepted in dispatch. Its history.ts pre-edit SHA-256 was 45af157ec6912bcb967b10b8e756a933b35fba458aad2d9055a132572bf13fa9; its profileExtents call remains intact. History final SHA-256: 3452bc82d23f4c0b0fb0401598146039a056fd4fc054e4e7ae0e11c0d95be97e. Test pre-edit SHA-256: 7c3b6d725a2cab97bc6561c1733deb9faa9d9cd7b9794998b9423e16432a0d2b; final: e54c06f6c5c2b2493ddfc49b969c17c9608f36ef97234dbb8bda5ec5fc9233ab6. Per-edit snapshots, hashes and intentions are under tmp/car14-r14/car14-p4-pcb-frame-reuse/.

Consumer audit: CadFrame fields are readonly. faceFrame creates a new frame and origin; scene makeTool holds the frame without mutating it; sweptBounds and check consume coordinates. bounds.ts extremaCache and profileExtremaCache key by loop/points identity and compare frame identity, deliberately allowing reuse. No other frame identity keyed state or mutation was found in the relevant consumers. Frame allocation is local to one geometry walk; span and withinExtent remain per reference.

Fail-before: bun test packages/core/src/cad/pcb-outline.test.ts -t 'shared PCB references project vertices once and retain individual spans' produced 0 pass, 1 fail, 16384 projections versus 128; log fail-before.log. A shell bookkeeping assignment to zsh's read-only status variable failed after the test; the test log itself records the failure. Final tests assert 128, 256, 512 and 1024 projections for one and K references, per-reference spans/cap Z and two cad.limit errors. Existing PCB digest remains f41508a20cd44bcd36306b9bfe9bd62077b8e8f313cad23a566b66773b978834.

- bunx biome check packages/core/src/cad/history.ts packages/core/src/cad/pcb-outline.test.ts: exit 0, biome-final.log. Earlier biome.log exit 1 on assignment in expression, corrected.
- bun test packages/core/src/cad/pcb-outline.test.ts packages/core/src/cad/check.test.ts packages/core/src/cad/history.test.ts: exit 0, 50 passed, tests-source-final.log.
- Workspace typecheck, lint and verify are assigned to serial integration.
