# car4-f8-face-resolution progress

Status: done (implementation; formal review pending).

The accepted f4 dependency was present in the dispatch. Extracted
`resolveFeatureGeometry` for both lookup paths, preserving status and dependency
short-circuits and the f4 extent calculation. Added valid, suppressed and broken
chain parity coverage and feature-update counters; the profile-build assertion remains.

Source SHA-256 before -> after:
- history.ts: 62762d6044724ac4ab5e0a97c46da5562480614c331b8e07ca75bb29a5c3333e -> 461be10e186101a57ad2f809f23603388e5f87d61497a99dba0adc9c32a8a1d6
- history.test.ts: b5dbbab8d1c64f4f0ce0927b696319d4bba32d5d9e24a83ecab2e8fb1261fef0 -> 8fbcdc319c0fa774d3154419dbe962b71f5e2de0ab35055bce6adcedd1619b4f

Before implementation `bun test packages/core/src/cad/history.test.ts` failed the new
counter assertion (16 pass, 1 fail); see `tmp/car4-r4/car4-f8-face-resolution/pre-fix.log`.
Final focused gate: `bunx biome check --diagnostic-level=warn packages/core/src/cad/history.ts packages/core/src/cad/history.test.ts && bun test packages/core/src/cad/history.test.ts packages/core/src/cad/preview.test.ts packages/core/src/cad/frames.test.ts` exited 0: 27 pass, 0 fail; see `tmp/car4-r4/car4-f8-face-resolution/final-gate.log`. Both valid lookup paths recorded three feature updates.
Workspace typecheck, lint and integration checks are assigned to serial integration.
