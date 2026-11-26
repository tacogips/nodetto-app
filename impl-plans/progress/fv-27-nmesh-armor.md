# fv-27-nmesh-armor progress

Status: implementation complete; independent review pending. The accepted fv-26 dependency is present. The plan and design section 6.3 agree on the required statement.

Before edit: this progress file did not exist. After edit: see `tmp/fv-s942/fv-27-nmesh-armor/progress-after.hash`. No Lean source was edited. Current model blob: `8823035b661d495d19de46e69a3a4706590df5fa`; module root blob: `02d282a8f5dc6b65492ca5da778efa318df1a426`.

`cd formal && mise exec -- lake build Nodetto.Nmesh` passed (build.log, exit 0). `formal/scripts/audit --module Nmesh --theorem fromInline_toInline` failed (audit.log, exit 1): the theorem is absent.

Remaining: prove the alphabet inverse for indices below 64, establish the three-byte block and one- and two-byte tail decoder identities, induct over blocks including padding and length checks, add the exact design theorem and root import, then rerun both gates. No counterexample has been established.

## Continuation 1

Added `Armor.lean` with kernel-checked general alphabet length, no-duplicate and inverse lemmas, block arithmetic, and encoded-length induction. Blob chain: absent → `4dc5c58efde3f684d6752bbcab434468125eb40e` → `5d08b0a935d9ef210fb139aea613608167c7aa90` → `ffd2bf06a0c588498f405e2d791130518b934d11`. Added the root import preserving preceding imports: `02d282a8f5dc6b65492ca5da778efa318df1a426` → `3c3287a3c74ed80d91a9e8d344de2de95571efe7`. Intent records are in `tmp/fv-s942/fv-27-nmesh-armor/cont1-intent-*.txt`.

The module build passed (`cont1-build.log`, exit 0); the theorem audit failed (`cont1-audit.log`, exit 1) because `fromInline_toInline` remains absent. Decoder fold composition, padding/tail lemmas, and the stated theorem remain to be implemented. No counterexample was found. Progress log before this edit: `a85ec6b03baf6de3e753de862f27d055e3041c98`; after: `tmp/fv-s942/fv-27-nmesh-armor/cont1-progress-after.hash`.

## Continuation 2

Proved `alphabet_not_padding` for every valid sextet using alphabet membership. `Armor.lean` hashes: `ffd2bf06a0c588498f405e2d791130518b934d11` → `e98568110daf47d70f50ddd2ea3bde1cf0a31b19` → `79f2fb5b6c2289a9508c1a5c7f4cca1ba262f0cd` → `f9f799a76914c7e65bf0091afcd56d198d4afe2e`. The first two continuation builds failed during proof development; `cont2-build-final.log` passed. `cont2-audit.log` failed because the required theorem remains absent. Decoder fold composition, padding and tail proofs and the theorem are incomplete; no counterexample has been established. Progress before this edit: `ce65346d99fce3263481965459cd519ae8c50297`; after: `tmp/fv-s942/fv-27-nmesh-armor/cont2-progress-after.hash`.

## Current handoff

The accepted dependency and design statement were rechecked. Current `Armor.lean` blob is `f9f799a76914c7e65bf0091afcd56d198d4afe2e`. The module build passed (`current-build-2.log`, exit 0). The required audit failed (`current-audit.log`, exit 1) because `fromInline_toInline` is absent. The decoder fold composition, padding and tail lemmas, and the exact theorem remain incomplete. No counterexample has been established. Two prior productive continuations have already been recorded; this is a terminal incomplete handoff. The progress file before this edit was `2a12736eccc946fe6a7ae32a18fdc60857113c07`; its after hash is recorded in `current-progress-after.hash`.

## Mechanical continuation attempt 1

Added kernel-checked encoder nonempty, body divisibility and success lemmas, plus general arithmetic identities for one- and two-byte tails. `Armor.lean` blob sequence: `f9f799a76914c7e65bf0091afcd56d198d4afe2e` → `e164494d2a4461645e1d98a05169b23107f5331b` → `9966d9c1d4ca1fa1f842f517c73d7138ad2eccdb`; edit intentions are in `continuation3-intent-1.txt` and `continuation3-intent-2.txt` in the plan evidence directory. The current module build passed (`continuation3-build-2.log`, exit 0); the theorem audit failed (`continuation3-audit.log`, exit 1) because the theorem remains absent. Still needed: decoder fold identities, padding-removal composition, and the exact theorem. No counterexample is established. Progress before this edit: `c56272c4f38b6bbee6cde8832a76713e8ecb2e07`; after hash is in `continuation3-progress-after.hash`.

