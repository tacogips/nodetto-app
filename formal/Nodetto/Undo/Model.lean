namespace Nodetto.Undo

structure Entry (C : Type) where
  undo : List C
  redo : List C
  deriving Repr, DecidableEq

structure History (C : Type) where
  undoStack : List (Entry C)
  redoStack : List (Entry C)
  depth : Nat
  pending : Option (Entry C)
  limit : Nat
  deriving Repr, DecidableEq

/-- packages/core/src/history.ts History.commit -/
def History.commit {C : Type} (h : History C) (e : Entry C) : History C :=
  { h with undoStack := (e :: h.undoStack).take h.limit, redoStack := [] }

/-- packages/core/src/history.ts History.push -/
def History.push {C : Type} (h : History C) (e : Entry C) : History C :=
  if e.undo.isEmpty then h
  else if h.depth > 0 then
    { h with pending := some (match h.pending with
      | none => e
      | some p => ⟨e.undo ++ p.undo, p.redo ++ e.redo⟩) }
  else h.commit e

/-- packages/core/src/history.ts History.beginBatch -/
def History.beginBatch {C : Type} (h : History C) : History C := { h with depth := h.depth + 1 }

/-- packages/core/src/history.ts History.endBatch -/
def History.endBatch {C : Type} (h : History C) : History C :=
  if h.depth = 0 then h
  else if h.depth > 1 then { h with depth := h.depth - 1 }
  else
    let next := { h with depth := 0, pending := none }
    match h.pending with
    | none => next
    | some e => next.commit e

/-- packages/core/src/history.ts History.abortBatch -/
def History.abortBatch {C : Type} (h : History C) : History C × Option (List C) :=
  if h.depth = 0 then (h, none)
  else if h.depth > 1 then ({ h with depth := h.depth - 1 }, none)
  else ({ h with depth := 0, pending := none }, h.pending.map Entry.undo)

/-- packages/core/src/history.ts History.undo -/
def History.undo {C : Type} (h : History C) : Option (List C × History C) :=
  match h.undoStack with
  | [] => none
  | e :: rest => some (e.undo, { h with undoStack := rest, redoStack := e :: h.redoStack })

/-- packages/core/src/history.ts History.redo -/
def History.redo {C : Type} (h : History C) : Option (List C × History C) :=
  match h.redoStack with
  | [] => none
  | e :: rest => some (e.redo, { h with redoStack := rest, undoStack := e :: h.undoStack })

/-- packages/core/src/history.ts History.clear -/
def History.clear {C : Type} (h : History C) : History C :=
  { h with undoStack := [], redoStack := [], depth := 0, pending := none }

def nonEmpty {C : Type} (es : List (Entry C)) : List (Entry C) := es.filter (fun e => !e.undo.isEmpty)
def Inverts {C D : Type} (run : List C → D → D) (e : Entry C) : Prop := ∀ d, run e.undo (run e.redo d) = d

abbrev ElemId := String
abbrev Store := List (ElemId × Int)
inductive Cmd where
  | create (id : ElemId) (value : Int)
  | delete (ids : List ElemId)
  | update (id : ElemId) (value : Int)
  deriving Repr, DecidableEq

/-- packages/core/src/commands.ts applyCommands working-store lookup -/
def lookup (s : Store) (id : ElemId) : Option Int := (s.find? fun p => p.1 == id).map Prod.snd

/-- packages/core/src/commands.ts applyCommands: createElement, deleteElements and replaceVisual. -/
def applyCommands (s : Store) (cs : List Cmd) : Except String (Store × List Cmd) :=
  cs.foldlM (fun (state : Store × List Cmd) c => do
    let (store, undo) := state
    match c with
    | .create id value =>
      if (lookup store id).isSome then throw "command"
      else pure ((id, value) :: store, .delete [id] :: undo)
    | .update id value =>
      match lookup store id with
      | none => throw "command"
      | some old => pure ((id, value) :: store.filter (fun p => p.1 != id), .update id old :: undo)
    | .delete ids =>
      let removed := (ids.eraseDups.filterMap fun id => (lookup store id).map fun v => (id, v)).mergeSort (fun a b => a.1 ≤ b.1)
      let remaining := store.filter fun p => !ids.contains p.1
      pure (remaining, removed.map (fun p => .create p.1 p.2) ++ undo)
  ) (s, [])

end Nodetto.Undo
