namespace Nodetto.Rotate

structure Geometry where
  cx : Int
  cy : Int
  pins : List (Int × Int)
  deriving Repr, BEq

structure Part where
  x : Int
  y : Int
  turns : Fin 4
  deriving Repr, BEq

inductive Turn where
  | cw | ccw
  deriving Repr, BEq

/-- `packages/core/src/geometry.ts` rotatePoint for quarter turns. -/
def rotateVec (t : Fin 4) (v : Int × Int) : Int × Int :=
  match t.val with
  | 0 => v
  | 1 => (-v.2, v.1)
  | 2 => (-v.1, -v.2)
  | _ => (v.2, -v.1)

/-- `packages/core/src/breadboard/catalogue.ts` breadboardPins. -/
def pinPositions (g : Geometry) (p : Part) : List (Int × Int) :=
  g.pins.map fun q =>
    let v := rotateVec p.turns (q.1 - g.cx, q.2 - g.cy)
    (p.x + g.cx + v.1, p.y + g.cy + v.2)

def anchor (g : Geometry) (p : Part) : Option (Int × Int) := (pinPositions g p).head?

/-- `packages/core/src/breadboard/snap.ts` snapBreadboardPoint coordinate. -/
def snap (v : Int) : Int := Int.fdiv (v + 10) 20 * 20

def snapPoint (v : Int × Int) : Int × Int := (snap v.1, snap v.2)
def OnLattice (v : Int × Int) : Prop := (20 : Int) ∣ v.1 ∧ (20 : Int) ∣ v.2
def PinsOnPitch (g : Geometry) : Prop :=
  ∀ q0 ∈ g.pins.head?, ∀ q ∈ g.pins, (20 : Int) ∣ q.1 - q0.1 ∧ (20 : Int) ∣ q.2 - q0.2

/-- `packages/core/src/breadboard/rotate.ts` planBreadboardRotation for one part. -/
def rotate (g : Geometry) (p : Part) (t : Turn) : Option Part := do
  let first ← anchor g p
  let turns : Fin 4 := match t with
    | .cw => p.turns + 1
    | .ccw => p.turns + 3
  let next ← anchor g { p with turns := turns }
  let fixed := snapPoint first
  pure { x := p.x + fixed.1 - next.1, y := p.y + fixed.2 - next.2, turns := turns }

end Nodetto.Rotate
