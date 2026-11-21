# M7 cad3d-07-engine-worker

- dependsOn: M5 (`createManifoldKernel`, evaluation)
- Design: sections 6.4, 6.5, 6.7 (edges), 11 (CSP), 13
- writePaths: `packages/core/src/cad/display.ts` (new),
  `packages/core/src/cad/engine.ts` (new), their tests,
  `packages/core/src/cad/index.ts`, `packages/cad-kernel/src/worker-host.ts`
  (new), `packages/cad-kernel/src/worker.ts` (new),
  `packages/cad-kernel/src/worker-host.test.ts` (new),
  `packages/cad-kernel/package.json` (export `./worker`),
  `apps/desktop/src/cad/engine.ts` (new), `apps/desktop/src/cad/csp.test.ts`
  (new), `apps/desktop/src/cad/bundle-rules.ts` (new),
  `apps/desktop/src/cad/bundle-rules.test.ts` (new),
  `apps/desktop/scripts/cad-bundle-check.ts` (new), `apps/desktop/package.json`, `apps/desktop/vite.config.ts`,
  `apps/desktop/src/vite-env.d.ts`, `apps/desktop/src-tauri/tauri.conf.json`

## Contract

```ts
// packages/core/src/cad/display.ts
export interface CadDisplayBody { readonly id: ElementId; readonly reference: boolean;
  readonly positions: Float32Array; readonly indices: Uint32Array;
  readonly triFace: Uint32Array; readonly faceNames: readonly string[];
  readonly edges: Float32Array } // xyz pairs
export function displayBody(id: ElementId, reference: boolean, mesh: KernelMesh): CadDisplayBody;
// packages/core/src/cad/engine.ts
export interface CadEngineInput { readonly revision: number; readonly pageId: PageId;
  readonly elements: readonly Element[] } // CAD page elements + referenced foreign elements
export interface CadEngineResult { readonly revision: number;
  readonly status: readonly (readonly [ElementId, CadStatus])[];
  readonly bodies: readonly CadDisplayBody[]; readonly failure?: string }
export interface CadEngine { evaluate(input: CadEngineInput): Promise<CadEngineResult>; dispose(): void }
export interface CadTransport { post(message: unknown, transfer: readonly ArrayBuffer[]): void;
  onMessage(handler: (message: unknown) => void): void; restart(): void }
export function collectCadInput(document: { pages: readonly Page[]; elements: readonly Element[] },
  pageId: PageId, revision: number): CadEngineInput;
export function createCadEngineClient(transport: CadTransport,
  options?: { timeoutMs?: number; now?: () => number;
    setTimer?: (fn: () => void, ms: number) => unknown; clearTimer?: (t: unknown) => void }): CadEngine;
// packages/cad-kernel/src/worker-host.ts
export function createWorkerHost(kernel: Promise<CadKernel>): (message: unknown,
  reply: (message: unknown, transfer: readonly ArrayBuffer[]) => void) => Promise<void>;
```

## Behavior

- `displayBody`: copies kernel buffers; an edge segment is emitted for every
  triangle edge whose two adjacent triangles have different face names or
  normals more than 30 degrees apart (compare the dot product of unit
  normals with the constant `0.8660254037844386`; no trigonometry), and for
  boundary edges. Adjacency through a `Map` keyed by the ordered vertex
  pair as a number (`lo * vertexCount + hi`).
- Client: at most one request in flight; a newer `evaluate` while busy
  replaces the pending one, whose promise rejects with an exported
  `CadSupersededError`; results whose `revision` is older than the latest
  requested are dropped; on timeout (default 20,000 ms) it calls
  `transport.restart()` and resolves with `failure: "cad.kernel.failed"`.
- Worker host: validates the message shape, runs `evaluateCadPage` with one
  long-lived memo, converts bodies with `displayBody`, replies with all
  typed array buffers as transferables. Any throw becomes a reply with
  `failure`. Messages are plain structured-clone data, never functions.
