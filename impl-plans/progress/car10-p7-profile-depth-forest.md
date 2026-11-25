# car10-p7-profile-depth-forest: done

Implemented bounded pair work and forest fallback; intersection remains unchanged. The nested-chain fail-before was 3.989x and final series is 245059, 525757, 1102502 for each selection. The sparse scene is 400 bytes.

Temporary instrumentation measurements from `tmp/car10-r10/car10-p7-profile-depth-forest/budgets.log`; total work includes pairs and all edge counters. All used the pair path.

| Fixture | Profiles | Pair work | Total work | Budget |
| --- | ---: | ---: | ---: | ---: |
| single row horizontal | 160 | 0 | 0 | 163840 |
| single row horizontal | 320 | 0 | 0 | 327680 |
| single row horizontal | 640 | 0 | 0 | 655360 |
| single row vertical | 160 | 0 | 0 | 163840 |
| single row vertical | 320 | 0 | 0 | 327680 |
| single row vertical | 640 | 0 | 0 | 655360 |
| two row | 129 | 2239 | 2755 | 131200 |
| two row | 257 | 5229 | 6257 | 262272 |
| two row | 513 | 11311 | 13363 | 524416 |
| detailed rim | 257 | 640 | 6019 | 270432 |
| detailed rim | 513 | 2304 | 14083 | 540768 |
| detailed rim | 1025 | 24799 | 50402 | 1081440 |
| slotted original | 257 | 640 | 7300 | 65664 |
| slotted original | 257 | 640 | 8836 | 98432 |
| slotted original | 513 | 2304 | 14596 | 98432 |
| slotted original | 513 | 2304 | 16644 | 131200 |
| slotted mirrored | 257 | 640 | 9604 | 65664 |
| slotted mirrored | 257 | 640 | 11396 | 98432 |
| slotted mirrored | 513 | 2304 | 19204 | 98432 |
| slotted mirrored | 513 | 2304 | 21764 | 131200 |

Focused gate: 81 passed, 0 failed; complete output in `tmp/car10-r10/car10-p7-profile-depth-forest/gate.log`. Formal review and integration checks remain downstream.
