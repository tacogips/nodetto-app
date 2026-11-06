# fss-00 overview: file save stability

- Design (binding): `design-docs/specs/design-file-save-stability.md`. Read it before any plan.
- Related specs, already revised: `design-docs/specs/design-web-app-roundtrip.md`, `design-docs/specs/design-document-change-source.md`.
- No open owner questions.
- Evidence root: `tmp/fss-s751/<planId>/` (git-ignored). Each plan's logs go in its own directory.
- This overview is not dispatched and has no write paths.

## User intent

With a document open in the desktop app, a change made outside the app must not cause a save unless the user has unsaved in-app changes. Any save keeps records the app did not change byte-identical. No save turns a relative image reference into an `artifacts/` copy.

## Waves and ownership

| Wave | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| 1 | fss-01-preserving-serializer | `serializeDocumentPreservingText` in `packages/io` | - |
| 1 | fss-02-attachments | Per-`src` attachment decisions and `copied` | - |
| 2 | fss-03-session | Session gate, reconcile, snapshot loop, state, status note, session tests | fss-01, fss-02 |
| 3 | fss-04-docs-final | User docs and the final `mise run verify` | fss-03 |

No file is owned by two plans. `impl-plans/README.md` is edited only at finalization, not by any plan.

No Rust, IR, core or CLI file changes. `mise run test-cli` is not required unless a plan is amended to change CLI code.

## Pinned contracts

```ts
// packages/io, exported from packages/io/src/index.ts (fss-01)
export function serializeDocumentPreservingText(document: Document, baseText: string): string;

// apps/desktop/src/file/attachments.ts (fss-02)
export interface PreparedAttachments {
  readonly document: Document;
  readonly changes: readonly { readonly id: string; readonly before: string; readonly after: string }[];
  readonly resolved: ReadonlyMap<string, string>;
  /** Save As copies only, one entry per distinct source. Empty otherwise. */
  readonly copied: readonly { readonly from: string; readonly to: string }[];
}
// prepareDocumentAttachments keeps its current five parameters.

// apps/desktop/src/file/session-types.ts (fss-03)
readonly copiedAttachments: PreparedAttachments["copied"];
```

## Rules for every worker

- Same branch and working directory as sibling plans. Do not use worktrees, private branches, or `git commit`, `stash`, `checkout` or `reset`.
- Before each edit, read the file fresh. Record its sha256 before and after in the progress log, and save a short intent note under the evidence root. If a file changed unexpectedly between read and edit, stop that edit, re-read, and record the drift.
- Edit only your `writePaths`. If you need another path, stop and report it in your progress log and final output.
- Edit only your own progress log. Do not run broad formatting. Run Biome on owned files only.
- `bun run typecheck` covers the whole repo. If it fails only in a file a sibling plan owns, record the output and retry once that sibling finishes. It must exit 0 on the final tree.
- Do not use emojis. Fixtures and text stay neutral, such as `thumbs/widget-1.png`, `widgets`, `orders`. Never mention issue numbers, organizations, reporters or downstream products.
- Keep lookups safe under `noUncheckedIndexedAccess`, even though the repo's `tsconfig.json` does not set it.
- Do not push, merge or commit.

## Progress log

Each plan writes `impl-plans/progress/<planId>.md` with: files changed and hashes, each verification command with exit status and log path, the red/green results the plan asks for, and any drift or blocker.

## Final gate

`mise run verify` in fss-04, on the combined tree, must exit 0. Log: `tmp/fss-s751/fss-04-docs-final/verify.log`.