- `worker.ts`: `self.onmessage` glue around `createWorkerHost(
  createManifoldKernel({ wasmUrl }))`, the URL arriving in an init message.
- `apps/desktop/src/cad/engine.ts`: lazily constructs the module Worker
  (Vite `?worker` import) and the WASM asset URL (`?url`), implements
  `CadTransport` (restart = terminate and recreate), exports
  `getCadEngine(): CadEngine`. Nothing is loaded until first call.
- CSP in `tauri.conf.json` (`:25-26`): `csp` gets the new directive
  `script-src 'self' 'wasm-unsafe-eval'` appended; `devCsp` already has a
  `script-src` directive, which gains the token `'wasm-unsafe-eval'`
  (otherwise the kernel cannot compile under `tauri dev`). Every other
  directive of both strings stays byte-identical.

## Tests

- `display.test.ts`: a box gives 12 edge segments; a prism of a 32-gon gives
  64 cap segments and no side segments between facets of one face name;
  buffers are fresh copies.
- `engine.test.ts` (fake transport and timers): coalescing (three calls
  while busy produce two posts), stale result dropped, timeout triggers
  `restart` and a failure result, `dispose` rejects pending work.
  `collectCadInput` returns only the page's elements.
- `worker-host.test.ts` (real kernel, in-process): the Plate document
  returns one body whose buffers are in the transfer list; a malformed
  message returns `failure`; round trip under 2000 ms, value logged to
  `tmp/cad3d/m7/roundtrip.log`.
- `csp.test.ts`: parses both strings of `tauri.conf.json` into directives.
  `csp`: `script-src` is exactly `'self' 'wasm-unsafe-eval'`; `devCsp`:
  `script-src` contains `'wasm-unsafe-eval'` and its previous sources;
  neither contains the token `'unsafe-eval'`; every directive other than
  `script-src` equals the literal value it has at the base commit (the
  literals are written into the test).
- Bundle check, `apps/desktop/scripts/cad-bundle-check.ts` (a script, not
  a test file, so `bun test`, `mise run test`, `verify` and `ci` do not
  depend on a build): runs the Vite build through its JS API with the
  configuration of `apps/desktop/vite.config.ts`, `outDir`
  `tmp/cad3d/bundle-check/dist`, and one extra plugin whose
  `generateBundle` hook collects `Object.keys(chunk.modules)` for every
  chunk and the emitted assets. It then calls `checkBundleModules` and
  exits non-zero with the offending ids. `--label <m>` writes the collected
  lists to `tmp/cad3d/<m>/bundle-check.json`.
- `apps/desktop/src/cad/bundle-rules.ts` (pure):
  `checkBundleModules(moduleIds, assets, inventoryNames)` returns the
  violations: a module id under `node_modules/manifold-3d/` other than
  `manifold.js`; a module id under `node_modules/<name>/` for any other
  inventory name (scoped names included); the number of `.wasm` assets not
  being exactly one. `bundle-rules.test.ts` covers each rule with
  synthetic lists, including a path containing the word `sharp` that is
  not a package directory (for example the Lucide data module) being
  accepted.

## Acceptance criteria

- The bundle check passes: the worker chunk exists, exactly one WASM
  asset is emitted and it is byte-identical to
  `node_modules/manifold-3d/manifold.wasm`
  (`tmp/cad3d/m7/bundle-check.json`).
- `bun test` passes on a tree without `apps/desktop/dist`.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/cad/display.test.ts packages/core/src/cad/engine.test.ts packages/cad-kernel apps/desktop/src/cad'`
2. `sh -c 'bun apps/desktop/scripts/cad-bundle-check.ts --label m7 && bun test apps/desktop/src/cad/bundle-rules.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m7; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m7/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m7/strict.log | grep -vqE "\.test\.tsx?\(" && bun test apps/desktop/src/cad/csp.test.ts'`
4. `sh -c 'bunx biome check packages/core/src/cad packages/cad-kernel apps/desktop/src/cad && bun test packages/cad-kernel/src/worker-host.test.ts'`
