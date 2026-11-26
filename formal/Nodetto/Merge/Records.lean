import Nodetto.Merge.Value

namespace Nodetto.Merge

theorem find_append_record (rs : List (String × J)) (id k : String) (v : J) :
    find (rs ++ [(id, v)]) k = if id = k then some v else find rs k := by
  by_cases h : id = k <;> simp [find, lookupFirst, List.reverse_append, List.find?_cons, h]

theorem find_absent (rs : List (String × J)) (id : String)
    (h : id ∉ rs.map Prod.fst) : find rs id = none := by
  apply lookupFirst_absent
  simpa using h

theorem fold_append_parts {α β γ : Type} (xs : List α)
    (f : α → List β × List γ) (rs : List β) (cs : List γ) :
    xs.foldl (fun acc x => (acc.1 ++ (f x).1, acc.2 ++ (f x).2)) (rs, cs) =
      (rs ++ xs.flatMap (fun x => (f x).1), cs ++ xs.flatMap (fun x => (f x).2)) := by
  induction xs generalizing rs cs with
  | nil => simp
  | cons x xs ih =>
    simp only [List.foldl_cons, ih, List.flatMap_cons, List.append_assoc]

def recordParts (b l r : Option J) (id : String) : List (String × J) × List Conflict :=
  let emit (v : J) := ([(id, v)], [])
  let conflict (reason : Reason) := [{ id := id, reason := reason }]
  match b, l, r with
  | _, none, none => ([], [])
  | none, some lv, some rv =>
    if same (some lv) (some rv) then emit lv
    else let (v, c) := mergeValue (some (.obj [])) (some lv) (some rv)
         (v.toList.map (id, ·), if c then conflict .bothChanged else [])
  | none, some lv, none => emit lv
  | none, none, some rv => emit rv
  | some bv, none, some rv => ([], if same (some rv) (some bv) then [] else conflict .deletedLocally)
  | some bv, some lv, none =>
    if same (some lv) (some bv) then ([], []) else ([(id, lv)], conflict .deletedRemotely)
  | some bv, some lv, some rv =>
    let (v, c) := mergeValue (some bv) (some lv) (some rv)
    (v.toList.map (id, ·), if c then conflict .bothChanged else [])

theorem recordParts_same_change (b x : Option J) (id : String) :
    recordParts b x x id = (x.toList.map (id, ·), []) := by
  cases b <;> cases x <;> simp [recordParts, same_refl, mergeValue_same_change]

theorem find_filterMap_keys (ks : List String) (f : String → Option J) (k : String) :
    find (ks.filterMap (fun x => (f x).map (x, ·))) k =
      if k ∈ ks then f k else none := by
  rw [find, ← List.filterMap_reverse, lookupFirst_filterMap_keys]
  simp

theorem mergeById_parts (B L R : List (String × J)) :
    mergeById B L R =
      let ids := ((L ++ R ++ B).map Prod.fst).eraseDups
      (ids.flatMap (fun id => (recordParts (find B id) (find L id) (find R id) id).1),
       ids.flatMap (fun id => (recordParts (find B id) (find L id) (find R id) id).2)) := by
  let f := fun id => recordParts (find B id) (find L id) (find R id) id
  have step (acc : List (String × J) × List Conflict) (id : String) :
      (let (rs, cs) := acc
       let b := find B id
       let l := find L id
       let r := find R id
       let emit (v : J) := (rs ++ [(id, v)], cs)
       let conflict (reason : Reason) := cs ++ [{ id := id, reason := reason }]
       match b, l, r with
       | _, none, none => (rs, cs)
       | none, some lv, some rv =>
         if same (some lv) (some rv) then emit lv
         else let (v, c) := mergeValue (some (.obj [])) (some lv) (some rv)
              (rs ++ v.toList.map (id, ·), if c then conflict .bothChanged else cs)
       | none, some lv, none => emit lv
       | none, none, some rv => emit rv
       | some bv, none, some rv => (rs, if same (some rv) (some bv) then cs else conflict .deletedLocally)
       | some bv, some lv, none =>
         if same (some lv) (some bv) then (rs, cs) else (rs ++ [(id, lv)], conflict .deletedRemotely)
       | some bv, some lv, some rv =>
         let (v, c) := mergeValue (some bv) (some lv) (some rv)
         (rs ++ v.toList.map (id, ·), if c then conflict .bothChanged else cs)) =
        (acc.1 ++ (f id).1, acc.2 ++ (f id).2) := by
    rcases acc with ⟨rs, cs⟩
    dsimp [f]
    cases hb : find B id <;> cases hl : find L id <;> cases hr : find R id <;>
      simp only [hb, hl, hr, recordParts]
    all_goals repeat' split <;> simp_all
    all_goals simp_all
  unfold mergeById
  change List.foldl _ _ _ = _
  calc
    _ = (((L ++ R ++ B).map Prod.fst).eraseDups).foldl
        (fun acc id => (acc.1 ++ (f id).1, acc.2 ++ (f id).2)) ([], []) := by
      congr 1
      funext acc id
      exact step acc id
    _ = _ := by
      simpa [f] using fold_append_parts (((L ++ R ++ B).map Prod.fst).eraseDups) f [] []

