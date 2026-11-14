# ipd-07-icon-core-cli progress

Plan hash: da03917c50eb70b8088014de97559eeb53660522. Accepted dependencies ipd-05 and ipd-07a were supplied by dispatch. The registered ui.icon util has 24x24 bounds, square default, box hit testing and resize; registration is in shapes/index.ts.

Implemented named and custom icon SVG export, placeholder and unknown-name warnings, CLI shape lookup, creation and validation/edit warnings. Shared index export was appended. Evidence and per-edit intents: tmp/ipd-s772/ipd-07-icon-core-cli/.

Focused tests: 43 pass, 0 fail; label-field alone: 4 pass, 0 fail. Typecheck and scoped Biome pass; rg found ui.icon in both required files. Logs are under final/. Exported final/icon-sheet.png with the Bun CLI at scale 2; visual inspection shows 24 recognizable, evenly spaced black icons, with no missing or clipped symbols.

Plan ambiguity: icon:not-an-icon yields no searchIcons matches. The prescribed no-match behavior is search guidance, while the proposed test expects Did you mean. Both the guidance and suggestions when matches exist are tested. This requires review reconciliation of the contradictory test wording.

Formal reviews, integration gates and commit are downstream.

## Redispatch 2026-11-10

The plan now separates no-match guidance and near-match suggestions. The CLI test asserts both cases and the requested exit code. The focused aggregate fails 42 pass / 1 fail: edit returns 2, while the repair brief requires 1. `apps/cli/src/commands.ts` defines `EXIT_ERROR = 2` and `EXIT_DRIFT = 1`; changing the edit error contract is not authorized by the repair's allowed paths. A plan amendment or an explicit scoped contract change is needed. Typecheck, scoped Biome, the label-field test (4/0), and the required rg check pass. Complete logs: `tmp/ipd-s772/ipd-07-icon-core-cli/revision-20261110/`. Formal reviews remain pending.

## IPD-R6 implementation 2026-11-10

The accepted round-4 and IPD-R6 amendments supersede the historical ambiguity and blocker above. No-match icon search now exits 0 with guidance; unknown icon descriptions and edits exit 2, using suggestions only when matches exist. Regression assertions cover each outcome. The plan hash at this run is d47c846e985b4ef0367532718d0051e8f627ef3f.

Current-source focused aggregate: 43 pass, 0 fail; icon command suites: 11 pass, 0 fail; label-field: 4 pass, 0 fail. Typecheck, scoped Biome, both required icon literal matches and the no-exit-1 check passed. Complete logs are in tmp/ipd-s772/ipd-07-icon-core-cli/final/*-s781.log. Re-exported the existing CLI-drawn 24-icon sheet at scale 2 and inspected it: all icons are recognizable, evenly spaced and unclipped. Formal reviews and final integration remain downstream.
