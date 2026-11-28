# fv-11-zorder-model progress

The model and vectors implement design 6.2, including D3 duplicate refusal. The root imports the model. The implementation uses the accepted Fractional model and keeps the RNG state on renumber fallback. Proof imports and TypeScript D3 repair belong to downstream plans.

Per-edit intentions, fresh before/after copies and hashes are in `tmp/fv-s942/fv-11-zorder-model/`: `intent-initial.txt`, `intent-root.txt`, `intent-rename.txt`, `intent-commands.txt`, `intent-cleanup.txt`, `intent-vectors.txt`, `intent-json.txt`, `intent-plan.txt` and `intent-progress.txt`. Initially the model and root were absent; the vectors stub hash was `a8aef606d3dbc6b2f7a7aa9c257bf98338eb3912`. Intermediate model hashes are recorded in the corresponding evidence files.

Final source hashes: Model `fc958b0d5ccaf1dd433f924a5106f0a1e8035217`, Vectors `963140822c8a78dd43e079bf3cc17833ea025e24`, root `531e9c979f60ead4f4bf8d982b3c1c01075016a4`, JSON `6a48dfd83540e1600a9d1ac4f132948120c8c72a`. Plan before and after hashes are recorded in the evidence directory; progress was absent before creation and its final hash is recorded there.

`build.log`: lake build Nodetto.ZOrder passed. `audit.log`: module audit and byte-exact vector freshness passed. `count.log`: 3618 cases: targetOrder 384, relativeOrder 3072, reorderCommands 162. `compare.log`: 3603 cases match the current TypeScript; 15 duplicate-target cases are intentionally deferred because the D3 TypeScript fix belongs to fv-41. Earlier build errors and fixes are recorded in `build-partial.log` and `build-commands.log`. These checks ran on the shared working tree; final integration is downstream.
