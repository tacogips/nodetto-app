# ipd-07b-icon-data-ascii progress

Implementation complete; formal review and integration remain downstream.

- The generator escapes non-ASCII UTF-16 code units in the outer string before the size check, and atomically renames the generated file. Existing icon records and license copying are retained.
- The extracted Lucide 1.70.0 package was present. Its tarball SHA-512 matched the ipd-03 audit: `03d52063df20f7822e1d063bae5eff005c075fb4f5a8da73af28a6f8ac3908685d576493a1bb4163e89bfd9e38a21caa5c4241f3c82f5c501e27ceee38e1ca2f`; no download was needed.
- Runtime Bun.hash before and after: `17201948910672016511`. Two generated file SHA-256 values matched: `39ed949cfe1f9aaf786e914e4d43541bdd7dca3579e71a80e1060e1efa266f43`. License SHA-256 before and after: `b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57`. Source size grew from 981957 to 982338 bytes.
- ASCII scan and emoji scan found no matches; scanner positive control passed; temporary generated file was absent. Tests confirmed preserved runtime tag and search: 10 pass, 0 fail. Scoped Biome and repository typecheck exited 0. Logs and pre-edit intent are in `tmp/ipd-s772/ipd-07b-icon-data-ascii/final/`.
- An initial scoped Biome check found formatting and the intentional control-character regex lint; the test now formats the added lines and documents a narrow suppression. The final check passed.
