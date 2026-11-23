# M23f capture-23f-host-cases (session 885)

- Dispatch `capture-s885`, wave 1, dependsOn none (CAP-R6-03). Parallel
  sibling: M23a (disjoint files).
- Design wins: 4.1, 4.2, 6.3, 12, 8.5 (request contract, fixtures,
  approximate pairs, CAP-R4-07, CAP-R5-02), CAP-R6-05 (cropped-frame
  amendment). Test list source: `capture-23-wiring.md` "Tests"
  (`capture-cad.test.ts` / `capture-command.test.ts`,
  `export-handlers.test.ts`).
- Writes (4): this file, `apps/desktop/src/shell/export-handlers.test.ts`,
  `apps/cli/src/capture-cad.test.ts`, `apps/cli/src/capture-command.test.ts`.
  Artifact roots: `target/capture-m23f` (unused), `tmp/capture/m23f`.
  No production file is owned.

## Intent

Pin the host side (CLI printing and exit codes, desktop and CLI scene
bytes) with fake backends, independent of the crate.

## Changes

`capture-cad.test.ts` (imitate its harness at `:40-60` and the test at
`:227`):
- CAP-R6-05, test "reports cropped frame, body states and cad check errors in text and JSON" only: fake state at `:53` `absent` -> `outside`; text at `:137` expects `Puck [outside the picture]`; JSON at `:171` expects `state: "outside"`. Every other assertion of that test stays.
Each case below is added only if not already covered; existing coverage
(for example the approximate case at `:267-283` and the default-fixture
equality at `:209-223`) is extended, not duplicated, and its current
assertions stay.
- One capped and one complete pair -> text `, approximate` and JSON `approximate: true` on the same pair.
- 25 unchecked -> `uncheckedCount` 25 with twenty listed.
- Exit codes with `--fail-on-interference`: pair -> 1; only unchecked -> 1; only capped -> 0; no flag -> 0.
- Emptied, refilled, hidden, outside body notes printed.
- Scene bytes: default request equals `__fixtures__/capture-plate-default.ncs1` (options 3); `--no-interference` equals `capture-plate-no-interference.ncs1` (options 0).
`capture-command.test.ts` (imitate its existing cases): interference
option on a 2D page -> exit 2 with message; add only if absent.
`export-handlers.test.ts` (imitate `:224-318`, keep those cases):
- Plate scene sent to the backend equals the bytes of `apps/cli/src/__fixtures__/capture-plate-default.ncs1` (read with `readFileSync`; no import from `apps/cli`).
- Page whose only body is a `cad.mesh` cube -> scene equals `prepareCadCapture` with `DEFAULT_CAD_INTERFERENCE` and `decodeCaptureMesh`.

## Pitfalls

Do not edit `capture-cad.ts`, `capture-command.ts`, `export-handlers.ts`,
`describe.ts`, the parser, M22 tests or fixture files. If a case fails
because production disagrees with the design: stop, record the scope
amendment. `absent` stays a valid wire value elsewhere.

## Acceptance criteria

- All new cases and every existing case in the three files pass;
  typecheck and biome clean on owned files.

## Verification (exit 0, positive pass count)

1. `sh -c 'bun run typecheck && bunx biome check --diagnostic-level=warn apps/desktop/src/shell apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts && bun test apps/desktop/src/shell/export-handlers.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts'`

## Progress

Pending. Hashes before and after per owned file, logs under
`tmp/capture/m23f/`, drift stops the run.
