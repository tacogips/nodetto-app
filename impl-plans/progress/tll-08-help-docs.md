# tll-08-help-docs progress

Intent: update CLI help and docs for the five lintable page kinds, scoped export warnings and 1 em wide-character measurement, preserving rule descriptions and exit codes. The plan matches the accepted design and has no dependencies. No matching help-string assertions were found in CLI tests.

SHA256 before:
- apps/cli/src/help.ts: cac78f6c0efa417290c382e44a2f4f8506c833ce2f747431930a678f34243e40
- docs/cli.md: 230caedee19dfe79bb28fe53213dd8e1285a97f31b6bba9ede9ecf4e627b7492

SHA256 after:
- apps/cli/src/help.ts: 2a07417ea4e714b43c829297d6fbfc176465630ce995d1244bf2c51e2056f7d9
- docs/cli.md: 892ff283c5f382c81de296f82e5d573f1d572af319b8de34973b2ee189aabdb8

Verification on the moving shared tree (all exits 0):
- `bunx biome check apps/cli/src/help.ts`: tmp/text-layout-lint-s552/tll-08-help-docs/biome.log; one file checked.
- `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/commands.test.ts`: tmp/text-layout-lint-s552/tll-08-help-docs/commands.log; 13 pass, 0 fail.
- `bun apps/cli/src/main.ts help lint`: tmp/text-layout-lint-s552/tll-08-help-docs/help-lint.txt; names page kinds and 1 em.
- `bun apps/cli/src/main.ts help export`: tmp/text-layout-lint-s552/tll-08-help-docs/help-export.txt; names page kinds.
- `grep -n -e freeform -e flowchart -e '1 em' tmp/text-layout-lint-s552/tll-08-help-docs/help-lint.txt tmp/text-layout-lint-s552/tll-08-help-docs/help-export.txt`: tmp/text-layout-lint-s552/tll-08-help-docs/grep-help.log.
- `grep -n freeform docs/cli.md`: tmp/text-layout-lint-s552/tll-08-help-docs/grep-docs.log.
- `bun run typecheck`: tmp/text-layout-lint-s552/tll-08-help-docs/typecheck.log; observed exit 0, pending join for stable shared-input verification because sibling tll-07 has not recorded done.
- `git diff --check -- apps/cli/src/help.ts docs/cli.md`: tmp/text-layout-lint-s552/tll-08-help-docs/diff-check.log.

Done criteria: assigned help and documentation changes are present; rule descriptions, warning format and exit codes are preserved; focused verification passed. Formal reviews and stable shared-tree verification belong to the downstream join.

STATUS: done
