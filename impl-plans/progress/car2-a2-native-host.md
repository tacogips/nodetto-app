# car2-a2-native-host progress

Status: done

Implemented native capture and bounds hosts, packet readers, structural CommandIo declarations, and host regression test. R2-D and legacy paths reviewed. Pre-fix API negative control: `git show 3cd2401:apps/cli/native/src/engine.rs | rg ...` exit 1 (baseline-api.log).

Pre-edit SHA-256:
```
d3739ecf27e6e2054fd893e907cfb0c203c99df9f61cffbaaa3a87b3b83f45a9  apps/cli/native/src/engine.rs
dc35531ab3d4d10a2a306b20191f77fc2e36c509262e5dc0a2dc993d697aecf8  apps/cli/native/src/engine_tests.rs
6b1b60b391e6e82c501594a53b5eeb58a7c505a188a6b7ccbaeb1437596143ae  apps/cli/src/native-engine.ts
28953760afb69a9a33d4945e301a4d98970fe8a07dce0ff816c852cafca88dcb  apps/cli/src/commands.ts
```
Post-edit SHA-256:
```
9eb97595bec24052c90fa0cc865ba11bb90ac6e4ff58a64c475f75f9e2c2b62b  apps/cli/native/src/engine.rs
95b6ba4f59310c74927d5df74ae1dd116c5ce94dd84d95ef753a4206abe79de0  apps/cli/native/src/engine_tests.rs
71b120385651b8d082e5a53115b6aa00d39db644608666e98725e82da9e4bbf9  apps/cli/src/native-engine.ts
9141da28bf82d07b9fe02fbe107da1fee7f75a4863c456cc744f60a19f0a4a94  apps/cli/src/commands.ts
```

Evidence: tmp/car2-r2b/car2-a2-native-host/attempt-1/; command logs also to be copied under target/car2-a2-native-host/logs/. Rustfmt check exit 0 (fmt.log); Biome final exit 0 (biome-final.log). `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-native-host cargo test -p nodetto-cli` exit 101 (cargo-test.log): sibling `crates/capture/src/raster.rs:528` assigns `&[bool]` to `Vec<bool>`. Strict focused TypeScript invocation exit 2 (typecheck.log), existing `apps/cli/src/raster-backend.ts:125-126` indexed access diagnostics. Release build and native parity pending. Re-run Rust and parity gates after sibling car2-c2-closure-once progress is done; do not edit its files. Formal review and integration follow implementation.

Release build completed exit 0 (build.log) on the moving shared tree. Native parity completed exit 0, 16 pass, 0 fail (parity.log), using NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a2-native-host/release/nodetto-cli". The sibling progress log has not yet appeared; the required cargo test remains blocked until it reads done, then must be rerun. Rust test and release build must be rechecked against stable sibling sources. Focused tsc diagnostics require integration classification. Formal reviews remain downstream.

## Attempt 2: stable sibling verification

The sibling progress now reads done. The four source SHA-256 values remain identical to the post-edit values above; no source was changed in this attempt. The plan matches design section 20.2 R2-D, and the accepted decoder dependency is present. Attempt 1's failure is superseded by the following final-source gates; its logs remain available above.

- `rustfmt --edition 2021 --check apps/cli/native/src/engine.rs apps/cli/native/src/engine_tests.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-native-host cargo test -p nodetto-cli`: exit 0, 31 tests passed, 0 failed. Log: `tmp/car2-r2b/car2-a2-native-host/attempt-2/rust-test.log`, mirrored at `target/car2-a2-native-host/logs/attempt-2/rust-test.log`.
- `bunx biome check --diagnostic-level=warn apps/cli/src/native-engine.ts apps/cli/src/commands.ts && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-native-host cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a2-native-host/release/nodetto-cli" bun test apps/cli/src/native-parity/cad.test.ts apps/cli/src/native-parity/capture.test.ts`: exit 0, 16 tests passed, 0 failed. Log: `tmp/car2-r2b/car2-a2-native-host/attempt-2/parity.log`, mirrored at `target/car2-a2-native-host/logs/attempt-2/parity.log`.

Formal test-integrity and adversarial reviews remain downstream. Workspace typecheck, lint and verification remain integration gates. The attempt-1 focused TypeScript diagnostics were in the out-of-scope raster backend; integration reconciliation reports workspace typecheck passing.
