# fv-21-fractional-keys progress

Dependency fv-20 is accepted in dispatch. The plan matches design 6.1; all ten statements are proved without changed hypotheses.

Edits (git hash-object; absent means no prior file):
- KeyBetween.lean: absent -> f5f2e68c82c1b195147d13e6f4299055ae93ed80 (ten proofs; intent-1.txt); -> c5468ea848bdffeaa7ca7edb3d2103ef0e314c6c (intent-fix1.txt); -> 8fe6c7a8640cf7b4ab64e9f987f140640bc19b67 (intent-fix2.txt); -> ec474c58c4e3882f49002a2e81cac577677485a0 (intent-fix3.txt).
- Fractional.lean: 971466fa8d5711533a4894413fad029bcdf19f2a -> 5bc7d649c22f83df1af388e92305f6d760c77f3d (append KeyBetween import; intent-root.txt).
- This progress log: absent -> recorded by git hash-object after creation; intent-progress.txt.

Acceptance: ten theorem signatures, existence and axioms passed the assigned audit. The module build passed. Complete current-source logs: tmp/fv-s942/fv-21-fractional-keys/build.log and audit.log, both exit 0. Earlier build-1 through build-3 failed during proof development; build-4 passed. Build warnings are unused simp arguments. Formal review and integration remain downstream.
