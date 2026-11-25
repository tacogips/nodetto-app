# car4-f3-loop-index progress

Status: done (implementation; formal review and integration pending).

- `packages/core/src/capture/scene.ts`: before `08024d8410e9db6a4b5096da501df7bb59ab21f332adb3813c7025a191aab1ff`, after `d6bc1bbe1a888060e0144933ee107cb423ad03e8ecdde7456b72f8cec771e2d1`.
- `packages/core/src/capture/scene.test.ts`: before `ed0b87e534fa9ae9b7dce4c73e223a5136c8b73f3fbd1a35accde40f66258f89`, after `1b0ec9496439535cdaeccbdda3099a2cbe4558ff455d1910720cd947705ccce1`.
- Test-first negative control: `bun test packages/core/src/capture/scene.test.ts --test-name-pattern 'normalisation indexes rings'`, exit 1, `tmp/car4-r4/car4-f3-loop-index/pre-fix.log`; 125250 and 500500 probes at 500 and 1000 square rings.
- Final gate: `bunx biome check --diagnostic-level=warn packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts packages/core/src/capture/determinism.test.ts`, exit 0, 34 pass, 0 fail; `tmp/car4-r4/car4-f3-loop-index/final-gate.log`.
- Counts (probes/entries): square rings 690/1380, 1000/2160, 2000/4000; row rings 500/1000, 1000/2000, 2000/4000; strips 1/1201, 1/2401, 1/4801; mixed 500/1121, 1000/2161, 2000/4001. All oracle identities and serialized bytes match; the existing perforated-plate test is unchanged.
- The f1a hidden-target changes remain in `scene.ts` and `scene.test.ts`. Workspace typecheck, lint and integration gates are assigned to the serial integration step.
