# ipd-20 app-design lint progress

Status: implementation complete; formal integrity, adversarial and integration review remain downstream. Plan hash at start: `2d1f2612172044daea843267a5aecc09f9178702`.

The seven app rules, CLI integration and instance-aware lint are implemented. The round-11 composer amendment changes the input from 314x36 to 314x44 and its container from 390x52 to 390x60. The 36x36 send button remains at x 338 and is vertically centered at y 12; its icon shifts with it. Padding remains 8 vertically and 16 horizontally. No lint threshold or exclusion changed.

Pre/post git object hashes: `content.ts` ee4b3c187de2ffa07f259e31c490a675ecb50028 / 101297267a7f19257971296214d87956a2fd3dfc; `kit-content.test.ts` 7172925c5afe477a2aac2d3ec0896092c41acf0d / a9d9c1f0468b8863640e4bf326c4f5261f90a652. Per-edit snapshots and intentions are under `tmp/ipd-s772/ipd-20-app-lint/final/`.

Final aggregate: 65 passed, 0 failed (`final/tests-final.log`). Scoped typecheck and Biome exit 0 (`final/typecheck.log`, `final/typecheck-gate-final.log`, `final/biome-final.log`). Seven rule IDs are present (`final/count-final-r11.log`). The default kit clean-instances test passes, including composer. Added grid, alignment, web touch target, linked instance icon, outside-screen and nested-instance coverage. CLI export `final/composer.png` was inspected: input and send button are centered and visible (`final/visual-export-final.log`). Earlier failed attempts are preserved in the evidence directory.
