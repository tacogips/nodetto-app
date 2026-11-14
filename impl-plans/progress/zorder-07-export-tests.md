# zorder-07-export-tests progress

Design alignment: H2 section 5; both dispatched dependencies are accepted. Added CLI SVG/PNG/PDF regression, three determinism comparisons, and five canvas/SVG layer parity fixtures. The pre-existing determinism file is an unchanged byte prefix of the current file. No tests are skipped.

Per-edit git hash-object records (absent means no file):
- export-paint-order.test.ts: absent -> 4c419cb865ee0d8bc109a774e94a70b15a04e151 -> fc42747b62eae9c78c3ae3c2a1d6351d89403bc5 -> b4730847d17be7fc3d0a79d060ad441132a812cf -> f259705d98cd2cb2677fc9cf6958b1e42c4da15b. The fill correction uses visual.style; formatting was scoped to this file.
- export-determinism.test.ts: d01357dd41e52f6f77582291105643ea6b6136b5 -> 288ceb1384e22b52204bd0b854ccccf266c5288f -> ef0ad5fdd0412ad9488a1c7f26ef02d469705017 -> 9091f7199d43e92ba7ae2c88a26b1685231c8e74.
- paint-order-parity.test.ts: absent -> 044f99a2fa032408e39f8c68f7bce64e4d89bb5e -> ca591c13eef22b4cec7d2f69d7cb8a5588a17260.
- progress log: absent -> see final hash in plan-local evidence.

Final checks on shared working tree: targeted three-file bun test 6 pass, 0 fail; export-command test 8 pass, 0 fail; typecheck exit 0; scoped Biome exit 0. Complete logs and per-edit intentions are in tmp/zorder-s734/zorder-07-export-tests/. Preliminary typecheck failed on visual.fill; corrected to visual.style.fill before final verification. Formal reviews and serial combined-tree gates remain downstream.
