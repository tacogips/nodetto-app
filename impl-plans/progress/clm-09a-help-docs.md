# clm-09a-help-docs progress

Workflow: issue-resolution. Implementation complete; formal review and stable-tree final gates remain downstream.

Each edit was preceded by a fresh read and saved intention in tmp/clm-s740/clm-09a-help-docs/. Pre/post git blob hashes:

```text
apps/cli/src/help.ts | Expand CLI help and preserve per-command behavior | cc38e1f83ec738d64d1c665310d7689111a1f939 | d4d1ae181383453498033a63eada50adbb035f2d
docs/cli.md | Expand CLI guide with tables, limits and both recipes | 8d6e64b6aa7bdb295f8e250e91e91058f28938f3 | 053f26b739ac90f2ef24cd5c282c6b467baa57c5
README.md | Move and expand CLI section above License with both recipes | 8a90acbff6523a58dbc26eed249d321d66f16d73 | f24a61fcd31f09708df6f6a45ad7c1ae1c85f3c6
design-docs/specs/export.md | Document text export determinism in Goals and Rollout | 6028aac1b0c79dc36775e52aba6f57265f9ea54f | 0131e76897b712bc7228b7d4fef4fe5110421f89
apps/cli/src/ai-commands.test.ts | Assert required help facts, overview length and absence of internal identifier | f702e9280018839993967c67b300b066c2ff47d4 | d5dbbbc1699101a7aa7f789a855e8ca80b20fbe1
apps/cli/src/ai-commands.test.ts | Format only the specified test file for Biome | d5dbbbc1699101a7aa7f789a855e8ca80b20fbe1 | f039c28424911817fd981eb9af0f409a489b5a63
apps/cli/src/mcp.test.ts | Format only the specified test file for Biome | c2d425c98f9370cbf8e2f42b337da237a92401e8 | f7fca860b52b2febb8d1d6b3ee31ef61a0315f34
impl-plans/active/clm-09a-help-docs.md | Record implementation status | 46833952d79cf6b152792d33747e2adca5ee1f88 | 5428413f1ea59b972d59cd20c3993a67d0bdaced
```

Manifest checks (moving shared tree):

```json
[
  {
    "command": "bun test apps/cli/src/ai-commands.test.ts apps/cli/src/mcp.test.ts apps/cli/src/mcp-stdio.test.ts",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/gate-01.log"
  },
  {
    "command": "bun run typecheck",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/gate-02.log"
  },
  {
    "command": "bunx biome check apps/cli/src/help.ts apps/cli/src/ai-commands.test.ts apps/cli/src/mcp.test.ts",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/gate-03.log"
  },
  {
    "command": "sh -c 'for f in apps/cli/src/help.ts docs/cli.md README.md; do for t in --frames --ids --reset-manual --metrics --fix --quiet name: where expect select carryMembers bpmn.lane breadboard.board merge=nodetto merge.nodetto.driver; do grep -qF -- \"$t\" \"$f\" || { echo \"$f missing $t\"; exit 1; }; done; done'",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/gate-04.log"
  },
  {
    "command": "sh -c 'for f in apps/cli/src/help.ts docs/cli.md; do for t in node-overlap image-missing tableName \"more like this\" \"time zone\" \"outside its pool\"; do grep -qF -- \"$t\" \"$f\" || { echo \"$f missing $t\"; exit 1; }; done; done'",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/gate-05.log"
  },
  {
    "command": "sh -c 'for f in docs/cli.md README.md; do grep -qF post-merge \"$f\" || { echo \"$f missing post-merge\"; exit 1; }; done'",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/gate-06.log"
  },
  {
    "command": "sh -c '! grep -nE \"Q11|clm-[0-9]\" apps/cli/src/help.ts docs/cli.md README.md'",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/gate-07.log"
  },
  {
    "command": "sh -c 'test \"$(grep -n \"^## License\" README.md | cut -d: -f1)\" -gt \"$(grep -n \"Layout, selection, and merging\" README.md | cut -d: -f1)\"'",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/gate-08.log"
  },
  {
    "command": "grep -n 'time zone' design-docs/specs/export.md",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/gate-09.log"
  },
  {
    "command": "git diff --quiet 235b8c84f3d47734077901aeb9313eed895f6e8f -- apps/cli/src/mcp.ts",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/gate-10.log"
  }
]
```