## Mechanical continuation attempt 2

Proved general `armor_single`, `armor_pair`, and `armor_triple` identities for valid bytes, including padding and actual decoder execution for each isolated block. `Armor.lean` blob chain: `9966d9c1d4ca1fa1f842f517c73d7138ad2eccdb` → `f52adbec12e3cf8205051fc1419001024bf66bb1` → `9d6166989a9a282f4fcd37c8a70d5a2b77112c84` → `25abfa7c1d185454c757011975d19c7457d28ccd` → `32d621817f722621cc173515403211bee5e888bc` → `1c781e6011619df8036e892b1d3add3bdabcca72`. Edit intentions and all build logs are in the plan evidence directory. The current build passed (`continuation4-build-5.log`, exit 0), but the audit failed (`continuation4-audit.log`, exit 1) because the required general theorem remains absent. General decoder fold and padding composition and induction are still needed. No counterexample was established. Progress before this edit: `01e43dbf56f78678658e5a802d96dd57a675a71d`; after hash is in `continuation4-progress-after.hash`.

## Current terminal handoff

The accepted fv-26 dependency and design signature remain aligned. Current Armor blob `1c781e6011619df8036e892b1d3add3bdabcca72`; root blob `3c3287a3c74ed80d91a9e8d344de2de95571efe7`. `handoff-build.log` passed (exit 0); `handoff-audit.log` failed (exit 1) because `fromInline_toInline` is absent. General decoder fold and padding composition, induction and the exact theorem remain incomplete. No counterexample is established. Two mechanical continuation attempts were already recorded; this is a terminal incomplete handoff. The progress before hash is in `handoff-progress-before.hash` and after hash in `handoff-progress-after.hash`.

## Riela continuation 1 (comm-000587)

Added `armor_fold_block`, proving that decoding a full three-byte block from zero pending bits appends the bytes to arbitrary prior output and returns to zero pending bits. Armor blob chain: `1c781e6011619df8036e892b1d3add3bdabcca72` → `adb8ac25009f41e0f273d6d6e177441f2cc9f8cd` → `17c1fc69a2de719280363a6b58931e94ee3b063e` → `1baac044537dd409cd97da0a265693cd1d994b32` → `3f9febf0527c5a7654bffbc74e1ec1803bca3dc0` → `1398157898738613343c98c987c1496a10ef58ef`. Intent and intermediate build logs are in the plan evidence directory. `cont5-build-5.log` passed (exit 0); `cont5-audit.log` failed (exit 1), since `fromInline_toInline` is still absent. Padding composition, prefix-output fold equivariance, induction and the exact theorem remain. No counterexample was established. Progress before and after hashes are in `cont5-progress-before.hash` and `cont5-progress-after.hash`.

## Riela continuation 2 (comm-000593)

Added kernel-checked `armor_body_min_length`, `armor_padding_suffix`, and `armor_take_padding`, establishing the nonempty encoded-body length and padding preservation/removal under a prepended block. Armor before `1398157898738613343c98c987c1496a10ef58ef`, after `18d8c60bf3b08888da00338dfe97b3ae007ca1cc`; per-edit intentions, before hashes, and intermediate build logs are under the plan evidence directory. `cont6-build-6.log` passed (exit 0); `cont6-audit.log` failed (exit 1) because the required theorem is absent. Fold output-prefix equivariance, composition, induction and the exact theorem remain incomplete. No counterexample was established. This is the second Riela continuation and a terminal incomplete handoff. Progress before and after hashes are recorded in `cont6-progress-before.hash` and `cont6-progress-after.hash`.

## Redispatch verification

The accepted fv-26 dependency and section 6.3 statement were rechecked. No proof source was changed in this redispatch. `redispatch-build.log` passed (exit 0); `redispatch-audit.log` failed (exit 1), reporting that `fromInline_toInline` is missing. Fold output-prefix equivariance, composition, induction, and the exact theorem remain incomplete; no counterexample is established. The prior high finding concerning ZOrder statement-check namespace resolution is in `formal/scripts/audit.ts`, outside this plan's writePaths; it remains for its owning plan. Progress before and after hashes are recorded in `redispatch-progress-before.hash` and `redispatch-progress-after.hash`.

## Redispatch 2 verification

