import Nodetto.ZOrder.Model
namespace Nodetto.ZOrder

private theorem filter_false (xs : List ElemId) : xs.filter (fun _ => false) = [] := by
  induction xs with
  | nil => simp
  | cons x xs ih => simp [ih]

private theorem filter_same (xs : List ElemId) (p : ElemId → Bool) :
    (xs.filter p).filter p = xs.filter p := by
  induction xs with
  | nil => simp
  | cons x xs ih => cases h : p x <;> simp [h, ih]

private theorem filter_opposite (xs : List ElemId) (p : ElemId → Bool) :
    (xs.filter (fun x => !p x)).filter p = [] := by
  induction xs with
  | nil => simp
  | cons x xs ih => cases h : p x <;> simp [h, ih]

private theorem filter_opposite' (xs : List ElemId) (p : ElemId → Bool) :
    (xs.filter p).filter (fun x => !p x) = [] := by
  induction xs with
  | nil => simp
  | cons x xs ih => cases h : p x <;> simp [h, ih]

private theorem swap_perm (xs : List ElemId) (pos : Nat) : (swapAt xs pos).Perm xs := by
  induction pos generalizing xs with
  | zero =>
    cases xs with
    | nil => simp [swapAt]
    | cons a xs =>
      cases xs with
      | nil => simp [swapAt]
      | cons b xs => simpa [swapAt] using (List.Perm.swap a b xs)
  | succ pos ih =>
    cases xs with
    | nil => simp [swapAt]
    | cons a xs =>
      have hp := (ih xs).cons a
      cases h1 : xs[pos]? <;> cases h2 : xs[pos + 1]? <;>
        simpa [swapAt, Nat.succ_eq_add_one, Nat.add_assoc, h1, h2] using hp

private theorem swap_filter (xs : List ElemId) (pos : Nat) (p : ElemId → Bool)
    (a b : ElemId) (ha : xs[pos]? = some a) (hb : xs[pos + 1]? = some b)
    (hne : p a ≠ p b) : (swapAt xs pos).filter p = xs.filter p := by
  induction pos generalizing xs with
  | zero =>
    cases xs with
    | nil => simp at ha
    | cons x xs =>
      cases xs with
      | nil => simp at hb
      | cons y ys =>
        simp only [List.getElem?_cons_zero, Option.some.injEq] at ha
        simp only [List.getElem?_cons_succ, List.getElem?_cons_zero, Option.some.injEq] at hb
        subst a
        subst b
        cases hx : p x <;> cases hy : p y <;> simp_all [swapAt]
  | succ pos ih =>
    cases xs with
    | nil => simp at ha
    | cons x xs =>
      simp only [List.getElem?_cons_succ] at ha hb
      have ih' := ih xs ha hb
      cases h1 : xs[pos]? <;> cases h2 : xs[pos + 1]? <;>
        simp_all [swapAt, Nat.succ_eq_add_one, Nat.add_assoc]
      all_goals cases hp : p x <;> simp_all [List.filter_cons]

private theorem fold_swap_perm (positions : List Nat) (xs : List ElemId)
    (guard : ElemId → ElemId → Bool) :
    (positions.foldl (fun xs pos =>
      match xs[pos]?, xs[pos + 1]? with
      | some a, some b => if guard a b then swapAt xs pos else xs
      | _, _ => xs) xs).Perm xs := by
  induction positions generalizing xs with
  | nil => exact List.Perm.refl xs
  | cons pos rest ih =>
    simp only [List.foldl_cons]
    apply List.Perm.trans (ih _)
    split <;> try split <;> simp_all [swap_perm, List.Perm.refl]
    all_goals exact List.Perm.refl _

private theorem fold_swap_filter (positions : List Nat) (xs : List ElemId)
    (guard : ElemId → ElemId → Bool) (p : ElemId → Bool)
    (hg : ∀ a b, guard a b = true → p a ≠ p b) :
    (positions.foldl (fun xs pos =>
      match xs[pos]?, xs[pos + 1]? with
      | some a, some b => if guard a b then swapAt xs pos else xs
      | _, _ => xs) xs).filter p = xs.filter p := by
  induction positions generalizing xs with
  | nil => rfl
  | cons pos rest ih =>
    simp only [List.foldl_cons, ih]
    split
    next a b ha hb =>
      split
      next hg' => exact swap_filter xs pos p a b ha hb (hg a b hg')
      next => rfl
    next => rfl

