import Nodetto.Merge.Diff

namespace Nodetto.Merge

theorem mergeValue_unchanged_ours (b t : Option J) :
    same (mergeValue b b t).1 t = true ∧ (mergeValue b b t).2 = false := by
  by_cases h : same b t = true
  · simp [mergeValue.eq_def, h]
  · simp [mergeValue.eq_def, h, same_refl]

theorem mergeValue_unchanged_theirs (b o : Option J) :
    same (mergeValue b o b).1 o = true ∧ (mergeValue b o b).2 = false := by
  by_cases h : same o b = true
  · simp [mergeValue.eq_def, h, same_refl]
  · simp [mergeValue.eq_def, h, same_refl]

theorem mergeValue_same_change (b x : Option J) :
    mergeValue b x x = (x, false) := by
  simp [mergeValue.eq_def, same_refl]

theorem fieldConflict_unchanged_left (b l r : Option J) (h : same b l = true) :
    ¬ FieldConflict b l r := by
  intro ⟨p, hp, _⟩
  rw [diffPaths_of_same b l h] at hp
  simp at hp

theorem fieldConflict_unchanged_right (b l r : Option J) (h : same b r = true) :
    ¬ FieldConflict b l r := by
  intro hc
  exact fieldConflict_unchanged_left b r l h ((fieldConflict_symm b l r).mp hc)

