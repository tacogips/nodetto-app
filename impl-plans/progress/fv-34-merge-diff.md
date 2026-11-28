# fv-34-merge-diff progress

Implementation incomplete. Added `diffPaths_nonobject`, `getPath_same`, and `fieldConflict_symm`; imported Diff from the module root. Still required: empty iff same, prefix-freeness, membership invariance under same, and object-step membership. No counterexample has been established.

Edit hashes (git hash-object): root before 33e6f86a5b2a754cb820592cfc41ca0d0dfe2312 and after 3754995123ee14dbd678cfd8acf7deeb78b61097; Diff initially absent, then 04ed2b5a4618a98a834a0cbbdf943ebdf1a10b8c, a935833702c89a6d7325110bf6a542a4d2cadd6f, 545ba93b15cabb3293ce7f56dd76e86874a4e5d4, and dc9eb7a26780b6c296d6cbca2069ca2392fab226. Per-edit intentions are under tmp/fv-s942/fv-34-merge-diff/.

Final-source build and vector audit passed in build-final.log and audit-final.log. Earlier build-attempt-2.log and build.log failed on an unfinished lemma that was removed; those runs are superseded. Completion criteria remain unchecked until all promised lemmas are proved.

## Continuation 1

Proved `diffPaths_of_same`, `lookupFirst_absent`, and the full `diffPaths_object_step` membership characterization, with `diffPaths_object_mem` as an intermediate lemma. Still outstanding: the converse of empty iff same, prefix-freeness, and membership invariance under same. The previous outstanding-work paragraph is superseded by this one.

Diff.lean edit hash chain: dc9eb7a26780b6c296d6cbca2069ca2392fab226 -> c946f6014a12bc2fcdc06826ad6d1aec5a647a87 -> 81e7230d321641973b35ac562fd2cbe4d9f21012 -> 4b811ea92bdda09e6505315972f9cffe024729e0 -> 81c0282733827359ab630b9efb352b3ef4c3e82e -> 5e1ccfddc05646b75c94d62cf8152220bfb74630 -> 437268f7844c058f5a998c6d214ed087f8cfc578. Intent and pre-edit copies are in tmp/fv-s942/fv-34-merge-diff/cont*-intent.txt and cont*-before.txt.

Build cont1-build6.log and vector audit cont1-audit-final.log exited 0 on the final source. Earlier continuation builds 1-3 and 5 failed during proof development; build 4 passed on an earlier source. They are superseded.

## Continuation 2

Completed `diffPaths_prefix_free`, `diffPaths_same`, `diffPaths_empty_same` and `diffPaths_empty_iff`. Together with the existing object-step, non-object, getPath and conflict symmetry lemmas, the assigned proof layer is complete. No counterexample was found.

Diff.lean edit hash chain: 437268f7844c058f5a998c6d214ed087f8cfc578 -> 93991dff8afb9e4c8d99ba3d75a44860953a1c94 -> f9e57036fe560072e70cb943e8c0883eb9375252 -> b055f5ab9a6edcb57d66bfc4b091daec5f321816 -> 1b04388afcd9521ab87e2184a0a0fc5f8f9e2505 -> 80d8ca414ade685a5ab474f358d45d3ff8c51db3 -> d99997d5e3cf0eacb8fff4b84c01739b7d0d9078 -> 29ea45646551bebae7884dbb9cf8e3e584dc42b5. Before/after hashes and intentions are under tmp/fv-s942/fv-34-merge-diff/cont2-*.

Final-source module build cont2-build7.log and vector audit cont2-audit-final.log exited 0. Earlier builds 1-4 failed while developing the termination proof; builds 5-6 passed on intermediate source. All are superseded. Formal review remains pending.

Plan status edit: 7fc50c6ae5c2e68d4431060146552198850f4ba5 -> 461853ccd7772d1a90488d4d19e48e7105693a2b (git hash-object).
