# tsh-01a-ir progress

Mode: issue-resolution; issue: session 780 runtime workflow input (no issue number).
Plan intent git hash-object: 801025b555990bd0e987754ab61e810457a2924a.
Design alignment: sections 2, 3 and 11; no dependencies. Review feedback: none.

Implemented table.sheet registration and validation, canonical JSONL fixture and tests, and the pinned core barrel. The IR public index already exports the semantic primitives and does not export individual registry definitions, so it needed no edit. Sibling plans own the barrel targets and subsequent integration.

## Edit audit
packages/ir/src/semantics.ts
Intent: Map table.sheet to its semantic type
Pre: 32b0efce8fcb4d1de57196bbac1b428c2df7988c
Post: ec33666eb71c0651b45a562ec1e91531f281257a
packages/ir/src/semantics.ts
Intent: Add table.sheet mapping
Pre: ec33666eb71c0651b45a562ec1e91531f281257a
Post: 2e5693198e43329416c7472e7f8057fd6449c366
packages/ir/src/registry.ts
Intent: Import table definition
Pre: 8db8fe4faf89e6fd01fc31c521702eecfe6bfc31
Post: 325b20bdcd97e0bce823d39619bae74aa97e9ed7
packages/ir/src/registry.ts
Intent: Register table definition
Pre: 325b20bdcd97e0bce823d39619bae74aa97e9ed7
Post: 8f01d476434d1c59b6d912de3d7eec6312d83b1a
packages/ir/src/registry.test.ts
Intent: Include table.sheet in expected types
Pre: b93c3fa528ac3f9ba03de787d01426c890b921bf
Post: 80ad75b1412ddd0d2cf28b6a28c8208975cbc56f
packages/io/src/jsonl/golden.test.ts
Intent: Include table-sheet fixture
Pre: f1bafa875302862fd8de4b1ca511504e5ff6eef3
Post: 264e15e8ad10fe03c3ac60faae3f563e7622bbe1
packages/ir/src/registry/table.ts
Intent: Define table sheet validation and canonical key order
Pre: absent
Post: 60411919360cf623300d7ac7f4e56d64dfa48971
packages/ir/src/registry/table.test.ts
Intent: Exercise validation contracts and boundaries
Pre: 0779e9062ba843bb874c546eebef14cefe9e5020
Post: 3fd29f9617bcc01b73bdc6c7edbe51a8d89d0927
packages/io/src/__fixtures__/table-sheet.jsonl
Intent: Add canonical typed table fixture
Pre: absent
Post: 1be4c5be43abf3af6e6b44bec94826454e3bcfd3
packages/io/src/jsonl/table-sheet.test.ts
Intent: Verify canonical table serialization, validity and sorted cell keys
Pre: absent
Post: 2c763023245289564902faaeede2e8716fa2da09
packages/io/src/jsonl/table-sheet.test.ts
Intent: Match canonical cell property order in reverse-key test
Pre: 2c763023245289564902faaeede2e8716fa2da09
Post: 848e7956298ffbeb7ee3700dc8c598f056622c9c
packages/ir/src/registry/table.ts
Intent: Avoid invoking select matcher with malformed options
Pre: 60411919360cf623300d7ac7f4e56d64dfa48971
Post: 5d114fae03ff97d53c52290614df44bda2ba0eff
packages/core/src/table-sheet/index.ts
Intent: Expose pinned wave-one table sheet modules
Pre: absent
Post: f01c51d6d6729199f7804ef49ae104c7b69287b5
packages/core/src/index.ts
Intent: Export table sheet barrel with one line
Pre: 10fb2d93a9a1f0fabc51105f37178fdd5d88a7b5
Post: 8a0e510b99343ada2f544fd36426b259eb08b0eb
packages/ir/src/registry/table.ts
Intent: format owned source with Biome
Pre: 5d114fae03ff97d53c52290614df44bda2ba0eff
Post: df65275c7d2ea71bbc0f8b64b080ded51d55dc1a
packages/ir/src/registry/table.test.ts
Intent: format owned source with Biome
Pre: 3fd29f9617bcc01b73bdc6c7edbe51a8d89d0927
Post: db73d238bf691aaa0ffa12fb5c69654b3d4a5475
packages/io/src/jsonl/table-sheet.test.ts
Intent: format owned source with Biome
Pre: 848e7956298ffbeb7ee3700dc8c598f056622c9c
Post: 8f86d14db02e20f3b9eef2bc8de6205fdbf6f555

## Verification on shared moving tree

- IR: exit 0, 19 tests, 0 failures, final/ir-final.log.
- JSONL: exit 0, 59 tests, 0 failures, final/io-final.log.
- Semantic field audit: exit 0, 3 tests, 0 failures, final/audit-final.log.
- Scoped Biome: exit 0, final/biome-final.log; typecheck: exit 0, final/typecheck-final.log.
- Core index diff has one added barrel line; protected ERD registry and commands diff is empty, final/core-diff.log and final/protected-diff.log.
- Earlier JSONL test failed because the test assumed the wrong canonical cell field order; corrected and rerun. Earlier formatting check failed and was corrected. Earlier logs are retained in final/.
- Formal review and serial integration remain downstream.

## Completion criteria

- [x] TABLE_SHEET registered and fixture in GOLDEN; all three behavioral checks pass.
- [x] Core index adds one line; barrel has ten pinned lines.
- [x] Protected files show no diff.
- [x] Intent and edit hashes and verification results recorded; progress file's own pre/post hashes are in edits.log.
