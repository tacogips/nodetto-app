# clm-03-lint-core progress

Implemented node overlap detection, CJK-aware text wrapping, additive text area extraction, and a width overflow fix planner. CLI wiring and exports belong to clm-08 and clm-09. Formal review and final integration remain downstream.

Focused tests and scoped Biome checks pass; workspace typecheck is subject to concurrent sibling changes. Complete command logs are in `tmp/clm-s725/clm-03-lint-core/`. Verification was performed on a moving shared tree and must be repeated at serial integration.

Redispatch verification: 16 tests passed with zero failures; typecheck, scoped Biome, and both contract symbol checks exited 0. Complete logs: `tmp/clm-s725/clm-03-lint-core/redispatch-*.log`. These checks ran on the shared tree; serial integration remains downstream.

Review repair clm03-ti-001: added regression assertions for ERD shared edges, rendered containment and 40x20 intersection, UML system containment, state overlaps, re-lint and replanning after fixes, and fitting text. ERD table height is derived from its rows, so the containment fixture uses equal rendered heights.
