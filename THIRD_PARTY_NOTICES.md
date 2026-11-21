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
