import Nodetto.Rotate.Model
import Nodetto.Json

open Nodetto.Rotate Nodetto.Json

structure Fixture where
  name : String
  semantic : Value
  x : Int
  y : Int
  w : Int
  h : Int
  pins : List (Int × Int)

private def n (x : Int) : Value := .num x
private def s (x : String) : Value := ofAscii x
private def point (p : Int × Int) : Value := .arr [n p.1, n p.2]
private def obj (xs : List (String × Value)) : Value := .obj xs

private def fixtures : List Fixture := [
  ⟨"resistor", obj [("reference", s "R?"), ("value", s "220"), ("span", n 4), ("bands", n 4)], -1, -1, 10, 2, [(0,0),(8,0)]⟩,
  ⟨"led", obj [("reference", s "D?"), ("value", s "red"), ("color", s "red")], -1, -2, 4, 4, [(0,0),(2,0)]⟩,
  ⟨"capacitor", obj [("reference", s "C?"), ("value", s "100n"), ("style", s "electrolytic"), ("span", n 2)], -1, -2, 6, 4, [(0,0),(4,0)]⟩,
  ⟨"transistor", obj [("reference", s "Q?"), ("value", s "NPN"), ("polarity", s "npn"), ("pinout", s "EBC")], -1, -2, 6, 3, [(0,0),(2,0),(4,0)]⟩,
  ⟨"button", obj [("reference", s "SW?"), ("value", s "PUSH")], -1, -1, 6, 8, [(0,0),(0,6),(4,0),(4,6)]⟩,
  ⟨"potentiometer", obj [("reference", s "RV?"), ("value", s "10k")], -1, -4, 6, 5, [(0,0),(2,0),(4,0)]⟩,
  ⟨"ic", obj [("reference", s "U?"), ("value", s "IC"), ("pinCount", n 8)], -1, -7, 8, 8, [(0,0),(2,0),(4,0),(6,0),(6,-6),(4,-6),(2,-6),(0,-6)]⟩,
  ⟨"header", obj [("reference", s "J?"), ("value", s "HEADER"), ("pinCount", n 4)], -1, -1, 8, 2, [(0,0),(2,0),(4,0),(6,0)]⟩,
  ⟨"battery", obj [("reference", s "BT?"), ("value", s "5V")], -6, -3, 7, 4, [(0,0),(0,-2)]⟩]

private def geometry (f : Fixture) : Geometry :=
  ⟨5 * f.w, 5 * f.h, f.pins.map fun p => (10 * (p.1 - f.x), 10 * (p.2 - f.y))⟩

private def fixtureCase (f : Fixture) : String × Value × Value :=
  let g := geometry f
  ("fixture", obj [("type", s ("breadboard." ++ f.name)), ("semantic", f.semantic),
    ("localBox2", obj [("x", n f.x), ("y", n f.y), ("width", n f.w), ("height", n f.h)]),
    ("pinDefs2", .arr (f.pins.map point))],
    ok (obj [("cx", n g.cx), ("cy", n g.cy), ("pins", .arr (g.pins.map point))]))

private def rotateCase (f : Fixture) (i : Nat) : String × Value × Value :=
  let x0 : Int := (Int.ofNat (i % 23) - 11) * 13
  let y0 : Int := (Int.ofNat (i % 17) - 8) * 19
  let turns : Fin 4 := ⟨i % 4, Nat.mod_lt _ (by decide)⟩
  let a := (anchor (geometry f) ⟨x0, y0, turns⟩).getD (0, 0)
  let x := if i < 8 then x0 + snap a.1 - a.1 else x0
  let y := if i < 8 then y0 + snap a.2 - a.2 else y0
  let clockwise := (i / 4) % 2 == 0
  let t := if clockwise then Turn.cw else Turn.ccw
  let output := match rotate (geometry f) ⟨x, y, turns⟩ t with
    | none => .null
    | some p => obj [("x2", n p.x), ("y2", n p.y), ("turns", n p.turns.val)]
  ("rotate", obj [("fixture", s f.name), ("x2", n x), ("y2", n y),
    ("turns", n turns.val), ("quarterTurns", n (if clockwise then 1 else -1))], ok output)

def main : IO Unit := do
  let cases := fixtures.map fixtureCase ++ fixtures.flatMap fun f => (List.range 32).map (rotateCase f)
  IO.print (document "rotate" ["packages/core/src/breadboard/rotate.ts",
    "packages/core/src/breadboard/catalogue.ts", "packages/core/src/breadboard/snap.ts"]
    "formal/Nodetto/Rotate/Vectors.lean" cases)
