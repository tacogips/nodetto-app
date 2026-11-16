# dps-17d individual PDF text progress

- Implementation complete on shared moving tree; formal review and final integration remain downstream.
- Includes optional element filter, viewBox-relative text runs and expanded scope membership, and forwards runs to PDF.
- pdf-document.ts unchanged.

## Source hashes

| Path | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `packages/core/src/document-export/text-runs.ts` | `b385d27e1550666302cf26834ccaf583452d6e156f2a46a06d8d98d23604bd31` | `08019f65ecf185a1db46a317db7ddaf56e523a57f515651278255d96050cef5a` |
| `packages/core/src/document-export/text-runs.test.ts` | `5ae61e1de4354d00fdeb661a0cef92dcb1bc28602468c66ab2b75783f1b481f9` | `61a068bf8c3120277f954fd6417eea10b870aff6e9613f8707533ecff21098b9` |
| `packages/ui-solid/src/raster-export.ts` | `664c571f75d28c6b5ec6b2eed4cc97fbb38c8df82820014df7ec6965701cf8a1` | `29c2ca108e40731ee388162a3f037d558d03afc87de76a7908e2f2b78bcb9970` |
| `packages/ui-solid/src/inspector/AssetExportSection.tsx` | `75b5725594c177e24a150f3bea424e737a67ab32c8150fd7428c5bb20ae037b9` | `32383e76013c82eab3b42e183d4f18465423ef6cc58592ad70f518a0db9efd40` |
| `packages/ui-solid/src/raster-export-text.test.ts` | `absent` | `12b7bd8018454d3506e9410344def8b89a7367d4730fcbbfb436161dc4dd828e` |

Per-edit preimages and intents are in `tmp/dps-s864/dps-17d-pdf-text-individual/`.

## Verification on moving shared tree

- `bun test packages/core/src/document-export packages/ui-solid/src/raster-export-text.test.ts packages/ui-solid/src/pdf-export.test.ts`: exit 0, 19 passed, 0 failed; `test-final.log`.
- `bun run typecheck`: exit 0; `typecheck-final.log`.
- `bunx biome check --diagnostic-level=warn packages/core/src/document-export/text-runs.ts packages/core/src/document-export/text-runs.test.ts packages/ui-solid/src/raster-export.ts packages/ui-solid/src/inspector/AssetExportSection.tsx packages/ui-solid/src/raster-export-text.test.ts`: exit 0; `biome-final.log`.
- Earlier fixture test failed due to equal layer indices (`attempt-test.log`); corrected fixture. Earlier typecheck failed on concurrent sibling `export-dialog-document.test.ts` (`typecheck.log`); subsequent full typecheck passed after sibling update.

Logs are under `tmp/dps-s864/dps-17d-pdf-text-individual/`.
