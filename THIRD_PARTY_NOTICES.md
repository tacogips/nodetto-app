# Third-party notices

## Lucide

Lucide 1.70.0 (https://lucide.dev) is licensed under the ISC license. The full license is in `packages/core/src/icons/LICENSE-lucide.txt`. Icon geometry is vendored as data in `packages/core/src/icons/lucide-data.generated.ts`.

## Liberation Sans metrics

Advance widths only, derived from Liberation Sans 2.x fonts (SIL Open Font License 1.1); no font data is shipped. The full license is in `packages/core/src/text-metrics/LICENSE-liberation-sans.txt`.

## Manifold

[Manifold 3.5.5](https://github.com/elalish/manifold/tree/v3.5.5) is
copyright The Manifold Authors and licensed under
[Apache-2.0](https://github.com/elalish/manifold/blob/v3.5.5/LICENSE).
The kernel distribution uses `manifold.js` and `manifold.wasm`. The
audited `manifold.wasm` SHA-256 is
`b172438703ef72dea983481a9a0328d43a9f09e224f6ab093e7bbc99f4372314`.

The [Manifold build](https://github.com/elalish/manifold/blob/v3.5.5/cmake/manifoldDeps.cmake)
includes [Clipper2](https://github.com/AngusJohnson/Clipper2/tree/46f639177fe418f9689e8ddb74f08a870c71f5b4)
under BSL-1.0. Manifold's
[`linalg.h`](https://github.com/elalish/manifold/blob/v3.5.5/include/manifold/linalg.h)
is based on Sterling Orsten's public-domain [linalg](https://github.com/sgorsten/linalg).

Other bundled sources in the Manifold tag include:

- [`disjoint_sets.h`](https://github.com/elalish/manifold/blob/v3.5.5/src/disjoint_sets.h)
  is adapted from [dset](https://github.com/wjakob/dset), copyright (c) 2015
  Wenzel Jakob, under the zlib-style terms in the header.
- [`svd.h`](https://github.com/elalish/manifold/blob/v3.5.5/src/svd.h) is
  adapted from [tbtSVD](https://github.com/wi-re/tbtSVD), copyright (c) 2019
  wi-re, under MIT. The header's notice follows below.
- [`quickhull.h`](https://github.com/elalish/manifold/blob/v3.5.5/src/quickhull.h)
  and [`quickhull.cpp`](https://github.com/elalish/manifold/blob/v3.5.5/src/quickhull.cpp)
  are copyright 2024 The Manifold Authors under Apache-2.0 and derive from
  Antti Kuukka's public-domain [QuickHull](https://github.com/akuukka/quickhull).
- [`tri_dist.h`](https://github.com/elalish/manifold/blob/v3.5.5/src/tri_dist.h)
  adapts routines from NVIDIA PhysX's
  [`GuSweepCapsuleCapsule.cpp`](https://github.com/NVIDIA-Omniverse/PhysX/blob/107.3-physx-5.6.1/physx/source/geomutils/src/sweep/GuSweepCapsuleCapsule.cpp)
  and [`GuDistanceTriangleTriangle.cpp`](https://github.com/NVIDIA-Omniverse/PhysX/blob/107.3-physx-5.6.1/physx/source/geomutils/src/distance/GuDistanceTriangleTriangle.cpp)
  under BSD-3-Clause. Their notice follows below.

MIT notice from Manifold's `svd.h`:

```text
Copyright (c) 2019 wi-re
Copyright 2023 The Manifold Authors.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

BSD-3-Clause notice for the adapted PhysX routines:

```text
Copyright (c) 2008-2025 NVIDIA Corporation. All rights reserved.
Copyright (c) 2004-2008 AGEIA Technologies, Inc. All rights reserved.
Copyright (c) 2001-2004 NovodeX AG. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
 * Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
 * Neither the name of NVIDIA CORPORATION nor the names of its
   contributors may be used to endorse or promote products derived
   from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

The [publish workflow](https://github.com/elalish/manifold/blob/v3.5.5/.github/workflows/publish_npm.yml)
pins [Emscripten 5.0.2](https://github.com/emscripten-core/emscripten/blob/5.0.2/LICENSE).
The generated glue and Embind use Emscripten's MIT option. The runtime
components below are a conservative superset from the
[Emscripten link rules](https://github.com/emscripten-core/emscripten/blob/5.0.2/tools/system_libs.py).

- [musl libc](https://github.com/emscripten-core/emscripten/blob/5.0.2/system/lib/libc/musl/COPYRIGHT)
  uses MIT, with permissive notices for individual sources including SunPro.
- LLVM [libc++](https://github.com/emscripten-core/emscripten/blob/5.0.2/system/lib/libcxx/LICENSE.TXT),
  [libc++abi](https://github.com/emscripten-core/emscripten/blob/5.0.2/system/lib/libcxxabi/LICENSE.TXT)
  and [compiler-rt](https://github.com/emscripten-core/emscripten/blob/5.0.2/system/lib/compiler-rt/LICENSE.TXT)
  use Apache-2.0 WITH LLVM-exception. The WASM contains a libc++abi
  source marker.
- [dlmalloc](https://github.com/emscripten-core/emscripten/blob/5.0.2/system/lib/dlmalloc.c)
  is released into the public domain.

SunPro notice for the trigonometry adapted through musl, as retained in
[Manifold's `include/manifold/math.h`](https://github.com/elalish/manifold/blob/v3.5.5/include/manifold/math.h):

```text
Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
Developed at SunPro/SunSoft, a Sun Microsystems, Inc. business.
Permission to use, copy, modify, and distribute this software is freely
granted, provided that this notice is preserved.
```

Manifold's optional tooling dependencies are installed by the package
manager and excluded from the kernel distribution.
[`licence-inventory.json`](packages/cad-kernel/licence-inventory.json) lists the
resolved packages and records installation status on macOS arm64.

## jpeg-encoder

The native CLI links [jpeg-encoder 0.7.1](https://crates.io/crates/jpeg-encoder/0.7.1)
for JPG capture. The desktop and Mac App Store builds will use the same
encoder when desktop capture is integrated. The licence is
`(MIT OR Apache-2.0) AND IJG`. See [LICENSE-MIT](crates/capture/licenses/LICENSE-MIT),
[LICENSE-APACHE](crates/capture/licenses/LICENSE-APACHE), and
[LICENSE-IJG](crates/capture/licenses/LICENSE-IJG).

This software is based in part on the work of the Independent JPEG Group.

The capture crate also uses [png 0.18](https://crates.io/crates/png/0.18.1)
(`MIT OR Apache-2.0`) for PNG encoding and decoding.
