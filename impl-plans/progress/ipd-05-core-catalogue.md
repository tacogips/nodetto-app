# ipd-05 Core Catalogue Progress

Plan hash at start: aa78332693c47e2ce4e0be8b33e17a63b558c0f9. Dependency ipd-07a accepted by dispatch. Design decisions 1.1, 6.5, 6.6 and 8.1 checked.

Implemented text layer defaults, five iPhone presets, back links, catalogue listings, title placement helpers and frame hit testing. Exported helpers through the append-only shared index. Added catalogue and behavioral regression tests. Catalogue expectations add seven entries; existing snapshot and count expectations needed no edits.

Verification on the shared working tree: focused core 33 pass, 0 fail; CLI shapes 7 pass, 0 fail; typecheck and scoped Biome exit 0; tool ID search returns three matches. Complete logs are under tmp/ipd-s772/ipd-05-core-catalogue/final/. Formal reviews and integration are downstream.
