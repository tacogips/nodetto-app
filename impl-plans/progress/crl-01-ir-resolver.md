# crl-01-ir-resolver progress

Plan intent hash: `b5cd18eef84312e3eaeef1fe9a70257f3a298eef` (git hash-object).
Dependency readiness: no predecessors; plan matches the accepted design.
Implementation: additive IR and page defaults, JSONL and Yjs persistence, undo and duplication, shared visual routing precedence, lanes and label offsets.
Checkpoint baseline: 437 run, 436 passed, 1 skipped, 0 failed, from `tmp/crl-s749/reconciliation/wave-001/checkpoint-baseline/aggregate.log`, produced by reconciliation from the checkpoint archive. Resolution evidence: `tmp/crl-s749/reconciliation/wave-001/checkpoint-baseline/resolution-probe.log`. The two new targeted files were absent at the checkpoint (cat-file exit 128 each): `tmp/crl-s749/reconciliation/wave-001/checkpoint-baseline/targeted-files-absent.log`. The reconciliation combined aggregate recorded 443 run, 442 passed, 1 skipped, 0 failed: `tmp/crl-s749/reconciliation/wave-001/combined/crl-01-aggregate.log`. No goldens were changed.
Earlier exploratory typecheck saw sibling fixture errors; the final rerun passed.

## Per-edit intent and hashes

