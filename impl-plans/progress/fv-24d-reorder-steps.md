# fv-24d progress

- Dependency fv-24c is accepted in the dispatch; G4 statements match design 6.2.1.
- Reorder.lean edits: 73b5f574760b33a308719474fd262b304dd04893 -> 5cba7f18b8af3753cd1aa38932bbff27847dc3ac -> a1e331338afb8d2de8d97221bc30d61dda012654 -> 2bce8032e6b92d329eb9e3747b9de8b8e8797a23. Fresh copies and intents are in tmp/fv-s959/fv-24d-reorder-steps/edit-{1,2,3}-*.txt.
- Added inv_kept and inv_moved with the design signatures; no earlier helper statement changed.
- Build attempts 1 and 2 exited 1 with elaboration errors; attempt 3 exited 0. Logs are retained in tmp/fv-s959/fv-24d-reorder-steps/.
- Final-source build, two-theorem audit and declaration gate exited 0; see build.log, audit.log and declarations.log in the evidence directory. Formal reviews and downstream plans remain pending.
