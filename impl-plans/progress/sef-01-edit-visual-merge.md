# sef-01-edit-visual-merge progress

G1 CLI visual patches now deep merge, strip null keys, normalize empty dash arrays, and preserve lock-only updates. Required semantic removals are diagnosed before reference resolution. Core merge behavior and add validation remain unchanged. Focused tests cover clearing, merging, required fields, lock behavior, and add rejection; native parity uses separate document copies.

Moving shared-tree checks: focused test 6 passed; edit/frame carry/scale suite 42 passed; typecheck and scoped Biome passed; native release build and parity passed with 1 test and no skips. Logs are in `tmp/sef-s733/sef-01-edit-visual-merge/`. Final stable-tree verification and formal reviews are downstream.
