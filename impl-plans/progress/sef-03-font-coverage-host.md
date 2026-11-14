# sef-03-font-coverage-host progress

Implementation blocked: the mixed-element base-face gate fails and requires an accepted design and plan amendment or another approved G2 approach. The plan has no DAG dependencies. Checks below ran on the moving shared tree, not a final integration snapshot.

The earlier no-fallback-character check (`A中`) and circled-glyph distinctness checks passed, but they did not establish mixed-element base-face preservation. The review measured 182 changed pixels of 183 inked for `A⑪` with fallback enabled, versus 0 with fallback disabled; `Widget⑪` differed by 1254 pixels and `Idle〜Run` by 539. An independent PNG-byte reproduction confirms mixed `A⑪` differs from base `A` with fallback on and matches with fallback off (`mixed-run-reproduction.log`); a separate-element control matches with fallback on and off (`separate-element-reproduction.log`). usvg 0.48.1 `src/text/layout.rs:1379-1383` replaces the whole run when a fallback face covers it. Native mixed-run rendering was not independently measured. Existing fallback paths on this host are `/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc`, `/System/Library/Fonts/Supplemental/Arial Unicode.ttf`, and `/System/Library/Fonts/Apple Symbols.ttf`.

Added the bounded fallback list without changing `FONT_FILES`, range-read sfnt/TTC coverage for Bun, fontdb/skrifa coverage for native, host and raster fallback switches, and neutral fixture and tests. The lockfile adds only the already locked skrifa dependency to nodetto-cli. `native-engine.ts` contains no `node:` import.

Final checks, with complete logs in `tmp/sef-s733/sef-03-font-coverage-host/`:

- `bun test apps/cli/src/font-coverage.test.ts`: 7 passed, 0 failed (`bun-final-3.log`).
- `CARGO_TARGET_DIR=target/sef-03-gate CARGO_TERM_QUIET=true cargo test -p nodetto-cli render::`: 4 passed, 0 failed (`native-final-2.log`).
- `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/cli/native/Cargo.toml --check`: exit 0 (`fmt-final-2.log`).
- `CARGO_TARGET_DIR=target/sef-03-gate CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`: exit 0 (`release-final-2.log`).
- `bun run typecheck`: exit 0 (`typecheck-final-3.log`).
- `bunx biome check apps/cli/src/render-profile.ts apps/cli/src/raster-backend.ts apps/cli/src/font-coverage.ts apps/cli/src/font-coverage.test.ts apps/cli/src/__fixtures__/test-font.ts apps/cli/src/local-io.ts apps/cli/src/native-engine.ts apps/cli/scripts/build-engine.ts`: exit 0 (`biome-final-3.log`).
- `bun test apps/cli/src/export-command.test.ts apps/cli/src/export-determinism.test.ts`: 9 passed, 0 failed (`export-final-3.log`).

The initial fixture load test exposed a missing PostScript name, and the fixture was corrected and retested. The first raster tests lacked a viewBox and were corrected; the first lint run reported multi-variable declarations, which were split. Earlier attempts remain in the evidence directory.

## Test integrity revision: SEF3-TI-CMAP4

The fixture now permits selecting cmap formats while default output stays byte-identical. The format-4-only test checks its single platform 3, encoding 1 record, finds U+E001, and reports U+E0FF missing. An isolated format-12-only test finds U+F0000. The prior TTC, corrupt-font and macOS gate assertions remain. No production coverage change was required. Pre- and post-edit default fixture hashes for three inputs match (`cmap-default-before.log`, `cmap-default-after.log`), and the test asserts the representative combined input hash.

Current-source checks on the moving shared tree: coverage tests 10 passed (`revision-bun.log`), native render tests 4 passed (`revision-native.log`), export tests 9 passed (`revision-export.log`), and typecheck, focused and full plan Biome checks, cargo fmt check and release build all exited 0 (`revision-typecheck.log`, `revision-biome-focused.log`, `revision-biome-plan.log`, `revision-fmt.log`, `revision-release.log`). Logs contain exit statuses. Independent review and final integration remain pending.

## Blocker: SEF3-ADV-MIXED-RUN-FACE

The owner or design author must amend the accepted design, sef-03 plan and sef-00 trade-offs to accept whole-element fallback-face behavior, or choose another approved G2 approach. The current design requires base-covered characters to retain their face, while the plan explicitly prohibits a text-run splitter and requires stopping when that condition fails. The owner must record the decision before the requested Bun and native characterization tests can be accepted. Production code was unchanged in this revision.

Redispatch check: committed HEAD `ab19166e2e32282b4ad6bfff5ce7d2cd22d1ceed` retains the base-face gate and splitter prohibition; no amendment or approved alternative was found. SEF3-ADV-MIXED-RUN-FACE remains blocked, with no behavior change in this redispatch. The required characterization tests and plan gates await the owner decision.

Redispatch recheck: committed HEAD `ab19166e2e32282b4ad6bfff5ce7d2cd22d1ceed` still contains the original base-face preservation gate and prohibits a text-run splitter. No committed amendment or approved alternative is present in the design, sef-03 plan, or overview. SEF3-ADV-MIXED-RUN-FACE remains blocked; no source or test changes were made. The required characterization and verification await the owner decision.

## Amendment redispatch: SEF3-ADV-MIXED-RUN-FACE

Committed HEAD `5f9d981` amends the design, overview and gate to permit a whole fallback face for a run containing a fallback glyph. Added Bun and native macOS assertions for mixed-run glyph distinction and separate-run byte identity, including cropped separate label lines. Bun exercises an actual Editor export. Native `png` measurement of cropped `A⑪` against `A` with fallback enabled differs; this is permitted. Existing macOS paths remain the three listed above. The previous blocker entries are historical; this implementation is ready for independent review, which must decide the finding.

Current moving-tree gates: Bun coverage 12 passed; native render 5 passed with none ignored; export tests 9 passed. Cargo fmt, isolated release build, typecheck and plan Biome check exited 0. Complete logs are `tmp/sef-s733/sef-03-font-coverage-host/round1-final-{bun,native,fmt,release,typecheck,biome,export}.log`. `Cargo.lock` adds only the existing skrifa dependency; `FONT_FILES` is unchanged; `native-engine.ts` has no `node:` import. Formal review and stable integration verification remain downstream.