The accepted fv-26 dependency and design section 6.3 remain aligned. No proof source was changed. Armor hash `18d8c60bf3b08888da00338dfe97b3ae007ca1cc`; root hash `3c3287a3c74ed80d91a9e8d344de2de95571efe7`. `redispatch2-build.log` passed (exit 0); `redispatch2-audit.log` failed (exit 1) because `fromInline_toInline` is absent. Fold output-prefix equivariance, padding composition, induction and the exact theorem remain incomplete. No counterexample is established. The prior ZOrder audit finding is outside this plan's writePaths; the shared audit script currently contains `checkOpens`, but its resolution remains for integration review. Progress before hash is recorded in `redispatch2-progress-before.hash`; after hash is recorded in `redispatch2-progress-after.hash`.

## Redispatch 3 verification

The accepted fv-26 dependency and section 6.3 signature remain aligned. No proof source was changed. Armor blob `18d8c60bf3b08888da00338dfe97b3ae007ca1cc`. `redispatch3-build.log` passed (exit 0); `redispatch3-audit.log` failed (exit 1) because `fromInline_toInline` is absent. Decoder fold composition, padding composition, induction and the exact theorem remain incomplete; no counterexample is established. Progress before and after hashes are in `redispatch3-progress-before.hash` and `redispatch3-progress-after.hash`.

## Continuation 7

Added `armor_fold_single` and `armor_fold_pair`, proving that decoding each padded tail's data sextets appends the original bytes to any prior output and leaves zero pending bits. Armor blob chain: `18d8c60bf3b08888da00338dfe97b3ae007ca1cc` → `d525ea1fae34914fef6746e9c38fc9a0c01adec7` → `9844dbf5d4d995f39cca03050b3562bc8a775464`. Per-edit intent and hashes are in the plan evidence directory. Initial build failed on definitional `pure` equalities; `cont7-build-2.log` passed after closing them. `cont7-audit.log` failed because `fromInline_toInline` remains absent. General fold and padding composition, induction and the exact theorem remain incomplete; no counterexample is established. Progress before and after hashes are recorded in `cont7-progress-before.hash` and `cont7-progress-after.hash`.

## Continuation 8

Added `armor_fold_block_append` for composing a full encoded block with arbitrary remaining characters, and `armor_fold_complete` by induction for byte lists whose lengths are divisible by three, with arbitrary prior output. Armor blob chain: `9844dbf5d4d995f39cca03050b3562bc8a775464` → `2204c794b7d669324ff8e4094d90bb3c07273797` → `465917f7698d1dfe830ac4aacea49ee0e13f0156` → `df023a46b4be22cfc45ab9ec470de9321d730547` → `175c8272434974f958e86192658807b8092d77d4`. Intent and before/after hashes are in the plan evidence directory. Intermediate builds 1 and 3 failed on elaboration and a definitional equality respectively; `cont8-build-4.log` passed. `cont8-audit.log` failed because `fromInline_toInline` remains absent. Padding composition, general induction including tails and the exact theorem remain incomplete; no counterexample is established. Progress before and after hashes are recorded in `cont8-progress-before.hash` and `cont8-progress-after.hash`.

## Continuation 9

Added `armor_fold_complete_single` and `armor_fold_complete_pair`, composing a decoded multiple-of-three prefix with either tail's sextets. Source before and after hashes and per-edit intentions are in the plan evidence directory. Two intermediate builds failed during proof elaboration; `cont9-build-final2.log` passed (exit 0). `cont9-audit.log` failed (exit 1), because `fromInline_toInline` is still absent. Padding detection and removal, the general induction and the exact theorem remain incomplete; no counterexample was established. The progress file before and after hashes are recorded in `cont9-progress-before.hash` and `cont9-progress-after.hash`.

## Continuation 10

Proved the padded decoder fold by induction over three-byte blocks, using the existing block, tail, and padding lemmas, and added `fromInline_toInline` with the exact design signature. Armor source before `cont10-source-before.hash`, after `9611b59b7b591c5be6b97f16c3865faf729b85b3`; root remains `3c3287a3c74ed80d91a9e8d344de2de95571efe7`. Per-edit intentions and hashes and intermediate elaboration logs are in the plan evidence directory. `cont10-build-12.log` passed (exit 0); `cont10-audit-final.log` passed (exit 0). These are focused gates on the shared working tree. Formal review and integration remain downstream. Progress before and after hashes are in `cont10-progress-before.hash` and `cont10-progress-after.hash`.
