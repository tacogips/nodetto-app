# fv-28-nmesh-payload progress

- Dependency fv-27-nmesh-armor is accepted in the dispatch runtime.
- The plan agrees with design section 6.3: the payload round trip may remain open.
- Created `formal/Nodetto/Nmesh/Payload.lean` (before: absent; after git hash-object `3ecab75a08fd70c1543744f02e354217f4077880`) with proofs that successful encoding implies canonicality and identifies the payload, and that the vertex and triangle counts fit the varint domain.
- Appended the Payload import to `formal/Nodetto/Nmesh.lean` (before `3c3287a3c74ed80d91a9e8d344de2de95571efe7`; after `2ecc00f663f541aa3706cb594899f900f6ff04ec`); prior imports remain intact.
- Status: **open**. The last unproved lemma statement, sufficient after `encodeNmesh_success`, is:

```lean
∀ (m : Mesh), isCanonical m = true →
  m.positions.length < 3 * 2 ^ 32 → m.triangles.length < 3 * 2 ^ 32 →
  m.groups.length < 2 ^ 32 →
  decodeNmesh (appendCrc (encodeBody m)) = .ok m
```

  This requires connecting the decoder's CRC, count, group, coordinate and index checks to the encoded body. No theorem named `decodeNmesh_encodeNmesh` is declared. The existing primitive proofs and vector audit cover the designated boundary; fv-50 owns the final open-item documentation.
- `cd formal && mise exec -- lake build Nodetto.Nmesh` exited 0; log: `tmp/fv-s942/fv-28-nmesh-payload/build.log`.
- Vector audit outcome is recorded in the plan-local audit log and the implementation handoff.
- Progress file before: absent. Its post-edit hash is recorded in the handoff evidence.

- Vector audit `formal/scripts/audit --module Nmesh --vectors` exited 0; log: `tmp/fv-s942/fv-28-nmesh-payload/audit.log`.
- Progress update: before `58653748d40381a53c654d5ac0d7863cf72aa51f`; after hash is in `tmp/fv-s942/fv-28-nmesh-payload/progress-after.hash`.