- `packages/ir/src/semantics/connectors.ts`: Add bounded lane constant and connector label offset fields; pre `78fdcb0cc0a0daf18dc263a280ffc1217e660992`, post `47bbe88f21d473b0213e6cf1ce5a53d1b3c1b0f6`.
- `packages/ir/src/index.ts`: Export lane constant and page routing type; pre `38e3f90b5cb342a87bc6d33d41c3b229a7b3c708`, post `5c177ad02527b84ebac30a0276a8ec8c726de9e3`.
- `packages/ir/src/types.ts`: Define optional page connector routing default; pre `f05a8f8a64fa20825ab3710b3ba952f9be142198`, post `42feceda7867025ce9cf0fbf632a1d341dc6bfb7`.
- `packages/ir/src/registry/generic.ts`: Register lane and applicable offsets; validate numeric constraints; pre `e4674b589e0861e383fcc0766a81d82a9c1c15fa`, post `253b997c94d0d9b3e9b000821ed701b917b69348`.
- `packages/ir/src/registry/uml.ts`: Register lane and applicable offsets; validate numeric constraints; pre `f57543bfea8b34f5519d97e23552da69ca4758ae`, post `9d29fb251144c4ffc1872bd55ccfc2b804d9fbc0`.
- `packages/ir/src/registry/erd.ts`: Register lane and applicable offsets; validate numeric constraints; pre `4510d15349b47b968a29a3cb3f9ee967a1120379`, post `8028dd8962b129b51d1272b79a7aff3a120b3af5`.
- `packages/ir/src/registry/bpmn.ts`: Register lane and applicable offsets; validate numeric constraints; pre `dac8b697119251fb0f2d589ea538e218ae0c3b21`, post `808005c3bbb43cffc45592728293b1423a13872d`.
- `packages/ir/src/validate.ts`: Validate page connector routing object and fields; pre `2d4cd22a29af814bcb4a6c895e63533913872bf6`, post `d929eaf245a4cb253595e1ecb29cb27eabae4a69`.
- `packages/io/src/jsonl/records.ts`: Add page connectorRouting canonical key; pre `b81edb719f5a4ba698197af900bad5f0da42e14c`, post `14a3c1bd8ca42e930e64f4129dc1bd03a324e6ff`.
- `packages/io/src/jsonl/parse.ts`: Preserve page routing on JSONL load; pre `9f7cb9e4ce0f4cf84cc2a36b244db527421668ac`, post `d10918a13d90a7ce73b9791f93702de6b0d2630e`.
- `packages/collab/src/ydoc.ts`: Preserve validated page routing across Yjs; pre `d3e4864c3b955573a1c5a50ea026f1431ba2f803`, post `d094524d5650df5ecacb14cb6afe25ea7a1f6518`.
- `packages/core/src/editor/bpmn.ts`: Retain or clear routingLane alongside routingBend; pre `95558350de9af4b164239e0ad5fce766014e0721`, post `78d03dd058107969497227922a86a3cf2480ff03`.
- `packages/ui-solid/src/connector-routing.ts`: Retain or clear routingLane alongside routingBend; pre `60f48844cda051b82501199cdb04c181e6cbbb50`, post `675c3cc2e4aa245b3cafcfe389adddab708d4113`.
- `packages/io/src/bpmn/equivalence.ts`: Ignore lane for BPMN equivalence alongside routing fields; pre `7c5ed95bf0b2c960bd25737ee1e68ad3acd2f9ca`, post `7dd02de01d3469af79b12911b32d1165bb43c7e3`.
- `packages/core/src/editor/pages.ts`: Copy page routing default on duplicate; pre `544532358feb9d18bb41d836751ffd32a35d6caa`, post `205e284f798511ff6035a6d43e43e83b4c0b5543`.
- `packages/core/src/editor/facade/page-editing.ts`: Add no-op aware page routing setter using undoable updatePage; pre `61647d60a65075b6ace303c1a69847eed7babdc9`, post `462b1bc73017c062829f0a10f46dc79ee4ae23a4`.
- `packages/core/src/commands.ts`: Validate, merge, clear and undo page routing default; pre `7377b5182d31e91a25466df1ae762b3c5c7511e7`, post `dd3265890549863bf05633cd218fec72d9631698`.
- `packages/core/src/shapes/connector/resolve.ts`: Resolve stored routing with precedence, lane geometry, and non-BPMN label offsets; pre `ab7a3e186bc46a809fc8354b5853bdcbb9bc44fe`, post `578a6fd8a611711a57db0b9b4039b01ad2c81d7f`.
- `packages/ir/src/connector-routing-fields.test.ts`: Test lane bounds, offsets, page default and connector key registration; pre `absent`, post `1e8820ca08abb05009343be8ce71ffc67ad38437`.
- `packages/io/src/jsonl/roundtrip.test.ts`: Test canonical page routing field serialization and roundtrip; pre `6d38e20374c7a67ce458750e8ba98eb38d129339`, post `84635e49f67ca95b53f18454c8657f33a86832a9`.
- `packages/collab/src/ydoc.test.ts`: Test valid and invalid Yjs page defaults; pre `d2c879b37471ebe01c8291a544ae087f3c12330a`, post `9fc462407bd503331774e8a7c1498febc117b7b4`.
- `packages/core/src/pages.test.ts`: Test page routing set, clear, undo, duplicate and no-op; pre `fa37907a1edee4f4df92cf5c12c224591a50b06c`, post `3b893cd237412627009fe5d1ec1d65fc6e5cdee7`.
- `packages/ui-solid/src/connector-routing.test.ts`: Test straighten removes routingLane; pre `9caf95ae42537b40a5ef21ddd19ec568efb922df`, post `f8c002c16e39c3a580bd63789698c57dd7da6187`.
- `packages/core/src/connector-stored-routing.test.ts`: Test SVG stored routing precedence, obstacles, deterministic output, lane and label geometry; pre `absent`, post `5afc0c9611fa7b4da316b16bed9cde2a96e0e6ce`.
- `packages/ir/src/semantics/connectors.ts`: Apply scoped Biome formatting and safe lint fixes; pre `47bbe88f21d473b0213e6cf1ce5a53d1b3c1b0f6`, post `47bbe88f21d473b0213e6cf1ce5a53d1b3c1b0f6`.
- `packages/ir/src/connector-routing-fields.test.ts`: Apply scoped Biome formatting and safe lint fixes; pre `1e8820ca08abb05009343be8ce71ffc67ad38437`, post `b27c6d5a6d6ae244c283b3b8a76c9ac20eca0d8b`.
- `packages/core/src/shapes/connector/resolve.ts`: Apply scoped Biome formatting and safe lint fixes; pre `578a6fd8a611711a57db0b9b4039b01ad2c81d7f`, post `5ddd6870fb75b55c207542cc3f947eac2aa85fae`.
- `packages/core/src/connector-stored-routing.test.ts`: Apply scoped Biome formatting and safe lint fixes; pre `5afc0c9611fa7b4da316b16bed9cde2a96e0e6ce`, post `8eca1f261535338a92523f0eff77fbe1b994c25a`.
- `packages/core/src/editor/facade/page-editing.ts`: Apply scoped Biome formatting and safe lint fixes; pre `462b1bc73017c062829f0a10f46dc79ee4ae23a4`, post `6fff222b3b03e8c38bc0cccc1071aea28f358375`.
- `packages/ui-solid/src/connector-routing.ts`: Apply scoped Biome formatting and safe lint fixes; pre `675c3cc2e4aa245b3cafcfe389adddab708d4113`, post `8ebbf806ec01480bfbe32d1b61fcace7ed2013c7`.
- `packages/core/src/shapes/connector/resolve.ts`: Rename escape distance to avoid shadowing global; pre `5ddd6870fb75b55c207542cc3f947eac2aa85fae`, post `f168eeab3a6980881da753f8e4242d4179b218a8`.
- `packages/core/src/shapes/connector/resolve.ts`: Complete escape distance rename; pre `f168eeab3a6980881da753f8e4242d4179b218a8`, post `326d6a57e3603d62a8a0f2e2a6d6da82dbc67723`.
- `packages/core/src/editor/facade/page-editing.ts`: Require a concrete page routing value or null; pre `6fff222b3b03e8c38bc0cccc1071aea28f358375`, post `edc0919520f67640231c31a9fc04fed771a0842b`.
- `packages/core/src/connector-stored-routing.test.ts`: Test each lane, pinned endpoints and BPMN label offset exclusion; pre `8eca1f261535338a92523f0eff77fbe1b994c25a`, post `4299c53c62eaf466fbd9a16ff494cc5633c44303`.
- `packages/ir/src/connector-routing-fields.test.ts`: Exercise the actual UML component relationship registry type; pre `b27c6d5a6d6ae244c283b3b8a76c9ac20eca0d8b`, post `4c98a88b9e456a040efcfc98a0349f7e18397f08`.
- `packages/ir/src/connector-routing-fields.test.ts`: Format only the assigned edited file; pre `4c98a88b9e456a040efcfc98a0349f7e18397f08`, post `4c98a88b9e456a040efcfc98a0349f7e18397f08`.
- `packages/core/src/connector-stored-routing.test.ts`: Format only the assigned edited file; pre `4299c53c62eaf466fbd9a16ff494cc5633c44303`, post `e67d038cac1fa9e14251a71da1ffe4f52ba49447`.
- `packages/core/src/shapes/connector/resolve.ts`: Format only the assigned edited file; pre `326d6a57e3603d62a8a0f2e2a6d6da82dbc67723`, post `f7696bfa716fe4553c6a46d19a292c3b2cdcf584`.
- `packages/ir/src/registry/generic.ts`: Format only the assigned edited file; pre `253b997c94d0d9b3e9b000821ed701b917b69348`, post `60ecd20cf299d4a97cfb27cfe5f6efca25f23fb3`.
- `packages/ir/src/registry/uml.ts`: Format only the assigned edited file; pre `9d29fb251144c4ffc1872bd55ccfc2b804d9fbc0`, post `9d29fb251144c4ffc1872bd55ccfc2b804d9fbc0`.
- `packages/ir/src/registry/erd.ts`: Format only the assigned edited file; pre `8028dd8962b129b51d1272b79a7aff3a120b3af5`, post `8028dd8962b129b51d1272b79a7aff3a120b3af5`.
- `packages/ir/src/registry/bpmn.ts`: Format only the assigned edited file; pre `808005c3bbb43cffc45592728293b1423a13872d`, post `808005c3bbb43cffc45592728293b1423a13872d`.
- `packages/ir/src/validate.ts`: Format only the assigned edited file; pre `d929eaf245a4cb253595e1ecb29cb27eabae4a69`, post `0bec51e69ae0243fd2e886236943b9059a63e8ac`.
- `packages/core/src/commands.ts`: Format only the assigned edited file; pre `dd3265890549863bf05633cd218fec72d9631698`, post `be87e6b39034fa9d9af4679710d9e296da61eac5`.
- `packages/core/src/editor/pages.ts`: Format only the assigned edited file; pre `205e284f798511ff6035a6d43e43e83b4c0b5543`, post `23564f1f0e322ee860c81a36b21cdf01ff8db26d`.
- `packages/collab/src/ydoc.ts`: Format only the assigned edited file; pre `d094524d5650df5ecacb14cb6afe25ea7a1f6518`, post `e722a4566e506fa7dc5a627a5610ef38450c9807`.
- `packages/collab/src/ydoc.test.ts`: Format only the assigned edited file; pre `9fc462407bd503331774e8a7c1498febc117b7b4`, post `7e7c9f398111ddc84da0ba0f11baf7641d09a719`.
- `packages/io/src/jsonl/parse.ts`: Format only the assigned edited file; pre `d10918a13d90a7ce73b9791f93702de6b0d2630e`, post `6eb44c097dffca1eb003354a8a3ff66778de05e1`.
- `packages/io/src/jsonl/roundtrip.test.ts`: Format only the assigned edited file; pre `84635e49f67ca95b53f18454c8657f33a86832a9`, post `34c8c655e2e08b54fe7edb485b0fcb0a5f8d58a9`.
- `packages/core/src/pages.test.ts`: Format only the assigned edited file; pre `3b893cd237412627009fe5d1ec1d65fc6e5cdee7`, post `3bd9ba78af14eb9b784be7f92152664bb895c281`.
- `packages/ui-solid/src/connector-routing.test.ts`: Format only the assigned edited file; pre `f8c002c16e39c3a580bd63789698c57dd7da6187`, post `f8c002c16e39c3a580bd63789698c57dd7da6187`.
- `packages/core/src/connector-stored-routing.test.ts`: Test every lane around a vertical stack of three obstacles; pre `e67d038cac1fa9e14251a71da1ffe4f52ba49447`, post `a9c22609f7e6fac10053d27bec329dd45bc2d370`.
- `packages/core/src/connector-stored-routing.test.ts`: Format the added stack geometry test; pre `a9c22609f7e6fac10053d27bec329dd45bc2d370`, post `fc5158ec0c2636621aa64323df3e641276b72a4e`.

