import Std
namespace Nodetto.Fractional
abbrev Key := List Nat
abbrev Rng := List Nat
def DIGITS : List Nat := (List.range 10).map (· + 48) ++ (List.range 26).map (· + 65) ++ (List.range 26).map (· + 97)
/-- `packages/core/src/fractional.ts`: isFractionalKey. -/
def isFractionalKey (value : Key) : Bool :=
  !value.isEmpty && value.getLast? != some 48 && value.all (DIGITS.contains ·)
/-- `packages/core/src/fractional.ts`: randomDigitBetween, with B2 draws. -/
def randomDigitBetween (low high : Nat) (rng : Rng) : Nat × Rng :=
  let u := rng.headD 0
  let span := high - low - 1
  (low + 1 + min (u * span / 2^20) (span - 1), rng.drop 1)
/-- `packages/core/src/fractional.ts`: midpoint. -/
def midpoint (lower : Key) (upper : Option Key) (rng : Rng) : Except String (Key × Rng) := do
  if let some u := upper then
    if !(lower < u) then throw "range"
  match upper with
  | some (u :: us) =>
    if lower.headD 48 == u then
      let (tail, rest) ← midpoint lower.tail (some us) rng
      return (u :: tail, rest)
    else
      let low := match lower with | [] => 0 | x :: _ => DIGITS.idxOf x
      let high := DIGITS.idxOf u
      if high - low > 1 then
        let (d, rest) := randomDigitBetween low high rng
        return ([DIGITS.getD d 48], rest)
      else if !us.isEmpty then return ([u], rng)
      else
        let (tail, rest) ← midpoint lower.tail none rng
        return (DIGITS.getD low 48 :: tail, rest)
  | some [] => throw "range"
  | none =>
    match lower with
    | [] =>
      let (d, rest) := randomDigitBetween 0 62 rng
      return ([DIGITS.getD d 48], rest)
    | x :: xs =>
      let low := DIGITS.idxOf x
      if 62 - low > 1 then
        let (d, rest) := randomDigitBetween low 62 rng
        return ([DIGITS.getD d 48], rest)
      else
        let (tail, rest) ← midpoint xs none rng
        return (DIGITS.getD low 48 :: tail, rest)
termination_by lower.length + (upper.map List.length).getD 0
decreasing_by all_goals simp_wf; all_goals cases lower <;> simp_all [List.isEmpty] <;> omega
/-- `packages/core/src/fractional.ts`: keyBetween. -/
def keyBetween (before after : Option Key) (rng : Rng) : Except String (Key × Rng) := do
  if let some b := before then
    if !isFractionalKey b then throw "range"
  if let some a := after then
    if !isFractionalKey a then throw "range"
  midpoint (before.getD []) after rng
/-- `packages/core/src/fractional.ts`: keyAfter. -/
def keyAfter (last : Option Key) (rng : Rng) : Except String (Key × Rng) :=
  match last with
  | none => midpoint [] none rng
  | some s => if isFractionalKey s then midpoint s none rng else
    let (d, rest) := randomDigitBetween 0 62 rng
    .ok (s ++ [DIGITS.getD d 48], rest)
end Nodetto.Fractional
