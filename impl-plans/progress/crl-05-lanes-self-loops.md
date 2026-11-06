# crl-05 lanes and self-loops progress

Implementation complete; independent integrity and adversarial review remain downstream. Plan intent blob: `4e679e50e8e97b16403c01a4940f4a39948c56ea`. Dependencies crl-01, crl-02 and crl-03 are accepted in dispatch.

The route stage assigns ports and top-first self-loop sides, evacuates movable ends, reserves loop coordinates, runs count-bounded lane search and label placement, and supports separation false and reset. It writes no waypoints. A loop on an otherwise unused element moves from right to top (R5). No BPMN golden rebaseline was necessary; obstacle-routing-batch fixtures are unchanged.

Current blobs: `arrange-route.ts` 9c194325aefa9f8ca16471a476ba268772527b1a; `arrange-route.test.ts` 055b4f1e7aa1240caa1f00855be893895eff82d8; `arrange-route-lanes.ts` 4b1319eb2d09532fddfc548a1464307d516d8326; `arrange-route-lanes.test.ts` 61b88e37388d12bfbde36ab49808d049b964e73f; `connector-arrange-route.test.ts` bf7980dc3f0ce2fa9b4025e9748a70c480949819.

Per-edit intentions, fresh snapshots and pre/post hashes are preserved in `tmp/crl-s749/crl-05-lanes-self-loops/`, including previous progress in `cont-progress-before.txt`. In this continuation the loop test changed from 0f7a2977890df716c150851d8c27f4148daafc4a to ef2960a70105ac78bede9b0e668a46c22fde8911, then scoped formatting to a8767e63f209d8f102cd29abd773d25e48e23bd1. Lane tests changed 8f8db81acf46e8bb587b6787b38b2557a202331f to 13bb3a0bda4eb2247c9a5a5520eca71322952691 to 644efe563e69180413aaee28bdd33ecf821c0b66 to 61b88e37388d12bfbde36ab49808d049b964e73f.

Final verification logs under `tmp/crl-s749/crl-05-lanes-self-loops/`: `res-final-targeted.log` 36 pass, `res-final-aggregate.log` 65 pass, `res-final-dependencies.log` 61 pass, `ti-final3-native.log` 4 pass and 0 skip on unchanged implementation source; `res-final-typecheck.log` and `res-final-biome.log` exit 0. Label stage, removal of old stage, and fixture diff checks exit 0 in `cont-final-label.log`, `cont-final-old-stage.log`, and `cont-final-fixtures.log`.

Route-only fixture: crossings 604 to 178, label overlaps 104 to 1, segment overlaps 332 to 5. Each fixture loop has an unshared side, so fixed fallback is not used there. Tests cover detours, fixed manual routes, exact bend offset, saturated search and tie, fixed fallback positions, distinct lanes, and rerun stability.

## Test-integrity revisions

CRL05-TI-TIE: top/bottom centered evacuation chooses right, with left for a leftward neighbor; the vertical branch is unchanged. Source blob 82d1666b4834791bdb35fb61e9d82b02cc42480a to 9c194325aefa9f8ca16471a476ba268772527b1a. CRL05-TI-SEPARATION: three labeled edges compare disabled and default stages. CRL05-TI-FEWEST: distinct movable and fixed cases select right as the strictly least occupied side, and fixed loops assert 0.3 and 0.7. Test blob a8767e63f209d8f102cd29abd773d25e48e23bd1 to cabcd1e2127c82d3e39e1c02c7e4e8d7ecf09553 to 1378d5a2fe274266b9556d153cd5be03ba593826 to the final blob above. The intervening typecheck and formatting fixes and their hashes are in ti-typefix and ti-format2 evidence. Independent re-review is pending.

CRL05-TI-RESERVATION: fixed ends use 0.6 and the movable end is asserted at 0.45, retaining the existing collision assertion. Test blob a5862979259652d1f837145aa13743d1e389e216 to 591c455d82bebbfd13b13eec5e9bb508b589c4e1. Source remains 9c194325aefa9f8ca16471a476ba268772527b1a. Independent re-review remains pending.

## Adversarial revisions

CRL05-LANE-THROUGH-BOX: lane candidates that cross more non-endpoint obstacle boxes than the base route are excluded before overlap comparison. This refines the design: first zero overlap wins among candidates that add no box crossing. The 18-box regression failed before and passes after the fix; candidate evaluations remain bounded at nine. CRL05-ERD-RERUN: existing nonzero lanes are held on rerun; a 36-relation test confirms idempotence and reset re-search. Lane helper blob 32917719455c8ba63e237c3054555762ad3191a3 to 4b1319eb2d09532fddfc548a1464307d516d8326; current test blob is above. Per-edit intentions, snapshots and hashes use the adv prefix in the evidence directory.

Final checks: adv-final3-targeted.log 38 pass; adv-final2-aggregate.log 65 pass; adv-final3-typecheck.log and adv-final3-biome.log exit 0; adv-final2-native.log 4 pass, 0 skip, on unchanged implementation source. Route-only fixture remains crossings 604 to 178, labels 104 to 1, segments 332 to 5. Independent re-review is pending.
