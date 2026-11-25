# car4-f6a-export-members progress

Status: done (implementation; formal review and integration pending).

- `packages/core/src/svg-export/document.ts`: pre 6e56ef7400c3458b4c0701c74ec474461afaede24de92a4949430d247863fe18; post a149245140d20871831aaabb4c400992994d0dc8a38a851787e5b102e80f3298. Extracted selection and artboard membership; renderer and public helper share it.
- `packages/core/src/index.ts`: pre ed9531b8d75a900fa1026bf96f556e01f39487d7ed4cbe0c9b5e7e93c1537f6a; post 3b4f928acb894cef134a81cc60e3b88934a89ee3565882b4281b40981f3cd7c3. Exported helper.
- `packages/core/src/svg-export/members.test.ts`: new; post 51a60370a822b6c0336a4bea5dade0d82c83598e98725c491a7162a568634c1f. Tests group, frame, single shape and rendered membership.
- `impl-plans/active/car4-f6a-export-members.md`: pre 20977fff94d55830484ba62191fb50d8bd37fa007d7c4d5279bf89bf2a531f3d; post bdb076b49ce78c26901661c2790f45f5b15db108e92e27aa01701147e82c5bf4. Recorded implementation completion.
- Pre-fix `bun test packages/core/src/svg-export/members.test.ts`: exit 1, missing exported helper; complete log `tmp/car4-r4/car4-f6a-export-members/baseline-test.log`.
- Final focused gate `bunx biome check --diagnostic-level=warn packages/core/src/svg-export/document.ts packages/core/src/index.ts packages/core/src/svg-export/members.test.ts && bun test packages/core/src/svg-export/members.test.ts packages/core/src/svg-export.test.ts packages/core/src/frame-title.test.ts packages/core/src/rotation-export.test.ts packages/core/src/svg-paint-order.test.ts`: exit 0, 72 passed, 0 failed; complete log `tmp/car4-r4/car4-f6a-export-members/verification.log`. Runs on shared moving tree; integration rechecks later.
- Whole-workspace TypeScript and integration checks are assigned to integration by the accepted overview.
