# ipd-19 desktop presentation progress

Status: implementation complete; formal review and workflow finalization remain downstream.

Implemented flow selection and restart, keyboard controls, optional device frame, hotspot hints, overlay swap and back handling, and static persistent destination layers. The round-9 amendment extends `prototypeScreen` to admit back and swap-overlay links only when the target is a frame, preserving the existing filtering and behavior. Browser coverage verifies back via `connectPrototypeBack`, history, swap replacement, invalid swap targets, and existing navigate and overlay links.

Current-source gates: presentation suite 30 pass, 0 fail; core and desktop suite 43 pass, 0 fail; scoped Biome exit 0; workspace typecheck exit 0. Full logs are under `tmp/ipd-s772/ipd-19-desktop-presentation/round9/` and `final/typecheck.log`. The fresh Bun CLI PNG export `round9/storyboard.png` was inspected: four frames, compact back label and navigation links are visible. It depicts the storyboard rather than the desktop presentation; browser interaction coverage verifies the latter, without visual screenshot inspection.

The previous browser failure and its out-of-scope core ownership gap are resolved by the round-9 amendment. Previous native CLI visual export failed because the existing binary predates the schema; current-source Bun CLI export succeeds. The initial amended browser test attempted to create an invalid connector through the validated API and failed; the final test uses a store commit to model an invalid imported target.

Plan hash at this dispatch: `7c9f4dd062afbbcdf33a2f3729091d4edee5f9e5`. Prior plan hash before implementation: `24a1652eabfb05cfccda8b9ff0c6b6e5de495b2e`.
