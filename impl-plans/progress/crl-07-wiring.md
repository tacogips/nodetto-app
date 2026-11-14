# crl-07 wiring progress

- Plan intent hash: fe786ecc40d0b4e14608c434b62087da0ef32a3f.
- Initial arrange-route.ts: 9c194325aefa9f8ca16471a476ba268772527b1a; matches crl-05.
- Initial arrange-route-lanes.ts: 4b1319eb2d09532fddfc548a1464307d516d8326; matches crl-05.
- Dependencies: none pending under amended dispatch.

## Baseline audit

- Source: 1e8f43d224d7b43e200eb2229e7be17b39ca033c.
- `bun --version`: 1.4.4; `CARGO_TERM_QUIET=true cargo --version`: cargo 1.98.1 (797e8a9bc 2026-08-05).
- `git archive 1e8f43d224d7b43e200eb2229e7be17b39ca033c | tar -x -C target/crl-baseline/src`: exit 0.
- `bun install --frozen-lockfile` in `target/crl-baseline/src`: exit 0; log `tmp/crl-s749/crl-07-wiring/baseline-install.log`.
- `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli --manifest-path target/crl-baseline/src/Cargo.toml --target-dir target/crl-baseline/build`: exit 0; log `tmp/crl-s749/crl-07-wiring/baseline-build.log`. Binary copied from build/release.
- SHA-256 `target/crl-baseline/nodetto-cli`: c8f5c9049d8877d9e277e55c97ec4f76012b6adf6f7201a3440368f1aad2afa0.

## Work and unresolved acceptance

- Exported label and layered contracts; wired measured layered selection and moved-label stderr reporting; combined wrap and label fixes into a single batch; added metric summary and initial help/docs.
- Fixture: input crossings 604, label overlaps 104, segment overlaps 332; after layered and route: crossings 169, label overlaps 2, segment overlaps 3. `tmp/crl-s749/crl-07-wiring/fixture-attempt.log` records the failing zero-overlap assertion. `label-probe.log` shows lint --fix leaves both label overlaps. No geometric minimal bound has been established.
- `bun run typecheck` passed after wiring, `tmp/crl-s749/crl-07-wiring/final/typecheck.log`; scoped Biome check passed, `biome-attempt.log`. Core regression: 112 pass, 0 fail in `core-attempt.log` before formatting.
- Native parity command exit 1: 15 pass, 2 fail, no skips; `native-attempt.log`. Bun also selected archived baseline copies of layout tests from `target/crl-baseline/src`, whose old TypeScript CLI differs from the current native binary. The exact verification command needs a way to exclude the required archived source without changing its contract or removing required baseline evidence. No timeout occurred.
- Fixture acceptance tests, serial overlap repair, full parity coverage, native timings and CPU ratios, `mise run verify`, and `mise run test-cli` remain incomplete. Formal reviews and finalization are downstream.

## Per-edit hashes

- README.md.hashes: f24a61fcd31f09708df6f6a45ad7c1ae1c85f3c6 77347ec970c800a54dc4e4a35351e9aeaafd8412
- arrange-modes.ts.2.hashes: 564d08e4a102a5e195fbe3e1c8380a2f383e14db 3eecdaad50fe772364340a371e5b3bc2dc3fd482
- arrange-modes.ts.hashes: 50bc66ff2de02d11b9fa1efe72e42ce04e20a39d 564d08e4a102a5e195fbe3e1c8380a2f383e14db
- cli.md.hashes: 2c4f15bd7a3972dbcf0318f8e7c492380b912ad1 e923b7378f954eac89ed30cb77d746c1635da414
- commands.ts.hashes: d6e5d7dc85217423d18cbfc0dae1969509302653 f722b5a6d0d595b855544c0d7cda52eb85dc0f12
- help.ts.hashes: caa8c945c4c1bd94f534e9444d6e44ff19c6b822 b599ca61a14f8b048623e4c25b682472dc5f8c50
- index.ts.hashes: 7bcd60bef55ffdd5235bd73cd9f33d27c224d898 d6947c5bb1680668c6621a9b1785449dae351eee
- lint-diagram.ts.2.hashes: 800326c2ed1bef195a3aa5bc05beff002336a89d 62a2103d4f846cdcdde8e4bcf25cdd0e02af2be1
- lint-diagram.ts.3.hashes: 62a2103d4f846cdcdde8e4bcf25cdd0e02af2be1 7a378fb21118751015509343a8795f93c1a03305
- lint-diagram.ts.hashes: 89d33e690aa655a8a5ceffb440a03366551c4199 800326c2ed1bef195a3aa5bc05beff002336a89d

## Final source checks

- Required CLI test command: exit 1, 60 pass and 1 fail, `tmp/crl-s749/crl-07-wiring/final/cli.log`; zero-overlap fixture assertion remains unresolved.
- Required core test command: exit 0, 112 pass, `tmp/crl-s749/crl-07-wiring/final/core.log`.
- Typecheck and scoped Biome check: exit 0, logs in `final/typecheck.log` and `final/biome.log`.
- Baseline executable exists; sha256 verified in `final/baseline-sha256.log`.
- Native parity log is a prior attempt because formatting followed the build; the exact command needs rerun after resolving baseline test discovery. Full workspace gates and timing remain unrun.

- arrange-modes.ts.format.post: post ec684dbe215354424e62cf6132ab835a2ca2ba5e
- commands.ts.format.post: post f722b5a6d0d595b855544c0d7cda52eb85dc0f12
- connector-arrange.test.ts.format.post: post c4ac8bf8fb13140cf1cb1341d2c33ebe5c4ab330
- help.ts.format.post: post b599ca61a14f8b048623e4c25b682472dc5f8c50
- index.ts.format.post: post 60aede4b21eda9de9c3be0c895e0b60694e06c46
- lint-diagram.ts.format.post: post 7d5ebb3e1b3a0db262179b218dc094841f93f4c2
