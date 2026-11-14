# seq-self-07-wiring progress

Implementation complete; formal review and integration remain downstream. The plan aligns with design section 9. README has no contradictory connect summary; commands.ts and core index need no changes. The source tree is shared and uncommitted.

## Edit audit

Document self-call kinds, layout, tools and example after existing sequence paragraph.
Before SHA256: b18c03bd0ebd883c9621ee44a418ed551deebaaf573d2cf8084935aa7412bb33
After SHA256: d479fb07c7549c70f41f6d775c7c234beefeeec6869b5a76d23838752c5f0fa9
Wrap kind assertion to satisfy Biome. Before: ca86b8d3256f6a51d5d178b0b2af4d0075e6f8e60ec74f99ee4846f41d42aa68
After: 514fcd73aca517439a3c6bdfabad97d44400bb0b6aca084309cdd1aa5e5532cf
Add self-call rule and types help note, preserving existing help.
Before SHA256: 2b54174d6b745c5af86a367fec89ce3f945bd067116e7342b43c5c616b7d0831
After SHA256: 1984687cc72e18f62811f40f724fcb0285cd176e9fe198f0d365bfb6f6aab160
Provide required CommandIo and version to runCli. Before: 514fcd73aca517439a3c6bdfabad97d44400bb0b6aca084309cdd1aa5e5532cf
After: 4052174c9882a036767f0cc3f5ce8d10e02f3891e13752de1324336e616af96f
Test Bun and native byte parity for both help pages.
Before SHA256: absent
After SHA256: e522702f55e6a166ea5365bfb3cbb98c327d5d1bf55d63bbb67899fe39a38123

## Verification

All final gates exited 0. Logs are under `tmp/seq-self-s750/seq-self-07-wiring/`.

- `bun test apps/cli/src/sequence-self-help.test.ts apps/cli/src/ai-commands.test.ts`: 16 passed, 0 failed; `bun.log`.
- `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`: `build.log`.
- `sh -c 'NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/sequence-self-help.test.ts'`: 1 passed, 0 failed; `native.log`.
- `bun run typecheck`: `typecheck-final.log`.
- `bunx biome check apps/cli/src/help.ts apps/cli/src/sequence-self-help.test.ts apps/cli/src/native-parity/sequence-self-help.test.ts`: `biome-final.log`.
- `grep -n 'self-call' docs/cli.md`: `doc-rule.log`.
- `grep -nF '"from":"@a","to":"@a"' docs/cli.md`: `doc-example.log`.
- `git diff --quiet HEAD -- apps/cli/src/commands.ts`: `commands-scope.log`.

Earlier typecheck exited 2 due to missing test helper arguments (`typecheck.log`); fixed and rerun. Earlier Biome exited 1 for formatting (`biome-first.log`); fixed and rerun. The initial Bun tests passed (`bun-first.log`) before the type correction. All runs used the shared tree; integration must verify the combined tree.
