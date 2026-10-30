# tll-07-wide-width progress

Intent: add the lint-only Unicode W/F measurement helper and tests, and export only the existing grapheme segmentation function. No renderer geometry or rule wiring changes.

Pre-edit SHA-256: `packages/core/src/text-layout.ts` = `4f0f735d473c8aa023b96f0dcb178bdbd20c8888e192b7cd0e6043a359fc89f6`; helper, test and this progress file were absent. Per-edit snapshots and intentions are in `tmp/text-layout-lint-s552/tll-07-wide-width/intent-*.txt` and adjacent pre/post files.

Post-edit SHA-256: `packages/core/src/text-layout.ts` = `a71d259aecdbed33ed1dad03f668f914f851b3b8bca111fdb6481f43df3f93e0`; `packages/core/src/wide-text-width.ts` = `3d00a9e7a3f74f2ffa9c47fe6fe56b382984eb47852313790ac2ad8482919887`; `packages/core/src/wide-text-width.test.ts` = `2e60d74e47f5b6a6c431912db1b216f4c4f517e267e70ef2297addfd7e883c72`.

Table source: `https://www.unicode.org/Public/16.0.0/ucd/EastAsianWidth.txt`; downloaded file SHA-256 `43adc76c0686a42cb370764eb8cfe2b2a45b10b855e5572a2db4a0eecce15d5b`. Parsed W/F entries and merged adjacent ranges.

Final checks on the moving shared tree (all exit 0):
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/wide-text-width.test.ts` — 4 pass, 0 fail; `tmp/text-layout-lint-s552/tll-07-wide-width/wide-width.log`.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/text-layout.test.ts packages/core/src/label-layout.test.ts packages/core/src/node-label.test.ts packages/core/src/text-layout-lint` — 25 pass, 0 fail; `tmp/text-layout-lint-s552/tll-07-wide-width/core-layout.log`.
- `bunx biome check packages/core/src/wide-text-width.ts packages/core/src/wide-text-width.test.ts packages/core/src/text-layout.ts` — `tmp/text-layout-lint-s552/tll-07-wide-width/biome.log`.
- `bun run typecheck` — `tmp/text-layout-lint-s552/tll-07-wide-width/typecheck.log`; shared-input gate requires confirmation at serial join after sibling tll-08 completion.
- `git diff --numstat 45cc69f -- packages/core/src/text-layout.ts` — 1 insertion, 1 deletion; `tmp/text-layout-lint-s552/tll-07-wide-width/numstat.log`.
- `git diff --stat 45cc69f -- packages/core/src/svg-export packages/core/src/label-layout.ts packages/core/src/node-label.ts packages/io/src apps/cli/native Cargo.toml Cargo.lock` — empty; `tmp/text-layout-lint-s552/tll-07-wide-width/boundary.log`.

Earlier attempts: helper test exit 1 because the chosen ZWJ sequence segmented into two graphemes; corrected to a narrow-leading single grapheme (`wide-width-attempt1.log`). Biome exit 1 for non-null assertions and then formatting (`biome-attempt1.log`, `biome-attempt2.log`); corrected and rerun. Formal reviews, downstream wiring and final combined export checks remain owned by later workflow steps.

STATUS: done
