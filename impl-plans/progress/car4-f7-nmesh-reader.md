# car4-f7-nmesh-reader progress

Status: done

One reader owns validation; capture budget uses inspection count. No dependencies. Formal reviews and integration gates remain downstream.

## File hashes

- `packages/nmesh/src/decode.ts`: Pre-sha256: 2839ba0f4a71521e968bbb0d00bfe060b9d2b07cda35b2608f5f2eacc8ec97f3; final sha256 97360812a183ea754942dcce90bb1eb4367225092fb21d697cafa7ff88bb5726
- `packages/nmesh/src/codec.test.ts`: Pre-sha256: 0c944980ef4d30f5793329185d8d1d982ba8bfea9b2053442ad3811ef9550bab; final sha256 4f53c95191fec3bdec08309176c50b6f9905df94f3b1d522c6b8f18c55d7579d
- `packages/io/src/nmesh/capture-decoder.ts`: Pre-sha256: 0277cde55cd75863547c4a209bfc92a0372ce6217674235dbd9276f40896b57b; final sha256 f114b37842c059e00874cf95a8fd8202acfa824cb57214cfcfe3f8e054527ed2
- `packages/io/src/nmesh/capture-decoder.test.ts`: Pre-sha256: dcad0127069049b2a3bf8b55cc0582e62fafadb3825f4658dc5190ce275fe1f6; final sha256 b0b245fa70f775dd3872b665e6f2ee3bf5bc7d04550777366dc405372a78e2de
- `packages/io/src/nmesh/capture-decoder-budget.test.ts`: Pre-sha256: b74285bfeb415942c53841b16f5da2f43f2b891f4eeb7aa5e6445f823d8df31a; Pre-sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855; final sha256 9257b5d8f1e1f5025f27ce8c6c01c3445d741edf914f8d32e512d86e325a7a6a

## Verification

- Pre-fix regression: `bun test packages/nmesh/src/codec.test.ts packages/io/src/nmesh/capture-decoder-budget.test.ts`, exit 1; `tmp/car4-r4/car4-f7-nmesh-reader/pre-fix.log`. Missing reader export demonstrated the reader contract; sentinel mock initially recursed and was corrected before the final run.
- Final gate: `bunx biome check --diagnostic-level=warn packages/nmesh/src/decode.ts packages/nmesh/src/codec.test.ts packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/capture-decoder.test.ts packages/io/src/nmesh/capture-decoder-budget.test.ts && bun test packages/nmesh/src packages/io/src/nmesh`, exit 0, 35 tests passed, 0 failed; `tmp/car4-r4/car4-f7-nmesh-reader/final-gate.log`.
- Corruption parity, bounds, allocation callbacks, multi-byte budget boundaries and sentinel inspection budget covered.
