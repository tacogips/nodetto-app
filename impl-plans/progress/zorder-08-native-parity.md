# zorder-08 native parity progress

- Dependencies zorder-04 and zorder-06 are accepted in dispatch. Plan aligns with design section 5.
- `apps/cli/src/native-parity/order.test.ts`: absent -> `49a15399c5769472eaed773e08760538c98d7af0` (parity cases); scoped formatting -> `0e7f6e209fbef81af02b0a2610de76b5d99257ba`. Intent and pre-format hash are in `tmp/zorder-s734/zorder-08-native-parity/`.
- Group assertion: `0e7f6e209fbef81af02b0a2610de76b5d99257ba` -> `90851d0989f0e7c7261703aa643b41dc7541965c`; expected member order is asserted.
- Progress file: absent -> `37ff947941286882a61a5fc0ea27191674c9b6a4` -> see final hash in plan-local evidence.
- `bun run typecheck`: exit 0; `bunx biome check apps/cli/src/native-parity/order.test.ts`: exit 0.
- Baseline archive commit `29f8691135fb6098a9496495f4a417e93ce0625e` built successfully; baseline rejects order with exit 2 and paints node before frame (baseline-order.log and baseline-probe.svg). Current release build passed.
- Native parity: 4 passed, 0 failed, 0 skipped; `native-final.log`. Both executable and timing file checks passed.
- CPU medians: connected baseline 1.230s, current 1.300s (1.0569 <= 1.25); flat baseline 1.380s, current 1.310s (0.9493 <= 1.5). 50-op dry-run current user+sys 9.89s. Samples and individual logs are in `timing.txt` and the evidence directory.
- Final typecheck and scoped Biome check passed. Formal review and combined-tree final gates are downstream.
- ZORDER-08-BASELINE-DISCOVERY: moved `target/zorder-baseline/src` to `target/zorder-baseline/.src`, preserving the source and links. Reviewer observed selectors 16 pass across 2 files and export 8 pass, 1 fail across 2 files before relocation; afterward selectors and export each pass 8 tests across 1 file. The requested find produces no paths. Logs: `baseline-relocate.log`, `repair-selectors.log`, `repair-export.log`, `repair-find.log`.
- Baseline still rejects order with exit 2 and paints node before frame (`repair-baseline-order.log`, `repair-baseline.svg`); baseline binary and timing remain available. SHA-256: binary `e94b21f42266a7ead7d27ed0ace25b3c5d1d61cecfb6a75af63f41e067373e81`, timing `9914c5ba2967c44d8dda4e1270fe16884f58f141473427ebccd8e2a2eb746c12`. Neither was modified by relocation.
- Repair verification: release build, executable and timing checks, typecheck and Biome exit 0; native parity 4 pass, 0 fail, 0 skip (`repair-native.log`). Test file remains `90851d0989f0e7c7261703aa643b41dc7541965c`; progress before this update `104d8178ee36ef0eef806833e7413ca363724dc2`, after update recorded in `repair-progress-hash.txt`. Independent reviews remain pending.
