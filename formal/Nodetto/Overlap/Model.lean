import Std

namespace Nodetto.Overlap

structure Box where
  minX : Int
  minY : Int
  maxX : Int
  maxY : Int
  deriving Repr, BEq, Inhabited
inductive Axis | x | y deriving Repr, BEq
inductive Branch | sweepX | sweepY | tree deriving Repr, BEq

def overlaps (a b : Box) : Bool :=
  decide (a.minX ≤ b.maxX) && decide (b.minX ≤ a.maxX) && decide (a.minY ≤ b.maxY) && decide (b.minY ≤ a.maxY)
def bruteForce (boxes : List Box) : List (Nat × Nat) :=
  (List.range boxes.length).flatMap fun i =>
    ((List.range boxes.length).filter fun j =>
      decide (i < j) && (match boxes[i]?, boxes[j]? with
        | some a, some b => overlaps a b
        | _, _ => false)).map fun j => (i, j)
def norm (p : Nat × Nat) : Nat × Nat := (min p.1 p.2, max p.1 p.2)

def lower (b : Box) (axis : Axis) : Int := if axis == .x then b.minX else b.minY
def upper (b : Box) (axis : Axis) : Int := if axis == .x then b.maxX else b.maxY

def sorted (boxes : List Box) (axis : Axis) : List (Nat × Box) :=
  (boxes.zipIdx.map fun (b, i) => (i, b)).mergeSort fun a b =>
    lower a.2 axis < lower b.2 axis || (lower a.2 axis == lower b.2 axis && a.1 ≤ b.1)

/-- Models the expiry count in packages/core/src/cad/loops.ts overlappingPairs. -/
def overlapCount (boxes : List Box) (axis : Axis) : Int :=
  let items := sorted boxes axis
  let ends := (items.map fun a => upper a.2 axis).mergeSort (· ≤ ·)
  (items.zipIdx.foldl (fun total (item, i) =>
    total + (i : Int) - ((ends.takeWhile (fun e => e < lower item.2 axis)).length : Int)) 0)

private def scan (a : Nat × Box) (axis : Axis) : List (Nat × Box) → List (Nat × Nat)
  | [] => []
  | b :: bs => if lower b.2 axis > upper a.2 axis then [] else
      (if overlaps a.2 b.2 then [(a.1, b.1)] else []) ++ scan a axis bs

private def sweepItems (axis : Axis) : List (Nat × Box) → List (Nat × Nat)
  | [] => []
  | a :: rest => scan a axis rest ++ sweepItems axis rest

/-- Models the ordered one-axis sweep in packages/core/src/cad/loops.ts overlappingPairs. -/
def sweep (boxes : List Box) (axis : Axis) : List (Nat × Nat) := sweepItems axis (sorted boxes axis)

private def maxOpt (a b : Option Int) : Option Int :=
  match a, b with
  | none, x => x
  | x, none => x
  | some x, some y => some (max x y)

private def updateUp : Nat → Array (Option Int) → Nat → Array (Option Int)
  | 0, tree, _ => tree
  | fuel + 1, tree, node =>
    if node ≤ 1 then tree else
      let parent := node / 2
      let tree := tree.set! parent (maxOpt (tree[parent * 2]!) (tree[parent * 2 + 1]!))
      updateUp fuel tree parent

private def update (size leaf : Nat) (value : Option Int) (tree : Array (Option Int)) : Array (Option Int) :=
  updateUp size (tree.set! (size + leaf) value) (size + leaf)

private def query : Nat → Array (Option Int) → Array (Nat × Box) → Box → Nat → Nat → Nat → Nat → List Nat
  | 0, _, _, _, _, _, _, _ => []
  | fuel + 1, tree, ys, a, limit, node, start, width =>
    if start ≥ limit || (match tree[node]! with | none => true | some m => m < a.minY) then []
    else if width ≤ 1 then
      match ys[start]? with
      | some (i, b) => if overlaps a b then [i] else []
      | none => []
    else
      let half := width / 2
      query fuel tree ys a limit (node * 2) start half ++
        query fuel tree ys a limit (node * 2 + 1) (start + half) half

private def powerSize (n : Nat) : Nat :=
  (List.range n).foldl (fun size _ => if size < n then size * 2 else size) 1

private def upperBound : Nat → Array (Nat × Box) → Int → Nat → Nat → Nat
  | 0, _, _, low, _ => low
  | fuel + 1, ys, value, low, high =>
    if low < high then
      let mid := (low + high) / 2
      if (ys[mid]!).2.minY ≤ value then upperBound fuel ys value (mid + 1) high
      else upperBound fuel ys value low mid
    else low

/-- Models the segment tree and expiry sweep in packages/core/src/cad/loops.ts overlappingPairs. -/
def treeSearch (boxes : List Box) : List (Nat × Nat) := Id.run do
  let xs := sorted boxes .x
  let ys := (sorted boxes .y).toArray
  let ends := (boxes.zipIdx.map fun (b, i) => (i, b)).mergeSort fun a b =>
    a.2.maxX < b.2.maxX || (a.2.maxX == b.2.maxX && a.1 ≤ b.1)
  let size := powerSize boxes.length
  let mut tree : Array (Option Int) := Array.replicate (size * 2) none
  let mut expired := 0
  let mut visits := []
  for (index, a) in xs do
    for (old, b) in ends.drop expired do
      if b.maxX < a.minX then
        if let some leaf := ys.toList.findIdx? (fun e => e.1 == old) then
          tree := update size leaf none tree
        expired := expired + 1
      else break
    let limit := upperBound (ys.size + 1) ys a.maxY 0 ys.size
    visits := visits ++ (query (size + 1) tree ys a limit 1 0 size).map (fun other => (other, index))
    if let some leaf := ys.toList.findIdx? (fun e => e.1 == index) then
      tree := update size leaf (some a.maxY) tree
  return visits

/-- Models branch selection in packages/core/src/cad/loops.ts overlappingPairs. -/
def overlappingPairs (boxes : List Box) : Branch × List (Nat × Nat) :=
  let x := overlapCount boxes .x
  let y := overlapCount boxes .y
  if min x y ≤ (boxes.length * 8 : Nat) then
    if x ≤ y then (.sweepX, sweep boxes .x) else (.sweepY, sweep boxes .y)
  else (.tree, treeSearch boxes)
end Nodetto.Overlap
