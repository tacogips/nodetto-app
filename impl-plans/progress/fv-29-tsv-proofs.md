# fv-29-tsv-proofs progress

Dependency fv-13-tsv-model is accepted in dispatch. Plan and design section 6.4 align.

- `formal/Nodetto/Tsv/Theorems.lean`: absent before; initial blob d1db893e613b7f4db18ab84098743d8f9d766d5a; revised blob 58a1a2811e7f357aec6a933e6740233dd6699d62. Three D1 literal theorems use kernel reduction on small literals.
- `formal/Nodetto/Tsv.lean`: before 335c3ad6f00b59314f2749af58c58c9ed516d5de; after 877aed5c4d13185ce1373eb7d4e07b6b1fd5f844; added theorem import.
- Build initial attempt failed (build.log); kernel reduction corrected it, build-2.log passed.
- Audit failed (audit.log): the general `parseTsv_serializeTsv` theorem is not yet implemented. No counterexample has been established. The acceptance criterion remains open. Complete the generalized scanner and serialization proof, then rerun both gates.

## Continuation 1

- Added checked empty-grid and singleton-empty-field round-trip base cases. Theorem file changed from 58a1a2811e7f357aec6a933e6740233dd6699d62 through 622dee1d75ae2e59a0291f7436f35866dc46fec1 and 7f5f9ef58f30ad7f8c86de18898ecaa2167e0d53 to eed0408cd23f02a9b7a4c8051be95e4a5c7c7872.
- Attempted a general scanner base lemma using the model's generated private name. Both attempts failed name resolution (build-continuation1.log and build-continuation1-fix.log); removed that uncompilable lemma. The model is outside this plan's write paths. An accessible proof route or an ownership amendment may be needed, but no impossibility has been established.
- build-continuation1-final.log passes; audit-continuation1.log fails because the required general theorem is still missing. The acceptance criterion remains open. No counterexample has been established.

## Continuation 2

- A local syntax macro constructs the private scanner name with Lean's numeric name component; a second references its first equation. `scan_empty` proves the empty-input result for arbitrary scanner state. No model change was needed.
- Theorem file before eed0408cd23f02a9b7a4c8051be95e4a5c7c7872; intermediate f08634e45a29691855c3db5478ace8b89149975a, 9fd0dbcd44ac92bc117ddb48c434d35d4ace8598, 188c982a5718a81709725d67637e6f10ca6ba8d4; after 37fafac1a7d00189a38fa1c26025813008ffe272. Attempts a, b and c failed; build-continuation2-d.log passes.
- audit-continuation2.log fails: parseTsv_serializeTsv remains absent. The quoted and unquoted field stream lemmas and field/row inductions remain to be proved. No counterexample was found. The acceptance criterion remains open.

## Redispatch verification

- Current theorem and root blobs remain 37fafac1a7d00189a38fa1c26025813008ffe272 and 877aed5c4d13185ce1373eb7d4e07b6b1fd5f844. Progress before this entry: 389c7b97a287a5553baef2e22ec074cbe86f45bd.
- `build-redispatch.log` exits 0; `audit-redispatch.log` exits 1 because `parseTsv_serializeTsv` is absent. Three literal theorems pass the statement and axiom checks. The general proof remains incomplete; no counterexample was established.

## Continuation 3

- Theorems.lean before 37fafac1a7d00189a38fa1c26025813008ffe272; intermediate 0f963232764ffeffc5fd2fa17b06721f690f4b6f, 0a5f260f69867a49fc4096f15f3a9380ea9bfd08, cf4cf586000f75239a4587b18bfb270d5ac885e1; after 136c6966e8902c3224d053e8e446047ad8ac1916. Added checked arbitrary-state tab, newline, and opening-quote transitions, and macros for scanner equations 2 and 3. Earlier attempts a and b failed; d builds successfully.
- `build-cont3-d.log` exits 0; `audit-cont3.log` exits 1 because the general round-trip theorem remains missing. Field stream, row, and grid inductions remain. No counterexample established; acceptance remains open. Progress before this entry was 35c19adfcc6c35455b1fcba402a20e3f1532665e.

## Continuation 4

