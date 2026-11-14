# ipd-04 CLI edit contracts progress

Implementation complete; formal review and workflow finalization remain downstream. Hooks intentionally reject unavailable features until their owning plans implement them. Dependency ipd-00 was accepted by dispatch.

| Check | Exit | Result |
| --- | --- | --- |
| Focused CLI tests | 0 | 160 pass, 0 fail |
| bun run typecheck | 0 | no errors |
| bunx biome check apps/cli/src/edit | 0 | 36 files checked |
| Operation field discovery | 0 | 5 matching lines |
| Hook exports | 0 | six files, 14 declarations |

Complete logs and pre-edit intentions: `tmp/ipd-s772/ipd-04-cli-edit-contracts/`. Tests ran on the shared moving tree. Earlier failures and fixes are retained there.

## Git object hashes

| Path | Hash |
| --- | --- |
| `impl-plans/active/ipd-04-cli-edit-contracts.md` | `8ed8115f458172fb975138a8db54772fc4162c58` |
| `apps/cli/src/edit/operation-fields.ts` | `c2cf57dd5954a9ce66594282d8ae3d5d5ee46751` |
| `apps/cli/src/edit/batch.ts` | `6955cd98b338c7e7af30b8038e8864ddcfca88ac` |
| `apps/cli/src/edit/operations/add.ts` | `a0433d262daa8f7cfebfa77a69df8916bda7b1cc` |
| `apps/cli/src/edit/operations/elements.ts` | `2b62eb4f176257876b506b7a1a8b644b649ac51a` |
| `apps/cli/src/edit/operations/layout.ts` | `0beb117c6abba90127bbc5ede7627bbed57602d8` |
| `apps/cli/src/edit/parent-fields.ts` | `5e4cd60fa5eaaa4d0e0383e117454a11be5a0995` |
| `apps/cli/src/edit/sizing-fields.ts` | `1da6dad9781f1ea13d78aa5d7c91b059948b8b9d` |
| `apps/cli/src/edit/kit-shapes.ts` | `7084915fac8fc57d8a132fe739c9dbb60545a217` |
| `apps/cli/src/edit/icon-shapes.ts` | `fb137193edd5555ecbe50ddaa3036e1b0534a90c` |
| `apps/cli/src/edit/typography-link.ts` | `ce47016a80f6252155249c04bda70a7dc7bee687` |
| `apps/cli/src/edit/ipd-contracts.test.ts` | `ac8d0e51f5c68b77feb7ed9ac2a56a11fb9ebfee` |