theorem mergeById_same_change (B X : List (String × J)) :
    (mergeById B X X).2 = [] ∧ ∀ id, same (find (mergeById B X X).1 id) (find X id) = true := by
  let ids := ((X ++ X ++ B).map Prod.fst).eraseDups
  have hs : (ids.flatMap (fun id => (recordParts (find B id) (find X id) (find X id) id).1)) =
      ids.filterMap (fun id => (find X id).map (id, ·)) := by
    induction ids with
    | nil => rfl
    | cons a rest ih =>
      simp only [recordParts_same_change, Prod.fst] at ih
      simp only [List.flatMap_cons, recordParts_same_change, Prod.fst, List.filterMap_cons]
      cases h : find X a <;> simp_all
  rw [mergeById_parts]
  change (ids.flatMap (fun id => (recordParts (find B id) (find X id) (find X id) id).2)) = [] ∧
    ∀ id, same (find (ids.flatMap (fun id => (recordParts (find B id) (find X id) (find X id) id).1)) id) (find X id) = true
  constructor
  · simp [recordParts_same_change]
  · intro id
    rw [hs, find_filterMap_keys]
    by_cases hi : id ∈ ids
    · simp [hi, same_refl]
    · have hn : id ∉ X.map Prod.fst := by
        have hx : (∀ (x : J), ¬ (id, x) ∈ X) ∧ (∀ (x : J), ¬ (id, x) ∈ B) := by
          simpa [ids] using hi
        simpa using hx.1
      simp [hi, find_absent X id hn, same_refl]

def recordValue (b l r : Option J) (id : String) : Option J :=
  find (recordParts b l r id).1 id

theorem recordParts_value (b l r : Option J) (id : String) :
    (recordParts b l r id).1 = (recordValue b l r id).toList.map (id, ·) := by
  cases b <;> cases l <;> cases r <;> simp [recordValue, recordParts, find, lookupFirst]
  all_goals repeat' split <;> simp_all [find, lookupFirst]
  all_goals cases h : (mergeValue _ _ _).1 <;> simp_all [find, lookupFirst]

theorem recordParts_unchanged_ours (b t : Option J) (id : String) :
    (recordParts b b t id).2 = [] ∧ same (recordValue b b t id) t = true := by
  cases b <;> cases t <;> simp [recordParts, recordValue, find, lookupFirst, same_refl]
  all_goals rename_i bv tv
  all_goals have h := mergeValue_unchanged_ours (some bv) (some tv)
  all_goals cases hv : (mergeValue _ _ _).1 <;> cases hc : (mergeValue _ _ _).2 <;>
    simp_all [find, lookupFirst]

theorem recordParts_unchanged_theirs (b o : Option J) (id : String) :
    (recordParts b o b id).2 = [] ∧ same (recordValue b o b id) o = true := by
  cases b <;> cases o <;> simp [recordParts, recordValue, find, lookupFirst, same_refl]
  all_goals rename_i bv ov
  all_goals have h := mergeValue_unchanged_theirs (some bv) (some ov)
  all_goals cases hv : (mergeValue _ _ _).1 <;> cases hc : (mergeValue _ _ _).2 <;>
    simp_all [find, lookupFirst]

