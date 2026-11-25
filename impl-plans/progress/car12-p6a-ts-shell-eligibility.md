# car12-p6a-ts-shell-eligibility progress

Status: done (implementation phase; independent review and integration pending).

- Decoder SHA-256: pre `f114b37842c059e00874cf95a8fd8202acfa824cb57214cfcfe3f8e054527ed2`; intermediate `e2b1bfd049dd9e1b6fd1f95f6535935af626f2dc415412cdf2865567f271fd01`, `ceab0818ec30fad7793e33830b7681bb5877f6759e96e15744e455bc7b319ff0`, `22d326113c6dc8b1f48fa8a010f5b37f1ced9632f7b0686fbb7e7ec945bb7625`; final `6c804bd250c5b37fb1a475bf5d0269fbb0d853ddfa6178ce2b9e334df3ffa212`.
- Test SHA-256: pre `b0b245fa70f775dd3872b665e6f2ee3bf5bc7d04550777366dc405372a78e2de`; intermediate `c78d500ad0075e91649c590da4b3e061c582e7cdf239e039a3b73cc4d90c8c88`; final `2a509ebdcccef6eae5c03d73a5c77119cc67f3ac58c782db7cd96a148873ac3d`.
- docs/capture.md SHA-256: pre `c1f1a9b4bf1d404bb7a9e81107c9dd4d9580e662a91d99d9ad57888809053ac4`; final `3fb158bca0e215d968ba9e0e26a93a9559b0a6896b48f4f24cc066e02476e922`.
- docs/cad3d.md SHA-256: pre `5b76154138058b717b5c7adf77337342cdbf01b400b0e163d2659907d4613fb1`; final `dfd6100a0f4ebc3d536e8f0b66506238c4935bcc24259fd6eabc08cac2a1790c`.
- Active plan pre SHA-256 `21e77d9165f484d4105df0c888094f65dbcfa78230b3debe619e116cec3c075c`; progress file created from absent.
- Fixtures (vertices/triangles): edge 14/24, face 12/24, crossed face 12/24, separated 16/24, open triangle 9/13, unbalanced 14/24, overlap 14/24, fin 16/28, coincident 16/36.
- Pre-fix `bun test packages/io/src/nmesh/capture-decoder.test.ts`: exit 1, 5 passed, 1 failed; `tmp/car12-r12/car12-p6a-ts-shell-eligibility/fail-before.log`.
- Final `bun test packages/io/src/nmesh/capture-decoder.test.ts packages/io/src/nmesh/capture-decoder-budget.test.ts`: exit 0, 7 passed; `tmp/car12-r12/car12-p6a-ts-shell-eligibility/tests-final.log`.
- Final `bunx biome check packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/capture-decoder.test.ts`: exit 0; `tmp/car12-r12/car12-p6a-ts-shell-eligibility/biome-final.log`. Initial diagnostics resolved; `biome.log`.
- Scoped `bunx tsc --noEmit -p tmp/car12-r12/car12-p6a-ts-shell-eligibility/tsconfig.json`: exit 0; `tmp/car12-r12/car12-p6a-ts-shell-eligibility/typecheck.log`. Workspace typecheck is owned by integration.
- No work counters apply to this plan. Per-edit intentions and snapshots are in the evidence directory. Shared-tree status includes sibling changes and is not a plan-scope violation.

- Active plan final SHA-256 `dc63cb083c277a827ed4ea563b36b1de3fe13782f459c305f22ad4d053099ec9`.
