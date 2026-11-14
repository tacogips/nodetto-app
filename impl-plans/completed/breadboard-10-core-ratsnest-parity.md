# breadboard-10-core-ratsnest-parity

- planId: breadboard-10-core-ratsnest-parity
- planPath: impl-plans/completed/breadboard-10-core-ratsnest-parity.md
- wave: 4; dependsOn: breadboard-07-core-connectivity-erc
- design: design-docs/specs/design-breadboard.md sections 5.3 (ratsnest),
  6.1 (parity rules 9-13), 3.2 (active netlist card), 7.2 (netlist card
  statuses in the inspector); user-QA Q8, Q9
- progress log: impl-plans/progress/breadboard-10-core-ratsnest-parity.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/core/src/breadboard/(ratsnest|parity)(\.test)?\.ts`

## Completion (session-490)

- Status: COMPLETE. Accepted by test-integrity, adversarial and the
  session-490 serial integration review (comm-009184, all 18 plans on the
  combined tree); archived to `impl-plans/completed/` in Step 8.
- Combined-tree verification: `mise exec -- bun run typecheck` exit 0;
  `mise exec -- bun test --path-ignore-patterns 'tmp/**'` exit 0 (2501 pass,
  18 skip, 0 fail); `CARGO_TERM_QUIET=true mise run lint` exit 0;
  `CARGO_TERM_QUIET=true mise exec -- cargo test --workspace` exit 0.
  Evidence (local, untracked): `tmp/breadboard-mode-s485/reconcile-s490/`.
- Open item owned by `breadboard-00-overview`, which stays in
  `impl-plans/active/`: `CARGO_TERM_QUIET=true mise run verify` exited 1
  because its `bun test` also collects git-ignored scratch copies under
  `tmp/breadboard-mode-s485/breadboard-05-collab/`
  (RECON-S490-W1-VERIFY-TMP-SCRATCH).
- The sections below are the dispatch-time plan.

## Intent

Compare the breadboard with the page's target netlist:
- a deterministic ratsnest (Prim spanning tree per target net) for target
  connections the board does not make yet
- the five schematic-parity ERC rules, appended to `lintBreadboardPage`
- a per-part target status list for the inspector

## Non-goals

- No overlay drawing (plan 12), no inspector UI (plan 13) and no import
  (plans 04, 09).
- Parts are matched by reference only. A type mismatch is not a rule.

## writePaths

- packages/core/src/breadboard/ratsnest.ts (new)
- packages/core/src/breadboard/ratsnest.test.ts (new)
- packages/core/src/breadboard/parity.ts (new)
- packages/core/src/breadboard/parity.test.ts (new)
- impl-plans/progress/breadboard-10-core-ratsnest-parity.md

## sharedPaths

- packages/core/src/breadboard/index.ts
- packages/core/src/breadboard/erc.ts

## sharedPathNotes

- packages/core/src/breadboard/index.ts: append exactly
  `export * from "./ratsnest.ts";` and `export * from "./parity.ts";`.
- packages/core/src/breadboard/erc.ts: plan 07 owns it. Add only the import
  of `breadboardParityFindings` and one statement on the line after the
  marker comment `// parity findings (plan 10)`. The statement pushes the
  parity findings into the local findings array before the existing final
  sort. Change nothing else. Fresh read and pre/post hash.

## Contracts (pinned; plans 12, 13, 14, 16, 18 rely on them)

```ts
export function computeBreadboardRatsnest(document: Document, pageId: PageId, connectivity: BreadboardConnectivity): readonly RatsnestLine[];
export function breadboardParityFindings(document: Document, pageId: PageId, connectivity: BreadboardConnectivity): readonly BreadboardErcFinding[];
export type BreadboardTargetPartStatus = "placed" | "missing" | "value-mismatch";
export function breadboardTargetStatus(document: Document, pageId: PageId): readonly { reference: string; value: string; status: BreadboardTargetPartStatus; elementId?: ElementId }[]; // target part order
export function resolveBreadboardReference(document: Document, pageId: PageId, reference: string): ElementId | undefined; // first visible part in element index order
```

## File-level changes

### ratsnest.ts (design 5.3)

1. Get the target from `breadboardTargetNetlist`. If there is none,
   return `[]`.
2. Resolve each reference with `resolveBreadboardReference`. Ignore
   unresolved references and pin numbers the part lacks.
3. For each target net, in target order, group its resolved pins by
   `connectivity.netOfPin`.
4. With g >= 2 groups, run Prim:
   - start from the group of the net's first resolved node
   - repeatedly add the shortest Euclidean pin-to-pin link from the joined
     set to an unjoined group
   - break ties by the `from` node's order in the target net, then the
     `to` node's order
   - `to` is the pin in the newly joined group
   - each added link is one line
5. Pin page positions come from `breadboardPins`.

### parity.ts (design 6.1)

