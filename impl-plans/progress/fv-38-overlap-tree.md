# fv-38-overlap-tree progress

The accepted design section 6.8 permits both tree statements to remain open.
`treeSearch_visits_overlaps` and `overlappingPairs_visits_overlaps` are open;
no declarations with those names were added. The last unproved lemma needed
for the first is the segment-tree invariant: after each update and expiry, each
node contains the maximum of its active descendant leaves, and query visits
exactly the eligible overlapping leaves. This must account for boxes expired
before insertion. The second statement additionally requires combining the
branch result with the proved sweep result. The tree branch remains covered by
vectors; fv-50 owns its open-status documentation.

Added the kernel-checked `overlaps_comm` helper and imported Tree after the
existing Model and Sweep imports. Before creation Tree.lean and this progress
file were absent. Root before: `27c48ce342f5843081a9d63c519569e451bf69e2`.
After: Tree `94af8102cab450bd8641b65dd7abd0f886d228c2`, root
`4790694ece7ed03b28cd9b530d8a80358b3f4185`. Intent and hashes are also
recorded in `tmp/fv-s942/fv-38-overlap-tree/`.

Acceptance: open statements and last unproved invariant recorded; focused
build and vector audit exit 0 (`build.log`, `audit.log`). The conditional
per-theorem audit exits 0 with no names selected (`theorem-selection.log`).
Verification was on the shared working tree. Formal review and integration
are downstream. The separate audit.ts findings at lines 58 and 320 remain
assigned to the audit owner.
