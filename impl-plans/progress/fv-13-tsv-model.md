# fv-13-tsv-model progress

Accepted dependencies: fv-01-scaffold, fv-02-audit, fv-04-stubs-a. The model follows design sections 3, 5, 6.4 and 7. Proofs and the permanent conformance test belong to downstream plans fv-29 and fv-43.

The UTF-16 parser and serializer model the TypeScript control flow; the vectors cover empty rows, malformed quotes, CRLF and lone surrogates. The initial 706 cases were checked against TypeScript with zero mismatches; the current set has 708 cases, including an additional inner zero-field row for serialization and round trip.

| Path | Before git hash-object | After git hash-object |
| --- | --- | --- |
| formal/Nodetto/Tsv/Model.lean | missing | a9e2e5343b82295d60731b53f7dfacfab3e11f0b |
| formal/Nodetto/Tsv/Vectors.lean | a8aef606d3dbc6b2f7a7aa9c257bf98338eb3912 | bdd348dd8fb37627e87cf6bb0a53ace9876b3da9 |
| formal/Nodetto/Tsv.lean | missing | 365e25b0d368386c396630badc9ea46ee18f6fc8 |
| formal/vectors/tsv.json | missing | 335c3ad6f00b59314f2749af58c58c9ed516d5de |
| impl-plans/active/fv-13-tsv-model.md | d7269836e92d513d46a9c37fac80f52dbe2bcc1c | see plan-after.txt |
| impl-plans/progress/fv-13-tsv-model.md | missing | see progress-after.txt |

Evidence and per-edit intentions are in tmp/fv-s942/fv-13-tsv-model/. Initial build failed on termination elaboration; the exhaustive lookahead correction passed. Final build.log and audit.log exit 0. conformance.log reports 706 cases, 0 failures. These checks ran on the shared working tree; integration review remains downstream.

The original table's after hashes for the four source files were shifted by one row. Current hashes: Model.lean `bdd348dd8fb37627e87cf6bb0a53ace9876b3da9`, Vectors.lean `033cc18e28f2cabe3785e8f5958fcc185d1509c9`, Tsv.lean `335c3ad6f00b59314f2749af58c58c9ed516d5de`, tsv.json `fd4fdd2269fd994da9708871293868fd04cbacbb`. Before the inner-row addition, Vectors.lean was `365e25b0d368386c396630badc9ea46ee18f6fc8`, tsv.json was `f5457b21918c78a2934f3e550e53517b91192a26`, and this progress file was `4dd551dfb558ce2720c70bf638cf9abda7495107`. The final shared-tree build and vector audit exited 0; see `build-final-inner.log` and `audit-final-inner.log`. The permanent TypeScript conformance gate is owned by fv-43.

Current Step 6 shared-tree self-check: `lake build Nodetto.Tsv` exited 0 (`build-step6-current.log`); `formal/scripts/audit --module Tsv --vectors` exited 0 (`audit-step6-current.log`). `counts-step6-current.log` records 708 vectors: 240 parseTsv, 234 serializeTsv and 234 roundTrip. Model, vector generator, module root and vector hashes remain respectively `bdd348dd8fb37627e87cf6bb0a53ace9876b3da9`, `033cc18e28f2cabe3785e8f5958fcc185d1509c9`, `335c3ad6f00b59314f2749af58c58c9ed516d5de`, and `fd4fdd2269fd994da9708871293868fd04cbacbb`. Proof and conformance plans remain downstream.

Step 6 rerun: build and vector audit both exited 0 on the shared tree (build-step6-rerun.log, audit-step6-rerun.log); counts-step6-rerun.log confirms 708 cases (240 parseTsv, 234 serializeTsv, 234 roundTrip). Progress before hash: 714a9ba32ecbc45763a94c71f861967c8e8a2dfe.

Step 6 final re-verification on the shared tree: `build-step6-final3.log` and `audit-step6-final3.log` both exited 0; `counts-step6-final3.log` confirms 708 cases (240 parseTsv, 234 serializeTsv, 234 roundTrip). Source hashes remain Model `bdd348dd8fb37627e87cf6bb0a53ace9876b3da9`, Vectors `033cc18e28f2cabe3785e8f5958fcc185d1509c9`, root `335c3ad6f00b59314f2749af58c58c9ed516d5de`, and JSON `fd4fdd2269fd994da9708871293868fd04cbacbb`. Intent and prior progress hash are recorded in `intent-final3.txt` and `progress-before-final3.hash`; the post-edit hash is in `progress-after-final3.hash`. Formal review and downstream proof and conformance plans remain pending.