theorem mergeById_find (B L R : List (String × J)) (id : String) :
    find (mergeById B L R).1 id = recordValue (find B id) (find L id) (find R id) id := by
  let ids := ((L ++ R ++ B).map Prod.fst).eraseDups
  have hs : ids.flatMap (fun k => (recordParts (find B k) (find L k) (find R k) k).1) =
      ids.filterMap (fun k => (recordValue (find B k) (find L k) (find R k) k).map (k, ·)) := by
    induction ids with
    | nil => rfl
    | cons a rest ih =>
      simp only [recordParts_value] at ih
      simp only [List.flatMap_cons, recordParts_value, List.filterMap_cons]
      cases h : recordValue (find B a) (find L a) (find R a) a <;> simp_all
  rw [mergeById_parts]
  change find (ids.flatMap (fun k => (recordParts (find B k) (find L k) (find R k) k).1)) id = _
  rw [hs, find_filterMap_keys]
  by_cases hi : id ∈ ids
  · simp [hi]
  · have hn : id ∉ L.map Prod.fst ∧ id ∉ R.map Prod.fst ∧ id ∉ B.map Prod.fst := by
      simpa [ids, and_assoc] using hi
    rw [if_neg hi, find_absent L id hn.1, find_absent R id hn.2.1, find_absent B id hn.2.2]
    rfl

theorem mergeById_unchanged_ours (B T : List (String × J)) :
    (mergeById B B T).2 = [] ∧ ∀ id, same (find (mergeById B B T).1 id) (find T id) = true := by
  constructor
  · rw [mergeById_parts]
    simp only [List.flatMap_eq_nil_iff]
    intro id _
    exact (recordParts_unchanged_ours (find B id) (find T id) id).1
  · intro id
    rw [mergeById_find]
    exact (recordParts_unchanged_ours (find B id) (find T id) id).2

theorem mergeById_unchanged_theirs (B O : List (String × J)) :
    (mergeById B O B).2 = [] ∧ ∀ id, same (find (mergeById B O B).1 id) (find O id) = true := by
  constructor
  · rw [mergeById_parts]
    simp only [List.flatMap_eq_nil_iff]
    intro id _
    exact (recordParts_unchanged_theirs (find B id) (find O id) id).1
  · intro id
    rw [mergeById_find]
    exact (recordParts_unchanged_theirs (find B id) (find O id) id).2

theorem recordParts_conflict_id (b l r : Option J) (id k : String)
    (h : k ∈ (recordParts b l r id).2.map Conflict.id) : k = id := by
  cases b <;> cases l <;> cases r <;> simp [recordParts] at h
  all_goals repeat' split at h <;> simp_all
  all_goals rcases h with ⟨a, ⟨_, rfl⟩, hk⟩
  all_goals exact hk.symm

theorem mergeById_conflict_id (B L R : List (String × J)) (id : String) :
    id ∈ (mergeById B L R).2.map Conflict.id ↔
      id ∈ (recordParts (find B id) (find L id) (find R id) id).2.map Conflict.id := by
  let ids := ((L ++ R ++ B).map Prod.fst).eraseDups
  rw [mergeById_parts]
  change id ∈ (ids.flatMap (fun k => (recordParts (find B k) (find L k) (find R k) k).2)).map Conflict.id ↔ _
  simp only [List.map_flatMap, List.mem_flatMap]
  constructor
  · rintro ⟨k, _, hk⟩
    have he := recordParts_conflict_id (find B k) (find L k) (find R k) k id hk
    subst k
    exact hk
  · intro h
    by_cases hi : id ∈ ids
    · exact ⟨id, hi, h⟩
    · have hn : id ∉ L.map Prod.fst ∧ id ∉ R.map Prod.fst ∧ id ∉ B.map Prod.fst := by
        simpa [ids, and_assoc] using hi
      rw [find_absent L id hn.1, find_absent R id hn.2.1, find_absent B id hn.2.2] at h
      simp [recordParts] at h

