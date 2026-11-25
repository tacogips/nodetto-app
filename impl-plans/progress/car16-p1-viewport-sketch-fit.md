# car16-p1-viewport-sketch-fit progress

Status: done. Review and serial integration are downstream.

Intent: fit visible sketch endpoints only when no bodies are drawn; keep provisional camera local until a body fit or user action. Add DOM coverage for fitting, hidden geometry, fallback, page switch, and preservation of existing behavior. Per-edit intent and intermediate hashes are recorded in `tmp/car16-r16/car16-p1-viewport-sketch-fit/`.

Pre-edit SHA-256: CadViewport.tsx `e049f98e05f78492600bbc765a2ce17995f4191a712f8bfed61f05dbad3c81ef`; cad-viewport.dom.tsx `1a5f5a10f193a3553cf24ef2230cb93f07fe4d4c0a1ed0aa21204ac8e26e0f06`; viewport.test.tsx `f18304b68ab536aa0d68b49e85dbd1622b125f94890ef4886bfeade3f9e8610d`; active plan `d42090bed26a05ee8ca33288909d61db7326cc823087a48129734139b94b08b5`; progress file absent.

Final source and plan hashes: see `tmp/car16-r16/car16-p1-viewport-sketch-fit/final-hashes.txt`.

- Pre-fix regression: exit 1; `fail-before.log`, corner NDC x -6.14888.
- Focused Biome and viewport gate: exit 0, one test; `gate-final3.log`.
- Full viewport tests: exit 0, two tests; `viewport-all-final2.log`.
- Intermediate fixture failures and corrections: `gate-test.log`, `gate.log`, `gate2.log`, `gate3.log`, and intention files.
- No existing assertion was changed; no Rust or new dependency. Integration runs workspace checks once after fanout.
