# tll-04-cli-export progress

Intent: append text-layout findings to existing document warnings only after successful whole-page SVG rendering on architecture pages, preserving export bytes and other formats. Add focused export coverage.

Pre-edit hash: see `tmp/text-layout-lint-s551/tll-04-cli-export/pre-sha256.txt`; test and progress files absent. Post-edit hashes: `tmp/text-layout-lint-s551/tll-04-cli-export/post-sha256.txt`. Per-edit snapshots and intentions are in that directory.

`loaded.warnings` occurrences: before 8, after 3 (two pre-existing other-format uses and the new combined assignment).

- Focused tests: exit 0, 12 pass, 0 fail; `focused-final2.log`.
- Biome: exit 0; `biome-final2.log`.
- TypeScript: `bunx tsc -p tsconfig.json --noEmit` exit 0, `tsc-final2.log`; `bun run typecheck` exit 0, `typecheck.log`.
- CLI suite: exit 0, 146 pass, 18 skip, 0 fail; `cli-all-final2.log`.
- Protected paths diff against a9728e6: exit 0, `protected.log`.
- Shared-input gates remain pending-join for tll-03: that sibling was still editing when these commands ran. Earlier moving-tree CLI failure in `cli-all-final.log` was in its `text-layout-lint.test.ts`; final moving-tree run passed. Repeat both shared-input gates after tll-03 reaches done.
- Superseded TypeScript errors in `tsc.log` and `tsc-final.log` were fixed in this plan's test; final check passed.

Formal review and serial integration remain downstream.

STATUS: done
