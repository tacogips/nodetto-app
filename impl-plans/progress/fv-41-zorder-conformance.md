# fv-41 z-order conformance progress

D3 and vector conformance implemented on the shared working tree. The dependency fv-11 was accepted by dispatch. Design sections 5, 7 and 10 match this plan.

Edits and git blob hashes (before -> after):
- z-order.test.ts: 88d388af803513e7291bb91961dce0600e5c732d -> dd789aa5a9d3fac07ac2aa654560bda95ed41efb; appended duplicate-ID regression.
- z-order.ts: 8e9a7cd66fc392da126d398005f4f1a39e2ffc99 -> ac45ffdb995eb311f3f9c32e0fd6e2eea416fba7; refuse duplicate filtered IDs.
- z-order.formal.test.ts: absent -> 682e797d1bee73fd26aee04d0377f0f8dc61dea6; intermediate 09ee00dc497508d3a265255c15c32e7c0dd3e503; validate and check every vector, and correct TypeScript narrowing. The scoped Biome format was applied to these owned files.
- Active plan: 2e256523fecf2020961f50c13df37b1f9bca8c57 -> 20907f44673e76ab9c9d50afa2ee942bdb78ecb2; acceptance marked complete.
- Progress: absent -> see evidence progress-after.hash.

Evidence: tmp/fv-s942/fv-41-zorder-conformance/. before.log records the duplicate regression failing with two reorder commands (25 pass, 1 fail). The shell wrapper attempted to assign zsh's readonly status variable after the runner, so its runner exit code was not captured; the complete Bun output records the failure. build.log passed; test-final.log passed 27 tests, 0 failures, 3721 assertions; biome-final.log and typecheck-final.log passed. The earlier typecheck.log recorded two narrowing errors, corrected before final verification. These gates ran on the shared tree; integration review and combined-tree checks remain downstream.