## Verification on shared tree

- Targeted bun tests: exit 0, 8 passed, 0 failed; `tmp/crl-s749/crl-01-ir-resolver/final/targeted.log`.
- Aggregate bun tests: exit 0, 443 run, 442 passed, 1 skipped, 0 failed; `tmp/crl-s749/crl-01-ir-resolver/final/aggregate.log`.
- `bun run typecheck`: exit 0; `tmp/crl-s749/crl-01-ir-resolver/final/typecheck.log`.
- Plan-scoped Biome check: exit 0; `tmp/crl-s749/crl-01-ir-resolver/final/biome.log`.
- Done checks: exit 0; `tmp/crl-s749/crl-01-ir-resolver/final/done-checks.log`; svg-export diff is empty.
- Formal reviews, final integration verification, and workflow finalization belong to subsequent steps.

- CRL01-BASELINE repair: reconciliation baseline and fresh moving-tree verification recorded; previous final evidence retained in `tmp/crl-s749/crl-01-ir-resolver/attempt-3/`. Test-integrity and adversarial decisions remain pending independent review.

## Neighbor escape review repair

A pinned lane escape falls back to 24 when its longer escape newly enters either a neighbor's cached 12-unit box or the strict interior of its real box. Endpoint clearance is capped below the smallest pinned escape; lane zero remains unchanged. This refines the escape rule for gaps smaller than MEMBER_GAP.