theorem targetOrder_selected_order (ordered : List ElemId) (selected : ElemId → Bool) (action : Action) :
    (targetOrder ordered selected action).filter selected = ordered.filter selected := by
  cases action with
  | front => simp [targetOrder, List.filter_append, filter_false]
  | back => simp [targetOrder, List.filter_append, filter_false]
  | forward =>
    apply fold_swap_filter
    intro a b h
    cases ha : selected a <;> cases hb : selected b <;> simp_all
  | backward =>
    apply fold_swap_filter
    intro a b h
    cases ha : selected a <;> cases hb : selected b <;> simp_all

theorem targetOrder_unselected_order (ordered : List ElemId) (selected : ElemId → Bool) (action : Action) :
    (targetOrder ordered selected action).filter (fun id => !selected id) =
      ordered.filter (fun id => !selected id) := by
  cases action with
  | front => simp [targetOrder, List.filter_append, filter_false]
  | back => simp [targetOrder, List.filter_append, filter_false]
  | forward =>
    apply fold_swap_filter
    intro a b h
    cases ha : selected a <;> cases hb : selected b <;> simp_all
  | backward =>
    apply fold_swap_filter
    intro a b h
    cases ha : selected a <;> cases hb : selected b <;> simp_all

theorem targetOrder_perm (ordered : List ElemId) (selected : ElemId → Bool) (action : Action) :
    (targetOrder ordered selected action).Perm ordered := by
  cases action with
  | front =>
    exact (List.perm_append_comm).trans (List.filter_append_perm _ _)
  | back => exact List.filter_append_perm _ _
  | forward => exact fold_swap_perm _ _ _
  | backward => exact fold_swap_perm _ _ _

theorem targetOrder_all_selected (ordered : List ElemId) (selected : ElemId → Bool) (action : Action)
    (h : ∀ id ∈ ordered, selected id = true) :
    targetOrder ordered selected action = ordered := by
  have hp : ordered.filter selected = ordered := List.filter_eq_self.mpr h
  have hr : ordered.filter (fun id => !selected id) = [] :=
    List.filter_eq_nil_iff.mpr (by intro a ha; simp [h a ha])
  have hf (pos : Nat) : (match ordered[pos]?, ordered[pos + 1]? with
      | some a, some b => if selected a && !selected b then swapAt ordered pos else ordered
      | _, _ => ordered) = ordered := by
    cases ha : ordered[pos]? with
    | none => simp [ha]
    | some a =>
      cases hb : ordered[pos + 1]? with
      | none => simp [ha, hb]
      | some b => simp [ha, hb, h b (List.mem_of_getElem? hb)]
  have hb (pos : Nat) : (match ordered[pos]?, ordered[pos + 1]? with
      | some a, some b => if !selected a && selected b then swapAt ordered pos else ordered
      | _, _ => ordered) = ordered := by
    cases ha : ordered[pos]? with
    | none => simp [ha]
    | some a =>
      cases hb : ordered[pos + 1]? with
      | none => simp [ha, hb]
      | some b => simp [ha, hb, h a (List.mem_of_getElem? ha)]
  have fixed (ps : List Nat) (f : List ElemId → Nat → List ElemId)
      (hfix : ∀ n, f ordered n = ordered) : ps.foldl f ordered = ordered := by
    induction ps with
    | nil => rfl
    | cons n ns ih => simp only [List.foldl_cons, hfix, ih]
  cases action with
  | front => simp [targetOrder, hp, hr]
  | back => simp [targetOrder, hp, hr]
  | forward => exact fixed _ _ hf
  | backward => exact fixed _ _ hb

theorem targetOrder_front_idem (ordered : List ElemId) (selected : ElemId → Bool) :
    targetOrder (targetOrder ordered selected .front) selected .front =
      targetOrder ordered selected .front := by
  simp [targetOrder, List.filter_append, filter_same, filter_opposite, filter_opposite', filter_false]

theorem targetOrder_back_idem (ordered : List ElemId) (selected : ElemId → Bool) :
    targetOrder (targetOrder ordered selected .back) selected .back =
      targetOrder ordered selected .back := by
  simp [targetOrder, List.filter_append, filter_same, filter_opposite, filter_opposite', filter_false]

end Nodetto.ZOrder
