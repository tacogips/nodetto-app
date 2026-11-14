# clm-09c native parity progress

Workflow: issue-resolution. Assigned plan aligned with continuation 5; no dependencies. Implementation-phase cases are complete; formal reviews and stable-tree verification remain downstream.

## Edits and hashes

Each new file was absent before creation. Per-edit intentions and fresh reads are retained in `tmp/clm-s740/clm-09c-native-parity/`.

- harness: 28b5b107ee3ec6368a439f88a185b0be3d477815 -> 8877f177ceeb8605a17e3e87f1cdac7edfa09feb -> e31e46693d5b0fc86d4ed17371f8069227fed8e5 (add compareFile; format).
- fixture: absent -> b0e29e1591264f15c385bbff2ab6656df61687ee -> 686aeaa652c602aadf38da579c1f668c7f7be7bd (create and format).
- layout: absent -> a1f7f7431c0e60d64b5921d701e86ef5ed3caf58 -> 48ca9563361dc16b55093a405901b81f0c7f84c7 -> aea2b8ba3995e318ccae8714e75402d68d1051ff -> cff3c5745d7bdb55c5a3feafab6166222eeda62c -> 896187b2b029a5082c6971d17ddd7fd1fbbc960b -> 493d6186c5f443cdc13ca719339ee85d7e4a46de.
- merge: absent -> 55e6d2a77faecd940737899ab14ba497fa5d1ae0 -> c38e2c893c5af6c92209c2e6522bcf231e746a56 -> fd9f58974b0a53225488bb5949681a29ca1818d7 -> 3288f3d5aaf3f0e1059fda617c6f67be2887e731 -> 2f4cfd5a19828c5fbdaa3e5c7aed54836b01a907 -> 190b45cc6434c8551cac58b59119370f3da7267b.
- edit usability: absent -> 71853fb47f9f4439a9c492d42c7faa8fdc194be3 -> 730d78ea6d8e374fe1625aa4b5ca157b50e17b9f -> 50d70aa57c34edcda2e33062027bb3c412dffaad -> 13b659994884bff0cfa4b0441c415b9d5a28f135 -> 4673822f3c01d22edb79920476eca319fca926ce -> d61bca0a8e1bee6a911206545c00c2bd3d993f25 -> a60c4c62d54749ff260dc813a8c20e996efb7ad8.
- lint rules: absent -> f13a3656b45efb50bae23cd4fc1d936060ece308 -> c8e8d487ce051ee0dcbef38a69555ce101e0aafc -> 4094e3e28b189db3c16c08136e5e9571558a8200.
- native-engine unchanged.

## Verification and remaining work

The final3 native gate passed 10 tests, zero failures; typecheck and scoped Biome passed. Prior attempts and diagnostics are retained in the evidence directory. The fixture validates without issues. Verification was on a moving shared tree; final stable-tree gates belong to clm-09-wiring.

Continuation 1 added the previously outstanding BPMN label collision, raster SVG locale/timezone comparison, repeated warning and quiet edit assertions, lint-fix idempotence, and resolved manual-route and obstacle-clearance checks. The final manifest native command passed 13 tests and zero failures. Typecheck and scoped Biome passed; logs are in `final4/` and `final/`. The earlier focused run timed out at the default five-second budget after an additional paired invocation; the new test's budget was made explicit without changing existing deadline tests. The intermediate typecheck diagnostic was fixed; complete logs remain in `continuation-focused.log` and `continuation-typecheck.log`. Review and final stable-tree gates remain downstream.

Continuation edit hashes (pre -> post):
- layout: 493d6186c5f443cdc13ca719339ee85d7e4a46de -> 4b7d4d707fe0ea14da94d0e7a11b8c8e8a82fac0 -> dff37259cace21f98c1d0875729567f35aaf5c0c.
- merge: 190b45cc6434c8551cac58b59119370f3da7267b -> 62be341ace87d7c20a65a8d068d17679282dc0d8 -> 439f52bb4b0aaeddc25ad9e7febb4a497bcf8d6f.
- edit: a60c4c62d54749ff260dc813a8c20e996efb7ad8 -> ca8253679e0eec4c1f2f8324de7a73fb6088ca40 -> 3b01b1e83daf718cba406a521404aac9f2d4301d -> e8385bc3858200f8ffcb7860b8c8957ae7a29138 -> 36f4fb14a660a2b8e21276277f7346476bdd0f42 -> f81623586a097a4248d16572b3b0951e1ce4994d.
- lint: 4094e3e28b189db3c16c08136e5e9571558a8200 -> 06be5c5949c52bf5818c98bb53d1421ad6720502 -> b6ddae5c765a06453cc4c4fa2b7e0e35835f213f -> bf24f3148ad8d61588eab9b480b26f810e04ac80.

## Test-integrity revision clm-09c-ti-01

Pre-edit test hash: `f81623586a097a4248d16572b3b0951e1ce4994d`. Intent: add positive and quiet controls for an edit-generated warning and assert the collapsed text-layout export warning; tighten the C2 suggestion assertion.

The prior quiet edit assertion was vacuous. The revised case introduces `semantic.bogus`, asserts the warning in non-quiet stdout, and asserts its absence and the applied summary under `--quiet`; the text-layout export also asserts its collapsed warning. The C2 assertion now checks the exact suggestion. Test hashes: `f81623586a097a4248d16572b3b0951e1ce4994d` -> `42b31f161d55e503c7a6de3177b52a32eff2b86c` -> `26c64e66f2a5e1d02a98255f8e8bfaf38a96ed79` (format).

Revision verification: the rebuilt manifest native gate passed 13 tests and zero failed (`final/native.log`); both count greps, `bun run typecheck` and scoped Biome passed (`ti01-*.log`). Test hash remains `26c64e66f2a5e1d02a98255f8e8bfaf38a96ed79`. No other test file or deadline was changed during this revision. Independent review remains pending.
