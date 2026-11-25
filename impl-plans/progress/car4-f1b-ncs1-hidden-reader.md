# car4-f1b-ncs1-hidden-reader progress

Status: done for implementation; formal review remains downstream.

- `crates/capture/src/scene.rs`: pre `a9374246dd51b8a5db27ee4331eb5004532e08cc675958ffae5e06e3cee3cefe`, post `dfb3cdb84430f5a218850973c779985e525ca9aa6fb816b66ec70e993a83e2e0`.
- `crates/capture/src/tiles.rs`: pre `9f7c256e19224be5bb21a718ebfca640db5b94b9b95da71016e442216c5bd16a`, post `922159615e0785e673e7eeb95d549b1ff544375fb7ad4d1f88b366af0a51918f`.
- `crates/capture/src/census.rs`: pre `ce82e4e5c6d72be3f7a16da15cff91064794c9812e29c5fc422d52769f04cdf5`, post `418fec9aa5ede40d68da465893960c4b6a348d60479acd7f2a94d9d25c1cb64c`.
- `crates/capture/tests/scene.rs`: pre `5b74361ddaa8613127f6e9ecbb9d3c5c286dc520abdf73bdfedf3de845b23985`, post `23a9b920ddbe453648516a2b3aebd3a57c1aa8b7ec3573f97aded3f29cc2d9d2`. Offset 36 is now a count, so its old padding assertion was replaced by the count-limit assertion.

Evidence is in `tmp/car4-r4/car4-f1b-ncs1-hidden-reader/`. The pre-fix focused regression failed to compile because `Scene::hidden` was absent (`pre-fix.log`, exit 101). The final focused scene suite passed 12 tests (`scene.log`, exit 0); rustfmt check passed (`rustfmt-check.log`, exit 0). The exact clippy and release crate gate was attempted three times (`gate.log`, `gate-retry.log`, `gate-retry-2.log`, all exit 101). Clippy passed each time; existing timing tests failed: tiles exceeded 1000 ms twice and interference exceeded 2000 ms once. Both also failed isolated runs (`isolated-tiles.log`, `isolated-interference.log`, exit 101). The full gate remains unverified; rerun under suitable machine load. Formal review and dependent hidden census integration remain downstream.

Redispatch verification: the exact gate again failed the tiles deadline at 1,449 ms (53 passed, 1 failed; exit 101; `gate-redispatch.log`). The current scene suite passed 12 tests (`scene-redispatch.log`, exit 0), and rustfmt passed (`rustfmt-redispatch.log`, exit 0). The required full gate remains unresolved; no source-matched baseline establishes the deadline failure as pre-existing.

Final redispatch: the exact clippy and release crate gate passed (162 tests, 0 failures; exit 0; `gate-final-20261125.log`). Rustfmt check passed (exit 0; `rustfmt-final-20261125.log`). The prior deadline failures are retained above as historical attempts.
