# fv-18-nmesh-codec-model progress

Dependency fv-12 is accepted by dispatch. The plan agrees with design section 6.3.

Partial implementation: created `formal/Nodetto/Nmesh/Codec.lean` containing `Mesh`, coordinate delta, body encoding and CRC append helpers. Before: absent. After: see `tmp/fv-s942/fv-18-nmesh-codec-model/hash-after-codec-1.txt`; intended edit and resulting content are saved beside it. The helpers compile independently; they are not yet wired into the root or validated against TypeScript.

`lake build Nodetto.Nmesh` exited 0, but the root does not import Codec yet. `lake build Nodetto.Nmesh.Codec` exited 0. The required vector audit exited 1: `formal/vectors/nmesh.json` does not exist. Complete logs are in the plan evidence directory.

Remaining: implement `isCanonical`, `encodeNmesh`, `decodeNmesh`, import Codec in the root, replace the vector stub with the complete generator, generate vectors, and rerun both required gates. Acceptance remains unmet.

## Continuation 1

Implemented canonical validation, encoding and full decoding in `Codec.lean`; added the root import and replaced the vector stub with the executable generator. Earlier incomplete status and failed audit above are historical. Edit intentions and before/after snapshots and hashes are recorded in `tmp/fv-s942/fv-18-nmesh-codec-model/` using `codec-*-decoder`, `codec-*-canonical`, `root-*-cont1`, `vectors-*-cont1`, and `json-*-cont1` names. Final blobs: Codec `aa96e57072e9b9d6e7aa97cba9e3bf52449b63f8`, Vectors `f17149d4e1011929f6bbe50adf7cb1481d74af5c`, root `26a3dc683b5a218ef892420962b73199c5dfc1cc`, JSON `a177581831e73c80152ef7decf8f3c12664572ab`.

The root build and vector audit both exited 0 (`build-cont1.log`, `audit-cont1.log`); the audit regenerated the vectors byte-for-byte. The generator contains 287 cases: encode 73, decode 84, toInline 62 and fromInline 68 (`count-cont1.log`). A plan-local TypeScript comparison returned 287 cases, zero mismatches (`conformance-cont1.log`). These checks ran on the shared working tree. Independent review remains downstream.

Per-edit Git blob identities: decoder `7a785220b5663abeac648fd053707908a19affe4` → `6a975c55302935964f2bd91fea8d0d3174312e04`; canonical/encoder `6a975c55302935964f2bd91fea8d0d3174312e04` → `aa96e57072e9b9d6e7aa97cba9e3bf52449b63f8`; root `2442dbed9f4781fb89bd70f0b045999bf700d15e` → `26a3dc683b5a218ef892420962b73199c5dfc1cc`; generator `a8aef606d3dbc6b2f7a7aa9c257bf98338eb3912` → `f17149d4e1011929f6bbe50adf7cb1481d74af5c`; vectors absent → `a177581831e73c80152ef7decf8f3c12664572ab`; plan `0a85bf13344464edefa86fc8e09201c48d7b7d2d` → `f1ee315877a2fc5dcfc2aa7c5423f415d835ac14`. Progress before and after identities are recorded in the corresponding evidence hash files.
