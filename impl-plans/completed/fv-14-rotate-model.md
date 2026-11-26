# fv-14-rotate-model

- planId: fv-14-rotate-model
- planPath: impl-plans/active/fv-14-rotate-model.md
- progressPath: impl-plans/progress/fv-14-rotate-model.md
- wave: 3
- dependsOn: fv-01-scaffold, fv-02-audit, fv-05-stubs-b
- Design: sections 3 (B3), 5 (D4), 6.5, 7.
- writePaths: `formal/Nodetto/Rotate/Model.lean`, `formal/Nodetto/Rotate/Vectors.lean`,
  `formal/Nodetto/Rotate.lean`, `formal/vectors/rotate.json`,
  `impl-plans/progress/fv-14-rotate-model.md`, `tmp/fv-s942/fv-14-rotate-model`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Doubled-integer model of one iteration of `planBreadboardRotation`
(`packages/core/src/breadboard/rotate.ts`) with `breadboardPins` (`catalogue.ts`) and
`snapBreadboardPoint` (`snap.ts`).

## Changes

- `formal/Nodetto/Rotate/Model.lean`, `namespace Nodetto.Rotate`: `Geometry`, `Part`
  (`turns : Fin 4`), `Turn` (`cw` = quarterTurns 1, `ccw` = -1), `rotateVec`,
  `pinPositions`, `rotate`, and the binding definitions `anchor`, `snap`
  (`Int.fdiv (v + 10) 20 * 20`), `snapPoint`, `OnLattice`, `PinsOnPitch`, all as in
  design 6.5. `rotate g p t`: `none` when `g.pins = []`; new turns `(p.turns + 1)` or
  `(p.turns + 3)` in `Fin 4`; `fixed := snapPoint (anchor at p)`; `next := anchor of
  {p with turns := new}`; new position `p.xy + fixed - next`.
- `formal/Nodetto/Rotate.lean`: `import Nodetto.Rotate.Model`.
- `formal/Nodetto/Rotate/Vectors.lean`: module `"rotate"`, sources
  `["packages/core/src/breadboard/rotate.ts","packages/core/src/breadboard/catalogue.ts","packages/core/src/breadboard/snap.ts"]`.
  - Fixture cases (`fn: "fixture"`), one per part used: `in`
    `{type, semantic, localBox2:{x,y,width,height}, pinDefs2:[[dx,dy],...]}` where
    every value is 2 times the catalogue value in pitches (catalogue quantities are
    multiples of 0.5 pitch by B3, so these are exact integers; for example a
    resistor of span 4 has `localBox2 {x:-1, y:-1, width:10, height:2}`). `out` is
    the doubled geometry `{cx, cy, pins:[[x,y],...]}` computed from these integers by
    `cx = 5 * width2`, `cy = 5 * height2`, pin = `(10 * (dx2 - x2), 10 * (dy2 - y2))`,
    which equal design 6.5's `10 * L.width` and `20 * (dx - L.x)`. Copy the catalogue
    data for at least: resistor (span 4), led, electrolytic capacitor, transistor,
    button, potentiometer, DIP-8 ic, header 1x4, battery. The TS test checks these
    against the real catalogue, so a wrong copy fails there. No vector value is a
    fraction (the shared `Nodetto.Json` printer is Int-only).
  - `rotate` cases (20+ per turn direction, 200+ total): `in {fixture, x2, y2, turns,
    quarterTurns}`, `out ok {x2, y2, turns}`. Cover all four turns both ways,
    on-lattice and off-lattice anchors, negative coordinates, half-unit positions,
    `|x| <= 10^6` page units (B3).
- `formal/vectors/rotate.json`: generated, committed.

## Pitfalls

- Pin page position = `(x, y) + (cx, cy) + rotateVec turns (q - (cx, cy))`; rotation
  `(dx, dy) -> (-dy, dx)` per quarter turn (TS `rotatePoint`, y-down).
- `Int.fdiv` (floor), not `/` (Euclidean): they agree only for positive divisors;
  use `fdiv` as the design states.
- Stay inside B3: positions multiples of 0.5 page units.

## Acceptance criteria

- [x] `Nodetto.Rotate` builds; vectors are fresh, 200+ cases, 20+ per non-fixture fn.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Rotate > ../tmp/fv-s942/fv-14-rotate-model/build.log 2>&1`
2. `formal/scripts/audit --module Rotate --vectors > tmp/fv-s942/fv-14-rotate-model/audit.log 2>&1`
