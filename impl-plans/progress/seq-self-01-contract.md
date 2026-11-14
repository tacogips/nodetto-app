# seq-self-01-contract progress

Workflow mode: issue-resolution. Baseline HEAD: 2e2b985a977f44c27abe5df9f23c29b461bd7be1.
Pre-change source comparison: exit 0, `tmp/seq-self-s750/seq-self-01-contract/baseline-diff.log`.
`rustc --version`: rustc 1.98.1 (48a229cea 2026-09-01).
`CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`: exit 0, `tmp/seq-self-s750/seq-self-01-contract/baseline-build.log`.
Baseline SHA-256: `c8f5c9049d8877d9e277e55c97ec4f76012b6adf6f7201a3440368f1aad2afa0` (`target/seq-self-baseline/nodetto-cli`).

## Edit audit

Progress log initially absent; created for baseline identity. Detailed per-edit intentions and snapshots are in `tmp/seq-self-s750/seq-self-01-contract/`.

- `packages/core/src/sequence-layout.ts`: Add self-message constants, detection, extent and order-aware geometry in the existing scan. Before SHA-256 `4be643aa41b0014d63c1122879084cee8ed3e026e641c057e279cdd4c444e76e`; after `cc64384d03a147bea314199236d294fc9e364da438eef3a70bfbf5fa7cd9967b`.

- `packages/core/src/shapes/connector/route.ts`: Add optional left-aligned label anchor to endpoint contract. Before SHA-256 `4f8537f59f28816b8bd1849719554861635abb3b1764eb8a710f06b135d841c1`; after `ec75e1e46552f2aa0a021aaddf4ab6f396d333ed4086270d6e94df9d3e370317`.

- `packages/core/src/shapes/connector/resolve.ts`: Resolve equal participant IDs to four-point loop with label beside it. Before SHA-256 `b702f86082240977f904bfc019a4403a63c1b7bf1397eb20c5da95fcc0066d1d`; after `35e5ceec6280b27c8ae1efaeec9b6871a99bdc5f3bdaee50bf723cb095281cac`.

- `packages/core/src/editor/connections.ts`: Allow sequence participants through the self-connect policy. Before SHA-256 `0c5923f5ef542b409a2ff75688ffb0e2a073900268f118d974a221e876df0822`; after `35e48d1240d16368c1e3aea51a5610900545ca393bdf425ccca4623bf168b5d7`.

- `packages/core/src/sequence-layout.test.ts`: Exercise self-message detection, offsets, saved geometry and bottom order. Before SHA-256 `b6cede2ff052753e39ab11c143d00ba72643ffc8930ae2ce5cee806f10d2c7f0`; after `0de829bf8b1bdfa8f210e4fcaf80b740568e4e77909c2042636d4e45131d131c`.

- `packages/core/src/sequence-layout.test.ts`: Import sequence geometry helpers for regression tests. Before SHA-256 `0de829bf8b1bdfa8f210e4fcaf80b740568e4e77909c2042636d4e45131d131c`; after `70c22dd6bf3489b6e4ee121d05a7353bc740bc0d25cc5d9db536f03d5520d578`.

- `packages/core/src/connector-policy.test.ts`: Cover participant self-connect, route and locked and prohibited types. Before SHA-256 `c164876f4bc54e7507df2a64ba4e8e2b71d4697297df0f4e12733b50dbd259e2`; after `da68ccc015f040a1104a54648a26cf221fb15ebc89bae85335430f9e68c4a96f`.

- `packages/core/src/connector-policy.test.ts`: Import direct endpoint reader for sequence route assertion. Before SHA-256 `da68ccc015f040a1104a54648a26cf221fb15ebc89bae85335430f9e68c4a96f`; after `47c09cabf8ef588a2ba5d3938f135bcaa55d9cc75e34f41d6b0e07c91de0006b`.

- `packages/core/src/sequence-self-route.test.ts`: Test loop geometry, label placement, kinds and distinct-participant stubs. Before SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; after `c10901e95a80e2892233041b50fa95a306c6301616f214e88530b8886b6c9a8f`.

- `apps/cli/src/sequence-self-golden.test.ts`: Compare CLI SVG output bytes to both literal baseline fixtures. Before SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; after `c32576b8694d3da32d9881bcca4e97c2d3d372877f729cd494ca8ca1ca0c38b8`.

- `packages/core/src/sequence-layout.test.ts` type fix before `70c22dd6bf3489b6e4ee121d05a7353bc740bc0d25cc5d9db536f03d5520d578` after `105a8d0d3f507b48c2e3c9b3b50bc934fbe21fffc62a8bd0d190e2ef71e289a7`.