theorem recordParts_conflict (b l r : Option J) (id : String) :
    id ∈ (recordParts b l r id).2.map Conflict.id ↔
      FieldConflict (recordBase b l r) l r := by
  rw [← mergeValue_conflict_iff]
  cases b with
  | none =>
    cases l with
    | none =>
      cases r with
      | none => simp [recordParts, recordBase, mergeValue_same_change]
      | some rv =>
        have hv := (mergeValue_unchanged_ours none (some rv)).2
        simp [recordParts, recordBase, hv]
    | some lv =>
      cases r with
      | none =>
        have hv := (mergeValue_unchanged_theirs none (some lv)).2
        simp [recordParts, recordBase, hv]
      | some rv =>
        by_cases h : same (some lv) (some rv) = true
        · have hv : (mergeValue (some (.obj [])) (some lv) (some rv)).2 = false := by
            simp [mergeValue.eq_def, h]
          simp [recordParts, recordBase, h, hv]
        · have hf : same (some lv) (some rv) = false := Bool.eq_false_iff.mpr h
          cases hm : mergeValue (some (.obj [])) (some lv) (some rv) with
          | mk v c => cases c <;> simp_all [recordParts, recordBase]
  | some bv =>
    cases l with
    | none =>
      cases r with
      | none => simp [recordParts, recordBase, mergeValue_same_change]
      | some rv =>
        have hn1 : same none (some rv) = false := by simp [same]
        have hn2 : same none (some bv) = false := by simp [same]
        by_cases h : same (some rv) (some bv) = true
        · have hv : (mergeValue (some bv) none (some rv)).2 = false := by
            simp [mergeValue.eq_def, hn1, hn2, h]
          simp [recordParts, recordBase, h, hv]
        · have hf : same (some rv) (some bv) = false := Bool.eq_false_iff.mpr h
          have hv : (mergeValue (some bv) none (some rv)).2 = true := by
            simp [mergeValue.eq_def, hn1, hn2, hf]
          simp [recordParts, recordBase, hf, hv]
    | some lv =>
      cases r with
      | none =>
        have hn1 : same (some lv) none = false := by simp [same]
        have hn2 : same none (some bv) = false := by simp [same]
        by_cases h : same (some lv) (some bv) = true
        · have hv : (mergeValue (some bv) (some lv) none).2 = false := by
            simp [mergeValue.eq_def, hn1, hn2, h]
          simp [recordParts, recordBase, h, hv]
        · have hf : same (some lv) (some bv) = false := Bool.eq_false_iff.mpr h
          have hv : (mergeValue (some bv) (some lv) none).2 = true := by
            simp [mergeValue.eq_def, hn1, hn2, hf]
          simp [recordParts, recordBase, hf, hv]
      | some rv =>
        cases hm : mergeValue (some bv) (some lv) (some rv) with
        | mk v c => cases c <;> simp_all [recordParts, recordBase]

theorem mergeById_conflict_iff (B L R : List (String × J)) (id : String) :
    id ∈ (mergeById B L R).2.map Conflict.id ↔
      FieldConflict (recordBase (find B id) (find L id) (find R id)) (find L id) (find R id) := by
  rw [mergeById_conflict_id, recordParts_conflict]

theorem find_option_record (v : Option J) (id : String) :
    find (v.toList.map (id, ·)) id = v := by
  cases v <;> simp [find, lookupFirst]

theorem find_single_record (v : J) (id : String) :
    find [(id, v)] id = some v := by simp [find, lookupFirst]

theorem recordParts_symm (b l r : Option J) (id : String)
    (h : (recordParts b l r id).2 = []) :
    (recordParts b r l id).2 = [] ∧ same (recordValue b l r id) (recordValue b r l id) = true := by
  cases b <;> cases l <;> cases r <;> simp [recordParts, recordValue, find_option_record, find_single_record, same_refl] at *
  all_goals repeat' split at * <;> simp_all [same_refl]
  all_goals try { simp_all [find_option_record, find_single_record] }
  all_goals try { rename_i lv rv hlr hrl; have hs := same_symm (some lv) (some rv); simp_all }
  all_goals try { exact mergeValue_symm _ _ _ h }
  all_goals rw [find_option_record]
  all_goals rw [find_option_record]
  all_goals exact mergeValue_symm _ _ _ h

theorem mergeById_symm (B L R : List (String × J)) (h : (mergeById B L R).2 = []) :
    (mergeById B R L).2 = [] ∧
      ∀ id, same (find (mergeById B L R).1 id) (find (mergeById B R L).1 id) = true := by
  have localEmpty (id : String) : (recordParts (find B id) (find L id) (find R id) id).2 = [] := by
    cases hc : (recordParts (find B id) (find L id) (find R id) id).2 with
    | nil => rfl
    | cons c cs =>
      have hid : c.id = id := by
        apply recordParts_conflict_id (find B id) (find L id) (find R id) id c.id
        simp [hc]
      have hm : id ∈ (mergeById B L R).2.map Conflict.id := by
        apply (mergeById_conflict_id B L R id).2
        simp [hc, hid]
      simp [h] at hm
  constructor
  · rw [mergeById_parts]
    simp only [List.flatMap_eq_nil_iff]
    intro id _
    exact (recordParts_symm (find B id) (find L id) (find R id) id (localEmpty id)).1
  · intro id
    rw [mergeById_find, mergeById_find]
    exact (recordParts_symm (find B id) (find L id) (find R id) id (localEmpty id)).2

end Nodetto.Merge
