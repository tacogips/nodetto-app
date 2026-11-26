# fv-18-nmesh-codec-model

- planId: fv-18-nmesh-codec-model
- planPath: impl-plans/active/fv-18-nmesh-codec-model.md
- progressPath: impl-plans/progress/fv-18-nmesh-codec-model.md
- wave: 4
- dependsOn: fv-12-nmesh-primitives-model
- Design: sections 3 (B4), 6.3, 7.
- writePaths: `formal/Nodetto/Nmesh/Codec.lean`, `formal/Nodetto/Nmesh/Vectors.lean`,
  `formal/Nodetto/Nmesh.lean`, `formal/vectors/nmesh.json`,
  `impl-plans/progress/fv-18-nmesh-codec-model.md`, `tmp/fv-s942/fv-18-nmesh-codec-model`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Whole-payload model of `encodeNmesh` (`encode.ts`), `readNmesh(bytes, "full")`
(`decode.ts`) and `isCanonical` (`canonical.ts`), plus all NMESH vectors.

## Changes

- `formal/Nodetto/Nmesh/Codec.lean`, `namespace Nodetto.Nmesh`, imports
  `Nodetto.Nmesh.Model`: `structure Mesh` (design 6.3), `isCanonical (m : Mesh) : Bool`,
  `encodeNmesh (m : Mesh) : Except NmeshError Bytes`, `decodeNmesh (bs : Bytes) : Except NmeshError Mesh`.
  - `isCanonical` mirrors every TS check in order: lengths divisible by 3,
    `|coord| <= 10^7`, unique positions, groups (`faceId` strictly increasing, at most
    `2^32 - 1`, `count > 0`, within triangles), first use, `degenerate` (integer cross
    product), rotation rule `a < b`, `a < c`, and triangle order within a group.
  - `encodeNmesh`: `.error .canonical` unless canonical; header
    `[0x4e,0x4d,0x53,0x48,1,0,3,0]`, varints V, T, G, groups, zigzag deltas per axis,
    index codes `used - vertex`, then CRC-32 of the body as 4 little-endian bytes.
  - `decodeNmesh`: the TS checks in the TS order (length < 12, magic, version, flags,
    unit, varint counts, count bound `3V+3T+2G > len-12`, CRC, groups, positions with
    range, indices via `indexStep`, final used, trailing).
- `formal/Nodetto/Nmesh.lean`: add `import Nodetto.Nmesh.Codec` (keep the Model import).
- `formal/Nodetto/Nmesh/Vectors.lean`: module `"nmesh"`, sources
  `["packages/nmesh/src/encode.ts","packages/nmesh/src/decode.ts","packages/nmesh/src/armor.ts","packages/nmesh/src/canonical.ts","packages/nmesh/src/crc32.ts"]`.
  Cases: `encodeNmesh {positions, triangles, groups:[[faceId,count]]}` -> `ok bytes` or
  `err code`; `decodeNmesh {bytes}` -> `ok {positions, triangles, groups}` or `err code`;
  `toInline {bytes}` -> `ok text` or `err`; `fromInline {text}` -> `ok bytes` or `err`.
  Include canonical meshes (single triangle, two groups, shared vertices, coordinates
  at `+-10^7`), non-canonical meshes, varint values 127/128/16383/16384/2^21/2^28/2^32-1,
  overlong and truncated varints, bad magic, version, flags, unit, CRC, counts,
  groups, index and trailing bytes (CRC recomputed with `crc32` so later checks are
  reached), armour padding 0/1/2, bad characters, non-zero leftover bits, the empty
  input, and the length limit.
- `formal/vectors/nmesh.json`: generated, committed.

## Pitfalls

- Error codes are the TS strings via `NmeshError.code`.
- Error order matters for vectors: mirror the TS order exactly.

## Acceptance criteria

- [x] `Nodetto.Nmesh` builds; vectors are fresh, 200+ cases, 20+ per fn.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Nmesh > ../tmp/fv-s942/fv-18-nmesh-codec-model/build.log 2>&1`
2. `formal/scripts/audit --module Nmesh --vectors > tmp/fv-s942/fv-18-nmesh-codec-model/audit.log 2>&1`
