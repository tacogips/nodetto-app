# ipd-27k-kit-grid progress

Status: incomplete; the strict zero-findings gate fails with app-misaligned warnings after integer centering. The prescribed plan forbids changing the lint rules and says not to rewrite label/indicator unless integer assertions fail; those assertions pass. Reconciliation is needed for the odd-width slot alignment conflict. No out-of-scope files were edited.

Plan git hash: a4aee15d90161bc37b2251fa0c07cc14afabee16. SHA-256 before and after (paths relative to packages/core/src/kits/ios):

| File | Before | After |
| --- | --- | --- |
| bars.ts | 3d1d103896bda89e7627fccfb9298522bdcbec155348b249ed37396968f71d5f | 3d1d103896bda89e7627fccfb9298522bdcbec155348b249ed37396968f71d5f |
| content.ts | 2aa405bfc5b70a9a1cacd76b0d908b1413e4809cb88977175652f1f8a1cb2c10 | 2aa405bfc5b70a9a1cacd76b0d908b1413e4809cb88977175652f1f8a1cb2c10 |
| style.ts | ea2709a5b97210ac181e1eca55ba76ea3c1f50df0f6164aa21b2c89f99e0331f | ea2709a5b97210ac181e1eca55ba76ea3c1f50df0f6164aa21b2c89f99e0331f |
| insert.ts | 30887ae98803e98a682a30949743cc079943a424d4dc785ecf046ee6a4b150a3 | 30887ae98803e98a682a30949743cc079943a424d4dc785ecf046ee6a4b150a3 |
| props.ts | b8a72166eecedea832ee922657f257d36c5219fd20a585b5f13f3d903260ec23 | 30712892daa91c54e67c282e61d19e987aaa14026c09fbc6651ab06282b5904f |
| types.ts | a7bd063e80f002d78c4f30bab32a37be8d0d55c3dae7e31d788670c290857bfe | a7bd063e80f002d78c4f30bab32a37be8d0d55c3dae7e31d788670c290857bfe |
| kit-core.test.ts | 18b212254e857e33df8bb694ddb932e22f785f9a9ddbbdf588b8bbbaa73987f9 | 18b212254e857e33df8bb694ddb932e22f785f9a9ddbbdf588b8bbbaa73987f9 |
| kit-content.test.ts | 51774226581ec780fbe932cea19b4ca586d9136ffeb2a893f928b7213a0e025d | 4c1679dd2441d8a91dafbf14786b19a3d4a1ac67e9124611faabd9635ef72b59 |

Commands and evidence (all paths relative to tmp/ipd-s772/ipd-27k-kit-grid):

- `bun test packages/core/src/kits/ios`: before edit exit 1, 15 pass, 1 fail, before.log; attempted correction exit 1, 17 pass, 1 fail, attempt.log.
- `bunx biome format --write packages/core/src/kits/ios/props.ts packages/core/src/kits/ios/kit-content.test.ts`: exit 0, format.log.
- `bun test packages/core/src/kits apps/cli/src/kit-cli.test.ts apps/cli/src/shapes-command.test.ts packages/core/src/app-design-lint apps/cli/src/iphone-kit-example.test.ts`: exit 1, 44 pass, 1 fail, tests.log; the tab-bar zero-findings assertion reports three app-misaligned warnings.
- Owned-file typecheck gate from plan: exit 0, typecheck-gate.log and typecheck.log; no diagnostics.
- `bunx biome check` on the eight plan kit files: exit 0, biome.log, eight files checked.
- `find packages/core/src/app-design-lint examples/design packages/core/src/constraints.ts packages/core/src/editor -type f -exec shasum -a 256 {} + | sort` before and after; `cmp` exit 0, scope.before.sha, scope.after.sha, scope-cmp.log.

Finding for reconciliation: strict zero app-misaligned findings conflicts with unchanged lint behavior and the prescribed restriction on changing label/indicator geometry when those fields already pass integer assertions. This remains unresolved; no claim of acceptance is made. The formal review and downstream reproduction remain pending.


## Round 21 implementation

Status: implementation complete; formal review and downstream reproduction remain pending. Plan git hash: `c192ecb6879f187af81ef7d0d68c3a910b22199a`. Center-line geometry, transaction keepMembers, and resized default insertion are implemented. Existing centered FAB shadow is preserved. No findings for another plan.

