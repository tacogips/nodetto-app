import Nodetto.ZOrder.Model
import Nodetto.Fractional

namespace Nodetto.ZOrder
open Nodetto.Fractional

private theorem dedup_sublist (xs : List ElemId) : List.Sublist xs.eraseDups xs := by
  cases xs with
  | nil => simp
  | cons a as =>
    rw [List.eraseDups_cons]
    apply List.Sublist.cons_cons
    apply List.Sublist.trans (dedup_sublist _)
    exact List.filter_sublist

termination_by xs.length
decreasing_by simp_wf; exact Nat.lt_succ_of_le (List.length_filter_le _ _)

private theorem dedup_nodup (xs : List ElemId) : xs.eraseDups.Nodup := by
  cases xs with
  | nil => simp
  | cons a as =>
    rw [List.eraseDups_cons, List.nodup_cons]
    constructor
    · intro h
      have h' := List.mem_eraseDups.mp h
      simp at h'
    · exact dedup_nodup _

termination_by xs.length
decreasing_by simp_wf; exact Nat.lt_succ_of_le (List.length_filter_le _ _)

private theorem nodup_of_dedup_length (xs : List ElemId) (h : xs.eraseDups.length = xs.length) : xs.Nodup := by
  have heq := (dedup_sublist xs).eq_of_length h
  rw [← heq]
  exact dedup_nodup xs

private theorem dedup_length_of_nodup (xs : List ElemId) (h : xs.Nodup) :
    xs.eraseDups.length = xs.length := by
  have hle : xs.eraseDups.length ≤ xs.length := (dedup_sublist xs).length_le
  have hge : xs.length ≤ xs.eraseDups.length := h.length_le_of_subset (by
    intro x hx
    exact List.mem_eraseDups.mpr hx)
  omega

private theorem perm_of_nodup_subset_length (xs ys : List ElemId) (hn : xs.Nodup)
    (hs : xs ⊆ ys) (hl : xs.length = ys.length) : xs.Perm ys := by
  induction xs generalizing ys with
  | nil =>
    cases ys <;> simp_all
  | cons a xs ih =>
    have ha : a ∈ ys := hs (by simp)
    have hns := List.nodup_cons.mp hn
    have hsub : xs ⊆ ys.erase a := by
      intro x hx
      apply (List.mem_erase_of_ne ?_).2 (hs (by simp [hx]))
      intro h
      subst x
      exact hns.1 hx
    have hlen : xs.length = (ys.erase a).length := by
      rw [List.length_erase]
      simp [ha] at hl ⊢
      omega
    exact ((ih _ hns.2 hsub hlen).cons a).trans (List.perm_cons_erase ha).symm

private theorem targetIds_subset (elements : List (ElemId × Key)) (order : List ElemId) :
    targetIds elements order ⊆ elements.map Prod.fst := by
  intro id h
  simp only [targetIds, List.mem_filter, List.any_eq_true, beq_iff_eq,
    List.mem_map] at h ⊢
  obtain ⟨_, e, he, hid⟩ := h
  exact ⟨e, he, hid⟩

private theorem moved_filter_append_fresh (scanned moved : List ElemId) (id : ElemId)
    (fresh : id ∉ scanned) :
    scanned.filter (fun x => !(moved ++ [id]).contains x) =
      scanned.filter (fun x => !moved.contains x) := by
  apply List.filter_congr
  intro x hx
  have hne : id ≠ x := by
    intro h
    subst x
    exact fresh hx
  simp [hne, Ne.symm hne]

private theorem moved_filter_step (scanned moved : List ElemId) (id : ElemId)
    (fresh : id ∉ scanned) :
    (scanned ++ [id]).filter (fun x => !(moved ++ [id]).contains x) =
      scanned.filter (fun x => !moved.contains x) := by
  rw [List.filter_append, moved_filter_append_fresh scanned moved id fresh]
  simp

private theorem kept_filter_step (scanned moved : List ElemId) (id : ElemId)
    (kept : id ∉ moved) :
    (scanned ++ [id]).filter (fun x => !moved.contains x) =
      scanned.filter (fun x => !moved.contains x) ++ [id] := by
  simp [List.filter_append, List.contains_iff_mem, kept]

private theorem sorted_keys_append (keys : List Key) (key : Key)
    (sorted : keys.Pairwise (· < ·)) (bound : ∀ k ∈ keys, k < key) :
    (keys ++ [key]).Pairwise (· < ·) := by
  simp only [List.pairwise_append, List.pairwise_singleton, and_true]
  exact ⟨sorted, by simpa using bound⟩

private theorem scan_moved_mem (elements : List (ElemId × Key)) (xs : List ElemId)
    (highest : Option Key) (moved : List ElemId) (id : ElemId)
    (h : id ∈ (xs.foldl (fun (highest, moved) id =>
      let key := keyOf elements id
      match highest with
      | none => (some key, moved)
      | some h => if h < key then (some key, moved) else (highest, moved ++ [id]))
      (highest, moved)).2) : id ∈ moved ∨ id ∈ xs := by
  induction xs generalizing highest moved with
  | nil => exact Or.inl h
  | cons x xs ih =>
    simp only [List.foldl_cons] at h
    cases highest with
    | none =>
      rcases ih (some (keyOf elements x)) moved h with hm | hx
      · exact Or.inl hm
      · exact Or.inr (by simp [hx])
    | some k =>
      by_cases hk : k < keyOf elements x
      · simp only [hk, if_true] at h
        rcases ih (some (keyOf elements x)) moved h with hm | hx
        · exact Or.inl hm
        · exact Or.inr (by simp [hx])
      · simp only [hk, if_false] at h
        rcases ih (some k) (moved ++ [x]) h with hm | hx
        · simp only [List.mem_append, List.mem_singleton] at hm
          rcases hm with hm | rfl
          · exact Or.inl hm
          · exact Or.inr (by simp)
        · exact Or.inr (by simp [hx])