theorem fieldConflict_same (b l r : Option J) (h : same l r = true) :
    ¬ FieldConflict b l r := by
  intro ⟨p, hp, q, hq, hpre, hn⟩
  have hq' := (diffPaths_same b r l q ((same_symm r l).trans h)).mp hq
  have he : p = q := by
    cases hpre with
    | inl h => exact diffPaths_prefix_free b l p q hp hq' h
    | inr h => exact (diffPaths_prefix_free b l q p hq' hp h).symm
  subst q
  exact hn ⟨rfl, getPath_same l r p h⟩

theorem fieldConflict_objects (bs ls rs : List (String × J))
    (hl : same (some (.obj bs)) (some (.obj ls)) = false)
    (hr : same (some (.obj bs)) (some (.obj rs)) = false) :
    FieldConflict (some (.obj bs)) (some (.obj ls)) (some (.obj rs)) ↔
      ∃ k, FieldConflict (lookupFirst bs k) (lookupFirst ls k) (lookupFirst rs k) := by
  constructor
  · rintro ⟨p, hp, q, hq, hpre, hn⟩
    obtain ⟨k, p, hpchild, rfl⟩ := (diffPaths_object_step bs ls p hl).mp hp
    obtain ⟨j, q, hqchild, rfl⟩ := (diffPaths_object_step bs rs q hr).mp hq
    have he : k = j := by
      cases hpre with
      | inl h => exact (List.cons_prefix_cons.mp h).1
      | inr h => exact (List.cons_prefix_cons.mp h).1.symm
    subst j
    refine ⟨k, p, hpchild, q, hqchild, ?_, ?_⟩
    · simpa only [List.cons_prefix_cons, true_and] using hpre
    · intro hc
      apply hn
      simpa [getPath] using hc
  · rintro ⟨k, p, hp, q, hq, hpre, hn⟩
    refine ⟨k :: p, (diffPaths_object_step bs ls _ hl).mpr ⟨k, p, hp, rfl⟩,
      k :: q, (diffPaths_object_step bs rs _ hr).mpr ⟨k, q, hq, rfl⟩, ?_, ?_⟩
    · simpa only [List.cons_prefix_cons, true_and] using hpre
    · intro hc
      apply hn
      simpa [getPath] using hc

theorem lookupFirst_filterMap_keys (ks : List String) (f : String → Option J) (k : String) :
    lookupFirst (ks.filterMap (fun x => (f x).map (x, ·))) k =
      if k ∈ ks then f k else none := by
  induction ks with
  | nil => simp [lookupFirst]
  | cons a rest ih =>
    by_cases h : a = k
    · subst a
      cases hf : f k with
      | none =>
        simp only [List.filterMap_cons, hf, Option.map_none, List.mem_cons, true_or, if_true]
        simpa [hf] using ih
      | some v => simp [List.filterMap_cons, hf, lookupFirst]
    · cases hf : f a with
      | none =>
        simp only [List.filterMap_cons, hf, Option.map_none, List.mem_cons, h, Ne.symm h, false_or]
        exact ih
      | some v =>
        simp only [List.filterMap_cons, hf, Option.map_some, List.mem_cons, Ne.symm h, false_or]
        simpa [lookupFirst, h] using ih

theorem any_key_flags (ks : List String) (f : String → Option J × Bool) :
    ((ks.map fun k => (k, f k)).any fun p => p.2.2) = true ↔
      ∃ k ∈ ks, (f k).2 = true := by
  simp [List.any_eq_true]

theorem mergeValue_object_flag (bs ls rs : List (String × J))
    (hlr : same (some (.obj ls)) (some (.obj rs)) = false)
    (hlb : same (some (.obj ls)) (some (.obj bs)) = false)
    (hrb : same (some (.obj rs)) (some (.obj bs)) = false) :
    (mergeValue (some (.obj bs)) (some (.obj ls)) (some (.obj rs))).2 = true ↔
      ∃ k, (mergeValue (lookupFirst bs k) (lookupFirst ls k) (lookupFirst rs k)).2 = true := by
  let ks := (keysUnion bs ls ++ rs.map Prod.fst).eraseDups
  rw [mergeValue.eq_def]
  simp only [hlr, hlb, hrb, Bool.false_eq_true, ↓reduceIte]
  rw [any_key_flags]
  constructor
  · rintro ⟨k, _, hk⟩
    exact ⟨k, hk⟩
  · rintro ⟨k, hk⟩
    refine ⟨k, ?_, hk⟩
    by_cases hn : k ∈ ks
    · exact hn
    · have h : k ∉ bs.map Prod.fst ∧ k ∉ ls.map Prod.fst ∧ k ∉ rs.map Prod.fst := by
        simpa [ks, keysUnion, and_assoc] using hn
      rw [lookupFirst_absent bs k h.1, lookupFirst_absent ls k h.2.1,
        lookupFirst_absent rs k h.2.2, mergeValue_same_change] at hk
      simp at hk

theorem mergeValue_object_lookup (bs ls rs : List (String × J)) (k : String)
    (hlr : same (some (.obj ls)) (some (.obj rs)) = false)
    (hlb : same (some (.obj ls)) (some (.obj bs)) = false)
    (hrb : same (some (.obj rs)) (some (.obj bs)) = false) :
    getPath (mergeValue (some (.obj bs)) (some (.obj ls)) (some (.obj rs))).1 [k] =
      (mergeValue (lookupFirst bs k) (lookupFirst ls k) (lookupFirst rs k)).1 := by
  let ks := (keysUnion bs ls ++ rs.map Prod.fst).eraseDups
  rw [mergeValue.eq_def]
  simp only [hlr, hlb, hrb, Bool.false_eq_true, ↓reduceIte, getPath]
  simp only [List.filterMap_map, Function.comp_def]
  rw [lookupFirst_filterMap_keys]
  by_cases hk : k ∈ ks
  · simp only [show k ∈ (keysUnion bs ls ++ rs.map Prod.fst).eraseDups from hk, ite_true]
  · have h : k ∉ bs.map Prod.fst ∧ k ∉ ls.map Prod.fst ∧ k ∉ rs.map Prod.fst := by
      simpa [ks, keysUnion, and_assoc] using hk
    simp only [show k ∉ (keysUnion bs ls ++ rs.map Prod.fst).eraseDups from hk, if_neg]
    rw [lookupFirst_absent bs k h.1, lookupFirst_absent ls k h.2.1,
      lookupFirst_absent rs k h.2.2, mergeValue_same_change]
    rfl

theorem fieldConflict_root (b l r : Option J) (hroot : diffPaths b l = [[]])
    (hr : same b r = false) (hlr : same l r = false) : FieldConflict b l r := by
  cases hd : diffPaths b r with
  | nil =>
    have he := diffPaths_empty_same b r hd
    simp [hr] at he
  | cons q qs =>
    refine ⟨[], by simp [hroot], q, by simp [hd], Or.inl List.nil_prefix, ?_⟩
    rintro ⟨hq, hs⟩
    subst q
    simp [getPath, hlr] at hs

theorem mergeValue_conflict_iff (b l r : Option J) :
    (mergeValue b l r).2 = true ↔ FieldConflict b l r := by
  by_cases hlr : same l r = true
  · have hn := fieldConflict_same b l r hlr
    simp [mergeValue.eq_def, hlr, hn]
  · have hlrf : same l r = false := Bool.eq_false_iff.mpr hlr
    by_cases hlb : same l b = true
    · have hn := fieldConflict_unchanged_left b l r ((same_symm b l).trans hlb)
      simp [mergeValue.eq_def, hlrf, hlb, hn]
    · have hlbf : same l b = false := Bool.eq_false_iff.mpr hlb
      by_cases hrb : same r b = true
      · have hn := fieldConflict_unchanged_right b l r ((same_symm b r).trans hrb)
        simp [mergeValue.eq_def, hlrf, hlbf, hrb, hn]
      · have hrbf : same r b = false := Bool.eq_false_iff.mpr hrb
        have hbl : same b l = false := (same_symm b l).trans hlbf
        have hbr : same b r = false := (same_symm b r).trans hrbf
        by_cases ho : ∃ bs ls rs, b = some (.obj bs) ∧ l = some (.obj ls) ∧ r = some (.obj rs)
        · obtain ⟨bs, ls, rs, rfl, rfl, rfl⟩ := ho
          rw [mergeValue_object_flag bs ls rs hlrf hlbf hrbf, fieldConflict_objects bs ls rs hbl hbr]
          exact exists_congr fun k => mergeValue_conflict_iff (lookupFirst bs k) (lookupFirst ls k) (lookupFirst rs k)
        · have hn : ¬ ∃ bs ls rs, b = some (.obj bs) ∧ l = some (.obj ls) ∧ r = some (.obj rs) := ho
          have hc : FieldConflict b l r := by
            by_cases hleft : ∃ bs ls, b = some (.obj bs) ∧ l = some (.obj ls)
            · obtain ⟨bs, ls, hb, hl⟩ := hleft
              have hright : ¬ ∃ bs rs, b = some (.obj bs) ∧ r = some (.obj rs) := by
                rintro ⟨bs', rs, hb', hr⟩
                cases hb.symm.trans hb'
                exact hn ⟨bs, ls, rs, hb, hl, hr⟩
              exact (fieldConflict_symm b r l).mp (fieldConflict_root b r l (diffPaths_nonobject b r hbr hright) hbl ((same_symm r l).trans hlrf))
            · exact fieldConflict_root b l r (diffPaths_nonobject b l hbl hleft) hbr hlrf
          cases b with
          | none => simp [mergeValue.eq_def, hlrf, hlbf, hrbf, hc]
          | some b =>
            cases b <;> cases l <;> simp_all [mergeValue.eq_def] <;>
              rename_i l <;> cases l <;> cases r <;> simp_all [mergeValue.eq_def] <;>
              rename_i r <;> cases r <;> simp_all [mergeValue.eq_def]
termination_by sizeOf b
decreasing_by
  all_goals simp_wf
  all_goals simp_all
  all_goals cases hk : lookupFirst bs k with
  | none => simp [hk]; omega
  | some v =>
    have hs := lookupFirst_size bs k v hk
    simp [hk]
    omega

theorem mergeValue_symm (b l r : Option J) (h : (mergeValue b l r).2 = false) :
    (mergeValue b r l).2 = false ∧ same (mergeValue b l r).1 (mergeValue b r l).1 = true := by
  by_cases hlr : same l r = true
  · have hrl := (same_symm r l).trans hlr
    simp [mergeValue.eq_def, hlr, hrl]
  · have hlrf : same l r = false := Bool.eq_false_iff.mpr hlr
    have hrlf : same r l = false := (same_symm r l).trans hlrf
    by_cases hlb : same l b = true
    · by_cases hrb : same r b = true
      · have he := same_trans l b r hlb ((same_symm b r).trans hrb)
        simp [hlrf] at he
      · simp [mergeValue.eq_def, hlrf, hrlf, hlb, hrb, same_refl]
    · have hlbf : same l b = false := Bool.eq_false_iff.mpr hlb
      by_cases hrb : same r b = true
      · simp [mergeValue.eq_def, hlrf, hrlf, hlbf, hrb, same_refl]
      · have hrbf : same r b = false := Bool.eq_false_iff.mpr hrb
        by_cases ho : ∃ bs ls rs, b = some (.obj bs) ∧ l = some (.obj ls) ∧ r = some (.obj rs)
        · obtain ⟨bs, ls, rs, rfl, rfl, rfl⟩ := ho
          have child (k : String) : (mergeValue (lookupFirst bs k) (lookupFirst ls k) (lookupFirst rs k)).2 = false := by
            cases hc : (mergeValue (lookupFirst bs k) (lookupFirst ls k) (lookupFirst rs k)).2 with
            | false => rfl
            | true =>
              have := (mergeValue_object_flag bs ls rs hlrf hlbf hrbf).2 ⟨k, hc⟩
              simp [h] at this
          have ih (k : String) := mergeValue_symm (lookupFirst bs k) (lookupFirst ls k) (lookupFirst rs k) (child k)
          have hs : (mergeValue (some (.obj bs)) (some (.obj rs)) (some (.obj ls))).2 = false := by
            cases hh : (mergeValue (some (.obj bs)) (some (.obj rs)) (some (.obj ls))).2 with
            | false => rfl
            | true =>
              obtain ⟨k, hk⟩ := (mergeValue_object_flag bs rs ls hrlf hrbf hlbf).1 hh
              have := (ih k).1
              simp [hk] at this
          refine ⟨hs, ?_⟩
          let left := ((keysUnion bs ls ++ rs.map Prod.fst).eraseDups).filterMap fun k =>
            ((mergeValue (lookupFirst bs k) (lookupFirst ls k) (lookupFirst rs k)).1).map (k, ·)
          let right := ((keysUnion bs rs ++ ls.map Prod.fst).eraseDups).filterMap fun k =>
            ((mergeValue (lookupFirst bs k) (lookupFirst rs k) (lookupFirst ls k)).1).map (k, ·)
          have he : same (some (.obj left)) (some (.obj right)) = true := by
            apply same_object_of_lookup
            intro k
            have hk := (ih k).2
            rw [← mergeValue_object_lookup bs ls rs k hlrf hlbf hrbf,
              ← mergeValue_object_lookup bs rs ls k hrlf hrbf hlbf] at hk
            rw [mergeValue.eq_def (some (.obj bs)) (some (.obj ls)) (some (.obj rs)),
              mergeValue.eq_def (some (.obj bs)) (some (.obj rs)) (some (.obj ls))] at hk
            simpa only [hlrf, hlbf, hrbf, hrlf, Bool.false_eq_true, ↓reduceIte, getPath,
              List.filterMap_map, Function.comp_def, left, right] using hk
          rw [mergeValue.eq_def (some (.obj bs)) (some (.obj ls)) (some (.obj rs)),
            mergeValue.eq_def (some (.obj bs)) (some (.obj rs)) (some (.obj ls))]
          simpa only [hlrf, hlbf, hrbf, hrlf, Bool.false_eq_true, ↓reduceIte,
            List.filterMap_map, Function.comp_def, left, right] using he
        · rw [mergeValue.eq_def] at h
          simp only [hlrf, hlbf, hrbf, Bool.false_eq_true, ↓reduceIte] at h
          cases b with
          | none => simp at h
          | some b =>
            cases b <;> cases l <;> simp_all <;>
              rename_i l <;> cases l <;> cases r <;> simp_all <;>
              rename_i r <;> cases r <;> simp_all
termination_by sizeOf b
decreasing_by
  all_goals simp_wf
  all_goals simp_all
  all_goals cases hk : lookupFirst bs k with
  | none => simp [hk]; omega
  | some v =>
    have hs := lookupFirst_size bs k v hk
    simp [hk]
    omega

end Nodetto.Merge