- Theorems.lean before 136c6966e8902c3224d053e8e446047ad8ac1916, intermediate aaa4bc0d41f1b27ae58f1cd75d939a1326b68473, after d50f47d35762631a7db32d119c2e37a54d04efa4. Added ordinary-character transition and an induction proving scanning an arbitrary ordinary stream preserves its contents with generalized parser state.
- `build-cont4-b.log` exits 0. `audit-cont4.log` exits 1: the general round-trip theorem is absent. Quoted stream and row/grid composition remain. No counterexample established. Progress before this entry: bf059441b4ff6169abd3f185d17fa3321508da42; acceptance remains open.

## Redispatch 2

- Rechecked the accepted plan and design section 6.4. Source blobs remain d50f47d35762631a7db32d119c2e37a54d04efa4 (theorems) and 877aed5c4d13185ce1373eb7d4e07b6b1fd5f844 (root); no proof changes were made. Progress before this entry: 70ef3300948eaff72394c29eccd4e2f959218f75.
- `build-redispatch2.log` exits 0; `audit-redispatch2.log` exits 1 because `parseTsv_serializeTsv` is missing. The three literal statements pass. The general proof remains incomplete and acceptance remains open; no counterexample was established.

## Continuation 5

- Added quoted-character and escaped-quote transitions and a generalized quoted-stream induction in `Theorems.lean`. Source hashes: d50f47d35762631a7db32d119c2e37a54d04efa4 -> de4c2a99431547ec6bed7af40f67ba8bece80647 -> de555df16c32da0e726b4c46df64a084c745bd10 -> 6e594316f28745a68fbccee24324044b9482907c -> ba9fb791b1da55cb5c775c63 -> e235c1258f51c6f91a2928eb1232872d3ae01af3 -> bf96ae993e9c3e253745b5b1bf8cff90f40572bd. Per-edit intentions and snapshots are in `tmp/fv-s942/fv-29-tsv-proofs/`.
- `build-cont5-f.log` exits 0; `audit-cont5.log` exits 1 because the general theorem remains absent. Field, row and grid composition remain; acceptance is open. No counterexample established. Progress before this entry: 83640519611aea8117496c63d5cc86be3a1888ac.

## Continuation 6

- Added `scan_quoted_field`, composing opening quote and the generalized quoted-stream lemma. Source hashes: bf96ae993e9c3e253745b5b1bf8cff90f40572bd -> 55d0a60ab000f4687f3a9f8a947c8b675de4a086 -> 4602b991e15cd4bb5f0a11f97a7d9687506f9b82 -> d4a13f555ec323afe1dd914ac2333f181705102b -> 607f82985603a91cd0d4938043d753742038775b -> 5ceb31ad244c92d0610bac3d9ba8744501b5d2b7 -> 18b249e7f2fb7973af73c05c1314f0ae4564b9f3. Intentions and snapshots are in the plan evidence directory.
- `build-cont6-f.log` exits 0; `audit-cont6.log` exits 1 because `parseTsv_serializeTsv` is absent. General field, row and grid composition remain. No counterexample established; acceptance remains open. Progress before this entry: a527045f61a2505c21040e0d91ce66bb2c3851a8.

## Current verification

- Dependency `fv-13-tsv-model` is accepted by dispatch; plan remains aligned with design section 6.4. The theorem and root hashes are `18b249e7f2fb7973af73c05c1314f0ae4564b9f3` and `877aed5c4d13185ce1373eb7d4e07b6b1fd5f844` respectively. Progress before this entry: `d9003e2a34ceb10b2b51af0746c597b620c6eb0d`.
- `build-current.log` exits 0. `audit-current.log` exits 1: `parseTsv_serializeTsv` is missing; the three literal theorems pass their axiom checks. General field, row and grid composition remains unproved. No counterexample was established; acceptance remains open.

## Encoded-field continuation

- Added `scan_encoded_field` for an arbitrary field with parser `ended = false`, combining the quoted and ordinary stream cases. `Theorems.lean` hashes: `18b249e7f2fb7973af73c05c1314f0ae4564b9f3` -> `e743943eea67b6306e20ba9d84a7d59149ea0c23` -> `b85fb96b0b52ec73c1ebed5ef430f59ec2da85c6` -> `50459d5de09547b1fbf2438dcb97833776af5268` -> `56b9a7524ba6421fd36c50b466aa7395e03431a2` -> `7c53e0f2daa14c08db4bccc3a0c84439e68e089a`. Per-edit intentions and snapshots are in the evidence directory.
- `build-field-e.log` exits 0. `audit-field.log` exits 1 because `parseTsv_serializeTsv` remains absent. Row and grid composition, including the `ended = true` state after a newline, remain unproved; acceptance is open. Progress before this entry: `9c45671aefe1932a970fbec2e508f931a61a6db6`.