Focused behavioral suite: 34 passed, 0 failed. The first Biome check exposed formatting in the two authorized test files; the final check passed after exact-file formatting. design-docs/specs/design-cli-ai-drawing.md was not touched: its existing design pointer remains accurate. apps/cli/src/mcp.ts is unchanged. Finding C3: command-specific import, ddl, bpmn, gerber, pcb, breadboard and export report warnings do not collapse as the design requires. Help describes the as-built behavior; the feature gap is handed to clm-09-wiring and integration review.

Final whitespace corrections and their pre/post hashes:

```text
apps/cli/src/help.ts | Remove trailing whitespace in determinism paragraph | d4d1ae181383453498033a63eada50adbb035f2d | 7a8cebf04d941cf27d5bca9d9265912f33dfdd1b
docs/cli.md | Remove extra blank line at end of guide | 053f26b739ac90f2ef24cd5c282c6b467baa57c5 | 2f2b06a30c36125be591859bf2b783a3a7fcc2ec
```
All ten manifest gates were rerun successfully after these corrections.

## Adversarial review repair clm-09a-AR-01

Fresh-read edit intentions and pre/post blob hashes:

```text
apps/cli/src/help.ts | Scope warning-collapse claims to actual paths on seven help pages | 7a8cebf04d941cf27d5bca9d9265912f33dfdd1b | 3552a4006334edd34a07978778bd1b6c6867987c
docs/cli.md | Describe which warning paths collapse and which print individually | 2f2b06a30c36125be591859bf2b783a3a7fcc2ec | 5daf87b6f1ff77875082c35198e9aae754a10fe0
apps/cli/src/ai-commands.test.ts | Assert as-built warning wording without weakening existing assertions | f039c28424911817fd981eb9af0f409a489b5a63 | 5ee3a648ddf6d31aed98403f691fe81d165a418b
```

Revision gates on the moving shared tree: 34 tests passed, 0 failed; all ten manifest commands exited 0. Complete command logs and exits:

```json
[
  {
    "command": "bun test apps/cli/src/ai-commands.test.ts apps/cli/src/mcp.test.ts apps/cli/src/mcp-stdio.test.ts",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/revision-gate-01.log"
  },
  {
    "command": "bun run typecheck",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/revision-gate-02.log"
  },
  {
    "command": "bunx biome check apps/cli/src/help.ts apps/cli/src/ai-commands.test.ts apps/cli/src/mcp.test.ts",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/revision-gate-03.log"
  },
  {
    "command": "sh -c 'for f in apps/cli/src/help.ts docs/cli.md README.md; do for t in --frames --ids --reset-manual --metrics --fix --quiet name: where expect select carryMembers bpmn.lane breadboard.board merge=nodetto merge.nodetto.driver; do grep -qF -- \"$t\" \"$f\" || { echo \"$f missing $t\"; exit 1; }; done; done'",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/revision-gate-04.log"
  },
  {
    "command": "sh -c 'for f in apps/cli/src/help.ts docs/cli.md; do for t in node-overlap image-missing tableName \"more like this\" \"time zone\" \"outside its pool\"; do grep -qF -- \"$t\" \"$f\" || { echo \"$f missing $t\"; exit 1; }; done; done'",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/revision-gate-05.log"
  },
  {
    "command": "sh -c 'for f in docs/cli.md README.md; do grep -qF post-merge \"$f\" || { echo \"$f missing post-merge\"; exit 1; }; done'",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/revision-gate-06.log"
  },
  {
    "command": "sh -c '! grep -nE \"Q11|clm-[0-9]\" apps/cli/src/help.ts docs/cli.md README.md'",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/revision-gate-07.log"
  },
  {
    "command": "sh -c 'test \"$(grep -n \"^## License\" README.md | cut -d: -f1)\" -gt \"$(grep -n \"Layout, selection, and merging\" README.md | cut -d: -f1)\"'",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/revision-gate-08.log"
  },
  {
    "command": "grep -n 'time zone' design-docs/specs/export.md",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/revision-gate-09.log"
  },
  {
    "command": "git diff --quiet 235b8c84f3d47734077901aeb9313eed895f6e8f -- apps/cli/src/mcp.ts",
    "exitStatus": 0,
    "log": "tmp/clm-s740/clm-09a-help-docs/revision-gate-10.log"
  }
]
```
