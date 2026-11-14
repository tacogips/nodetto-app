# crl-04-connect progress

Checkpoint and intent: d4843e58b679160142ac07225bcf4b4519f17433; implementation follows R1 in design-connector-routing-arranging.md. Dependency crl-01 was accepted by dispatch. Checkpoint aggregate baseline: 106 passed, 0 failed, 1834 assertions, 14 files, exit 0; `tmp/crl-s749/crl-04-connect/baseline-retry.log`. It used a git archive and symlinks to workspace dependencies; the initial attempt lacked workspace dependency links and is preserved in `baseline.log`.

Implemented routing precedence, visual application and migration, page convention and defaults, field validation, and sequence message exclusion. The existing operation-fields expectation for connect visual style was updated under R1 because visual is now applied. Earlier failed moving-tree typechecks are in `attempt-typecheck.log` and `pages-typecheck.log` and are superseded by the final run.

Per-edit intent and pre/post hash records are in `tmp/crl-s749/crl-04-connect/`: `intent-helper.txt`, `helper-before-fix.hash`, `intent-helper-fix.txt`, `connect-before.hash`, `intent-connect.txt`, `format-before.hash`, `format-after.hash`, `add-*.hash`, `add-intent.txt`, `add-format-intent.txt`, `pages-intent-1.txt`, `pages-format-{pre,post}.txt`, `fields-intent-1.txt`, `fields-test-intent-{1,2}.txt`, `fields-test-format-{pre,post}.txt`, `batch-intent-1.txt`, and `test-{intent,hash,pre,post}-*.txt`. The new helper initial blob was a8611f8f030ae99a402df41c579814eebfd7cc1e; after type correction db7372e33210257dc6c8a303be67476ac26b3287. The connect initial edited blob was 05bcbfa514f414e05920579c574bdfa1e882cb3f.

Final blobs in plan order:
- connect-routing.ts e5f26d11077c7ace10d54512934ed2f2fb5f3187
- connect-routing.test.ts 34fb33c40347a3f4e2aa786416248c4983dd3c49
- operations/connect.ts 12d7d096fdf57ce3f103855cac753238ac2cb60b
- operations/add.ts 85a165250450bd5de7baf5685bc65d06f635ea8d
- operations/pages.ts 3d6879f97178006a044e753819be3733f67f2e83
- operation-fields.ts ffdb7eefa6e5fe2a1a0d1fc779a1b65987477056
- operation-fields.test.ts f65890bfe54a5737270acfe4e7330bbdaf7c47e3
- batch.ts cacac090b8947505ca80eb4c6f62706152e4be60
- native-parity/connect-routing.test.ts 03880e32e5b1a91a53f34f5148f758b80ff6c9ec

Final gates on the shared tree, all exit 0, complete logs under `tmp/crl-s749/crl-04-connect/final/`:
- Targeted Bun: `targeted.log`, 6 pass, 0 fail, 52 assertions.
- Aggregate Bun: `aggregate.log`, 113 pass, 0 fail, 1905 assertions.
- Typecheck: `typecheck.log`; Biome: `biome.log`, 9 files.
- Release native build and parity: `native.log`, 1 pass, 0 fail, 0 skips.
- Registration check: `registration.log`; protected paths diff: `protected.log`, empty.

Implementation complete for this plan. Independent integrity and adversarial reviews and final combined-tree integration remain downstream. The final gates ran on the shared tree; unrelated sibling work is present.

The parity page-record serialized-byte assertion was refined after the first gate run. Intent and pre/post blobs are in `intent-parity-byte.txt`, `parity-before-byte.hash`, `parity-after-byte.hash`, `intent-parity-format.txt`, and `parity-format-{before,after}.hash`. The formatting-only intermediate Biome failure is retained in `attempt-2/biome.log`; final typecheck, Biome and native gates were rerun after formatting. Targeted and aggregate tests were unaffected by that parity-only change and their complete logs are copied from attempt 1.

## Test-integrity revision

CRL04-TI-01 adds explicit routing against page defaults with avoidance true and false. CRL04-TI-02 adds all-manual peers and matching routing with conflicting avoidance. CRL04-TI-03 adds typed edge default and convention cases, plus typed sequence explicit rejection and default skip. Existing assertions are retained. Test edit blobs: 34fb33c40347a3f4e2aa786416248c4983dd3c49 -> b88126b6ef21491ffd630d8fce87336f57e1cf71; formatting -> 7f8eb827287e3e4565543894c4667133b16c87b5. Intent and fresh read evidence: `ti-intent.txt`, `ti-before.test.txt`, `ti-after.test.txt`, `ti-format-intent.txt`, `ti-format-before.txt`, `ti-format-after.txt` and corresponding hash files under `tmp/crl-s749/crl-04-connect/`.

Current verification supersedes the targeted, aggregate, typecheck and Biome counts above: `ti-targeted.log` 10 pass, 0 fail, 64 assertions; `ti-aggregate.log` 117 pass, 0 fail, 1917 assertions; `ti-typecheck.log` and `ti-biome.log` exit 0. All four commands exited 0 on the shared tree. The non-test source hashes in `ti-source-hashes.log` match the reviewed blobs above, including the native parity test; the prior `final/native.log` gate remains source-matched (1 pass, 0 fail, 0 skip). Independent reviewer fault reruns and review decisions remain pending.
