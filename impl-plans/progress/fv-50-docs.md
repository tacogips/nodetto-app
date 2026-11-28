# fv-50-docs progress

Dependency `fv-24f-reorder-spec` is in runtime acceptedPlanIds. Implementation follows design sections 3, 5, 6, 8 and 9.

## Edits and git hash-object provenance

- `formal/Nodetto.lean`: `absent` -> `e71047af51eb20e935bb20883b7b27d04f831561`; Add the eight root imports only.
- `mise.toml`: `1ba7bfe42604592d25cd4b23e2cc0447c269c275` -> `a686a58022f90e354b432fc0466c930548056ec0`; Add the design section 8 prove task before test; preserve other tasks.
- `README.md`: `35f12f6b1a8dbfbe5b2b701a0c706f45a15abb89` -> `db54c896fdcdf5619d16439077dbc8aff0d3eac8`; Add formal verification link in Development.
- `docs/formal.md`: `absent` -> `22ca253ece73da0775f61db30e27de854833726c`; Document audit statements, assumptions, findings, open items and limitations.
- `docs/formal.md` edit 2: `22ca253ece73da0775f61db30e27de854833726c` -> `2ee4e9979f373bb3306a67419f9ecbd98e6a8d9a`; clarify source functions.
- `impl-plans/active/fv-50-docs.md`: `30a7a05bea6612b42457ff0dff0e71ca2d2eb095` -> `e824c464ba4d16747cd34ce5490fb425a4c49f95`; append implementation status.

- `impl-plans/progress/fv-50-docs.md`: before `absent`; after hash is recorded in `tmp/fv-s959/fv-50-docs/progress-after-hash.txt` (self-reference avoided).

## Verification

- `mise run prove > tmp/fv-s959/fv-50-docs/prove.log 2>&1 && grep -q 'audit: ok' tmp/fv-s959/fv-50-docs/prove.log`: exit 0; all eight modules, statements and vectors passed.
- 69 statement rows; documentation checks and README link passed; logs are in `tmp/fv-s959/fv-50-docs/`.
- `rg` for the three open theorem declarations returned 1, no matches (`open-declarations.log`); all three are documented under Open.
- Completion criteria met for implementation; independent review and integration-wide typecheck, lint and conformance tests are downstream.
