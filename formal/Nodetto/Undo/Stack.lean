import Nodetto.Undo.Model

namespace Nodetto.Undo

theorem undo_then_redo {C : Type} (h : History C) (e : Entry C) (rest : List (Entry C))
    (hu : h.undoStack = e :: rest) :
    ∃ h1, h.undo = some (e.undo, h1) ∧ h1.redo = some (e.redo, h) := by
  cases h with
  | mk us rs depth pending limit =>
    simp only at hu
    subst us
    simp [History.undo, History.redo]

theorem redo_then_undo {C : Type} (h : History C) (e : Entry C) (rest : List (Entry C))
    (hr : h.redoStack = e :: rest) :
    ∃ h1, h.redo = some (e.redo, h1) ∧ h1.undo = some (e.undo, h) := by
  cases h with
  | mk us rs depth pending limit =>
    simp only at hr
    subst rs
    simp [History.undo, History.redo]

theorem push_clears_redo {C : Type} (h : History C) (e : Entry C)
    (hne : e.undo ≠ []) (hd : h.depth = 0) :
    h.push e = { h with undoStack := (e :: h.undoStack).take h.limit, redoStack := [] } := by
  simp [History.push, History.commit, hne, hd]

theorem push_empty {C : Type} (h : History C) (e : Entry C) (he : e.undo = []) :
    h.push e = h := by
  simp [History.push, he]

theorem abortBatch_keeps_stacks {C : Type} (h : History C) :
    h.abortBatch.1.undoStack = h.undoStack ∧ h.abortBatch.1.redoStack = h.redoStack := by
  simp only [History.abortBatch]
  split <;> simp_all
  split <;> simp_all

theorem batch_inverts {C D : Type} (run : List C → D → D)
    (hnil : ∀ d, run [] d = d) (hrun : ∀ xs ys d, run (xs ++ ys) d = run ys (run xs d))
    (es : List (Entry C)) (h : ∀ e ∈ es, Inverts run e) :
    Inverts run (Entry.mk (es.reverse.flatMap Entry.undo) (es.flatMap Entry.redo)) := by
  induction es with
  | nil => simp [Inverts, hnil]
  | cons e es ih =>
    have he : Inverts run e := h e (by simp)
    have ht : Inverts run (Entry.mk (es.reverse.flatMap Entry.undo) (es.flatMap Entry.redo)) :=
      ih (by intro x hx; exact h x (by simp [hx]))
    intro d
    simp only [List.reverse_cons, List.flatMap_append, List.flatMap_cons,
      List.flatMap_nil, List.append_nil, Entry.undo, Entry.redo, hrun]
    change run e.undo (run (es.reverse.flatMap Entry.undo) (run (es.flatMap Entry.redo) (run e.redo d))) = d
    rw [ht (run e.redo d)]
    exact he d

private theorem snoc_induction {α : Type} (P : List α → Prop)
    (base : P []) (step : ∀ xs x, P xs → P (xs ++ [x])) (xs : List α) : P xs := by
  have aux : ∀ ys : List α, P ys.reverse := by
    intro ys
    induction ys with
    | nil => exact base
    | cons y ys ih => simpa using step ys.reverse y ih
  simpa using aux xs.reverse

private theorem fold_batch {C : Type} (h : History C) (es : List (Entry C))
    (hd : h.depth = 1) (hp : h.pending = none) :
    es.foldl History.push h =
      { h with pending := (if (nonEmpty es).isEmpty then none else
        some (Entry.mk ((nonEmpty es).reverse.flatMap Entry.undo) ((nonEmpty es).flatMap Entry.redo))) } := by
  induction es using snoc_induction with
  | base => cases h; simp_all [nonEmpty]
  | step es e ih =>
    rw [List.foldl_append, ih]
    have ha : nonEmpty (es ++ [e]) = nonEmpty es ++ (if e.undo.isEmpty then [] else [e]) := by
      cases hx : e.undo <;> simp [nonEmpty, hx]
    rw [ha]
    by_cases he : e.undo = []
    · simp [he, History.push, hd]
    · by_cases hn : nonEmpty es = []
      · simp [he, hn, History.push, hd]
      · cases hs : nonEmpty es with
        | nil => contradiction
        | cons a as => simp [he, hs, History.push, hd]

theorem batch_one_step {C : Type} (h : History C) (es : List (Entry C))
    (hd : h.depth = 0) (hp : h.pending = none) (hne : nonEmpty es ≠ []) :
    (es.foldl History.push h.beginBatch).endBatch =
      { h with
        undoStack := (Entry.mk ((nonEmpty es).reverse.flatMap Entry.undo)
          ((nonEmpty es).flatMap Entry.redo) :: h.undoStack).take h.limit,
        redoStack := [] } := by
  rw [fold_batch h.beginBatch es (by simp [History.beginBatch, hd]) (by simp [History.beginBatch, hp])]
  cases hs : nonEmpty es with
  | nil => contradiction
  | cons a as => cases h; simp_all [History.beginBatch, History.endBatch, History.commit]

theorem batch_noop {C : Type} (h : History C) (es : List (Entry C))
    (hd : h.depth = 0) (hp : h.pending = none) (hall : nonEmpty es = []) :
    (es.foldl History.push h.beginBatch).endBatch = h := by
  rw [fold_batch h.beginBatch es (by simp [History.beginBatch, hd]) (by simp [History.beginBatch, hp])]
  cases h; simp_all [History.beginBatch, History.endBatch]

theorem abortBatch_reverts {C : Type} (h : History C) (es : List (Entry C))
    (hd : h.depth = 0) (hp : h.pending = none) (hne : nonEmpty es ≠ []) :
    (es.foldl History.push h.beginBatch).abortBatch =
      (h, some ((nonEmpty es).reverse.flatMap Entry.undo)) := by
  rw [fold_batch h.beginBatch es (by simp [History.beginBatch, hd]) (by simp [History.beginBatch, hp])]
  cases hs : nonEmpty es with
  | nil => contradiction
  | cons a as => cases h; simp_all [History.beginBatch, History.abortBatch]

end Nodetto.Undo
