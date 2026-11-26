# fv-40 fractional conformance progress

Dependency fv-10 accepted in dispatch; plan matches design B2, D6 and D7.

Before hashes: fractional.ts d419b73bcf846f94e4ef3966f44697899f0b7324; fractional.test.ts e00697d950d72d6519117701ec352241d7b2b804; formal test absent; plan 0d8610c0389092be8d891916d958d754cec28463; progress absent.
After hashes: fractional.ts a500697bae947229c214a5e435f64cfbd34bb8de; fractional.test.ts 7438109e500a3c677ba63926adb4bc3f3c218444; fractional.formal.test.ts 262eeb399f741202e8b64a9c7d53406d81df62f9.

Pre-fix D6 and D7 tests each exited 1: see before.log and before-d7.log. Pre-fix numeric draws 0 and 0.5 yielded respectively keyBetween(1,3) = 2, keyBetween(yzz,z) = yzz1/yzzV, keyAfter(zz) = zz1/zzV. Tests preserve these results and assert one draw for each long-key case.

Final gates: model build exit 0 (build.log); fractional tests exit 0, 17 passed, 0 failed (test.log); Biome exit 0 (biome.log); both baseline logs nonempty and repeat check exit 0. Evidence is under tmp/fv-s942/fv-40-fractional-conformance/. Formal review and integration remain downstream.
