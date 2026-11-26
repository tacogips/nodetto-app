import Nodetto.Fractional.Model
namespace Nodetto.ZOrder
open Nodetto.Fractional
abbrev ElemId := String
inductive Action | front | forward | backward | back
inductive Side | before | after
structure Reorder where
  id : ElemId
  index : Key
  deriving Repr

/-- `packages/core/src/z-order.ts`: targetOrder's adjacent swap. -/
def swapAt (xs : List ElemId) (pos : Nat) : List ElemId :=
  match xs[pos]?, xs[pos + 1]? with
  | some a, some b => (xs.take pos) ++ [b, a] ++ xs.drop (pos + 2)
  | _, _ => xs

/-- `packages/core/src/z-order.ts`: targetOrder. -/
def targetOrder (ordered : List ElemId) (selected : ElemId → Bool) (action : Action) : List ElemId :=
  let picked := ordered.filter selected
  let rest := ordered.filter (fun id => !selected id)
  match action with
  | .front => rest ++ picked
  | .back => picked ++ rest
  | .forward => ((List.range (ordered.length - 1)).reverse).foldl (fun xs pos =>
      match xs[pos]?, xs[pos + 1]? with
      | some a, some b => if selected a && !selected b then swapAt xs pos else xs
      | _, _ => xs) ordered
  | .backward => (List.range (ordered.length - 1)).foldl (fun xs pos =>
      match xs[pos]?, xs[pos + 1]? with
      | some a, some b => if !selected a && selected b then swapAt xs pos else xs
      | _, _ => xs) ordered

/-- `packages/core/src/z-order.ts`: relativeOrder. -/
def relativeOrder (ordered : List ElemId) (moved anchorBlock : ElemId → Bool) (side : Side) : List ElemId :=
  let picked := ordered.filter moved
  let rest := ordered.filter (fun id => !moved id)
  let positions := (rest.zipIdx).filter (fun x => anchorBlock x.1) |>.map Prod.snd
  match positions with
  | [] => ordered
  | first :: tail =>
    let pos := match side with
      | .before => first
      | .after => (tail.getLast?.getD first) + 1
    rest.take pos ++ picked ++ rest.drop pos

/-- `packages/core/src/z-order.ts`: reorderCommands target selection. -/
def targetIds (elements : List (ElemId × Key)) (order : List ElemId) : List ElemId :=
  order.filter (fun id => elements.any (fun e => e.1 == id))

/-- `packages/core/src/commands.ts`: apply reorder commands in sequence. -/
def applyReorders (elements : List (ElemId × Key)) (cmds : List Reorder) : List (ElemId × Key) :=
  cmds.foldl (fun es c => es.map (fun e => if e.1 == c.id then (e.1, c.index) else e)) elements

def keyOf (elements : List (ElemId × Key)) (id : ElemId) : Key :=
  ((elements.find? (fun e => e.1 == id)).map Prod.snd).getD []
/-- `packages/core/src/z-order.ts`: renumber. -/
def renumber (order : List ElemId) (rng : Rng) : Except String (List Reorder × Rng) := do
  let (_, cmds, state) ← order.foldlM (fun (prev, cmds, state) id => do
    let (key, state') ← keyAfter prev state
    pure (some key, cmds ++ [⟨id, key⟩], state')) (none, [], rng)
  pure (cmds, state)

/-- `packages/core/src/z-order.ts`: reorderCommands, including D3 duplicate refusal. -/
def reorderCommands (elements : List (ElemId × Key)) (order : List ElemId) (rng : Rng) :
    Except String (List Reorder × Rng) := do
  let target := targetIds elements order
  if target.length != elements.length || target.eraseDups.length != target.length ||
      target == elements.map Prod.fst then
    return ([], rng)
  let keys := elements.map Prod.snd
  if !(keys.all isFractionalKey) || keys.eraseDups.length != keys.length then
    return ← renumber target rng
  let (_, moved) := target.foldl (fun (highest, moved) id =>
    let key := keyOf elements id
    match highest with
    | none => (some key, moved)
    | some h => if h < key then (some key, moved) else (highest, moved ++ [id])) (none, [])
  -- The loop carries the draw state so that the fallback starts after prior draws.
  let rec loop (rest : List ElemId) (done : List (ElemId × Key)) (cmds : List Reorder)
      (state : Rng) : Except String (List Reorder × Rng) := do
    match rest with
    | [] => return (cmds, state)
    | id :: tail =>
      if !moved.contains id then
        loop tail (done ++ [(id, keyOf elements id)]) cmds state
      else
        let below := done.getLast?.map Prod.snd
        let above := (tail.find? (fun next => !moved.contains next)).map (keyOf elements)
        if let (some b, some a) := (below, above) then
          if !(b < a) then return ← renumber target state
        let (key, state') ← keyBetween below above state
        loop tail (done ++ [(id, key)]) (cmds ++ [⟨id, key⟩]) state'
  loop target [] [] rng
end Nodetto.ZOrder
