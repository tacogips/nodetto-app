import Nodetto.ZOrder.Model
import Nodetto.Json
open Nodetto.ZOrder Nodetto.Fractional Nodetto.Json

private def ids : List ElemId := ["0061", "0062", "0063", "0064"]
private def idJson (id : ElemId) : Value := (ofE id).getD .null
private def idsJson (xs : List ElemId) : Value := .arr (xs.map idJson)
private def keyJson (key : Key) : Value := .str key
private def elementsJson (xs : List (ElemId × Key)) : Value :=
  .arr (xs.map fun (id, key) => .arr [idJson id, keyJson key])
private def actionName : Action → String
  | .front => "front" | .forward => "forward" | .backward => "backward" | .back => "back"
private def subsets : List (List ElemId) :=
  (List.range 16).map fun n => (ids.zipIdx).filterMap fun (id, i) =>
    if n / (2 ^ i) % 2 == 1 then some id else none
private def orders : List (List ElemId) :=
  [[], ["0061"], ["0061", "0062"], ids, ids.reverse,
   ["0062", "0061", "0064", "0063"]]
private def targetCase (order selected : List ElemId) (action : Action) : String × Value × Value :=
  ("targetOrder", .obj [("ordered", idsJson order), ("selected", idsJson selected),
    ("action", ofAscii (actionName action))], ok (idsJson (targetOrder order selected.contains action)))
private def relativeCase (order moved anchors : List ElemId) (side : Side) : String × Value × Value :=
  let name := match side with | .before => "before" | .after => "after"
  ("relativeOrder", .obj [("ordered", idsJson order), ("moved", idsJson moved),
    ("anchorBlock", idsJson anchors), ("side", ofAscii name)],
    ok (idsJson (relativeOrder order moved.contains anchors.contains side)))
private def reorderCase (elements : List (ElemId × Key)) (order : List ElemId) (draws : Rng) : String × Value × Value :=
  let result := match reorderCommands elements order draws with
    | .ok (cmds, _) => ok (.arr (cmds.map fun c => .arr [idJson c.id, keyJson c.index]))
    | .error e => err e
  ("reorderCommands", .obj [("elements", elementsJson elements), ("order", idsJson order),
    ("draws", .arr (draws.map fun n => .num (Int.ofNat n)))], result)

def main : IO Unit := do
  let targets := orders.flatMap fun order => subsets.flatMap fun selected =>
    [Action.front, .forward, .backward, .back].map (targetCase order selected)
  let relatives := orders.flatMap fun order => subsets.flatMap fun moved =>
    subsets.flatMap fun anchors => [Side.before, .after].map (relativeCase order moved anchors)
  let sets : List (List (ElemId × Key)) :=
    [[], [("0061", [65])], [("0061", [65]), ("0062", [66])],
     [("0061", [65]), ("0062", [65])], [("0061", [122,122,33]), ("0062", [66])],
     [("0061", [65]), ("0062", [65,66]), ("0063", [66]), ("0064", [67])]]
  let reorders := sets.flatMap fun es =>
    (orders ++ [["0061", "0061"], ["0061", "0078"], ["0062", "0061"]]).flatMap fun order =>
      [[], [0], [524288, 0, 1048575, 0]].map (reorderCase es order)
  IO.print (document "z-order" ["packages/core/src/z-order.ts", "packages/core/src/fractional.ts"]
    "formal/Nodetto/ZOrder/Vectors.lean" (targets ++ relatives ++ reorders))
