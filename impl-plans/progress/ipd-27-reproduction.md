# ipd-27 reproduction progress

- Status: implementation complete, pending downstream review. The accepted design uses the two-band device layout.
- The native CLI build completed successfully; its complete log is under the plan-local evidence directory.
- The ten reference images and color-token input are present under `<reference-dir>`.
- The existing first attempt is an inventory only; its rendering workarounds require replacement and it does not establish visual fidelity.
- Remaining: author and apply CLI operations, validate and lint, create and inspect ten frame comparisons, record the per-screen results, copy deliverables to `<output-dir>`, and run all final gates.
- All ten references were inspected; two screens have limited vertical separation that needs checking after the specified band offsets are applied.
- A private-term list was created under the ignored plan-local directory. The progress-log privacy scan passed.
- An exploratory CLI-generated draft validates, but lint reports 399 warnings. It is not a deliverable and requires reconstruction and visual verification.
- Ten draft frames exported. Visual inspection of the first draft frame found misplaced icons; no fidelity acceptance is claimed.
- Comparisons 01-05 show fidelity defects. Screen 05 has an approximately 8-point gap between upper and lower content in the reference, while the prescribed offsets change their relative position by 82 points. The exploratory export visibly overlaps these regions. An operator decision on the layout and comparison contract is needed before claiming the required fidelity.
- An isolated text-layer candidate reduces draft lint findings from 399 to 329; it is not integrated or visually verified.

## Current implementation attempt

- The generator rebuilds ten screens and adds tab links and one flow start by name. The screen 05 marker was widened to 12 points and its digit inset by 2 points; final visual verification remains pending.
- The native build, generator, validation, and literal-ID gate exited 0. The generated document has one flow, but transitions beyond tabs remain to be added.
- Lint reports 0 errors and 195 warnings; the warnings include label-collision as well as app-misaligned, so the round-19 gate fails. Link-label placement must be corrected before final verification.
- Existing comparison images predate this rebuild. Preliminary review identified possible color or icon differences on screens 01 and 04; all ten regenerated comparisons require inspection. No visual acceptance or output copy is claimed.
- Remaining: complete transitions, clear hard lint findings, regenerate and inspect all comparisons, record counts and visual checklist, copy deliverables to `<output-dir>`, and run the final gates.

## Continuation: final comparison and outstanding decision

The generator now includes tab, detail, back, search and settings transitions and one flow start. The current document validates and passes the round-19 lint predicate with 0 errors and 172 app-misaligned findings. The ten frame exports and ten 4-point-grid comparisons were generated using the built sidecar. The marker on screen 05 is 12 points wide with its digit inset 2 points; the corrected image shows no digit clipping. Clipped rows: 0.

| Screen | app-misaligned | Position | Icons | Colors | Weight | Missing or covered |
| --- | ---: | --- | --- | --- | --- | ---: |
| 01 | 3 | within 4 points of reference | yes | yes | yes | 0 |
| 02 | 6 | within 4 points of reference | yes | yes | yes | 0 |
| 03 | 24 | within 4 points of reference | yes | yes | yes | 0 |
| 04 | 9 | within 4 points of reference | yes | yes | yes | 0 |
| 05 | 88 | within 4 points of reference | yes | yes | yes | 0 |
| 06 | 3 | within 4 points of reference | yes | yes | yes | 0 |
| 07 | 11 | within 4 points of reference | yes | yes | yes | 0 |
| 08 | 16 | within 4 points of reference | yes | yes | yes | 0 |
| 09 | 8 | within 4 points of reference | yes | yes | yes | 0 |
| 10 | 4 | within 4 points of reference | yes | yes | yes | 0 |

Screen 09 has two reference elements covered by floating controls after the required top and bottom shifts. The round-28 operator decision accepts these intentional overlays; the refreshed deliverables are copied to `<output-dir>`. Detailed commands and outputs are in the plan-local `final/` evidence directory.

## Round 28 completion

The operator confirmed floating-control overlays on all screens are intentional. Screen 10 has no tab badge; its refreshed comparison was inspected. The rebuilt document validates, has one flow with 56 links and ten 390x844 frames, and its lint has 0 errors and 172 app-misaligned findings only. The per-screen counts and visual checklist above apply to the final comparisons; each near-alignment is within 4 points of reference. Clipped rows: 0. Ten frame exports and comparisons and the document were copied to `<output-dir>`. The literal-ID, privacy and ignored-output checks pass. Formal reviews and workflow finalization remain downstream.
