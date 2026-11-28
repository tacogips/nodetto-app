import Nodetto.Undo.Model

namespace Nodetto.Undo

private theorem lookup_cons_same (s : Store) (id : ElemId) (value : Int) :
    lookup ((id, value) :: s) id = some value := by
  simp [lookup]

private theorem lookup_cons_other (s : Store) (id other : ElemId) (value : Int)
    (h : id ≠ other) : lookup ((id, value) :: s) other = lookup s other := by
  simp [lookup, h]

private theorem lookup_filter (s : Store) (id : ElemId) (p : ElemId → Bool) :
    lookup (s.filter fun pair => p pair.1) id =
      if p id then lookup s id else none := by
  induction s with
  | nil => simp [lookup]
  | cons a rest ih =>
    rcases a with ⟨key, value⟩
    by_cases h : key = id
    · subst key
      cases hp : p id <;> simp only [List.filter_cons, hp, Bool.false_eq_true,
        ↓reduceIte, lookup_cons_same, ih]
    · cases hp : p key <;> simp only [List.filter_cons, hp, Bool.false_eq_true,
        ↓reduceIte, lookup_cons_other _ _ _ _ h, ih]

private theorem lookup_remove_key (s : Store) (key id : ElemId) :
    lookup (s.filter fun pair => pair.1 != key) id =
      if id = key then none else lookup s id := by
  have h := lookup_filter s id (fun x => x != key)
  by_cases e : id = key <;> simpa [e] using h

private theorem update_restores_lookup (s : Store) (key id : ElemId) (old new : Int)
    (h : lookup s key = some old) :
    lookup ((key, old) :: (((key, new) :: (s.filter fun p => p.1 != key)).filter
      fun p => p.1 != key)) id = lookup s id := by
  by_cases e : key = id
  · subst id
    simp [lookup_cons_same, h]
  · simp [lookup_cons_other _ _ _ _ e, lookup_remove_key, Ne.symm e]

private theorem create_restores_lookup (s : Store) (key id : ElemId) (value : Int)
    (h : lookup s key = none) :
    lookup (((key, value) :: s).filter fun p => p.1 != key) id = lookup s id := by
  rw [lookup_remove_key]
  by_cases e : id = key
  · subst id
    simpa using h.symm
  · simp [e, lookup_cons_other _ _ _ _ (Ne.symm e)]

private theorem lookup_delete_keys (s : Store) (ids : List ElemId) (id : ElemId) :
    lookup (s.filter fun p => !ids.contains p.1) id =
      if ids.contains id then none else lookup s id := by
  have h := lookup_filter s id (fun x => !ids.contains x)
  by_cases hi : id ∈ ids <;> simpa [hi] using h

private theorem deleted_pair_spec (s : Store) (ids : List ElemId) (id : ElemId) (v : Int) :
    (id, v) ∈ (ids.eraseDups.filterMap fun key =>
      (lookup s key).map fun value => (key, value)).mergeSort (fun a b => a.1 ≤ b.1) ↔
      id ∈ ids ∧ lookup s id = some v := by
  rw [List.Perm.mem_iff (List.mergeSort_perm _ _)]
  simp only [List.mem_filterMap, List.mem_eraseDups]
  constructor
  · rintro ⟨key, hk, he⟩
    cases hv : lookup s key with
    | none => simp [hv] at he
    | some value =>
      simp [hv] at he
      rcases he with ⟨rfl, rfl⟩
      exact ⟨hk, hv⟩
  · rintro ⟨hi, hv⟩
    exact ⟨id, hi, by simp [hv]⟩

private theorem deleted_pair_absent (s : Store) (ids : List ElemId) (id : ElemId) (v : Int)
    (h : (id, v) ∈ (ids.eraseDups.filterMap fun key =>
      (lookup s key).map fun value => (key, value)).mergeSort (fun a b => a.1 ≤ b.1)) :
    lookup (s.filter fun p => !ids.contains p.1) id = none := by
  have hi := ((deleted_pair_spec s ids id v).mp h).1
  simpa [hi] using lookup_delete_keys s ids id

