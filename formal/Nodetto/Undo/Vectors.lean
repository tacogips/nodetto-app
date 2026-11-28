import Nodetto.Undo.Model
import Nodetto.Json

open Nodetto.Undo Nodetto.Json

private def str (s : String) : Value := ofAscii s
private def strings (xs : List String) : Value := .arr (xs.map str)
private def enc (s : String) : Value := (ofE s).getD .null
private def cmdJson : Cmd → Value
  | .create id v => .obj [("type", str "create"), ("id", enc id), ("value", .num v)]
  | .delete ids => .obj [("type", str "delete"), ("ids", .arr (ids.map enc))]
  | .update id v => .obj [("type", str "update"), ("id", enc id), ("value", .num v)]
private def storeJson (s : Store) : Value :=
  .arr ((s.mergeSort (fun a b => a.1 ≤ b.1)).map fun p => .arr [enc p.1, .num p.2])

private inductive Op where
  | push (e : Entry String) | begin | finish | abort | undo | redo | clear
private def opJson : Op → Value
  | .push e => .obj [("op", str "push"), ("undo", strings e.undo), ("redo", strings e.redo)]
  | .begin => .obj [("op", str "begin")]
  | .finish => .obj [("op", str "end")]
  | .abort => .obj [("op", str "abort")]
  | .undo => .obj [("op", str "undo")]
  | .redo => .obj [("op", str "redo")]
  | .clear => .obj [("op", str "clear")]
private def step (h : History String) (op : Op) : History String × Option (List String) :=
  match op with
  | .push e => (h.push e, none)
  | .begin => (h.beginBatch, none)
  | .finish => (h.endBatch, none)
  | .abort => h.abortBatch
  | .undo => match h.undo with | none => (h, none) | some (xs, next) => (next, some xs)
  | .redo => match h.redo with | none => (h, none) | some (xs, next) => (next, some xs)
  | .clear => (h.clear, none)
private def historyCase (n : Nat) : String × Value × Value := Id.run do
  let limit := [0, 1, 3][n % 3]!
  let e : Entry String := ⟨[s!"u{n}"], [s!"r{n}"]⟩
  let empty : Entry String := ⟨[], ["ignored"]⟩
  let ops : List Op := match n % 5 with
    | 0 => [.undo, .redo, .push e, .undo, .redo, .clear]
    | 1 => [.begin, .push e, .begin, .push e, .finish, .abort, .undo]
    | 2 => [.push e, .undo, .push e, .redo, .undo]
    | 3 => [.begin, .push empty, .finish, .abort, .clear]
    | _ => [.begin, .push e, .begin, .abort, .finish, .undo, .redo]
  let mut h : History String := ⟨[], [], 0, none, limit⟩
  let mut results := []
  for op in ops do
    let (next, ran) := step h op
    h := next
    results := results ++ [.obj [("ran", ran.map strings |>.getD .null),
      ("undoSize", .num h.undoStack.length), ("redoSize", .num h.redoStack.length),
      ("batching", .bool (h.depth > 0))]]
  return ("history", .obj [("limit", .num limit), ("ops", .arr (ops.map opJson))], ok (.arr results))
private def storeCase (n : Nat) : String × Value × Value :=
  let a := "0061"
  let b := "0062"
  let v : Int := n
  let store : Store := if n % 2 == 0 then [(a, v), (b, v + 1)] else [(a, v)]
  let commands : List Cmd := match n % 8 with
    | 0 => [.delete [b, a, b, "0063"]]
    | 1 => [.create b v, .update a (v + 2)]
    | 2 => [.create a v]
    | 3 => [.update b v]
    | 4 => [.delete ["0063"]]
    | 5 => [.delete [a], .create a (v + 3)]
    | 6 => [.update a (v + 1), .delete [a, b]]
    | _ => []
  let output := match applyCommands store commands with
    | .error _ => err "command"
    | .ok (s, undo) => ok (.obj [("store", storeJson s), ("undo", .arr (undo.map cmdJson))])
  ("applyCommands", .obj [("store", storeJson store), ("commands", .arr (commands.map cmdJson))], output)

def main : IO Unit := do
  IO.print (document "undo" ["packages/core/src/history.ts", "packages/core/src/commands.ts"]
    "formal/Nodetto/Undo/Vectors.lean" ((List.range 120).map historyCase ++ (List.range 120).map storeCase))
