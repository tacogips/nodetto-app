# M5 cad3d-05-kernel-manifold

- dependsOn: M4 (`CadKernel`, `evaluateCadPage`, test documents)
- Design: sections 3.4, 6.1, 11, 14, 18
- writePaths: `packages/cad-kernel/package.json` (new),
  `packages/cad-kernel/src/index.ts` (new),
  `packages/cad-kernel/src/manifold-kernel.ts` (new),
  `packages/cad-kernel/src/manifold-kernel.test.ts` (new),
  `packages/cad-kernel/src/slice.test.ts` (new),
  `packages/cad-kernel/src/dependency.test.ts` (new),
  `packages/cad-kernel/licence-inventory.json` (new), `tsconfig.json` (path
  `@nodetto/cad-kernel`), `bun.lock`, `THIRD_PARTY_NOTICES.md`

## Intent

The real kernel behind the port and the headless vertical slice: a JSONL
document becomes a measured solid, a parameter edit regenerates it.

## Contract

```ts
// packages/cad-kernel/src/manifold-kernel.ts
export async function createManifoldKernel(options?: { wasmUrl?: string }): Promise<CadKernel>;
```

`package.json`: name `@nodetto/cad-kernel`, private, type module, exports
`"."`, dependencies `@nodetto/core` (workspace), `@nodetto/ir` (workspace),
`manifold-3d` pinned to exactly `3.5.5`, licence MIT.

## Behavior

- `createManifoldKernel` instantiates the module once and calls `setup()`.
  `options.wasmUrl` is passed as `locateFile` so a host can serve the file.
- `solid`: reserves one original id (`Manifold.reserveIDs(1)`), builds a
  `Mesh` with `vertProperties` (Float32 from the tool positions),
  `triVerts`, `faceID` = `triFace`, one run with that original id, and
  stores `originalId -> faceNames`. A non-manifold tool throws an `Error`
  with the kernel status text.
- `boolean`: `add` is `Manifold.union([target, ...tools])`, `cut` is
  `Manifold.difference(target, Manifold.union(tools))`, `intersect` is
  `Manifold.intersection([target, Manifold.union(tools)])`.
- `mesh`: reads `getMesh()`; for each run maps `runOriginalID` to the stored
  names and each triangle's `faceID` to a name; returns one merged
  `faceNames` table and `triFace` indices; positions are the first three
  properties.
- `measure`: `volume()`, `surfaceArea()`, `isEmpty()`, `numTri()`.
- Imports: the only third-party specifier in this package is the bare
  `manifold-3d` (its main entry `manifold.js`); never `manifold-3d/lib/*`,
  `manifold-3d/manifoldCAD` or any of its dependencies.
- `release`: calls `delete()` on the kernel object and forgets its handle;
  name tables are reference counted by the handles that still use them.
- Handles are integers from a counter; an unknown handle throws.

## Licence and dependency task (design section 11)

`manifold-3d` 3.5.5 declares eleven hard dependencies and one peer for its
optional tooling; about 60 packages are resolved, including `sharp` with a
prebuilt LGPL-3.0-or-later `@img/sharp-libvips-*` binary. None of them is
imported or shipped. Therefore:

- `licence-inventory.json`: one entry per package reachable from
  `manifold-3d` in `bun.lock` (name, version, licence string read from its
  `package.json`, `use`: `"distributed"` for `manifold-3d` only, else
  `"installed-only"`). Optional platform packages named in `bun.lock` but
  not installed on the build machine (other operating systems or CPUs) are
  listed with `use: "not-installed"` and the licence of their installed
  sibling; the test checks the licence field only for installed packages.
- `THIRD_PARTY_NOTICES.md`, new `## Manifold` entry in the existing form:
  version and URL; Apache-2.0; the two distributed files (`manifold.js`,
  `manifold.wasm`); the libraries compiled into the WASM with their
  licences, taken from the upstream source tree of tag v3.5.5 (build
  files and bundled sources; the package README does not list them; the
  binary's strings show Clipper2, Boost Software Licence 1.0, and linalg,
  public domain); a sentence that the remaining packages of the tree are
  installed for the dependency's optional tooling and are not distributed,
  with a pointer to the inventory file. Stop and report if a component
  compiled into the WASM has a licence other than Apache-2.0, BSL-1.0,
  MIT, BSD, zlib, Unlicense or public domain.

## Tests (real WASM under Bun)

- `manifold-kernel.test.ts`: a unit box has volume 1; box minus an
  overlapping box matches the analytic volume within 1e-5 relative; face names of
  both tools appear in the cut result and no other names; `release` then
  `mesh` throws; a tool with a missing triangle throws.
- `slice.test.ts` (documents from `@nodetto/core` test builders, serialised
  and re-parsed through `@nodetto/io` first):
  - Plate 100 x 60 x 5 with six holes of radius 3: one body; volume equals
    `30000 - 6 * 5 * polygonArea(tessellateCircle)` within 1e-5 relative
    (tool vertices pass through Float32); names `ex1:start`, `ex1:end`, four `ex1:side:*`, and `ex2:side:<circle>`
    for each hole.
  - Changing one radius through `applyCommands` (`updateSemantic`) and
    re-evaluating with the same memo gives the new analytic volume; undo
    (inverse commands) restores the first volume exactly.
  - Boss: a sketch on `{"face":{"feature":"ex1","role":"end"}}` extruded 10
    with `op: "add"` raises the bounding box top to 15.
  - `intersect` of two overlapping plates gives the overlap volume.
  - Determinism: two fresh kernels evaluating the same document return
    byte-identical `positions`, `triangles` and `triFace`.
  - Timing: the 60 hole plate evaluates in under 2000 ms (design budget
    150 ms; log the measured value to `tmp/cad3d/m5/timing.log`).

- `dependency.test.ts`:
  - every import specifier in `packages/cad-kernel/src/*.ts` (non-test) is
    relative, `@nodetto/*` or exactly `manifold-3d`;
  - `packages/core/package.json` and `packages/ir/package.json` do not
    name this package or `manifold-3d`;
  - the set of packages reachable from `manifold-3d` in `bun.lock`
    (parsed as text, walking the `dependencies`, `peerDependencies` and
    `optionalDependencies` of each entry, so the platform and libvips
    packages under `sharp` are reached) equals the names in `licence-inventory.json` (entries marked
    `"not-installed"` included, since `bun.lock` names every platform
    variant), each installed package's `license` field equals the recorded
    string, at least one `@img/sharp-libvips-*` entry is present with an
    LGPL licence string (proof that the walk reaches them), and exactly one
    entry has `use: "distributed"`;
  - `node_modules/manifold-3d/manifold.js` contains no static `import`
    statement and no `require(` of a bare package name.

## Acceptance criteria

- Notice entry and inventory present and consistent with `bun.lock`. The
  `bun.lock` diff contains the new workspace, `manifold-3d` and its
  resolved tree and nothing unrelated (no version change of an existing
  package); the list of added packages is quoted in the commit message.

## Verification (each must exit 0)

1. `sh -c 'bun install --frozen-lockfile && bun run typecheck && bun test packages/cad-kernel'`
2. `sh -c 'bunx biome check packages/cad-kernel && bun test packages/cad-kernel/src/slice.test.ts packages/cad-kernel/src/dependency.test.ts'`
