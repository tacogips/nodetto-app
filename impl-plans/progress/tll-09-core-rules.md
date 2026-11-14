# tll-09 core rules progress

Intent: widen lintable page kinds, use lint-only wide measurement for label and note findings, and add focused tests and shared CLI fixture. The accepted design and tll-09 plan agree; tll-07 is accepted in runtime dispatch. No sibling files were edited.

Pre-edit SHA256:
```text
2b1fc9fbb94f57dacec3b6b8d98453e625797a47dbe90d4274bdaf0945c23f2f  packages/core/src/text-layout-lint/rules.ts
f67e8b96185778217a22214b9cd86f6c0c528c9c00014628e0bc562af7b72e1d  packages/core/src/text-layout-lint/rules.test.ts
5a6f620095675d585789b73d0cf91c9974e840b3802d57fb11790cd4c4c8fa68  packages/core/src/text-layout-lint/engine.test.ts
c56eeea30d4511ed81a2350a2f18daf05ba67c9831f5827c304a2d56d2ac63f8  apps/cli/src/__fixtures__/text-layout.ts
```
Post-edit SHA256:
```text
17b9698b65d527bd97bae2071a4c8049395d8d8d700e9cc27f59239d131bbe0e  packages/core/src/text-layout-lint/rules.ts
11cc911a255cc8b35a1d7365a631d7969875f9060844a38b1ab0b04fa6f8ecba  packages/core/src/text-layout-lint/rules.test.ts
94ea403f521d7d64d32184491d67386666af18e39bd811f43262fb7ee9e17570  packages/core/src/text-layout-lint/engine.test.ts
7014a70ded05e565724a395cde572e6db4e1515039eca7d7058b1a83198977af  apps/cli/src/__fixtures__/text-layout.ts
```
Per-edit content and intent snapshots are under tmp/text-layout-lint-s552/tll-09-core-rules/.

Verification (logs in that directory; final source):
- BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/text-layout-lint packages/core/src/wide-text-width.test.ts: exit 0, 17 pass, 0 fail; core-lint-final.log.
- BUN_OPTIONS=--jsx-runtime=classic bun test packages/core: exit 0, 1452 pass, 0 fail; core-all-final.log.
- BUN_OPTIONS=--jsx-runtime=classic bun test packages/io: exit 0, 275 pass, 0 fail; io-all-final.log.
- bunx biome check packages/core/src/text-layout-lint apps/cli/src/__fixtures__/text-layout.ts: exit 0; biome.log. Earlier non-null assertion error fixed; biome-attempt1.log.
- bun run typecheck: exit 0; typecheck-final.log. Shared-input gate requires serial integration rerun.
- bun -e fixture check from plan: exit 0; fixture-check-final.log contains the four required ordered pairs.
- rg -l wide-text-width packages apps -g '*.ts': exit 0; references-final.log contains only rules.ts and wide-text-width.test.ts.
- git diff --stat 45cc69f -- packages/core/src/text-layout-lint/engine.ts packages/core/src/index.ts: exit 0, empty; boundary-final.log.
- git diff --stat 45cc69f -- packages/core/src/svg-export packages/core/src/label-layout.ts packages/core/src/node-label.ts packages/io/src apps/cli/native Cargo.toml Cargo.lock: exit 0, empty; export-boundary.log.
- git diff --check -- packages/core/src/text-layout-lint apps/cli/src/__fixtures__/text-layout.ts: exit 0, empty; diff-check.log.
- BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/text-layout-lint.test.ts apps/cli/src/text-layout-export.test.ts: exit 1, 6 pass, 2 fail; cli-informational-final.log. Expected failures: layout warnings exclude freeform, element, clean and semantic exports; freeform pages are not lintable or selectable. Both belong to downstream tll-10.

Formal review and combined-tree gates remain downstream.
## Session 555

Re-validation against the accepted design and tll-09 plan; no source edits were necessary. Fresh SHA256 before this progress edit:
```text
17b9698b65d527bd97bae2071a4c8049395d8d8d700e9cc27f59239d131bbe0e  packages/core/src/text-layout-lint/rules.ts
11cc911a255cc8b35a1d7365a631d7969875f9060844a38b1ab0b04fa6f8ecba  packages/core/src/text-layout-lint/rules.test.ts
94ea403f521d7d64d32184491d67386666af18e39bd811f43262fb7ee9e17570  packages/core/src/text-layout-lint/engine.test.ts
7014a70ded05e565724a395cde572e6db4e1515039eca7d7058b1a83198977af  apps/cli/src/__fixtures__/text-layout.ts
30a850e79bed1fcbb4bf04b75db53271f2b4f7194364d429cabdb356de40c19e  impl-plans/progress/tll-09-core-rules.md
```
The evidence directory is a directory, not a single file; its individual files are hashed in `tmp/text-layout-lint-s555/tll-09-core-rules/evidence-sha256.txt`. The progress log post-edit hash is recorded separately in `progress-after.sha256` to avoid a self-referential hash.

File-level comparison:
- rules.ts page kinds: matches; imports and removal of unused measurement: matches; label width arguments, remaining logic and messages: matches.
- rules.ts note wrap width and spacing, first drawn wide line, wide height, separate alignment offsets, rotation ordering and messages: matches.
- rules.test.ts existing tests unchanged: matches. Wide node 195/120 and ASCII control: matches; shape 195/124: matches; note 182/104 and 58.8/44: matches; 80px and 60px cases and all alignments: matches; ASCII 200x21.6 guard: matches; renderer agreement: matches.
- engine.test.ts constant assertion and otherwise unchanged: matches.
- CLI fixture builder, generic elements, spacing, ordering and expected array, unchanged existing fixture: matches.

Verification (complete logs under `tmp/text-layout-lint-s555/tll-09-core-rules/`):
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/text-layout-lint packages/core/src/wide-text-width.test.ts`: exit 0, 17 pass, 0 fail, core-lint.log.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core`: exit 0, 1452 pass, 0 fail, core-all.log.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/io`: exit 0, 275 pass, 0 fail, io-all.log.
- `bunx biome check packages/core/src/text-layout-lint apps/cli/src/__fixtures__/text-layout.ts`: exit 0, biome.log.
- `bun run typecheck`: exit 0, typecheck.log.
- Plan `bun -e` fixture command: exit 0, fixture-check.log, exact four expected pairs.
- `grep -rln wide-text-width packages apps --include=*.ts` (zsh `noglob`): exit 0, references.log, only the two required paths. Initial unquoted zsh invocation failed glob expansion; retry succeeded.
- Both specified `git diff --stat 45cc69f` boundary checks: exit 0, empty, boundary.log and export-boundary.log.
- `git diff --numstat 45cc69f -- packages/core/src/text-layout.ts`: exit 0, 1 1, numstat.log.
- `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/text-layout-lint.test.ts apps/cli/src/text-layout-export.test.ts apps/cli/src/breadboard-commands.test.ts`: informational exit 1, 14 pass, exactly the three expected tll-10 failures, cli-informational.log.

Formal review and downstream tll-10 and tll-11 remain pending.
STATUS: done