| File | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `packages/core/src/kits/ios/bars.ts` | `3d1d103896bda89e7627fccfb9298522bdcbec155348b249ed37396968f71d5f` | `2d5cc736ed34c1838a137e5bc03810dcb2ce4a52e52a2680225dcf5796f2dab3` |
| `packages/core/src/kits/ios/content.ts` | `2aa405bfc5b70a9a1cacd76b0d908b1413e4809cb88977175652f1f8a1cb2c10` | `2aa405bfc5b70a9a1cacd76b0d908b1413e4809cb88977175652f1f8a1cb2c10` |
| `packages/core/src/kits/ios/style.ts` | `ea2709a5b97210ac181e1eca55ba76ea3c1f50df0f6164aa21b2c89f99e0331f` | `ea2709a5b97210ac181e1eca55ba76ea3c1f50df0f6164aa21b2c89f99e0331f` |
| `packages/core/src/kits/ios/insert.ts` | `30887ae98803e98a682a30949743cc079943a424d4dc785ecf046ee6a4b150a3` | `266be0cfc79efc075d80b646e3600571d6e0e76bbbcbc981028ff048acb8335d` |
| `packages/core/src/kits/ios/props.ts` | `30712892daa91c54e67c282e61d19e987aaa14026c09fbc6651ab06282b5904f` | `061ae55956feaa9fc791ccd2752676e0be76e9711919c1a7573657a48bffae7f` |
| `packages/core/src/kits/ios/types.ts` | `a7bd063e80f002d78c4f30bab32a37be8d0d55c3dae7e31d788670c290857bfe` | `a7bd063e80f002d78c4f30bab32a37be8d0d55c3dae7e31d788670c290857bfe` |
| `packages/core/src/kits/ios/kit-core.test.ts` | `18b212254e857e33df8bb694ddb932e22f785f9a9ddbbdf588b8bbbaa73987f9` | `18b212254e857e33df8bb694ddb932e22f785f9a9ddbbdf588b8bbbaa73987f9` |
| `packages/core/src/kits/ios/kit-content.test.ts` | `4c1679dd2441d8a91dafbf14786b19a3d4a1ac67e9124611faabd9635ef72b59` | `65c35f5e92de309d11fac97727a6aef1d0e2a0e0935c0eb5690e34ac13bb96b1` |

Evidence directory: `tmp/ipd-s772/ipd-27k-kit-grid/`.

- `bun test packages/core/src/kits/ios` baseline: exit 1, 17 pass, 1 fail, `baseline.log`; after implementation: exit 0, `attempt-tests-02.log`.
- `bunx biome format --write` on the four edited kit files: exit 0, `format-s810.log`.
- `bun test packages/core/src/kits apps/cli/src/kit-cli.test.ts apps/cli/src/shapes-command.test.ts packages/core/src/app-design-lint apps/cli/src/iphone-kit-example.test.ts`: exit 0, 46 pass, 0 fail, `final-tests.log`.
- Plan owned-file typecheck gate: exit 0, `typecheck-gate-final.log` and `typecheck.log`; no diagnostics.
- `bunx biome check` on the eight kit files: exit 0, `biome-final.log`.
- Scope snapshots: `scope.before.sha`, `scope.after.sha`; `cmp` exit 0, `scope-cmp-final.log`.
- Center-line and keepMembers inspection: `invariants.log`; old slotWidth Math.round grep exit 1, `no-old-round.log`.

The initial incomplete status above records the previous attempt and is superseded by this round.

Final test strengthening: `kit-content.test.ts` final SHA-256 `28b7cfcba390e61b2e86e2221c4fbed39b857c31d2d844ddc1862c1080ed9648`; other final hashes remain as above (`after-final.sha`). `bunx biome format --write packages/core/src/kits/ios/kit-content.test.ts` exit 0, `format-final.log`. Final aggregate exit 0, 46 pass, 0 fail, `final-tests-2.log`; owned typecheck gate exit 0, `typecheck-gate-final-2.log` and `typecheck-final-2.log`; eight-file Biome exit 0, `biome-final-2.log`.

Visual inspection: `bun apps/cli/src/main.ts export examples/design/iphone-kit/design.jsonl --format png --page 'App' --output tmp/ipd-s772/ipd-27k-kit-grid/sample.png --scale 1` exit 0, `export.log`; inspected `sample.png`, with tab icons and labels visibly aligned. This existing committed example is supplementary; geometry of newly inserted bars is verified by the tests.
