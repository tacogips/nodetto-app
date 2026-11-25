# car14-p2b-ts-attachment-sides progress

Status: done (implementation). Formal review and integration are downstream.

- Test file SHA-256: pre-edit `2a509ebdcccef6eae5c03d73a5c77119cc67f3ac58c782db7cd96a148873ac3d`; after fixture `f55c0f7d01f77bcfe45f6de2585e1ae1437d7ee78050173514fd4ae44364affb`; final `e18fd146a9c69c55f36462077b1e085fdc6d6bc6ffe05b9621328b04da556dfc`.
- Decoder SHA-256: pre-edit `6c804bd250c5b37fb1a475bf5d0269fbb0d853ddfa6178ce2b9e334df3ffa212`; after C2b `cd977bf9a418e99317a92d1abc90404088e8faca8c56013c8aedb57302b414a7`; after formatting `0d382bdab0ef41554389021f79e44f2f1e2b23443ae33d1c34314f07660fc6c7`; final `e4f6faf85f52e5912645b3a145e0b8f248752831a418fa5f9c8635754321f6a4`.
- Plan SHA-256: pre-edit `7c34682d612e4b01a45f743c4f6b2a9cd240402d70c9411f4633a1c177def584`; final `0db7688959e194cb12febf116b9a4292e2de4b7f4ec561d947091fecfd0f71a4`. Progress file was absent before creation; its final hash is in evidence `progress-hash.txt`.
- Evidence directory: `tmp/car14-r14/car14-p2b-ts-attachment-sides/`. Per-edit intent and snapshots are recorded there.
- Fail-before: `bun test packages/io/src/nmesh/capture-decoder.test.ts -t 'face contact with a second overlap and self-touching shells are not targets'`, exit 1, `fail-before.log`: all three negative fixtures returned true.
- `bunx biome format --write packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/capture-decoder.test.ts`, exit 0, `format.log`.
- Initial `bunx biome check packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/capture-decoder.test.ts`, exit 1, `biome-first.log`; corrected Infinity style with `bunx biome check --write packages/io/src/nmesh/capture-decoder.ts`, exit 0, `lint-fix.log`.
- Final `bunx biome check packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/capture-decoder.test.ts`, exit 0, `biome-final.log`.
- Final `bun test packages/io/src/nmesh/capture-decoder.test.ts packages/io/src/nmesh/capture-decoder-budget.test.ts`, exit 0, 8 passed, `pass-after.log`. Verbose repeat: exit 0, 8 passed, `pass-verbose.log`.
- Final selected regression command as above, exit 0, 1 passed, `regression-final.log`.
- No work counters apply. Workspace typecheck, lint, and verify run at integration per the dispatch. Tests ran on the shared working tree.
