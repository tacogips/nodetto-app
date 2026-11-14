# ipd-21 HTML prototype progress

- Implementation: standalone deterministic HTML export, CLI format and validation, artboard exclusion for persistent layers, and browser interaction regression.
- Dependency: ipd-19-desktop-presentation accepted by dispatch. The selected plan aligns with design Decisions 8.7 and 8.8.
- Verification: final-source logs are under `tmp/ipd-s772/ipd-21-html-prototype/final4/`. The focused aggregate, scoped typecheck, and Biome check are recorded there.
- Visual evidence: `tmp/ipd-s772/ipd-21-html-prototype/final2/start.png` and `navigation.png` show the generic start and second screens; `final/diagram.png` is the CLI PNG export. All three were inspected. The bezel encloses the artboard, and the navigation screenshot displays the second screen.
- Earlier Biome attempt failed on a multiple-variable declaration; corrected before the final checks. Its log is `tmp/ipd-s772/ipd-21-html-prototype/attempt1/biome-final-attempt.log`.
- `packages/core/src/index.ts` had concurrent formatting of the existing kit exports between the recorded pre-edit snapshot and re-read; all sibling exports remain present and this unit appended only its own export.
- Formal test-integrity, adversarial and integration reviews, staging and commit remain downstream workflow steps.

- Review repair `ipd21-s7-dup-svg-def-ids`: screen and persistent SVG fragments now receive deterministic, distinct ID namespaces, including local URL and href references. The regression reproduced duplicate IDs before the fix (`review-repair/regression-before.log`, 1 failure); the expanded regression and full aggregate pass (`review-repair/tests.log`, 72 pass, 0 fail). Scoped typecheck and Biome pass in `review-repair/typecheck.log` and `review-repair/biome.log`.
- Inspected `tmp/ipd-s772/ipd-21-html-prototype/review-repair/screen2.png`: the second screen's clipped red child and its shadow are visible. The CLI-rendered `review-repair/fixture.png` was also inspected. Independent review remains pending.