private theorem scan_moved_preserved (elements : List (ElemId × Key)) (xs : List ElemId)
    (highest : Option Key) (moved : List ElemId) (id : ElemId) (h : id ∈ moved) :
    id ∈ (xs.foldl (fun (highest, moved) id =>
      let key := keyOf elements id
      match highest with
      | none => (some key, moved)
      | some h => if h < key then (some key, moved) else (highest, moved ++ [id]))
      (highest, moved)).2 := by
  induction xs generalizing highest moved with
  | nil => exact h
  | cons x xs ih =>
    simp only [List.foldl_cons]
    cases highest with
    | none => exact ih (some (keyOf elements x)) moved h
    | some k =>
      by_cases hk : k < keyOf elements x
      · simp only [hk, if_true]
        exact ih (some (keyOf elements x)) moved h
      · simp only [hk, if_false]
        exact ih (some k) (moved ++ [x]) (by simp [h])

private theorem target_guard_false (elements : List (ElemId × Key)) (order : List ElemId)
    (hnd : (elements.map Prod.fst).Nodup)
    (hperm : (targetIds elements order).Perm (elements.map Prod.fst))
    (hmove : targetIds elements order ≠ elements.map Prod.fst) :
    ((targetIds elements order).length != elements.length ||
      (targetIds elements order).eraseDups.length != (targetIds elements order).length ||
      targetIds elements order == elements.map Prod.fst) = false := by
  have hl : (targetIds elements order).length = elements.length := by
    simpa using hperm.length_eq
  have hn : (targetIds elements order).Nodup := hperm.nodup_iff.mpr hnd
  have hd := dedup_length_of_nodup _ hn
  simp [hl, hd, hmove]

private theorem keyOf_cons (e : ElemId × Key) (es : List (ElemId × Key)) (id : ElemId) :
    keyOf (e :: es) id = if e.1 == id then e.2 else keyOf es id := by
  by_cases h : e.1 = id <;> simp [keyOf, List.find?_cons, h]

private theorem keyOf_update_other (es : List (ElemId × Key)) (id : ElemId) (c : Reorder)
    (h : c.id ≠ id) :
    keyOf (es.map (fun e => if e.1 == c.id then (e.1, c.index) else e)) id = keyOf es id := by
  induction es with
  | nil => simp [keyOf]
  | cons e es ih =>
    simp only [beq_iff_eq] at ih
    cases e with
    | mk eid key =>
      simp only [List.map_cons, keyOf_cons]
      by_cases eq : eid = c.id
      · subst eid
        simp [h, ih]
      · simp [eq, ih]

private theorem keyOf_update_same (es : List (ElemId × Key)) (c : Reorder)
    (h : c.id ∈ es.map Prod.fst) :
    keyOf (es.map (fun e => if e.1 == c.id then (e.1, c.index) else e)) c.id = c.index := by
  induction es with
  | nil => simp at h
  | cons e es ih =>
    cases e with
    | mk id key =>
      simp only [List.map_cons, List.mem_cons] at h
      by_cases he : id = c.id
      · simp [keyOf_cons, he]
      · simp only [List.map_cons, keyOf_cons, beq_iff_eq, he, ↓reduceIte]
        simpa only [beq_iff_eq] using ih (h.resolve_left (Ne.symm he))

private theorem keyOf_apply_other (es : List (ElemId × Key)) (cs : List Reorder) (id : ElemId)
    (h : ∀ c ∈ cs, c.id ≠ id) : keyOf (applyReorders es cs) id = keyOf es id := by
  induction cs generalizing es with
  | nil => simp [applyReorders]
  | cons c cs ih =>
    simp only [applyReorders, List.foldl_cons]
    rw [← applyReorders]
    rw [ih _ (by intro c hc; exact h c (by simp [hc]))]
    exact keyOf_update_other es id c (h c (by simp))
private theorem keyOf_apply_first (es : List (ElemId × Key)) (c : Reorder) (cs : List Reorder)
    (hmem : c.id ∈ es.map Prod.fst) (hother : ∀ d ∈ cs, d.id ≠ c.id) :
    keyOf (applyReorders es (c :: cs)) c.id = c.index := by
  simp only [applyReorders, List.foldl_cons]
  rw [← applyReorders, keyOf_apply_other _ _ _ hother]
  exact keyOf_update_same es c hmem

private theorem update_ids (es : List (ElemId × Key)) (c : Reorder) :
    (es.map (fun e => if e.1 == c.id then (e.1, c.index) else e)).map Prod.fst = es.map Prod.fst := by
  induction es with
  | nil => rfl
  | cons e es ih =>
    simp only [List.map_cons, ih]
    cases e with
    | mk id key =>
      by_cases h : id = c.id <;> simp [h]

private theorem apply_ids (es : List (ElemId × Key)) (cs : List Reorder) :
    (applyReorders es cs).map Prod.fst = es.map Prod.fst := by
  induction cs generalizing es with
  | nil => rfl
  | cons c cs ih =>
    simp only [applyReorders, List.foldl_cons]
    rw [← applyReorders, ih, update_ids]

private theorem keyOf_apply_member (es : List (ElemId × Key)) (cs : List Reorder) (c : Reorder)
    (hn : (cs.map Reorder.id).Nodup) (hc : c ∈ cs) (hm : c.id ∈ es.map Prod.fst) :
    keyOf (applyReorders es cs) c.id = c.index := by
  induction cs generalizing es with
  | nil => simp at hc
  | cons d ds ih =>
    simp only [List.map_cons, List.nodup_cons] at hn
    simp only [List.mem_cons] at hc
    rcases hc with rfl | hc
    · apply keyOf_apply_first es c ds hm
      intro x hx heq
      apply hn.1
      exact List.mem_map.mpr ⟨x, hx, heq⟩
    · simp only [applyReorders, List.foldl_cons]
      rw [← applyReorders]
      apply ih _ hn.2 hc
      simpa only [update_ids] using hm

private theorem keyOf_member (es : List (ElemId × Key)) (e : ElemId × Key)
    (hn : (es.map Prod.fst).Nodup) (he : e ∈ es) : keyOf es e.1 = e.2 := by
  induction es with
  | nil => simp at he
  | cons a es ih =>
    simp only [List.mem_cons] at he
    rcases he with rfl | he
    · simp [keyOf_cons]
    · simp only [List.map_cons, List.nodup_cons] at hn
      have hne : a.1 ≠ e.1 := by
        intro heq
        apply hn.1
        rw [heq]
        exact List.mem_map_of_mem he
      simp [keyOf_cons, hne, ih hn.2 he]

