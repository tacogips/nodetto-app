# cpf-07 canvas view progress

Implemented the shared notation view model in local 54 px coordinates, reactive box propagation, actor and database SVG primitives and labels, and the existing service fallback. Modifier CSS leaves the lifeline at 54 px. Smart paint applies only to the actor head and database cylinder; actor limb paths do not animate paint because fill animation would fill open paths. Direct primitiveAttributes rendering diverges from BpmnNotationPrimitiveView because that component cannot forward smart-paint attributes. Canvas SVG uses the solid style fill fallback for gradients; gradient rendering is outside this plan.

Before hashes in order (SequenceParticipantView.tsx, ShapeView.tsx, new test absent, canvas.css, progress absent): see tmp/cpf-s748/cpf-07-canvas-view/before-hashes.log. After hashes with paths: tmp/cpf-s748/cpf-07-canvas-view/after-hashes.log. Intent and fresh reads are in the same evidence directory.

Completion: implementation and focused tests complete; formal review and combined-tree verification are downstream. Checks run on the moving shared tree:
- focused Bun test: exit 0, 11 passed, focused-final.log. Initial assertion formatting failure retained in focused.log and corrected.
- shapes Bun test: exit 0, 15 passed, shapes.log.
- scoped biome check: exit 0, biome.log.
- sequence.ts and sequence-layout.ts unchanged against 1e8f43d: exit 0, unchanged.log.
- bun run typecheck: exit 0, typecheck.log.

## CPF07-TI-01 test integrity revision

Added actor limb coordinate bounds, db arc extents and the db label position relative to the first ellipse, retaining the prior assertions. Test hash changed from d9f4b40de52548321ad2140f6500caf15f835acc to 08baf15be5fadeea0473276dba303ad7ab6f1bce; intermediate hashes and intent are in tmp/cpf-s748/cpf-07-canvas-view/ti01-intent.log. Production view, ShapeView and canvas CSS hashes remained 74f005f8, 25c611ba and 9ddd730f respectively (ti01-final-hashes.log).

On the moving shared tree, the focused Bun suite exited 0 (11 pass, ti01-focused-final2.log), shapes suite exited 0 (15 pass, ti01-shapes-final2.log), bun run typecheck exited 0 (ti01-typecheck-final2.log), and the scoped biome check exited 0 (ti01-biome-final2.log). The in-memory negative control with label y 8 exited 1 at the label assertion as expected (ti01-negative.log). Formal review remains downstream.