private theorem deleted_pair_value_unique (s : Store) (ids : List ElemId)
    (id : ElemId) (v w : Int)
    (hv : (id, v) ∈ (ids.eraseDups.filterMap fun key =>
      (lookup s key).map fun value => (key, value)).mergeSort (fun a b => a.1 ≤ b.1))
    (hw : (id, w) ∈ (ids.eraseDups.filterMap fun key =>
      (lookup s key).map fun value => (key, value)).mergeSort (fun a b => a.1 ≤ b.1)) :
    v = w := by
  have h₁ := ((deleted_pair_spec s ids id v).mp hv).2
  have h₂ := ((deleted_pair_spec s ids id w).mp hw).2
  exact Option.some.inj (h₁.symm.trans h₂)

private theorem deleted_pairs_congruent (s t : Store) (ids : List ElemId)
    (h : ∀ id, lookup s id = lookup t id) :
    (ids.eraseDups.filterMap fun key => (lookup s key).map fun value => (key, value)).mergeSort
        (fun a b => a.1 ≤ b.1) =
      (ids.eraseDups.filterMap fun key => (lookup t key).map fun value => (key, value)).mergeSort
        (fun a b => a.1 ≤ b.1) := by
  simp only [h]

private theorem lookup_append_absent (entries s : Store) (id : ElemId)
    (h : id ∉ entries.map Prod.fst) :
    lookup (entries ++ s) id = lookup s id := by
  induction entries with
  | nil => rfl
  | cons p rest ih =>
    rcases p with ⟨key, value⟩
    simp only [List.map_cons, List.mem_cons, not_or] at h
    simp only [List.cons_append, lookup_cons_other _ _ _ _ (Ne.symm h.1), ih h.2]

private theorem lookup_append_member (entries s : Store) (id : ElemId) (value : Int)
    (hn : (entries.map Prod.fst).Nodup) (hm : (id, value) ∈ entries) :
    lookup (entries ++ s) id = some value := by
  induction entries with
  | nil => simp at hm
  | cons p rest ih =>
    rcases p with ⟨key, v⟩
    simp only [List.map_cons, List.nodup_cons] at hn
    simp only [List.mem_cons] at hm
    rcases hm with he | hm
    · cases he
      simp [lookup_cons_same]
    · have hne : key ≠ id := by
        intro he
        subst key
        exact hn.1 (List.mem_map.mpr ⟨(id, value), hm, rfl⟩)
      simpa [lookup_cons_other _ _ _ _ hne] using ih hn.2 hm

private theorem eraseDups_nodup (xs : List ElemId) : xs.eraseDups.Nodup := by
  cases xs with
  | nil => simp
  | cons a xs =>
    rw [List.eraseDups_cons, List.nodup_cons]
    constructor
    · simp [List.mem_eraseDups]
    · exact eraseDups_nodup _
termination_by xs.length
decreasing_by
  simp_wf
  exact Nat.lt_succ_of_le (List.length_filter_le _ _)

private theorem removed_keys (s : Store) (ids : List ElemId) :
    (ids.filterMap fun key => (lookup s key).map fun value => (key, value)).map Prod.fst =
      ids.filter (fun key => (lookup s key).isSome) := by
  induction ids with
  | nil => rfl
  | cons id rest ih =>
    cases h : lookup s id <;> simp [h, ih]

private theorem deleted_keys_nodup (s : Store) (ids : List ElemId) :
    ((ids.eraseDups.filterMap fun key => (lookup s key).map fun value => (key, value)).mergeSort
      (fun a b => a.1 ≤ b.1) |>.map Prod.fst).Nodup := by
  have h := (List.mergeSort_perm
    (ids.eraseDups.filterMap fun key => (lookup s key).map fun value => (key, value))
    (fun a b => a.1 ≤ b.1)).map Prod.fst
  apply h.symm.nodup
  rw [removed_keys]
  exact (eraseDups_nodup ids).filter _

