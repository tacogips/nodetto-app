# sms-01-editor-facade progress

Base HEAD: `fabc47cf7ab7e81225dbfa16fe0c8d43e82564d2`.

## Intent snapshot

Move state, constructor and the core API to `EditorCore`; element operations to `ElementEditing`; selection operations to `SelectionEditing`; page operations to `PageEditing`; notation operations to `NotationEditing`; retain component and responsive-variant operations in `Editor`. The exact member-to-class table is in the accepted plan `impl-plans/active/sms-01-editor-facade.md` (SHA-256 `bb67fda9ba3eb10192adc83fc5b6a7b8d3f1a0c5553fc16a521fbe03b60a6a4a`). Preserve the inheritance order and field order, retype planner parameters, then run gates before deduplication. The design SHA-256 is `93a9672878eefb94f3bf78be01755eb56b78a39793db617a4f319143ac803c36`.

## Baseline

- B1 exit 0: 2945 pass, 25 skip, 0 fail; `tmp/source-module-split-s579/sms-01-editor-facade/baseline-bun-test.log`.
- B2 exit 0: `tmp/source-module-split-s579/sms-01-editor-facade/baseline-wc.txt`.
- B3 exit 0: `tmp/source-module-split-s579/sms-01-editor-facade/baseline-strict.log`.
- Pre-edit `packages/core/src/editor.ts` SHA-256: `6f3e0fdd49658da9a2e7bce8f350a1277f841f0d4d4d0d2b0242ebe7e1948016`.

## Implementation

The five-class chain, planner type-only imports, frame helper deduplication, and the documentation paragraph are complete. The moved-code gates passed before deduplication. No drift was detected. The first move aggregate exposed Biome formatting issues; `move-verify.log` records that superseded failure, fixed before `move-verify-retry.log` passed. The initial attempt to launch the move script as a `.txt` file did not execute it; it was then run through Node.

## Hashes

Before planner edits: `paste.ts` fddc9517ddb8fc4e88a63d90c060de0735db5a4d33e0d579b91aadb71708477e; `pages.ts` 5192c5cd580421e09a1a6b5b523b09d54580379ad98623229084ba7c2b6c9dd9; `sequence.ts` 332f7019bd4fb2c7462b22447b11a59955719c4b08bdc8d269e51ed0792817b0; `bpmn.ts` f902043adfbf4f7ddc2573975a9b0359203dffb8e4bccad3f71aa38135bb35a7; `breadboard.ts` 73b62f51e26b96fb6af7a80f25f918383fc822fef2d597d5a34b49c63c9a4b4e; `connections.ts` d2b81485022f35adc71840623c91706f36fd9ff33c96634c1b9cdbb5e66a3dba. The new facade files did not exist before the move. Pre- and post-format hashes for all moved files and planners are in `tmp/source-module-split-s579/sms-01-editor-facade/pre-format-hashes.txt` and `tmp/source-module-split-s579/sms-01-editor-facade/post-format-hashes.txt`. `editor.ts` before deduplication: 0de14111bcf9f40608ceb3b4defafd4bcd11d99659829008fe865c2334488328; after helper insertion: 91e583549d0979db95adbaa3b5ef4c534e5c64e770fd7962b2dcfcbdad255bfb; after formatting: 5a71e9672fbba368c634b7c557b00da3af4362a70ef20fbec55468a6dc221c9c. `docs/development.md` before: 8207633cc2b5f295479d9614724cdfb9a7c5fe7578731af329c5caf2dead43b4; after: b8b2af35ea686f3bc9df54c5b188e141af02bb2ac791a3b336e9ed38f067a429. Final hashes: `tmp/source-module-split-s579/sms-01-editor-facade/final-hashes.txt`.

## Gates

All completed gates below exited 0. Logs are relative to `tmp/source-module-split-s579/sms-01-editor-facade/`.

- Move G1 `move-verify-retry.log`: 2945 pass, 25 skip, 0 fail. G2 `move-test-cli.log`: 172 pass, 0 fail; `move-native-parity.log`: 17 pass, 0 fail, no skip. G3–G9: `move-size.log`, `move-export.log`, `move-strict.log`, `move-imports.log`, `move-unchanged.log`; size and filename checks also exited 0.
- Post-deduplication G1 `dedup-verify.log`: 2945 pass, 25 skip, 0 fail. G2 `dedup-test-cli.log`: 172 pass, 0 fail; `dedup-native-parity.log`: 17 pass, 0 fail, no skip. G3–G9: `dedup-size.log`, `dedup-export.log`, `dedup-strict.log`, `dedup-imports.log`, `dedup-unchanged.log`; size and filename checks also exited 0.
- Final G1 `verify.log`: 2945 pass, 25 skip, 0 fail; `verify-summary.log`. G2 `test-cli.log`: 172 pass, 0 fail; `native-parity.log`: 17 pass, 0 fail and no skip; `cli-summary.log`, `parity-count.log`, `parity-skip.log`. Final `bun run typecheck`: `typecheck.log`. G3–G9: `size.log`, `editor-size.log`, `numbered.log`, `export.log`, `strict.log`, `imports.log`, `unchanged.log`. Exact export and import-scan commands are in `export-command.txt` and `imports-command.txt`.

## Final line counts

```text
     267 packages/core/src/editor.ts
     260 packages/core/src/editor/bpmn.ts
     248 packages/core/src/editor/breadboard.ts
     511 packages/core/src/editor/components.ts
     231 packages/core/src/editor/connections.ts
     136 packages/core/src/editor/pages.ts
     101 packages/core/src/editor/paste.ts
     300 packages/core/src/editor/sequence.ts
     223 packages/core/src/editor/style-text.ts
     241 packages/core/src/editor/transaction.ts
     216 packages/core/src/editor/transform.ts
      68 packages/core/src/editor/types.ts
     531 packages/core/src/editor/facade/core.ts
     226 packages/core/src/editor/facade/element-editing.ts
     285 packages/core/src/editor/facade/notation-editing.ts
     238 packages/core/src/editor/facade/page-editing.ts
     397 packages/core/src/editor/facade/selection-editing.ts
    4479 total
```

Implementation is complete; independent review and workflow finalization remain downstream.

## Redispatch verification

The 13 source hashes in `final-hashes.txt` matched before and after this retry (`retry-final-hashes.log`, exit 0). No source edits were made. Fresh `bun run typecheck` exited 0 (`retry-typecheck.log`); `mise run verify` exited 0 with 2945 pass and 0 fail (`retry-verify.log`); `mise run test-cli` exited 0 with 172 pass and 0 fail (`retry-test-cli.log`). The size, editor-size, numbered-name, export/field order, strict, import and unchanged-file checks all exited 0 (`retry-size.log`, `retry-editor-size.log`, `retry-numbered.log`, `retry-export.log`, `retry-strict.log`, `retry-imports.log`, `retry-unchanged.log`); final line counts are in `retry-wc.log`. Exit codes are recorded in corresponding `.exit` files.

The standalone native parity gate failed twice on the current source: `retry-native-parity.log` and `retry2-native-parity.log` each show 16 pass, 1 fail, with the golden-fixture test timing out at 95 seconds. Both command exits are 1; the required 17-pass grep exits 1 (`retry2-parity-count.log`), while the no-skip check exits 0 (`retry2-parity-skip.log`). The standalone 17-pass requirement remains unresolved despite the successful full CLI gate. Independent test-integrity and adversarial reviews and workflow finalization remain downstream.