private theorem keyOf_valid_of_member (es : List (ElemId × Key)) (id : ElemId)
    (ha : (es.map Prod.snd).all isFractionalKey = true)
    (hm : id ∈ es.map Prod.fst) : isFractionalKey (keyOf es id) = true := by
  induction es with
  | nil => simp at hm
  | cons e es ih =>
    simp only [List.map_cons, List.all_cons, Bool.and_eq_true] at ha
    simp only [List.map_cons, List.mem_cons] at hm
    by_cases h : e.1 = id
    · simpa [keyOf_cons, h] using ha.1
    · simp only [keyOf_cons, beq_iff_eq, h, ↓reduceIte]
      exact ih ha.2 (hm.resolve_left (Ne.symm h))

private theorem untouched_element (es : List (ElemId × Key)) (cs : List Reorder)
    (hn : (es.map Prod.fst).Nodup) (e : ElemId × Key) (he : e ∈ es)
    (h : ∀ c ∈ cs, c.id ≠ e.1) : keyOf (applyReorders es cs) e.1 = e.2 := by
  rw [keyOf_apply_other es cs e.1 h]
  exact keyOf_member es e hn he

private def renumberStep (s : Option Key × List Reorder × Rng) (id : ElemId) : Except String (Option Key × List Reorder × Rng) := do
  let (prev, cmds, state) := s
  let (key, state') ← keyAfter prev state
  pure (some key, cmds ++ [⟨id, key⟩], state')

private theorem between_bounds (lo hi : Option Key) (rng : Rng)
    (hl : ∀ k, lo = some k → isFractionalKey k = true)
    (hu : ∀ k, hi = some k → isFractionalKey k = true)
    (ho : ∀ l h, lo = some l → hi = some h → l < h) :
    ∃ k r, keyBetween lo hi rng = .ok (k, r) ∧ isFractionalKey k = true ∧
      (∀ l, lo = some l → l < k) ∧ (∀ h, hi = some h → k < h) := by
  cases lo with
  | none =>
    cases hi with
    | none =>
      obtain ⟨k, r, he, hv⟩ := keyBetween_unbounded rng
      exact ⟨k, r, he, hv, by simp, by simp⟩
    | some h =>
      obtain ⟨k, r, he, hk, hv⟩ := keyBetween_below h rng (hu h rfl)
      exact ⟨k, r, he, hv, by simp, by intro x hx; cases hx; exact hk⟩
  | some l =>
    cases hi with
    | none =>
      obtain ⟨k, r, he, hk, hv⟩ := keyBetween_above l rng (hl l rfl)
      exact ⟨k, r, he, hv, by intro x hx; cases hx; exact hk, by simp⟩
    | some h =>
      obtain ⟨k, r, he, hk, kh, hv⟩ := keyBetween_between l h rng (hl l rfl) (hu h rfl) (ho l h rfl rfl)
      exact ⟨k, r, he, hv, by intro x hx; cases hx; exact hk, by intro x hx; cases hx; exact kh⟩

private theorem after_bound (prev : Option Key) (rng : Rng) :
    ∃ k r, keyAfter prev rng = .ok (k, r) ∧ ∀ p, prev = some p → p < k := by
  cases prev with
  | none =>
    obtain ⟨k, r, h, _⟩ := keyAfter_none_valid rng
    exact ⟨k, r, h, by simp⟩
  | some s =>
    obtain ⟨k, r, h, hl⟩ := keyAfter_gt s rng
    exact ⟨k, r, h, by intro p hp; cases hp; exact hl⟩

private theorem fold_sorted (xs : List ElemId) (prev : Option Key) (cmds : List Reorder) (rng : Rng) :
    ∃ prev' out rng', xs.foldlM renumberStep (prev, cmds, rng) = .ok (prev', cmds ++ out, rng') ∧
      out.map Reorder.id = xs ∧ (out.map Reorder.index).Pairwise (· < ·) ∧
      ∀ c ∈ out, ∀ p, prev = some p → p < c.index := by
  induction xs generalizing prev cmds rng with
  | nil => exact ⟨prev, [], rng, by simp [pure, Pure.pure, Except.pure], by simp, by simp, by simp⟩
  | cons x xs ih =>
    obtain ⟨k, r, hk, hkbound⟩ := after_bound prev rng
    obtain ⟨p, out, r', he, hi, hs, hb⟩ := ih (some k) (cmds ++ [⟨x, k⟩]) r
    refine ⟨p, ⟨x, k⟩ :: out, r', ?_, ?_, ?_, ?_⟩
    · simpa [List.foldlM_cons, renumberStep, hk, Bind.bind, Except.bind, pure, Pure.pure, Except.pure, List.append_assoc] using he
    · simpa using hi
    · simp only [List.map_cons, List.pairwise_cons]
      exact ⟨by intro z hz; obtain ⟨c, hc, rfl⟩ := List.mem_map.mp hz; exact hb c hc k rfl, hs⟩
    · intro c hc p hp
      simp only [List.mem_cons] at hc
      rcases hc with rfl | hc
      · exact hkbound p hp
      · exact List.lt_trans (hkbound p hp) (hb c hc k rfl)

private theorem renumber_sorted (ids : List ElemId) (rng : Rng) :
    ∃ cmds rng', renumber ids rng = .ok (cmds, rng') ∧
      cmds.map Reorder.id = ids ∧ (cmds.map Reorder.index).Pairwise (· < ·) := by
  obtain ⟨prev, cmds, r, he, hi, hs, _⟩ := fold_sorted ids none [] rng
  refine ⟨cmds, r, ?_, hi, hs⟩
  simp only [List.nil_append] at he
  change (do
    let (_, cs, state) ← ids.foldlM renumberStep (none, [], rng)
    pure (cs, state)) = .ok (cmds, r)
  simp [he, Bind.bind, Except.bind, pure, Pure.pure, Except.pure]

private theorem apply_command_keys (es : List (ElemId × Key)) (cs : List Reorder)
    (hn : (cs.map Reorder.id).Nodup) (hm : ∀ c ∈ cs, c.id ∈ es.map Prod.fst) :
    (cs.map Reorder.id).map (keyOf (applyReorders es cs)) = cs.map Reorder.index := by
  rw [List.map_map]
  apply List.map_congr_left
  intro c hc
  exact keyOf_apply_member es cs c hn hc (hm c hc)

private theorem renumber_applied_sorted (es : List (ElemId × Key)) (ids : List ElemId) (rng : Rng)
    (hn : ids.Nodup) (hm : ids ⊆ es.map Prod.fst) :
    ∃ cs r, renumber ids rng = .ok (cs, r) ∧
      (ids.map (keyOf (applyReorders es cs))).Pairwise (· < ·) := by
  obtain ⟨cs, r, hr, hi, hs⟩ := renumber_sorted ids rng
  refine ⟨cs, r, hr, ?_⟩
  have hcs : (cs.map Reorder.id).Nodup := by simpa [hi] using hn
  have hmem : ∀ c ∈ cs, c.id ∈ es.map Prod.fst := by
    intro c hc
    apply hm
    rw [← hi]
    exact List.mem_map_of_mem hc
  rw [← hi, apply_command_keys es cs hcs hmem]
  exact hs

private theorem reorderCommands_renumber_spec (elements : List (ElemId × Key))
    (order : List ElemId) (rng : Rng)
    (hnd : (elements.map Prod.fst).Nodup)
    (hperm : (targetIds elements order).Perm (elements.map Prod.fst))
    (hmove : targetIds elements order ≠ elements.map Prod.fst)
    (hkeys : (!(elements.map Prod.snd).all isFractionalKey ||
      (elements.map Prod.snd).eraseDups.length != (elements.map Prod.snd).length) = true) :
    ∃ cmds rng', reorderCommands elements order rng = .ok (cmds, rng') ∧
      ((targetIds elements order).map (keyOf (applyReorders elements cmds))).Pairwise (· < ·) ∧
      ∀ e ∈ elements, (∀ c ∈ cmds, c.id ≠ e.1) → keyOf (applyReorders elements cmds) e.1 = e.2 := by
  have hn : (targetIds elements order).Nodup := hperm.nodup_iff.mpr hnd
  obtain ⟨cs, r, hr, hs⟩ := renumber_applied_sorted elements (targetIds elements order) rng hn
    (targetIds_subset elements order)
  refine ⟨cs, r, ?_, hs, ?_⟩
  · simp only [reorderCommands, target_guard_false elements order hnd hperm hmove,
      Bool.false_eq_true, if_false, hkeys, if_true, hr, Bind.bind, Except.bind,
      pure, Pure.pure, Except.pure]
  · intro e he hc
    exact untouched_element elements cs hnd e he hc

