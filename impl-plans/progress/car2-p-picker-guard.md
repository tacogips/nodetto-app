# car2-p-picker-guard

Status: done. Formal review and integration remain downstream.

Pre/post SHA-256:
- packages/ui-solid/src/cad/board-picker.tsx: 1c4954cb8dee76948882951507ab1d662e855444748a9fd82d83863d9cc7a6a9 / 542320618aa1af5caa0c1ffefb1f17acc0301b4bfbaad2c081737d24cbeb7a21
- packages/ui-solid/src/test-dom/cad-sketch.dom.tsx: 8047c8305217209b3902ab678e016984a7ef7b4684f0ace20973b344c5777032 / 691359b0758ec795137a0145347902127841d1f32facc3817a8ed7f7931180cb
- impl-plans/active/car2-p-picker-guard.md: a2deb6dc277180d2fa6ea76a04acd161fb13fcd3c4ad0f74518c44f24c0fa824 / 65e7d36f56e9b824e7b1545ab42bb8532aea1878108c7745f02bb7d49c01e926
- This progress file: absent before creation; its final hash is recorded in the plan-local evidence.

Commands and complete logs:
- Pre-fix regression: `bun test packages/ui-solid/src/cad/viewport.test.tsx` exited 1 (1 pass, 1 fail; stale insertion added history): target/car2-p-picker-guard/logs/negative.log.
- `bun test packages/ui-solid/src/cad/viewport.test.tsx packages/ui-solid/src/cad/pcb-insert.test.ts` exited 0 (5 pass, 0 fail): target/car2-p-picker-guard/logs/tests-final.log.
- `bunx biome check --diagnostic-level=warn packages/ui-solid/src/cad/board-picker.tsx packages/ui-solid/src/test-dom/cad-sketch.dom.tsx` exited 0: target/car2-p-picker-guard/logs/biome-final.log.
- Evidence and intermediate attempts: tmp/car2-r2b/car2-p-picker-guard/attempt-1/.
