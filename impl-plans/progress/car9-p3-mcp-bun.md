# car9-p3-mcp-bun progress

Status: done (implementation; formal review and integration pending).

- `apps/cli/src/mcp.ts`: original SHA-256 `e3a37339780142f1f7e9ac340f46ea59b07a48939532918cd7702aacd14cb5b4`; stage 1 `045e745f2d3ce9c0bbbca342da38d31d352f95c4c5d897d9128ee59f62e4fa03`; fix `29c2fd3226cea2c56eb30ac289084facda221e292899675a88072e247db6bd5d`; formatted final `240dbb3b54aacadaf7329f32f4f67c064eef359991ce44faaf40bfb4aa123b9b`. Added per-call bounded write retention and removed readback.
- `apps/cli/src/mcp.test.ts`: original `c70faeaf6ca254485cff8f167536b0ea7dfd44a8a67d17ecad25493a3914db60`; stage 1 `9ccd989ac8cb1326c4e83a3d54179dc6085f70662a41b61b5d27e133d65c416d`; boundary cases `00f3d8c5c008272212400d84b25cd27d16d75228854f97fbfea9604c8a894738`; formatted final `e12db56bb438ed544df2c8a797e67d4cf6020db7dfd9eda7e01305dec93c67eb`. Added race and boundary tests; adapted specified readback fixtures.
- Stage 1: `bun test apps/cli/src/mcp.test.ts --test-name-pattern '^MCP inline capture attaches each call.s own write$'` exited 1, one test failed as expected: A received B while both writes and exit codes succeeded. Full log: `tmp/car9-r9/car9-p3-mcp-bun/stage1.log`.
- Final: `bunx biome check apps/cli/src/mcp.ts apps/cli/src/mcp.test.ts && bun test apps/cli/src/mcp.test.ts apps/cli/src/mcp-image.test.ts apps/cli/src/mcp-stdio.test.ts` exited 0; 25 tests passed, 0 failed. Full log: `tmp/car9-r9/car9-p3-mcp-bun/gate.log`.
- Per-edit intentions and intermediate hashes are preserved in `tmp/car9-r9/car9-p3-mcp-bun/edit-*.txt`. Typecheck, workspace verification and release parity are assigned to integration.