- Format `packages/core/src/sequence-layout.ts` before SHA-256 `cc64384d03a147bea314199236d294fc9e364da438eef3a70bfbf5fa7cd9967b`.

- Format `packages/core/src/sequence-layout.test.ts` before SHA-256 `105a8d0d3f507b48c2e3c9b3b50bc934fbe21fffc62a8bd0d190e2ef71e289a7`.

- Format `packages/core/src/sequence-self-route.test.ts` before SHA-256 `c10901e95a80e2892233041b50fa95a306c6301616f214e88530b8886b6c9a8f`.

- Format `packages/core/src/shapes/connector/route.ts` before SHA-256 `ec75e1e46552f2aa0a021aaddf4ab6f396d333ed4086270d6e94df9d3e370317`.

- Format `packages/core/src/shapes/connector/resolve.ts` before SHA-256 `35e5ceec6280b27c8ae1efaeec9b6871a99bdc5f3bdaee50bf723cb095281cac`.

- Format `packages/core/src/editor/connections.ts` before SHA-256 `35e48d1240d16368c1e3aea51a5610900545ca393bdf425ccca4623bf168b5d7`.

- Format `packages/core/src/connector-policy.test.ts` before SHA-256 `47c09cabf8ef588a2ba5d3938f135bcaa55d9cc75e34f41d6b0e07c91de0006b`.

- Format `apps/cli/src/sequence-self-golden.test.ts` before SHA-256 `c32576b8694d3da32d9881bcca4e97c2d3d372877f729cd494ca8ca1ca0c38b8`.

## Final source hashes after formatting
- `packages/core/src/sequence-layout.ts`: `a1b115ab35553c54c83ce3d8df45b51dd08eb61d018e7c65a66d0b716914a019`
- `packages/core/src/sequence-layout.test.ts`: `1efe5127505c2a02a31de2a6e641bf6745b02bed82052a4079edd79b27991e05`
- `packages/core/src/sequence-self-route.test.ts`: `8c758f142fc231ddd6e65dc5a8eab19f7d36d16b6444f30bd4f29eb45bbf545c`
- `packages/core/src/shapes/connector/route.ts`: `ec75e1e46552f2aa0a021aaddf4ab6f396d333ed4086270d6e94df9d3e370317`
- `packages/core/src/shapes/connector/resolve.ts`: `8bdb873f8245f2da142d05fd0ccbf39589933d04ebe707e1ea41c4e54b156265`
- `packages/core/src/editor/connections.ts`: `35e48d1240d16368c1e3aea51a5610900545ca393bdf425ccca4623bf168b5d7`
- `packages/core/src/connector-policy.test.ts`: `81d774b1f7aacbbe184b1538f166cf43d0988fe04487cf5035820ea92d9849a8`
- `apps/cli/src/sequence-self-golden.test.ts`: `b7d672c21574dd65cda3705841b04e2e403d1a4ac9b3f0a5b64200a1f5532d78`

Golden SHA-256: `3f5976f423b3683b3579009ce2cd52e2529ac61f6aaaabfdac39b4b27927a220` (io) and `720e17f50ea940d4a4f4cb91ac9c141341c260f61d188cb21b0b6ca0a62df245` (omitted geometry). Fixture SHA-256: `e715f06ddba71a5e1ff885776b2dd944fcbde654eb51afdbbc5809b8589cb69d`.

## Amendment and status

The authorized assertion now checks the returned element is a `sequence.message` with both endpoints equal to the participant. `packages/core/src/sequence-authoring.test.ts` SHA-256 before: `582a7244197fd932271a486f3988cdebecce0bfc9f6c4c7ff3d7a8a41df826dc`; after: `c70493fdd1ab04a51da2378fda3b8190941b41a512ae1865d9ceb2117a4a59cb`. The diff against `2e2b985a977f44c27abe5df9f23c29b461bd7be1` contains only that assertion. Baseline binary SHA-256 remains `c8f5c9049d8877d9e277e55c97ec4f76012b6adf6f7201a3440368f1aad2afa0`.

All assigned implementation acceptance criteria are complete. Final-source verification: baseline comparisons exit 0 (`cmp-io-amend.log`, `cmp-omitted-amend.log`); aggregate Bun suite exit 0, 79 passed, 0 failed (`tests-amend.log`); typecheck exit 0 (`typecheck-amend.log`); scoped Biome including the amended file exit 0 (`biome-amend.log`). Logs are under `tmp/seq-self-s750/seq-self-01-contract/`. The earlier aggregate failure is retained in `tests.log` and resolved by the amendment. Formal review and workflow finalization remain downstream.
