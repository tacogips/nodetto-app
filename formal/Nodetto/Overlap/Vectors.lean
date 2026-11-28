import Nodetto.Json
import Nodetto.Overlap.Model

namespace Nodetto.Overlap.Vectors
open Nodetto.Json
open Nodetto.Overlap

private def boxJson (b : Box) : Value :=
  .arr [.num b.minX, .num b.minY, .num b.maxX, .num b.maxY]

private def caseJson (boxes : List Box) : String × Value × Value :=
  let (branch, visits) := overlappingPairs boxes
  let tree := match branch with | .tree => true | _ => false
  ("overlappingPairs", .obj [("boxes", .arr (boxes.map boxJson))],
    ok (.obj [("tree", .bool tree), ("visits", .arr (visits.map fun (i, j) =>
      .arr [.num (Int.ofNat i), .num (Int.ofNat j)]))]))

private def shift (n : Nat) (boxes : List Box) : List Box :=
  let d : Int := Int.ofNat n - 10
  boxes.map fun b => ⟨b.minX + d, b.minY - d, b.maxX + d, b.maxY - d⟩

-- All three fixtures change visit order when the other sweep axis is chosen.
private def xFixture : List Box := [⟨0, 2, 3, 20⟩, ⟨1, 1, 4, 20⟩, ⟨10, 0, 12, 20⟩]
private def yFixture : List Box := [⟨2, 0, 20, 3⟩, ⟨1, 1, 20, 4⟩, ⟨0, 10, 20, 12⟩]
private def tieFixture : List Box := [⟨0, 2, 20, 20⟩, ⟨1, 1, 20, 20⟩, ⟨2, 0, 20, 20⟩]

private def crowded (seed : Nat) : List Box :=
  (List.range (20 + seed % 5)).map fun i =>
    let x : Int := Int.ofNat ((i * 7 + seed) % 5) - 2
    let y : Int := Int.ofNat ((i * 3 + seed) % 5) - 2
    ⟨x, y, x + 8, y + 8⟩

private def crowdedMixed (seed : Nat) : List Box :=
  let cluster := (List.range 26).map fun i =>
    let x : Int := 18 + Int.ofNat ((i * 7 + seed) % 5)
    let y : Int := 18 + Int.ofNat ((i * 3 + seed) % 5)
    (⟨x, y, x + 8, y + 8⟩ : Box)
  cluster ++ [⟨0, 20, 5, 28⟩, ⟨10, 20, 18, 28⟩,
    ⟨20, 40, 28, 45⟩, ⟨20, 0, 28, 5⟩,
    ⟨29, 29, 40, 40⟩, ⟨40, 20, 39, 28⟩]

private def randomBoxes (seed : Nat) : List Box :=
  (List.range (seed % 7)).map fun i =>
    let s := Nodetto.Json.lcg (seed * 11 + i * 7919)
    let x : Int := Int.ofNat (s % 21) - 10
    let y : Int := Int.ofNat ((s / 31) % 21) - 10
    let w : Int := Int.ofNat ((s / 997) % 9) - 2
    let h : Int := Int.ofNat ((s / 8191) % 9) - 2
    ⟨x, y, x + w, y + h⟩

private def special : List (List Box) := [
  [], [⟨0, 0, 0, 0⟩],
  [⟨0, 0, 1, 1⟩, ⟨1, 1, 2, 2⟩],
  [⟨-2, -2, 2, 2⟩, ⟨-2, -2, 2, 2⟩],
  [⟨2, 1, 1, 0⟩, ⟨-4, -4, 4, 4⟩],
  [⟨-8, -5, -2, -1⟩, ⟨-2, -1, 1, 4⟩]]

private def fixtures (f : List Box) : List (List Box) :=
  (List.range 21).map fun n => shift n f

private def branchIs (boxes : List Box) (wanted : Branch) : Bool :=
  match (overlappingPairs boxes).1, wanted with
  | .sweepX, .sweepX | .sweepY, .sweepY | .tree, .tree => true
  | _, _ => false

private def discriminates (boxes : List Box) : Bool :=
  sweep boxes .x != sweep boxes .y

private def matchesBrute (boxes : List Box) : Bool :=
  let visits := (overlappingPairs boxes).2.map norm
  let expected := bruteForce boxes
  visits.length == expected.length && expected.all (fun p => visits.contains p)

private def mixedValid (boxes : List Box) : Bool :=
  branchIs boxes .tree &&
    boxes.any (fun p => boxes.any (fun q => q.maxX < p.minX)) &&
    boxes.any (fun p => boxes.any (fun q => q.maxY < p.minY)) &&
    (overlappingPairs boxes).2.length < boxes.length * (boxes.length - 1) / 2 &&
    matchesBrute boxes

def main : IO Unit := do
  let xs := fixtures xFixture
  let ys := fixtures yFixture
  let ties := fixtures tieFixture
  let trees := (List.range 24).map crowded
  let mixed := (List.range 6).map crowdedMixed
  unless xs.all (fun b => branchIs b .sweepX && discriminates b && overlapCount b .x < overlapCount b .y) &&
      ys.all (fun b => branchIs b .sweepY && discriminates b && overlapCount b .y < overlapCount b .x) &&
      ties.all (fun b => branchIs b .sweepX && discriminates b && overlapCount b .x == overlapCount b .y) &&
      trees.all (fun b => branchIs b .tree) &&
      trees.all matchesBrute && mixed.all mixedValid do
    throw (IO.userError "overlap fixture branch or axis discrimination failed")
  let cases := special ++ xs ++ ys ++ ties ++ trees ++ mixed ++ (List.range 120).map randomBoxes
  IO.print (document "overlap" ["packages/core/src/cad/loops.ts"]
    "formal/Nodetto/Overlap/Vectors.lean" (cases.map caseJson))

end Nodetto.Overlap.Vectors

def main : IO Unit := Nodetto.Overlap.Vectors.main
