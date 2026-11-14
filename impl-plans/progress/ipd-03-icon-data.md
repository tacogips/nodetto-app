# ipd-03-icon-data progress

Historical status before amendment: blocked before data generation. Accepted dependency: ipd-00-baseline. Decision 2 and the committed plan require the latest stable lucide-static archive and strict rejection of child attributes outside the geometry allowlist.

- Metadata download: `curl -fsSL https://registry.npmjs.org/lucide-static/latest -o tmp/ipd-s772/ipd-03-icon-data/src/metadata.json` (exit 0); version 1.70.0, integrity `sha512-A9UgY98g94IuHQY7rl7/AFwHX7T1qNpzryim+Kw5CGhdV2STobtBY+ib/Z44ohyqXEJB88gvXFAeJ87uOOHKLw==`.
- Archive download: `curl -fsSL https://registry.npmjs.org/lucide-static/-/lucide-static-1.70.0.tgz -o tmp/ipd-s772/ipd-03-icon-data/src/lucide-static-1.70.0.tgz` (exit 0); SHA-512 `03d52063df20f7822e1d063bae5eff005c075fb4f5a8da73af28a6f8ac3908685d576493a1bb4163e89bfd9e38a21caa5c4241f3c82f5c501e27ceee38e1ca2f`.
- `bun scripts/vendor-lucide.ts tmp/ipd-s772/ipd-03-icon-data/src/package` exits 1: `brain-circuit` contains `fill="currentColor"`, which the required strict child-attribute allowlist excludes. See `tmp/ipd-s772/ipd-03-icon-data/final/generator.log` and `incompatibility.log`.
- No data file was produced, so generated file size and icon count are unavailable. The generator is preliminary, not verified. The remaining implementation and all required gates are pending.

Historical resume condition: when the plan is amended to authorize a compatible pinned release or explicitly define safe handling of the upstream `fill` attribute without silently discarding geometry. Then regenerate and complete the registry, markup, tests, notices, shared exports, and verification.

## Amendment implementation, 2026-11-10

The amendment resolves the prior generator blocker. The stored archive SHA-512 was rechecked and matches the download audit above. Lucide 1.70.0 generated the full set of 2,322 icons in 981,918 bytes; no subset fallback was needed. Generated data SHA-256: `0f9089df13e9892f9b4addd691fa9c1fc23238ec97528ddfa14331995f457531`. The generator preserves `currentColor` and `none` child fills and rejects other values. Added lazy lookup, search, escaped markup, license and notices, exports and regression tests.

- `bun test packages/core/src/icons`: 5 passed, 0 failed.
- Two generator runs produced identical SHA-256; license and notice checks passed.
- Targeted Biome check passed (3 files checked; repository configuration ignores the script).
- `bun run typecheck`: final rerun passed (exit 0); an earlier run encountered a transient sibling-owned unused import, retained in `attempt-2/typecheck.log`.
- Logs: `tmp/ipd-s772/ipd-03-icon-data/attempt-2/`. Formal review, integration and commit remain downstream.

## Adversarial review correction

Finding `ipd-03-adv-1-generated-data-biome`: the generator now emits a Biome format suppression immediately before its generated data literal, preventing repository formatting from rewriting it. Two regenerations produced SHA-256 `5a90d1994dadfd0c20e05cf2df28c92a0121ac5020475f0afe36da848c3609e3`; the full set remains 2,322 icons and 981,957 bytes. The decoded data SHA-256 remains `e9fb5a600b91baf2a2bc1fdb0c37668ada0f964a61b09192b5fa18df4a775fbe`, and brain-circuit retains its currentColor node.

`bunx biome check packages/core/src/icons` passed (4 files); the plan's targeted Biome check passed (3 files checked; script excluded by repository configuration). `bun test packages/core/src/icons` passed 5 tests, and `bun run typecheck` passed. Logs and pre-edit hashes are under `tmp/ipd-s772/ipd-03-icon-data/attempt-3/`. Independent review remains pending.