- `packages/core/src/connector-stored-routing.test.ts`: add gap/lane matrix and 60-unit escape assertion; pre `fc5158ec0c2636621aa64323df3e641276b72a4e`, post `0fa38a1d669a62a633b9cb4bc5ad2a3db78114df`; scoped format post `e18e177b401d884a8b5bd431da0feca68e5cdbd3`. Before the fix the new test failed (5 pass, 1 fail), `tmp/crl-s749/crl-01-ir-resolver/neighbor-before.log`.
- `packages/core/src/shapes/connector/resolve.ts`: preserve neighbors using per-end escape selection; pre `f7696bfa716fe4553c6a46d19a292c3b2cdcf584`, post `578674e873fb53748382d9f2a4ac4ee455cbecea`; scoped format post `0959deca5043834208752d3baeb43597d1d05bbf`.
- Moving shared tree verification: targeted 9 pass, 0 fail; aggregate 443 run, 442 pass, 1 skip, 0 fail; typecheck, Biome and SVG diff exit 0. Complete command and status logs: `tmp/crl-s749/crl-01-ir-resolver/revision-1/`.
- Prior test-integrity decision accepted; revised source requires renewed independent review. Adversarial decision requested this repair and is pending re-review.

## Close-gap escape review repair

- `packages/core/src/connector-stored-routing.test.ts`: add below-target and mirrored pin matrix for gaps 24–37 and lanes 0–8; pre `e18e177b401d884a8b5bd431da0feca68e5cdbd3`, post `02c96f5bec9ff8e68a10f5f4a0f982968e9df9d4`, formatted `51ffc7ad9291dcf849dc1cb5e6019591d1df3fc2`. Before the fix, targeted tests failed (9 pass, 1 fail, exit 1): `tmp/crl-s749/crl-01-ir-resolver/sub36-before.log`.
- `packages/core/src/shapes/connector/resolve.ts`: check strict real-box interior in addition to the cached clearance box; pre `0959deca5043834208752d3baeb43597d1d05bbf`, post `4e4f357d436f36177a6b9fbc41ead55f8962768f`, formatted `6458e327e0368eb87dbd0995042870aed273160b`.
- Moving-tree checks: targeted 10 pass, aggregate 442 pass and 1 skip, fixture 1 pass; typecheck, Biome, and SVG diff exit 0. Complete logs and exit statuses: `tmp/crl-s749/crl-01-ir-resolver/revision-2/`. The fixture test pins metrics 604, 104 and 332. Earlier revision-1 evidence remains intact.
- Independent test-integrity and adversarial re-review of the revised source remain pending.
