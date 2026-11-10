# ipd-07b-icon-data-ascii

- planId: ipd-07b-icon-data-ascii
- planPath: impl-plans/active/ipd-07b-icon-data-ascii.md
- progressPath: impl-plans/progress/ipd-07b-icon-data-ascii.md
- wave: 2. dependsOn: ipd-07-icon-core-cli; accepted dependency ipd-03-icon-data (generator and generated icon data).
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 2 (vendored Lucide icon data, D6) and the Verification contract (no emojis in changed text files). AGENTS.md: no emojis.
- Evidence: `tmp/ipd-s772/ipd-07b-icon-data-ascii/`.
<!-- ownership:start -->
- writePaths:
  - `scripts/vendor-lucide.ts`
  - `packages/core/src/icons/lucide-data.generated.ts`
  - `packages/core/src/icons/LICENSE-lucide.txt`
  - `packages/core/src/icons/icons.test.ts`
  - `impl-plans/progress/ipd-07b-icon-data-ascii.md`
  - `tmp/ipd-s772/ipd-07b-icon-data-ascii`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-07b-icon-data-ascii`
<!-- ownership:end -->

## Intent and context

Added by the Step 4 rerun for review finding IPD-R5 (session 781). The ipd-28
emoji gate now uses ripgrep instead of BSD `grep -P`. Its first real run over
the tracked plus untracked file union found 9 matches of U+1F389 (and the
neighbouring U+1F38A tag) in `packages/core/src/icons/lucide-data.generated.ts`.
Upstream Lucide tags the `party-popper` icon with the emoji characters themselves.

The old gate passed without scanning, so this was never seen. `ipd-03-icon-data`
is accepted, and the ipd-28 gate cannot pass while the generated file contains
raw emoji bytes. This plan gives the fix an owner.

Fix: the generator writes every non-ASCII UTF-16 code unit of the outer
`LUCIDE_DATA` string literal as a `\uXXXX` escape. The runtime string, and so
every name, tag, search result and icon geometry, stays byte-for-byte identical
after the module loads. Only the source bytes change.

## Non-goals

- Do not drop, rename or filter tags or icons. Search behaviour must not change.
- Do not change the Lucide version (1.70.0), the subset rule, the 1,500,000-byte fallback threshold, the attribute allowlist or the fill allowlist.
- Do not download anything when the ipd-03 extracted package is present and its tarball SHA-512 matches the ipd-03 progress log.
- Do not edit `packages/core/src/icons/icon-registry.ts`, `icon-markup.ts`, `THIRD_PARTY_NOTICES.md`, the IR, the CLI or any ipd-28 gate.

## File-level changes

`scripts/vendor-lucide.ts`, in `makeOutput` only:

- After `JSON.stringify(JSON.stringify(data))`, replace each code unit in `[\u0080-\uffff]` with `\u` plus 4 lowercase hex digits. Use a regex without the `u` flag so that astral characters become two surrogate escapes (for example `\ud83c\udf89`). Pinned idiom:
  ```ts
  .replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
  ```
- Apply it before the 1,500,000-byte size check, so the check measures the bytes that are actually written.
- Write the output atomically: write to `packages/core/src/icons/lucide-data.generated.ts.tmp`, then `rename` it over the target. Sibling wave-2 plans (ipd-08, ipd-10, ipd-11) may import the module during their tests.
- Keep the `copyFile` of `LICENSE`. Its output must be byte-identical to the current `LICENSE-lucide.txt`; record the pre and post `shasum -a 256`.

`packages/core/src/icons/lucide-data.generated.ts`: regenerate with `bun scripts/vendor-lucide.ts tmp/ipd-s772/ipd-03-icon-data/src/package`. Do not hand-edit it.

`packages/core/src/icons/icons.test.ts`: add the tests below. Keep the existing tests unchanged.

## Existing code to imitate

- `scripts/vendor-lucide.ts:makeOutput` (the only function to change).
- `packages/core/src/icons/icons.test.ts` (test style and imports: `findIcon`, `searchIcons`, `iconNames`, `LUCIDE_SUBSET`).

## Pitfalls

- The `u` regex flag would match the whole astral character and `charCodeAt(0)` would then emit only the high surrogate. Do not use it.
- Escaping inside the inner JSON (before the outer `JSON.stringify`) would double the backslashes and change the runtime string. Escape the outer literal only.
- A stray `.tmp` file left behind is a build artifact in `packages/`. Rename must remove it; verify with `test ! -e`.
- If `tmp/ipd-s772/ipd-03-icon-data/src/package` is missing, re-extract `tmp/ipd-s772/ipd-03-icon-data/src/lucide-static-1.70.0.tgz` into `tmp/ipd-s772/ipd-07b-icon-data-ascii/src` after checking its SHA-512 against the ipd-03 progress log. Only if the tarball is also missing, download the same pinned URL into that directory. Record the URL, version, SHA-512, command and exit code in the progress log, which is the download audit record. Never write into the ipd-03 evidence directory.

## Tests (`packages/core/src/icons/icons.test.ts`)

- Read the generated file's source text with `readFileSync` -> it has no character with code point above 0x7f (`/[^\x00-\x7f]/.test(text)` is false).
- `findIcon("party-popper")?.tags` -> contains `"\u{1F389}"` (runtime data unchanged).
- `searchIcons("party", 5)` -> contains `party-popper`.

## Verification (evidence in `tmp/ipd-s772/ipd-07b-icon-data-ascii/final/`)

1. Before editing: `bun -e 'import("./packages/core/src/icons/lucide-data.generated.ts").then(m => console.log(Bun.hash(m.LUCIDE_DATA).toString()))'` -> record the runtime-data hash (pre).
2. `bun scripts/vendor-lucide.ts tmp/ipd-s772/ipd-03-icon-data/src/package` -> exit 0. Run it twice; `shasum -a 256 packages/core/src/icons/lucide-data.generated.ts` gives the same hash both times.
3. Rerun the command from step 1 -> the post hash equals the pre hash.
4. `rg -c '[^\x00-\x7f]' packages/core/src/icons/lucide-data.generated.ts` -> exit 1 (no match). `test ! -e packages/core/src/icons/lucide-data.generated.ts.tmp` -> exit 0.
5. `shasum -a 256 packages/core/src/icons/LICENSE-lucide.txt` -> equals the pre-edit hash.
6. `bun test packages/core/src/icons/icons.test.ts packages/core/src/ui-icon.test.ts` -> exit 0, 0 fail.
7. `bunx biome check scripts/vendor-lucide.ts packages/core/src/icons/icons.test.ts` -> exit 0.
8. `bun run typecheck` -> no `error TS` line in the owned files.
9. Record `wc -c packages/core/src/icons/lucide-data.generated.ts` before and after. The growth is expected to be under 1 KB; ipd-23 measures the engine bundle after this plan.

## Done criteria

- Verification steps 1-9 pass with the recorded exit codes.
- `printf 'a\xe2\x9c\x85b\n' | rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]'` -> exit 0 (scanner control), and `rg -n --no-messages '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' scripts/vendor-lucide.ts packages/core/src/icons/lucide-data.generated.ts packages/core/src/icons/icons.test.ts` -> exit 1 with empty stdout and stderr. The test file must use the `\u{1F389}` escape, not the raw character.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.
- Edit only the writePaths above. Edit only your own progress log.
