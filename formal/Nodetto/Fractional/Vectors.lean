import Nodetto.Json
import Nodetto.Fractional.Model
open Nodetto.Fractional Nodetto.Json

def units (s : String) : Key := s.toList.map Char.toNat
def keys : List (Option Key) := [none] ++ (["", "0", "1", "9", "A", "Z", "a", "z", "10", "11", "101", "1z", "zz", "!", "foreign", "00", "z1", "999", "A0", "AA"].map (some ∘ units))
def opt (v : Option Key) : Value := v.elim .null Value.str
def draws : List Rng := [[], [0], [1048575], [524288], [0, 1048575], [1048575, 0]]
def drawJson (r : Rng) : Value := .arr (r.map (fun n => .num (Int.ofNat n)))
def result (r : Except String (Key × Rng)) : Value :=
  match r with | .ok (v, _) => ok (.str v) | .error _ => err "range"
def cases : List (String × Value × Value) :=
  (keys.drop 1 |>.flatMap fun k => draws.map fun _ =>
    ("isFractionalKey", .obj [("value", opt k)], ok (.bool (isFractionalKey (k.getD []))))) ++
  (keys.flatMap fun a => keys.flatMap fun b => draws.map fun r =>
    ("keyBetween", .obj [("before", opt a), ("after", opt b), ("draws", drawJson r)], result (keyBetween a b r))) ++
  (keys.flatMap fun k => draws.map fun r =>
    ("keyAfter", .obj [("last", opt k), ("draws", drawJson r)], result (keyAfter k r)))
def main : IO Unit := IO.print (document "fractional" ["packages/core/src/fractional.ts"] "vectors-fractional" cases)
