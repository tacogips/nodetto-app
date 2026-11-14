# sac-03-slide-rect-core progress

- Workflow: issue-resolution; issue reference: runtime workflowInput of opus-terra-design-and-implement-review-loop-session-826.
- Intent plan hash before edits: `44f1d380bb0e9d7c520d7f44354c88fa40a52040`.
- Implemented explicit and fallback slide rectangles, ordered presets and page labels, including focused tests.
- Shared-tree checks: `bun test ./packages/core/src/presentation` exit 0, 17 passed, 0 failed; `bun run typecheck` exit 0; owned-file `bunx biome check` exit 0. Complete logs are in `tmp/sac-s826/sac-03-slide-rect-core/final/`.
- Protected source, slides, fit, navigation and core index files have no diff.
- Formal review, integration, commit and push are downstream.

## Per-edit evidence

- `edit-01.json`: `packages/core/src/presentation/slide-rect.ts` absent -> 20839590623da1a6cbd127bed6c124a3eb459a99 (exit 0).
- `edit-02.json`: `packages/core/src/presentation/slide-size.ts` absent -> 32e0f2bfa0092ecb816fd9036fb3ad00c3d4cf65 (exit 0).
- `edit-03.json`: `packages/core/src/presentation/labels.ts` absent -> 46fae417db10a013cd3261046adeb11d0fac2c71 (exit 0).
- `edit-04.json`: `packages/core/src/presentation/index.ts` e1393c736d3e827581116c1d479a02ecc84d0a44 -> 0030609f2057066b67a5372ced6dd1458c109b67 (exit 0).
- `edit-05.json`: `packages/core/src/presentation/slide-size.test.ts` absent -> f7faec69205abb2241ebd04ff73814d260b57365 (exit 0).
- `edit-06.json`: `packages/core/src/presentation/labels.test.ts` absent -> 424493905a6f92642590428123c95d1eeebb3555 (exit 0).
- `edit-07.json`: `packages/core/src/presentation/slide-rect.test.ts` absent -> f0bc61fba5d8e5911110f430c0b39ff4309df295 (exit 0).
- `edit-08.json`: `packages/core/src/presentation/labels.test.ts` 424493905a6f92642590428123c95d1eeebb3555 -> 68c1da2c89f4cc2658c2197fe5ee2edbe7b7c6e5 (exit 0).
- `edit-09.json`: `packages/core/src/presentation/slide-size.test.ts` f7faec69205abb2241ebd04ff73814d260b57365 -> c4ad1028094618dbdb6380d22fc10e5278b3eff9 (exit 0).
- `edit-10.json`: `packages/core/src/presentation/index.ts` 0030609f2057066b67a5372ced6dd1458c109b67 -> 0030609f2057066b67a5372ced6dd1458c109b67 (exit 0).
- `edit-11.json`: `packages/core/src/presentation/slide-rect.test.ts` f0bc61fba5d8e5911110f430c0b39ff4309df295 -> 9b97a19f249f95ba03d44e33b5c17ce5786a2c86 (exit 0).
- `edit-12.json`: `packages/core/src/presentation/slide-size.ts` 32e0f2bfa0092ecb816fd9036fb3ad00c3d4cf65 -> 15147b4de7eb71dfe1243deeb82ee231a4c852e6 (exit 0).
- `edit-13.json`: `packages/core/src/presentation/slide-rect.ts` 20839590623da1a6cbd127bed6c124a3eb459a99 -> d14864979868272c7a9d899d856362ca211bfa0c (exit 0).
- `edit-14.json`: `packages/core/src/presentation/labels.ts` 46fae417db10a013cd3261046adeb11d0fac2c71 -> a4b87cf7c13354c7607d79f2b3a6ee90a5383b58 (exit 0).
- `edit-15.json`: `impl-plans/active/sac-03-slide-rect-core.md` 44f1d380bb0e9d7c520d7f44354c88fa40a52040 -> 89efd4c5545e72f0c864b8fdb81b9eff5d58e9b9 (exit 0).
- This progress-file edit is recorded with pre/post hashes and content in the next numbered `edit-*.json` evidence file.
