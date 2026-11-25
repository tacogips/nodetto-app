# car12-p5-inspector-targets progress

Status: done (implementation phase; formal review and integration follow).

Design alignment: section 29 R12-5; no predecessors. Per-edit preimages, intentions, and hashes are in `tmp/car12-r12/car12-p5-inspector-targets/`.

Counter assertions: for 500 and 1000 selections builds are 1, visits and queries are respectively 500 and 1000; ordering visits are 1000 and 2000. Real inspector changes at 16 and 32 targets build once and query counts double. Stored target order and single-target add replacement are asserted in both themes.

Final-source checks (shared tree moving):
- Biome check: exit 0, `tmp/car12-r12/car12-p5-inspector-targets/biome-final.log`.
- Focused Bun tests: exit 0, 10 passed, 0 failed, `tmp/car12-r12/car12-p5-inspector-targets/test-final.log`.
- DOM harness: exit 0, `ok light`, `ok dark`, `tmp/car12-r12/car12-p5-inspector-targets/dom-final-2.log`.
- Fail-before regression: exit 1, missing new export, `tmp/car12-r12/car12-p5-inspector-targets/fail-before.log`.
- Earlier Biome formatting attempt and incorrect direct harness working directory are retained as `biome-attempt-1.log` and `dom-final.log`; corrected runs passed.

Workspace typecheck, lint, and integration verification are explicitly assigned to serial integration; no shared output was generated here. Other plans' modified paths in the shared tree are preserved.

Final SHA-256:
- `packages/ui-solid/src/cad/extrude-targets.ts`: `ee7d3423f078ef70eb0d9798bff67c63b64666140f06f2c6015365df1b0b5656`
- `packages/ui-solid/src/cad/extrude-targets.test.ts`: `3331d58877fd153701c9889bd8defbe65dcb7fe211d4dec8f13e9e0418032b27`
- `packages/ui-solid/src/inspector/CadSection.tsx`: `94fa2416cb58eea7248aa236811e0a0ece3be2d4376c8802e95bd0dfd1a68038`
- `packages/ui-solid/src/test-dom/cad-inspector.dom.tsx`: `500cf389a889ca604ae7be65b27a49bab761c8cd19b0415f127579545a2faff6`
- `impl-plans/active/car12-p5-inspector-targets.md`: `2107e3a6625e94b8a7ffe79b8def73141335e49b52656367c8e94e97567354b1`