theorem reorderCommands_refuses (elements : List (ElemId × Key)) (order : List ElemId) (rng : Rng)
    (h : ¬ (targetIds elements order).Perm (elements.map Prod.fst)) :
    reorderCommands elements order rng = .ok ([], rng) := by
  by_cases hl : (targetIds elements order).length = elements.length
  · by_cases hn : (targetIds elements order).eraseDups.length = (targetIds elements order).length
    · exfalso
      apply h
      apply perm_of_nodup_subset_length _ _ (nodup_of_dedup_length _ hn) (targetIds_subset elements order)
      simpa using hl
    · have hn' : (targetIds elements order).eraseDups.length ≠ elements.length := by simpa [← hl] using hn
      simp [reorderCommands, hl, hn', pure, Pure.pure, Except.pure]
  · simp [reorderCommands, hl, pure, Pure.pure, Except.pure]

theorem reorderCommands_unchanged (elements : List (ElemId × Key)) (order : List ElemId) (rng : Rng)
    (h : targetIds elements order = elements.map Prod.fst) :
    reorderCommands elements order rng = .ok ([], rng) := by
  simp [reorderCommands, h, pure, Pure.pure, Except.pure]


private def scanStep (elements : List (ElemId × Key)) :
    Option Key × List ElemId → ElemId → Option Key × List ElemId :=
  fun (highest, moved) id =>
    let key := keyOf elements id
    match highest with
    | none => (some key, moved)
    | some h => if h < key then (some key, moved) else (highest, moved ++ [id])

private theorem scanStep_mem (elements : List (ElemId × Key)) (xs : List ElemId)
    (highest : Option Key) (moved : List ElemId) (id : ElemId)
    (h : id ∈ (xs.foldl (scanStep elements) (highest, moved)).2) : id ∈ moved ∨ id ∈ xs := by
  exact scan_moved_mem elements xs highest moved id h

private theorem scanStep_preserved (elements : List (ElemId × Key)) (xs : List ElemId)
    (highest : Option Key) (moved : List ElemId) (id : ElemId) (h : id ∈ moved) :
    id ∈ (xs.foldl (scanStep elements) (highest, moved)).2 := by
  exact scan_moved_preserved elements xs highest moved id h

private theorem scan_kept_sorted (elements : List (ElemId × Key)) (xs : List ElemId)
    (highest : Option Key) (moved : List ElemId)
    (hnd : xs.Nodup) (hfresh : ∀ x ∈ xs, x ∉ moved) :
    ((xs.filter (fun x => !((xs.foldl (scanStep elements) (highest, moved)).2).contains x)).map
        (keyOf elements)).Pairwise (· < ·) ∧
      ∀ x ∈ xs.filter (fun x => !((xs.foldl (scanStep elements) (highest, moved)).2).contains x),
        ∀ h, highest = some h → h < keyOf elements x := by
  induction xs generalizing highest moved with
  | nil => simp
  | cons x xs ih =>
    have hn := List.nodup_cons.mp hnd
    have fresh : ∀ y ∈ xs, y ∉ moved := by
      intro y hy
      exact hfresh y (by simp [hy])
    have kept (bound : ∀ h, highest = some h → h < keyOf elements x)
        (step : scanStep elements (highest, moved) x = (some (keyOf elements x), moved)) :
        (((x :: xs).filter (fun y => !(((x :: xs).foldl (scanStep elements) (highest, moved)).2).contains y)).map
          (keyOf elements)).Pairwise (· < ·) ∧
        ∀ y ∈ (x :: xs).filter (fun y => !(((x :: xs).foldl (scanStep elements) (highest, moved)).2).contains y),
          ∀ h, highest = some h → h < keyOf elements y := by
      have hx : x ∉ (xs.foldl (scanStep elements) (some (keyOf elements x), moved)).2 := by
        intro h
        rcases scanStep_mem elements xs _ moved x h with hm | hm
        · exact hfresh x (by simp) hm
        · exact hn.1 hm
      obtain ⟨hs, hb⟩ := ih (some (keyOf elements x)) moved hn.2 fresh
      have hc : ((xs.foldl (scanStep elements) (some (keyOf elements x), moved)).2).contains x = false := by
        simpa [List.contains_iff_mem] using hx
      simp only [List.foldl_cons, step, List.filter_cons, hc, Bool.not_false,
        ite_true, List.map_cons, List.pairwise_cons]
      constructor
      · exact ⟨by intro k hk; obtain ⟨y, hy, rfl⟩ := List.mem_map.mp hk; exact hb y hy _ rfl, hs⟩
      · intro y hy h hh
        simp only [List.mem_cons] at hy
        rcases hy with rfl | hy
        · exact bound h hh
        · exact List.lt_trans (bound h hh) (hb y hy _ rfl)
    cases highest with
    | none =>
      apply kept
      · simp
      · rfl
    | some k =>
      by_cases hk : k < keyOf elements x
      · apply kept
        · intro h hh; cases hh; exact hk
        · simp [scanStep, hk]
      · have hx : x ∈ (xs.foldl (scanStep elements) (some k, moved ++ [x])).2 :=
          scanStep_preserved elements xs _ _ x (by simp)
        have fresh' : ∀ y ∈ xs, y ∉ moved ++ [x] := by
          intro y hy
          simp only [List.mem_append, List.mem_singleton, not_or]
          exact ⟨fresh y hy, by intro he; subst y; exact hn.1 hy⟩
        obtain ⟨hs, hb⟩ := ih (some k) (moved ++ [x]) hn.2 fresh'
        simpa [List.foldl_cons, scanStep, hk, List.contains_iff_mem, hx] using And.intro hs hb

private def cmdsOf (moved : List ElemId) (done : List (ElemId × Key)) : List Reorder :=
  (done.filter (fun p => moved.contains p.1)).map (fun p => (⟨p.1, p.2⟩ : Reorder))

private theorem loop_nil_eq (elements : List (ElemId × Key)) (target moved : List ElemId)
    (done : List (ElemId × Key)) (cmds : List Reorder) (state : Rng) :
    reorderCommands.loop elements target moved [] done cmds state = .ok (cmds, state) := by
  simp [reorderCommands.loop, pure, Pure.pure, Except.pure]

private theorem loop_kept_eq (elements : List (ElemId × Key)) (target moved : List ElemId)
    (id : ElemId) (tail : List ElemId) (done : List (ElemId × Key)) (cmds : List Reorder)
    (state : Rng) (hk : moved.contains id = false) :
    reorderCommands.loop elements target moved (id :: tail) done cmds state =
      reorderCommands.loop elements target moved tail (done ++ [(id, keyOf elements id)]) cmds state := by
  simp only [reorderCommands.loop, hk, Bool.not_false, if_true]

private theorem loop_fallback_eq (elements : List (ElemId × Key)) (target moved : List ElemId)
    (id : ElemId) (tail : List ElemId) (done : List (ElemId × Key)) (cmds : List Reorder)
    (state : Rng) (b a : Key) (hm : moved.contains id = true)
    (hb : done.getLast?.map Prod.snd = some b)
    (ha : (tail.find? (fun next => !moved.contains next)).map (keyOf elements) = some a)
    (hba : ¬ b < a) :
    reorderCommands.loop elements target moved (id :: tail) done cmds state = renumber target state := by
  simp only [reorderCommands.loop, hm, Bool.not_true, if_false, hb, ha, hba,
    not_false_eq_true, if_true, Bind.bind, Except.bind, pure, Pure.pure, Except.pure]
  cases renumber target state <;> rfl

private theorem loop_moved_eq (elements : List (ElemId × Key)) (target moved : List ElemId)
    (id : ElemId) (tail : List ElemId) (done : List (ElemId × Key)) (cmds : List Reorder)
    (state : Rng) (key : Key) (state' : Rng) (hm : moved.contains id = true)
    (hord : ∀ b a, done.getLast?.map Prod.snd = some b →
      (tail.find? (fun next => !moved.contains next)).map (keyOf elements) = some a → b < a)
    (hkb : keyBetween (done.getLast?.map Prod.snd)
      ((tail.find? (fun next => !moved.contains next)).map (keyOf elements)) state = .ok (key, state')) :
    reorderCommands.loop elements target moved (id :: tail) done cmds state =
      reorderCommands.loop elements target moved tail (done ++ [(id, key)]) (cmds ++ [⟨id, key⟩]) state' := by
  simp only [reorderCommands.loop, hm, Bool.not_true, if_false]
  generalize hb : done.getLast?.map Prod.snd = below at *
  generalize ha : (tail.find? (fun next => !moved.contains next)).map (keyOf elements) = above at *
  cases below <;> cases above <;> simp_all [Bind.bind, Except.bind, pure, Pure.pure, Except.pure]



private theorem last_bound (ks : List Key) (b : Key) (hs : ks.Pairwise (· < ·))
    (hl : ks.getLast? = some b) : b ∈ ks ∧ ∀ x ∈ ks, x = b ∨ x < b := by
  obtain ⟨init, rfl⟩ := List.getLast?_eq_some_iff.mp hl
  have hp := List.pairwise_append.mp hs
  constructor
  · simp
  · intro x hx
    simp only [List.mem_append, List.mem_singleton] at hx
    rcases hx with hx | rfl
    · exact Or.inr (hp.2.2 x hx b (by simp))
    · exact Or.inl rfl

private theorem find_first_kept (elements : List (ElemId × Key)) (moved tail : List ElemId)
    (hp : ((tail.filter (fun x => !moved.contains x)).map (keyOf elements)).Pairwise (· < ·))
    (id' : ElemId) (hid : id' ∈ tail) (hk : moved.contains id' = false) :
    ∃ f, tail.find? (fun next => !moved.contains next) = some f ∧ f ∈ tail ∧
      ∀ k : Key, k < keyOf elements f → k < keyOf elements id' := by
  induction tail with
  | nil => simp at hid
  | cons x xs ih =>
    by_cases hx : moved.contains x = false
    · refine ⟨x, ?_, by simp, ?_⟩
      · simp only [List.find?_cons, hx, Bool.not_false, if_true]
      · intro k h
        simp only [List.mem_cons] at hid
        rcases hid with rfl | hid
        · exact h
        · simp only [List.filter_cons, hx, Bool.not_false, ite_true,
            List.map_cons, List.pairwise_cons] at hp
          have hi : id' ∈ xs.filter (fun y => !moved.contains y) := by
            simp only [List.mem_filter, hid, hk, Bool.not_false, and_self]
          exact List.lt_trans h (hp.1 _ (List.mem_map_of_mem hi))
    · have htrue : moved.contains x = true := by cases h : moved.contains x <;> simp_all only [Bool.false_eq_true, not_true_eq_false]
      have hid' : id' ∈ xs := by
        simp only [List.mem_cons] at hid
        rcases hid with h | h
        · subst x; rw [hk] at htrue; contradiction
        · exact h
      have hp' : ((xs.filter (fun x => !moved.contains x)).map (keyOf elements)).Pairwise (· < ·) := by
        simpa only [List.filter_cons, htrue, Bool.not_true, Bool.false_eq_true, ite_false] using hp
      obtain ⟨f, hf, hmem, hb⟩ := ih hp' hid'
      exact ⟨f, by simpa only [List.find?_cons, htrue, Bool.not_true, if_false] using hf, by simp [hmem], hb⟩

private structure LoopInv (elements : List (ElemId × Key)) (target moved rest : List ElemId)
    (done : List (ElemId × Key)) (cmds : List Reorder) : Prop where
  hpre : done.map Prod.fst ++ rest = target
  hsorted : (done.map Prod.snd).Pairwise (· < ·)
  hvalid : ∀ k ∈ done.map Prod.snd, isFractionalKey k = true
  hrestValid : ∀ id ∈ rest, isFractionalKey (keyOf elements id) = true
  hrestSorted : ((rest.filter (fun x => !moved.contains x)).map (keyOf elements)).Pairwise (· < ·)
  hbelow : ∀ id ∈ rest, moved.contains id = false → ∀ k ∈ done.map Prod.snd, k < keyOf elements id
  hcmds : cmds = cmdsOf moved done
  hkept : ∀ p ∈ done, moved.contains p.1 = false → p.2 = keyOf elements p.1

private theorem loop_init (elements : List (ElemId × Key)) (target : List ElemId)
    (hn : target.Nodup) (hsub : target ⊆ elements.map Prod.fst)
    (hall : (elements.map Prod.snd).all isFractionalKey = true) :
    LoopInv elements target ((target.foldl (scanStep elements) (none, [])).2) target [] [] := by
  refine ⟨by simp, by simp, by simp, ?_, ?_, by simp, by simp [cmdsOf], by simp⟩
  · intro id hi
    exact keyOf_valid_of_member elements id hall (hsub hi)
  · exact (scan_kept_sorted elements target none [] hn (by simp)).1

private theorem inv_bounds (elements : List (ElemId × Key)) (target moved : List ElemId)
    (id : ElemId) (tail : List ElemId) (done : List (ElemId × Key)) (cmds : List Reorder)
    (h : LoopInv elements target moved (id :: tail) done cmds) :
    (∀ b, done.getLast?.map Prod.snd = some b → isFractionalKey b = true) ∧
    (∀ a, (tail.find? (fun next => !moved.contains next)).map (keyOf elements) = some a →
      isFractionalKey a = true) ∧
    (∀ key : Key, (∀ b, done.getLast?.map Prod.snd = some b → b < key) →
      ∀ k ∈ done.map Prod.snd, k < key) := by
  have hm : (done.map Prod.snd).getLast? = done.getLast?.map Prod.snd := by simp
  constructor
  · intro b hb
    exact h.hvalid b (last_bound _ b h.hsorted (hm.trans hb)).1
  constructor
  · intro a ha
    cases hf : tail.find? (fun next => !moved.contains next) with
    | none =>
      rw [hf] at ha
      cases ha
    | some f =>
      have mem := List.mem_of_find?_eq_some hf
      rw [hf] at ha
      simp only [Option.map_some, Option.some.injEq] at ha
      subst a
      exact h.hrestValid f (by simp [mem])
  · intro key hb k hk
    cases hl : (done.map Prod.snd).getLast? with
    | none =>
      have he : done.map Prod.snd = [] := List.getLast?_eq_none_iff.mp hl
      simp [he] at hk
    | some b =>
      have bounds := last_bound _ b h.hsorted hl
      have hbk : b < key := hb b (hm.symm.trans hl)
      rcases bounds.2 k hk with rfl | hlt
      · exact hbk
      · exact List.lt_trans hlt hbk


private theorem inv_kept (elements : List (ElemId × Key)) (target moved : List ElemId)
    (id : ElemId) (tail : List ElemId) (done : List (ElemId × Key)) (cmds : List Reorder)
    (h : LoopInv elements target moved (id :: tail) done cmds) (hk : moved.contains id = false) :
    LoopInv elements target moved tail (done ++ [(id, keyOf elements id)]) cmds := by
  have hp : (keyOf elements id :: (tail.filter (fun x => !moved.contains x)).map (keyOf elements)).Pairwise (· < ·) := by
    simpa only [List.filter_cons, hk, Bool.not_false, ite_true, List.map_cons] using h.hrestSorted
  have hs := (List.pairwise_cons.mp hp).2
  have hb : ∀ id' ∈ tail, moved.contains id' = false → keyOf elements id < keyOf elements id' := by
    intro id' hi hk'
    exact (List.pairwise_cons.mp hp).1 _ (List.mem_map_of_mem (by simp only [List.mem_filter, hi, hk', Bool.not_false, and_self]))
  refine ⟨?_, ?_, ?_, ?_, hs, ?_, ?_, ?_⟩
  · simpa [List.map_append, List.append_assoc] using h.hpre
  · simpa [List.map_append] using sorted_keys_append _ _ h.hsorted (h.hbelow id (by simp) hk)
  · intro k hk'
    simp only [List.map_append, List.map_cons, List.map_nil, List.mem_append, List.mem_singleton] at hk'
    rcases hk' with hk' | rfl
    · exact h.hvalid k hk'
    · exact h.hrestValid id (by simp)
  · intro x hx; exact h.hrestValid x (by simp [hx])
  · intro x hx hxk k hkm
    simp only [List.map_append, List.map_cons, List.map_nil, List.mem_append, List.mem_singleton] at hkm
    rcases hkm with hkm | rfl
    · exact h.hbelow x (by simp [hx]) hxk k hkm
    · exact hb x hx hxk
  · simpa only [cmdsOf, List.filter_append, List.map_append, List.filter_cons, Prod.fst, hk, Bool.false_eq_true, ite_false, List.filter_nil, List.map_nil, List.append_nil] using h.hcmds
  · intro p hp hpkept
    simp only [List.mem_append, List.mem_singleton] at hp
    rcases hp with hp | rfl
    · exact h.hkept p hp hpkept
    · rfl

private theorem inv_moved (elements : List (ElemId × Key)) (target moved : List ElemId)
    (id : ElemId) (tail : List ElemId) (done : List (ElemId × Key)) (cmds : List Reorder)
    (key : Key) (h : LoopInv elements target moved (id :: tail) done cmds)
    (hm : moved.contains id = true)
    (hlo : ∀ k ∈ done.map Prod.snd, k < key) (hv : isFractionalKey key = true)
    (hhi : ∀ a, (tail.find? (fun next => !moved.contains next)).map (keyOf elements) = some a → key < a) :
    LoopInv elements target moved tail (done ++ [(id, key)]) (cmds ++ [⟨id, key⟩]) := by
  have hs : ((tail.filter (fun x => !moved.contains x)).map (keyOf elements)).Pairwise (· < ·) := by
    simpa only [List.filter_cons, hm, Bool.not_true, Bool.false_eq_true, ite_false] using h.hrestSorted
  refine ⟨?_, ?_, ?_, ?_, hs, ?_, ?_, ?_⟩
  · simpa [List.map_append, List.append_assoc] using h.hpre
  · simpa [List.map_append] using sorted_keys_append _ _ h.hsorted hlo
  · intro k hk'
    simp only [List.map_append, List.map_cons, List.map_nil, List.mem_append, List.mem_singleton] at hk'
    rcases hk' with hk' | rfl
    · exact h.hvalid k hk'
    · exact hv
  · intro x hx; exact h.hrestValid x (by simp [hx])
  · intro x hx hxk k hkm
    simp only [List.map_append, List.map_cons, List.map_nil, List.mem_append, List.mem_singleton] at hkm
    rcases hkm with hkm | rfl
    · exact h.hbelow x (by simp [hx]) hxk k hkm
    · obtain ⟨f, hf, _, transfer⟩ := find_first_kept elements moved tail hs x hx hxk
      apply transfer _
      apply hhi (keyOf elements f)
      rw [hf]
      rfl
  · simp only [h.hcmds, cmdsOf, List.filter_append, List.map_append, List.filter_cons, Prod.fst, hm, ite_true, List.filter_nil, List.map_cons, List.map_nil]
  · intro p hp hpkept
    simp only [List.mem_append, List.mem_singleton] at hp
    rcases hp with hp | rfl
    · exact h.hkept p hp hpkept
    · simp only [Prod.fst, hm, Bool.true_eq_false] at hpkept

private theorem done_applied_keys (elements : List (ElemId × Key)) (moved : List ElemId)
    (done : List (ElemId × Key)) (hn : (done.map Prod.fst).Nodup)
    (hm : ∀ p ∈ done, p.1 ∈ elements.map Prod.fst)
    (hkept : ∀ p ∈ done, moved.contains p.1 = false → p.2 = keyOf elements p.1) :
    (done.map Prod.fst).map (keyOf (applyReorders elements (cmdsOf moved done))) = done.map Prod.snd := by
  have hnod : ((cmdsOf moved done).map Reorder.id).Nodup := by
    have hsub : List.Sublist ((done.filter (fun p => moved.contains p.1)).map Prod.fst) (done.map Prod.fst) := List.Sublist.map Prod.fst List.filter_sublist
    apply List.Nodup.sublist _ hn
    simpa [cmdsOf, List.map_map, Function.comp_def] using hsub
  simp only [List.map_map]
  apply List.map_congr_left
  intro p hp
  simp only [Function.comp_apply]
  by_cases hpM : moved.contains p.1 = true
  · have hc : (⟨p.1, p.2⟩ : Reorder) ∈ cmdsOf moved done := by
      apply List.mem_map.mpr
      exact ⟨p, List.mem_filter.mpr ⟨hp, hpM⟩, rfl⟩
    exact keyOf_apply_member elements _ _ hnod hc (hm p hp)
  · have hk : moved.contains p.1 = false := Bool.eq_false_iff.mpr hpM
    rw [keyOf_apply_other]
    · exact (hkept p hp hk).symm
    · intro c hc heq
      simp only [cmdsOf] at hc
      obtain ⟨q, hq, rfl⟩ := List.mem_map.mp hc
      have hqM : moved.contains q.1 = true := (List.mem_filter.mp hq).2
      simp only at heq
      rw [heq] at hqM
      rw [hk] at hqM
      contradiction

private theorem loop_final (elements : List (ElemId × Key)) (target moved : List ElemId)
    (hn : target.Nodup) (hsub : target ⊆ elements.map Prod.fst) (done : List (ElemId × Key))
    (hd : done.map Prod.fst = target) (hs : (done.map Prod.snd).Pairwise (· < ·))
    (hkept : ∀ p ∈ done, moved.contains p.1 = false → p.2 = keyOf elements p.1) :
    (target.map (keyOf (applyReorders elements (cmdsOf moved done)))).Pairwise (· < ·) := by
  have hn' : (done.map Prod.fst).Nodup := by simpa [hd] using hn
  have hm : ∀ p ∈ done, p.1 ∈ elements.map Prod.fst := by
    intro p hp
    apply hsub
    rw [← hd]
    exact List.mem_map_of_mem hp
  rw [← hd, done_applied_keys elements moved done hn' hm hkept]
  exact hs

private theorem loop_ok (elements : List (ElemId × Key)) (target moved : List ElemId)
    (P : List Reorder → Prop)
    (hren : ∀ state, ∃ cs r, renumber target state = .ok (cs, r) ∧ P cs)
    (hfin : ∀ done : List (ElemId × Key), done.map Prod.fst = target →
      (done.map Prod.snd).Pairwise (· < ·) →
      (∀ p ∈ done, moved.contains p.1 = false → p.2 = keyOf elements p.1) → P (cmdsOf moved done))
    (rest : List ElemId) (done : List (ElemId × Key)) (cmds : List Reorder) (state : Rng)
    (hinv : LoopInv elements target moved rest done cmds) :
    ∃ out r, reorderCommands.loop elements target moved rest done cmds state = .ok (out, r) ∧ P out := by
  induction rest generalizing done cmds state with
  | nil =>
    refine ⟨cmds, state, loop_nil_eq _ _ _ _ _ _, ?_⟩
    rw [hinv.hcmds]
    exact hfin done (by simpa using hinv.hpre) hinv.hsorted hinv.hkept
  | cons id tail ih =>
    cases hm : moved.contains id with
    | false =>
      rw [loop_kept_eq _ _ _ _ _ _ _ _ hm]
      exact ih _ _ _ (inv_kept _ _ _ _ _ _ _ hinv hm)
    | true =>
      by_cases bad : ∃ b a, done.getLast?.map Prod.snd = some b ∧
          (tail.find? (fun next => !moved.contains next)).map (keyOf elements) = some a ∧ ¬ b < a
      · obtain ⟨b, a, hb, ha, hba⟩ := bad
        rw [loop_fallback_eq _ _ _ _ _ _ _ _ b a hm hb ha hba]
        exact hren state
      · have hord : ∀ b a, done.getLast?.map Prod.snd = some b →
            (tail.find? (fun next => !moved.contains next)).map (keyOf elements) = some a → b < a := by
          intro b a hb ha
          by_cases h : b < a
          · exact h
          · exact False.elim (bad ⟨b, a, hb, ha, h⟩)
        have bounds := inv_bounds elements target moved id tail done cmds hinv
        obtain ⟨key, r, hkb, hv, hlo, hhi⟩ := between_bounds _ _ state bounds.1 bounds.2.1 hord
        rw [loop_moved_eq elements target moved id tail done cmds state key r hm hord hkb]
        exact ih _ _ _ (inv_moved elements target moved id tail done cmds key hinv hm (bounds.2.2 key hlo) hv hhi)

private theorem keys_valid_of_check (keys : List Key)
    (h : (!keys.all isFractionalKey || keys.eraseDups.length != keys.length) = false) :
    keys.all isFractionalKey = true := by
  cases hk : keys.all isFractionalKey <;> simp_all

private theorem reorderCommands_valid_eq (elements : List (ElemId × Key)) (order : List ElemId)
    (rng : Rng) (hnd : (elements.map Prod.fst).Nodup)
    (hperm : (targetIds elements order).Perm (elements.map Prod.fst))
    (hmove : targetIds elements order ≠ elements.map Prod.fst)
    (hkeys : (!(elements.map Prod.snd).all isFractionalKey ||
      (elements.map Prod.snd).eraseDups.length != (elements.map Prod.snd).length) = false) :
    reorderCommands elements order rng =
      reorderCommands.loop elements (targetIds elements order)
        (((targetIds elements order).foldl (scanStep elements) (none, [])).2)
        (targetIds elements order) [] [] rng := by
  simp only [reorderCommands, target_guard_false elements order hnd hperm hmove, hkeys,
    Bool.false_eq_true, if_false]
  rfl

private theorem reorderCommands_valid_spec (elements : List (ElemId × Key)) (order : List ElemId)
    (rng : Rng) (hnd : (elements.map Prod.fst).Nodup)
    (hperm : (targetIds elements order).Perm (elements.map Prod.fst))
    (hmove : targetIds elements order ≠ elements.map Prod.fst)
    (hkeys : (!(elements.map Prod.snd).all isFractionalKey ||
      (elements.map Prod.snd).eraseDups.length != (elements.map Prod.snd).length) = false) :
    ∃ cmds rng', reorderCommands elements order rng = .ok (cmds, rng') ∧
      ((targetIds elements order).map (keyOf (applyReorders elements cmds))).Pairwise (· < ·) ∧
      ∀ e ∈ elements, (∀ c ∈ cmds, c.id ≠ e.1) → keyOf (applyReorders elements cmds) e.1 = e.2 := by
  have hn : (targetIds elements order).Nodup := hperm.nodup_iff.mpr hnd
  have hsub := targetIds_subset elements order
  rw [reorderCommands_valid_eq elements order rng hnd hperm hmove hkeys]
  obtain ⟨cs, r, hr, hs⟩ := loop_ok elements (targetIds elements order)
    (((targetIds elements order).foldl (scanStep elements) (none, [])).2)
    (fun cs => ((targetIds elements order).map (keyOf (applyReorders elements cs))).Pairwise (· < ·))
    (fun state => renumber_applied_sorted elements (targetIds elements order) state hn hsub)
    (fun done hd hs hk => loop_final elements (targetIds elements order) _ hn hsub done hd hs hk)
    (targetIds elements order) [] [] rng
    (loop_init elements (targetIds elements order) hn hsub (keys_valid_of_check _ hkeys))
  exact ⟨cs, r, hr, hs, fun e he hc => untouched_element elements cs hnd e he hc⟩

theorem reorderCommands_spec (elements : List (ElemId × Key)) (order : List ElemId) (rng : Rng)
    (hnd : (elements.map Prod.fst).Nodup)
    (hperm : (targetIds elements order).Perm (elements.map Prod.fst))
    (hmove : targetIds elements order ≠ elements.map Prod.fst) :
    ∃ cmds rng', reorderCommands elements order rng = .ok (cmds, rng') ∧
      ((targetIds elements order).map (keyOf (applyReorders elements cmds))).Pairwise (· < ·) ∧
      ∀ e ∈ elements, (∀ c ∈ cmds, c.id ≠ e.1) → keyOf (applyReorders elements cmds) e.1 = e.2 := by
  cases hk : (!(elements.map Prod.snd).all isFractionalKey ||
      (elements.map Prod.snd).eraseDups.length != (elements.map Prod.snd).length) with
  | false => exact reorderCommands_valid_spec elements order rng hnd hperm hmove hk
  | true => exact reorderCommands_renumber_spec elements order rng hnd hperm hmove hk

end Nodetto.ZOrder
