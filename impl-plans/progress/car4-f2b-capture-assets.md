# car4-f2b-capture-assets progress

Implemented ordered capture carriers and the Bun resource resolver. The capture boundary regression checks one read, one payload and bounded growth for 1, 2, 8 and 32 placements. Bun parity covers PNG, JPEG, GIF and unresolved WebP, four placement modes and two scales. Native shared-versus-distinct attachment PNG/JPG parity is in `apps/cli/src/native-parity/capture-attachment-reuse.test.ts`.

The focused Bun gate passed 48 tests; see `tmp/car4-r4/car4-f2b-capture-assets/bun-gate-final.log`. The native release build and parity gate passed 1 test; see `tmp/car4-r4/car4-f2b-capture-assets/native-gate.log`. Status: done. Formal review and combined-tree integration remain downstream.

Review repair `f2b-embedded-data-url-source-regression`: embedded data URLs return inline before attachment indexing. Added embedded-only and mixed-source regressions. Both failed before the guard (exit 1, `tmp/car4-r4/car4-f2b-capture-assets/embedded-before-repair.log`) and passed afterward. The refreshed Bun gate passed 50 tests (`bun-gate-repair.log`); the native gate passed 1 test (`native-gate-repair.log`). Both logs are in the plan evidence directory. Formal re-review and integration remain downstream.