## Row composition continuation

- Added checked lemmas `scan_nonempty_ended`, `scan_encoded_field_cont`, `scan_row_fields`, `scan_row_eof`, and `scan_row_newline`. They establish scanner state independence on nonempty input and reconstruct arbitrary nonempty rows at EOF or newline. Source hashes: `7c53e0f2daa14c08db4bccc3a0c84439e68e089a` -> `9355ae83b0e267ea99de0ca0e42b3afc7d3b47ff` -> `933aeb43a3beed30391dfa2fbc00983b6079a9db` -> `9cf8b1a0b08db78eb83c7cdf75d14e6122162b77` -> `c8bd2b0452c2e8aa4cf59f99fb27a411df49f178` -> `cddc0b461be6da01eb8cae0c9f6d8f6583f09024` -> `46e2b63aa7c5cdabe6f2842b57801092d76c8666` -> `6765179c2286362bfdd308a8c6f779cf62b9f6a0`. Snapshots and intentions are in the plan evidence directory.
- `build-continuation2-g.log` exits 0. `audit-continuation2.log` exits 1 because `parseTsv_serializeTsv` is still absent. Grid induction, encoded row nonemptiness, and top-level parser composition remain. Progress before this entry: `5ebeda5eccd19d4300abd595a1cee9304db54cda`; acceptance remains open.

## Redispatch 3

- Added `encode_single_nonempty`, proving singleton field encodings are nonempty. Theorem source hash before: `6765179c2286362bfdd308a8c6f779cf62b9f6a0`; after: `dc082f8417cf85b0f3a645eefab84cc8a2d87fc8`. Progress hash before: `77bbdbecd8dfd4779e357bfedaac9e77a108f162`; intent and snapshot are in the plan evidence directory.
- `build-redispatch3-lemma.log` exits 0; `audit-redispatch3-final.log` exits 1 because `parseTsv_serializeTsv` is absent. General encoded-row nonemptiness, grid induction, and parser composition remain. No counterexample established; acceptance remains open.

## Redispatch 4

- Added `encoded_row_nonempty` for every nonempty row. Theorem source hash: `dc082f8417cf85b0f3a645eefab84cc8a2d87fc8` -> `b86573c5d6501dbe9130b8b2136ad6883356d705`. Intent and prior snapshot are in the plan evidence directory.
- `build-redispatch4-lemma.log` exits 0; `audit-redispatch4-final.log` exits 1 because `parseTsv_serializeTsv` remains absent. Grid induction and parser composition remain; no counterexample was established. Acceptance remains open. The two prior audit-script findings remain outside this plan's write paths and require their owner.

## Grid proof completion

- Added `encodedRow`, `encoded_row_form`, `scan_grid`, and the exact design statement `parseTsv_serializeTsv`; the induction composes arbitrary nonempty rows, including the newline and EOF cases. Theorem blob `b86573c5d6501dbe9130b8b2136ad6883356d705` -> `d3a7907bc17da8dfd359e307547db56f9bf00c78` -> `e765716c425917501ef68d553d3281e15c12d664` -> `85db4f6e6891897d302beb94297b19f73d90d0da` -> `ff1873eb0d2b29f444fc3872dc686362f4567d8f`. Per-edit snapshots and intentions are in the evidence directory. Root blob remains `877aed5c4d13185ce1373eb7d4e07b6b1fd5f844`.
- `build-grid-fix3.log` exits 0; `audit-grid-final.log` exits 0 for all four required statements. Earlier proof elaboration attempts are retained as `build-grid-current.log`, `build-grid-fix.log`, and `build-grid-fix2.log`. Acceptance criterion is satisfied on the moving shared tree; independent review remains downstream. Progress blob before this entry: `be07e7183f020df25b8b80785eb40c63dfe12407`.