private theorem deleted_lookup_restored (s : Store) (ids : List ElemId) (id : ElemId) :
    lookup (( (ids.eraseDups.filterMap fun key =>
      (lookup s key).map fun value => (key, value)).mergeSort
        (fun a b => a.1 ≤ b.1)).reverse ++ s.filter (fun p => !ids.contains p.1)) id =
      lookup s id := by
  let entries := (ids.eraseDups.filterMap fun key =>
    (lookup s key).map fun value => (key, value)).mergeSort (fun a b => a.1 ≤ b.1)
  have hn : (entries.reverse.map Prod.fst).Nodup := by
    apply (List.Perm.map Prod.fst (List.reverse_perm entries)).symm.nodup
    exact deleted_keys_nodup s ids
  by_cases hi : id ∈ ids
  · cases hv : lookup s id with
    | some v =>
      have hm : (id, v) ∈ entries.reverse := by
        simpa [entries] using (deleted_pair_spec s ids id v).mpr ⟨hi, hv⟩
      simpa [entries, hv] using lookup_append_member entries.reverse
        (s.filter fun p => !ids.contains p.1) id v hn hm
    | none =>
      have ha : id ∉ entries.reverse.map Prod.fst := by
        intro hm
        obtain ⟨⟨key, value⟩, hp, he⟩ := List.mem_map.mp hm
        simp only at he
        subst key
        have hp' : (id, value) ∈ entries := by simpa using hp
        have := ((deleted_pair_spec s ids id value).mp (by simpa [entries] using hp')).2
        simp [hv] at this
      rw [show lookup (entries.reverse ++ s.filter (fun p => !ids.contains p.1)) id =
        lookup (s.filter fun p => !ids.contains p.1) id from lookup_append_absent _ _ _ ha]
      rw [lookup_delete_keys]
      simp [hi, hv]
  · have ha : id ∉ entries.reverse.map Prod.fst := by
      intro hm
      obtain ⟨⟨key, value⟩, hp, he⟩ := List.mem_map.mp hm
      simp only at he
      subst key
      have hp' : (id, value) ∈ entries := by simpa using hp
      exact hi (((deleted_pair_spec s ids id value).mp (by simpa [entries] using hp')).1)
    rw [show lookup (entries.reverse ++ s.filter (fun p => !ids.contains p.1)) id =
      lookup (s.filter fun p => !ids.contains p.1) id from lookup_append_absent _ _ _ ha]
    rw [lookup_delete_keys]
    simp [hi]

private theorem fold_creates (entries : Store) (s : Store) (u : List Cmd)
    (hn : (entries.map Prod.fst).Nodup)
    (ha : ∀ p ∈ entries, lookup s p.1 = none) :
    entries.foldlM (fun (st : Store × List Cmd) (p : ElemId × Int) =>
      if (lookup st.1 p.1).isSome then Except.error "command"
      else .ok (p :: st.1, Cmd.delete [p.1] :: st.2)) (s, u) =
      .ok (entries.reverse ++ s, entries.reverse.map (fun p => Cmd.delete [p.1]) ++ u) := by
  induction entries generalizing s u with
  | nil => rfl
  | cons p rest ih =>
    rcases p with ⟨key, value⟩
    simp only [List.map_cons, List.nodup_cons] at hn
    have hhead : lookup s key = none := ha (key, value) (by simp)
    have htail : ∀ q ∈ rest, lookup ((key, value) :: s) q.1 = none := by
      intro q hq
      have hne : key ≠ q.1 := by
        intro he
        apply hn.1
        exact List.mem_map.mpr ⟨q, hq, he.symm⟩
      rw [lookup_cons_other _ _ _ _ hne]
      exact ha q (by simp [hq])
    simp only [List.foldlM_cons, hhead, Option.isSome_none, Bool.false_eq_true,
      ↓reduceIte]
    change rest.foldlM _ ((key, value) :: s, Cmd.delete [key] :: u) = _
    simpa [Except.bind, List.reverse_cons, List.map_append, List.append_assoc] using
      ih ((key, value) :: s) (Cmd.delete [key] :: u) hn.2 htail

private theorem apply_creates (entries : Store) (s : Store)
    (hn : (entries.map Prod.fst).Nodup)
    (ha : ∀ p ∈ entries, lookup s p.1 = none) :
    applyCommands s (entries.map fun p => Cmd.create p.1 p.2) =
      .ok (entries.reverse ++ s, entries.reverse.map (fun p => Cmd.delete [p.1])) := by
  unfold applyCommands
  rw [List.foldlM_map]
  have hf : (fun (st : Store × List Cmd) (p : ElemId × Int) =>
      if (lookup st.1 p.1).isSome then Except.error "command"
      else .ok ((p.1, p.2) :: st.1, Cmd.delete [p.1] :: st.2)) =
      (fun (st : Store × List Cmd) (p : ElemId × Int) =>
      if (lookup st.1 p.1).isSome then Except.error "command"
      else .ok (p :: st.1, Cmd.delete [p.1] :: st.2)) := by
    funext st p
    cases p
    rfl
  change entries.foldlM (fun (st : Store × List Cmd) (p : ElemId × Int) =>
      if (lookup st.1 p.1).isSome then Except.error "command"
      else .ok ((p.1, p.2) :: st.1, Cmd.delete [p.1] :: st.2)) (s, []) = _
  rw [hf]
  simpa using fold_creates entries s [] hn ha

private theorem delete_inverse (s : Store) (ids : List ElemId) :
    let entries := (ids.eraseDups.filterMap fun key =>
      (lookup s key).map fun value => (key, value)).mergeSort (fun a b => a.1 ≤ b.1)
    ∃ t u, applyCommands (s.filter fun p => !ids.contains p.1)
      (entries.map fun p => Cmd.create p.1 p.2) = .ok (t, u) ∧
      ∀ id, lookup t id = lookup s id := by
  dsimp only
  let entries := (ids.eraseDups.filterMap fun key =>
    (lookup s key).map fun value => (key, value)).mergeSort (fun a b => a.1 ≤ b.1)
  have hn : (entries.map Prod.fst).Nodup := deleted_keys_nodup s ids
  have ha : ∀ p ∈ entries, lookup (s.filter fun p => !ids.contains p.1) p.1 = none := by
    intro p hp
    rcases p with ⟨key, value⟩
    exact deleted_pair_absent s ids key value hp
  refine ⟨entries.reverse ++ s.filter (fun p => !ids.contains p.1),
    entries.reverse.map (fun p => Cmd.delete [p.1]), ?_, ?_⟩
  · exact apply_creates entries _ hn ha
  · intro id
    exact deleted_lookup_restored s ids id

private theorem fold_suffix
    (step : Store × List Cmd → Cmd → Except String (Store × List Cmd))
    (hs : ∀ s u v c, step (s, u ++ v) c =
      (step (s, u) c).map (fun p => (p.1, p.2 ++ v)))
    (cs : List Cmd) (s : Store) (u v : List Cmd) :
    cs.foldlM step (s, u ++ v) =
      (cs.foldlM step (s, u)).map (fun p => (p.1, p.2 ++ v)) := by
  induction cs generalizing s u with
  | nil => rfl
  | cons c rest ih =>
    rw [List.foldlM_cons, List.foldlM_cons, hs]
    cases he : step (s, u) c with
    | error e => rfl
    | ok p =>
      rcases p with ⟨s', u'⟩
      change rest.foldlM step (s', u' ++ v) =
        (rest.foldlM step (s', u')).map (fun p => (p.1, p.2 ++ v))
      exact ih s' u'

private theorem create_inverse (s : Store) (key : ElemId) (value : Int)
    (h : lookup s key = none) :
    ∃ t u, applyCommands ((key, value) :: s) [.delete [key]] = .ok (t, u) ∧
      ∀ id, lookup t id = lookup s id := by
  refine ⟨((key, value) :: s).filter (fun p => ![key].contains p.1), _, rfl, ?_⟩
  intro id
  rw [lookup_delete_keys]
  by_cases e : id = key
  · subst id
    simpa using h.symm
  · simpa [e, lookup_cons_other _ _ _ _ (Ne.symm e)]

private theorem update_inverse (s : Store) (key : ElemId) (old value : Int)
    (h : lookup s key = some old) :
    ∃ t u, applyCommands ((key, value) :: s.filter (fun p => p.1 != key))
      [.update key old] = .ok (t, u) ∧ ∀ id, lookup t id = lookup s id := by
  refine ⟨(key, old) :: (((key, value) :: s.filter (fun p => p.1 != key)).filter
    fun p => p.1 != key), [.update key value], ?_, ?_⟩
  · simp [applyCommands, lookup_cons_same, pure, Except.pure]
    rfl
  · intro id
    exact update_restores_lookup s key id old value h

private def commandStep (state : Store × List Cmd) (c : Cmd) : Except String (Store × List Cmd) := do
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

private theorem commandStep_suffix (s : Store) (u v : List Cmd) (c : Cmd) :
    commandStep (s, u ++ v) c =
      (commandStep (s, u) c).map (fun p => (p.1, p.2 ++ v)) := by
  cases c with
  | create id value =>
    cases h : (lookup s id).isSome <;> simp [commandStep, h, pure, Except.pure, Except.map] <;> rfl
  | update id value =>
    cases h : lookup s id <;> simp [commandStep, h, pure, Except.pure, Except.map] <;> rfl
  | delete ids => simp [commandStep, pure, Except.pure, Except.map, List.append_assoc]

private theorem apply_append (s : Store) (xs ys : List Cmd) :
    applyCommands s (xs ++ ys) = (applyCommands s xs).bind (fun p =>
      (applyCommands p.1 ys).map (fun q => (q.1, q.2 ++ p.2))) := by
  change (xs ++ ys).foldlM commandStep (s, []) =
    (xs.foldlM commandStep (s, [])).bind (fun p =>
      (ys.foldlM commandStep (p.1, [])).map (fun q => (q.1, q.2 ++ p.2)))
  rw [List.foldlM_append]
  cases h : xs.foldlM commandStep (s, []) with
  | error e => rfl
  | ok p =>
    rcases p with ⟨s', u⟩
    change ys.foldlM commandStep (s', u) =
      (ys.foldlM commandStep (s', [])).map (fun q => (q.1, q.2 ++ u))
    simpa using fold_suffix commandStep commandStep_suffix ys s' [] u

private theorem lookup_cons_congruent (s t : Store) (key : ElemId) (v : Int)
    (h : ∀ id, lookup s id = lookup t id) :
    ∀ id, lookup ((key, v) :: s) id = lookup ((key, v) :: t) id := by
  intro id
  by_cases e : key = id
  · subst id
    simp [lookup_cons_same]
  · simp [lookup_cons_other _ _ _ _ e, h]

private theorem lookup_filter_congruent (s t : Store) (p : ElemId → Bool)
    (h : ∀ id, lookup s id = lookup t id) :
    ∀ id, lookup (s.filter fun x => p x.1) id = lookup (t.filter fun x => p x.1) id := by
  intro id
  simp [lookup_filter, h]

private theorem commandStep_congruent (s t s' : Store) (u u' : List Cmd) (c : Cmd)
    (eqv : ∀ id, lookup s id = lookup t id)
    (hs : commandStep (s, u) c = .ok (s', u')) :
    ∃ t', commandStep (t, u) c = .ok (t', u') ∧
      ∀ id, lookup s' id = lookup t' id := by
  cases c with
  | create key value =>
    cases hk : lookup s key with
    | none =>
      have ht : lookup t key = none := (eqv key).symm.trans hk
      simp [commandStep, hk, pure, Except.pure] at hs
      rcases hs with ⟨rfl, rfl⟩
      refine ⟨(key, value) :: t, ?_, lookup_cons_congruent s t key value eqv⟩
      simp [commandStep, ht, pure, Except.pure]
    | some old => simp [commandStep, hk] at hs
  | update key value =>
    cases hk : lookup s key with
    | none => simp [commandStep, hk] at hs
    | some old =>
      have ht : lookup t key = some old := (eqv key).symm.trans hk
      simp [commandStep, hk, pure, Except.pure] at hs
      rcases hs with ⟨rfl, rfl⟩
      refine ⟨(key, value) :: t.filter (fun p => p.1 != key), ?_, ?_⟩
      · simp [commandStep, ht, pure, Except.pure]
      · exact lookup_cons_congruent _ _ key value (lookup_filter_congruent s t (fun x => x != key) eqv)
  | delete ids =>
    simp [commandStep, pure, Except.pure] at hs
    rcases hs with ⟨rfl, rfl⟩
    refine ⟨t.filter (fun p => !ids.contains p.1), ?_, ?_⟩
    · simp [commandStep, pure, Except.pure, deleted_pairs_congruent s t ids eqv]
    · exact lookup_filter_congruent s t (fun x => !ids.contains x) eqv

private theorem fold_congruent (cs : List Cmd) (s t s' : Store) (u u' : List Cmd)
    (eqv : ∀ id, lookup s id = lookup t id)
    (hs : cs.foldlM commandStep (s, u) = .ok (s', u')) :
    ∃ t', cs.foldlM commandStep (t, u) = .ok (t', u') ∧
      ∀ id, lookup s' id = lookup t' id := by
  induction cs generalizing s t u with
  | nil =>
    simp at hs
    rcases hs with ⟨rfl, rfl⟩
    exact ⟨t, rfl, eqv⟩
  | cons c rest ih =>
    rw [List.foldlM_cons] at hs ⊢
    cases hc : commandStep (s, u) c with
    | error e =>
      rw [hc] at hs
      contradiction
    | ok p =>
      rcases p with ⟨m, v⟩
      obtain ⟨n, hn, he⟩ := commandStep_congruent s t m u v c eqv hc
      rw [hc] at hs
      change rest.foldlM commandStep (m, v) = .ok (s', u') at hs
      rw [hn]
      change ∃ t', rest.foldlM commandStep (n, v) = .ok (t', u') ∧ _
      exact ih m n v he hs

private theorem apply_congruent (s t s' : Store) (cs u : List Cmd)
    (eqv : ∀ id, lookup s id = lookup t id)
    (hs : applyCommands s cs = .ok (s', u)) :
    ∃ t', applyCommands t cs = .ok (t', u) ∧
      ∀ id, lookup s' id = lookup t' id := by
  exact fold_congruent cs s t s' [] u eqv hs

private theorem single_undo (s s' : Store) (c : Cmd) (u : List Cmd)
    (h : applyCommands s [c] = .ok (s', u)) :
    ∃ t u', applyCommands s' u = .ok (t, u') ∧ ∀ id, lookup t id = lookup s id := by
  change [c].foldlM commandStep (s, []) = .ok (s', u) at h
  rw [List.foldlM_cons] at h
  have hc : commandStep (s, []) c = .ok (s', u) := by
    cases he : commandStep (s, []) c with
    | error e => rw [he] at h; contradiction
    | ok p =>
      rw [he] at h
      change Except.ok p = .ok (s', u) at h
      exact h
  clear h
  cases c with
  | create key value =>
    cases hk : lookup s key with
    | none =>
      simp [commandStep, hk, pure, Except.pure] at hc
      rcases hc with ⟨rfl, rfl⟩
      exact create_inverse s key value hk
    | some old => simp [commandStep, hk] at hc
  | update key value =>
    cases hk : lookup s key with
    | none => simp [commandStep, hk] at hc
    | some old =>
      simp [commandStep, hk, pure, Except.pure] at hc
      rcases hc with ⟨rfl, rfl⟩
      exact update_inverse s key old value hk
  | delete ids =>
    simp [commandStep, pure, Except.pure] at hc
    rcases hc with ⟨rfl, rfl⟩
    exact delete_inverse s ids

theorem applyCommands_undo (s s' : Store) (cs u : List Cmd)
    (h : applyCommands s cs = .ok (s', u)) :
    ∃ t u', applyCommands s' u = .ok (t, u') ∧ ∀ id, lookup t id = lookup s id := by
  induction cs generalizing s s' u with
  | nil =>
    simp [applyCommands] at h
    rcases h with ⟨rfl, rfl⟩
    exact ⟨s, [], rfl, fun _ => rfl⟩
  | cons c rest ih =>
    have happ := apply_append s [c] rest
    simp only [List.singleton_append] at happ
    rw [h] at happ
    cases hc : applyCommands s [c] with
    | error e => rw [hc] at happ; contradiction
    | ok p =>
      rcases p with ⟨m, v⟩
      rw [hc] at happ
      change Except.ok (s', u) = (applyCommands m rest).map
        (fun q => (q.1, q.2 ++ v)) at happ
      cases hr : applyCommands m rest with
      | error e => rw [hr] at happ; contradiction
      | ok q =>
        rcases q with ⟨n, w⟩
        rw [hr] at happ
        change Except.ok (s', u) = Except.ok (n, w ++ v) at happ
        cases happ
        obtain ⟨t, ut, ht, he⟩ := ih m s' w hr
        obtain ⟨x, ux, hx, hex⟩ := single_undo s m c v hc
        obtain ⟨y, hy, hey⟩ := apply_congruent m t x v ux (fun id => (he id).symm) hx
        refine ⟨y, ux ++ ut, ?_, ?_⟩
        · rw [apply_append, ht]
          change (applyCommands t v).map (fun q => (q.1, q.2 ++ ut)) = _
          rw [hy]
          rfl
        · intro id
          exact (hey id).symm.trans (hex id)

end Nodetto.Undo
