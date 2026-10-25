# breadboard-10-core-ratsnest-parity progress

Plan: `impl-plans/active/breadboard-10-core-ratsnest-parity.md`
Issue: Circuit breadboard drawing mode (workflow issue-resolution; no GitHub issue).
Codex-agent reference: Step 6 implementation of `breadboard-10-core-ratsnest-parity`.

## Implemented

- `packages/core/src/breadboard/ratsnest.ts` exports `computeBreadboardRatsnest`. It uses the first visible target card, resolves the first visible matching part by element order, ignores missing references and pins, groups pins by live connectivity, and returns a deterministic Prim tree of shortest links. Unconnected pins each remain their own group. Coordinates come from `breadboardPins`, so the result follows document revisions.
- `packages/core/src/breadboard/parity.ts` exports `breadboardParityFindings`, `breadboardTargetStatus`, and `resolveBreadboardReference`. It implements the five plan-10 parity rules, matching values through `parseComponentValue` with the pinned relative tolerance and falling back to trimmed case-insensitive text. Bonded button pins inherit a target net from their twin. Extra-part findings skip later holders of a duplicate reference.
- `packages/core/src/breadboard/erc.ts` contains only the assigned import and the one parity insertion after `// parity findings (plan 10)`. The exact before/after diff is recorded at `tmp/breadboard-mode-s485/breadboard-10-core-ratsnest-parity/erc-diff.log` against the immutable pre-node snapshot.
- `packages/core/src/breadboard/index.ts` exports `ratsnest.ts` and `parity.ts` once each, preserving sibling exports.
- `packages/core/src/breadboard/ratsnest.test.ts` and `parity.test.ts` cover no-card behavior, routed and unrouted connections, Prim ordering and tie breaks, live pin movement, first-card selection, every parity rule, button bond fallback, value equivalence, duplicate references, status order, and lint integration.

## Verification

All commands ran in the foreground on the current source. Complete logs are under `tmp/breadboard-mode-s485/breadboard-10-core-ratsnest-parity/`.

| Command | Result | Log |
| --- | --- | --- |
| `bun test packages/core/src/breadboard/ratsnest.test.ts packages/core/src/breadboard/parity.test.ts packages/core/src/breadboard/erc.test.ts` | exit 0; 34 pass, 0 fail | `focused-final.log` |
| `bun test packages/core` | exit 0; 1232 pass, 4 skip, 0 fail | `core.log` |
| `bun run typecheck` | exit 0; no TypeScript diagnostics | `typecheck.log` |
| `! grep -E '^packages/core/src/breadboard/(ratsnest|parity)(\.test)?\.ts' tmp/breadboard-mode-s485/breadboard-10-core-ratsnest-parity/typecheck.log` | exit 0; G1 printed nothing | `g1-ownregex.log` |
| `bunx biome check packages/core/src/breadboard/ratsnest.ts packages/core/src/breadboard/ratsnest.test.ts packages/core/src/breadboard/parity.ts packages/core/src/breadboard/parity.test.ts packages/core/src/breadboard/erc.ts` | exit 0; no fixes required | `biome-final.log` |
| `test -z "$(for r in parity-missing-connection parity-extra-connection parity-missing-part parity-extra-part parity-value-mismatch; do grep -q "\"$r\"" packages/core/src/breadboard/parity.test.ts || echo missing $r; done)"` | exit 0; all five rule ids covered | `contract-gates.log` |
| ASCII gates on owned files, progress log and added shared-file lines | exit 0 | `ascii-gates.log` |
| plan-10 barrel export count and erc diff check | exit 0; each export once; erc diff is exactly one import and one insertion | `barrel-marker.log`, `erc-diff-contract.log`, `erc-diff.log` |

An earlier focused fixture run failed 6 assertions (25 pass, 6 fail); its full log is `focused-1.log`. Fixture geometry, target pin tables and ordering expectations were corrected, and the final focused run passes. An intermediate typecheck also exposed missing target pin-table fixture types and use of `toSorted`; those were corrected. Its log was overwritten by the final passing `typecheck.log`, so the intermediate diagnostics are not presented as final-source evidence.

## Completion criteria

- [x] Ratsnest API and deterministic live connectivity behavior implemented and tested.
- [x] Five parity rules, active-card status API, value matching and reference resolution implemented and tested.
- [x] Parity findings enter `lintBreadboardPage` at the single plan-owned marker.
- [x] Focused tests, core suite, typecheck, G1, Biome, contract and ASCII gates pass.
- [x] No `erc.ts` changes outside the planned import and one insertion.

Formal test-integrity/adversarial review and serial integration gates remain owned by downstream workflow steps; this log does not claim those decisions.
