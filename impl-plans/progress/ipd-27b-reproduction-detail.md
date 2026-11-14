# ipd-27b reproduction detail progress

Prior attempt: the accepted generator supported screens 01-03 only.

The built sidecar completed successfully. Validation, the reproduction lint gate and the literal-ID gate pass on the existing three-screen document. The six-frame gate fails because only three frames exist. Evidence is under `tmp/ipd-s772/ipd-27b-reproduction-detail/`. The plan hash recorded at intake is `75bf987b185defb68c966c8356022f8dc463f66c`.

Continuation: Draft batches for 04-06 were added to the generator, including the clipped frame for 05. The sidecar applied 04; the long-running 05 batch was interrupted before completion. The current document validates but fails the reproduction lint gate. No visual acceptance or per-screen counts are claimed. Complete the rebuild, correct hard lint findings, export and inspect all three comparisons, then run the full gates.

Second continuation: identified the 04 hard lint finding as overlapping adjacent text boxes and narrowed the first box in the generator. The correction has not been rebuilt or verified. A second 05 edit remained CPU-bound for over six minutes and was interrupted; the required complete rebuild and visual checks remain outstanding.

## Performance dependency continuation

- Rebuilt the sidecar and the generator through 06; both exited 0. The resulting six-screen document validates. Scale-2 frames and comparisons for 04-06 were generated and inspected.
- Visual acceptance remains incomplete. Screen 05 has visible calendar grid and overlay differences, and its clipped-row count has not been established. Screens 04 and 06 also require detailed measurement and correction before the checklist can be certified.
- Current lint reports 0 errors, 114 app-misaligned findings and 2 note-overflow findings. The hard lint gate therefore fails; no near-alignment justification is claimed. Evidence is under `tmp/ipd-s772/ipd-27b-reproduction-detail/`.
- Remaining: correct the two hard findings without losing reference fidelity, finish visual corrections and clipped-row accounting, rebuild and rerun all required gates. Output copying, links and flow start remain downstream.

## Continuation after performance rebuild

- Adjusted screen 05 grid lines, selected marker and overlay spacing; adjusted the screen 04 icon. The current six-screen rebuild, validation, literal-ID gate, frame count, typecheck and reproduction lint gate exit 0. Lint reports 0 errors and 125 app-misaligned findings; provisional screen counts are 04: 8, 05: 82, 06: 3. Earlier hard lint findings are resolved.
- 05 clipped rows: 0.
- Scale-2 comparisons were regenerated with the 4-point grid. Screen 05 still has an element obscured by the intended overlay; the visual checklist and bulk near-alignment justification are not certified. Screens 04 and 06 require final visual measurement. Evidence is under `tmp/ipd-s772/ipd-27b-reproduction-detail/`.

## Visual assessment continuation

The 4-point-grid comparisons were inspected with the top and bottom bands treated separately. The counts below refer to `app-misaligned` findings. Screen 05 retains the required floating overlay above its clipped content; one reference-visible element is covered in the device layout, so its visual checklist remains unresolved rather than being marked as missing from the document.

| Screen | Findings | Position | Icons | Colors | Weight | Missing |
| --- | ---: | --- | --- | --- | --- | ---: |
| 04 | 8 | within 4 points of reference | yes | yes | yes | 0 |
| 05 | 82 | unresolved | unresolved | unresolved | unresolved | unresolved |
| 06 | 3 | within 4 points of reference | yes | yes | yes | 0 |

The prior provisional visual notes for 04 and 06 are superseded by this assessment. The screen 05 acceptance decision remains open; no overall completion is claimed.