All five rules run only when a target exists.
- Target-net assignment for each resolved pin:
  - the listed target net
  - otherwise the target net of a bonded twin (`breadboardBondGroups`)
  - otherwise a pseudo net named "unconnected <ref> pin <n>"
- Rule 9 `parity-missing-connection` (warning): one finding per ratsnest
  line, reported on the `to` part and pin. The message names the target
  net and the `from` reference and pin. `elementIds` is the `to` part,
  then the `from` part.
- Rule 10 `parity-extra-connection` (error): for each breadboard net,
  collect the distinct target nets or pseudo nets of the resolved pins on
  it. With two or more, emit one finding:
  - order the target nets by their first pin (component order) on this
    breadboard net
  - report on the first pin of the second one
  - the message lists all merged names
  - `elementIds` holds every part with a resolved pin on the net
  - ignore parts not in the target
- Rule 11 `parity-missing-part` (warning): reported on the active card
  element, one per target part that resolves to nothing. The message names
  the reference and value.
- Rule 12 `parity-extra-part` (warning): a visible part whose reference is
  not in the target. Later holders of a duplicated reference are skipped,
  because rule 7 reports them.
- Rule 13 `parity-value-mismatch` (warning):
  - when both values parse with `parseComponentValue`, compare them with
    `|a-b| <= 1e-9 * max(|a|,|b|)`
  - otherwise compare trimmed, case-insensitive strings
- Severity comes from `BREADBOARD_ERC_SEVERITY`. The messages are
  nodetto's own wording.

### breadboardTargetStatus

For each target part in target order:
- `missing` when it does not resolve
- `value-mismatch` when it resolves and rule 13 would fire
- `placed` otherwise

Include the resolved element id when there is one.

## Pitfalls

- Missing-work rules are warnings. Only rule 10 is an error (user-QA Q8).
  Staged parts still trigger rule 1 errors from plan 07. That is correct,
  so do not suppress it (Q9).
- An inert second card is ignored completely.
- Without the bond-twin rule, the 4-pin button imported from a 2-pin
  symbol would falsely report rule 10.
- Determinism: use target order and component order. Never iterate
  unsorted Maps.
- Do not edit plan 07's tests or rules beyond the single marked
  statement.

## Tests (input -> expected), using plan 07's `test-builder.ts`

`ratsnest.test.ts`:
- no netlist card -> `[]`
- a target net {R1.1, D1.1} with R1 and D1 on separate strips -> 1 line
  from R1.1 to D1.1
- a net of 3 pins on 3 separate strips -> 2 lines, the shortest links
  chosen
- the same pins all in one strip -> 0 lines
- connect one pair with a wire -> that line disappears and the others
  stay
- move a part -> the line endpoints follow the new pin positions
- equidistant ties -> lines ordered by node order, stable across runs

`parity.test.ts`, one positive and one negative test per rule 9-13:
- rule 9: an unrouted target net -> a warning with `elementIds` of both
  parts; routed -> none
- rule 10: a wire joining two target nets -> an error; separate -> none
- rule 10: a 4-pin button (pins 2, 4 not in the target) on its bonded
  strips -> no finding (bond twin)
- rule 11: target `C1` absent -> a warning on the card element; present
  -> none
- rule 12: page part `R9` not in the target -> a warning; all in the
  target -> none
- rule 13: target `4.7k` and page `4k7` -> no finding; target `220` and
  page `330` -> warning; target `1N4148` and page `1n4148` -> no finding
- a duplicate `R1` on the page -> rule 12 does not report the second
  holder
- two cards -> only the first is used
- `lintBreadboardPage` with a target -> includes parity findings, sorted
  with the ERC findings
- `breadboardTargetStatus` -> `placed`, `missing` and `value-mismatch` in
  target order

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-10-core-ratsnest-parity
bun test packages/core/src/breadboard/ratsnest.test.ts packages/core/src/breadboard/parity.test.ts packages/core/src/breadboard/erc.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/core > tmp/breadboard-mode-s485/breadboard-10-core-ratsnest-parity/core.log 2>&1   # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-10-core-ratsnest-parity/typecheck.log 2>&1   # G1
bunx biome check packages/core/src/breadboard/ratsnest.ts packages/core/src/breadboard/ratsnest.test.ts packages/core/src/breadboard/parity.ts packages/core/src/breadboard/parity.test.ts packages/core/src/breadboard/erc.ts   # exit 0
```

## Done criteria

- `for r in parity-missing-connection parity-extra-connection parity-missing-part parity-extra-part parity-value-mismatch; do grep -q "\"$r\"" packages/core/src/breadboard/parity.test.ts || echo missing $r; done` prints nothing.
- `git diff -- packages/core/src/breadboard/erc.ts` shows only the import and the one statement (record the diff in the progress log). If erc.ts is still untracked at this point, record a before/after line diff from your pre-edit copy in the evidence directory instead.
- All verification lines pass, with exit codes and counts in the progress log.
