import Nodetto.Merge.Model

namespace Nodetto.Merge

theorem same_eq (a b : Option J) : same a b = true ↔ a.map canon = b.map canon := by
  cases a <;> cases b <;> simp [same]
  exact jEq_correct _ _

theorem same_refl (a : Option J) : same a a = true := by
  exact (same_eq _ _).2 rfl

theorem same_symm (a b : Option J) : same a b = same b a := by
  apply Bool.eq_iff_iff.mpr
  constructor <;> intro h
  · exact (same_eq _ _).2 ((same_eq _ _).1 h).symm
  · exact (same_eq _ _).2 ((same_eq _ _).1 h).symm

theorem same_trans (a b c : Option J) (hab : same a b = true)
    (hbc : same b c = true) : same a c = true := by
  exact (same_eq _ _).2 ((same_eq _ _).1 hab |>.trans ((same_eq _ _).1 hbc))

theorem same_none (a : Option J) : same none a = true ↔ a = none := by
  cases a <;> simp [same_eq]

def sameItems : List J → List J → Prop
  | [], [] => True
  | x :: xs, y :: ys => same (some x) (some y) = true ∧ sameItems xs ys
  | _, _ => False

theorem same_array (xs ys : List J) :
    same (some (.arr xs)) (some (.arr ys)) = true ↔
      sameItems xs ys := by
  rw [same_eq]
  simp only [Option.map, canon, Option.some.injEq, J.arr.injEq]
  induction xs generalizing ys with
  | nil => cases ys <;> simp [sameItems]
  | cons x xs ih =>
    cases ys with
    | nil => simp [sameItems]
    | cons y ys => simp [sameItems, ih, same_eq]

theorem sameItems_length (xs ys : List J) (h : sameItems xs ys) : xs.length = ys.length := by
  induction xs generalizing ys with
  | nil => cases ys <;> simp_all [sameItems]
  | cons x xs ih =>
    cases ys with
    | nil => simp [sameItems] at h
    | cons y ys =>
      simp only [sameItems] at h
      simp [ih ys h.2]

theorem same_null (v : J) : same (some .null) (some v) = true ↔ v = .null := by
  cases v <;> simp [same_eq, canon]

theorem same_bool (a : Bool) (v : J) :
    same (some (.bool a)) (some v) = true ↔ v = .bool a := by
  cases v <;> simp [same_eq, canon] <;> exact eq_comm

theorem same_num (a : Int) (v : J) :
    same (some (.num a)) (some v) = true ↔ v = .num a := by
  cases v <;> simp [same_eq, canon] <;> exact eq_comm

theorem same_str (a : String) (v : J) :
    same (some (.str a)) (some v) = true ↔ v = .str a := by
  cases v <;> simp [same_eq, canon] <;> exact eq_comm

theorem sorted_keys_unique (xs ys : List String)
    (hx : xs.Pairwise (· < ·)) (hy : ys.Pairwise (· < ·))
    (hm : ∀ k, k ∈ xs ↔ k ∈ ys) : xs = ys := by
  have nx : xs.Nodup := hx.imp (fun h => Std.ne_of_lt h)
  have ny : ys.Nodup := hy.imp (fun h => Std.ne_of_lt h)
  have hp : xs.Perm ys := (List.perm_ext_iff_of_nodup nx ny).2 hm
  exact hp.eq_of_pairwise (fun _ _ _ _ hab hba => False.elim (Std.not_gt_of_lt hab hba)) hx hy

theorem same_object_shape (fs : List (String × J)) (v : Option J)
    (h : same (some (.obj fs)) v = true) : ∃ gs, v = some (.obj gs) := by
  cases v with
  | none => simp [same_eq] at h
  | some v =>
    cases v <;> simp [same_eq, canon] at h ⊢

theorem lookupFirst_map_canon (fs : List (String × J)) (k : String) :
    lookupFirst (fs.map (fun p => (p.1, canon p.2))) k = (lookupFirst fs k).map canon := by
  simp [lookupFirst, List.find?_map, Option.map_map, Function.comp_def]

theorem lookupFirst_dedup (fs : List (String × J)) (k : String) :
    lookupFirst (fs.eraseDupsBy (fun a b => a.1 == b.1)) k = lookupFirst fs k := by
  cases fs with
  | nil => rfl
  | cons p ps =>
    cases p with
    | mk key value =>
      rw [List.eraseDupsBy_cons]
      by_cases h : key = k
      · subst k
        simp [lookupFirst]
      · have hr := lookupFirst_dedup (ps.filter (fun b => (b.1 == key) = false)) k
        simp only [lookupFirst, List.find?_cons, Prod.fst, beq_iff_eq, h, ↓reduceIte, Bool.false_eq_true] at hr ⊢
        have hk : (key == k) = false := beq_eq_false_iff_ne.mpr h
        simp only [hk] 
        rw [hr]
        rw [List.find?_filter]
        have hp : (fun a : String × J => decide (decide ((a.1 == key) = false) = true ∧ (a.1 == k) = true)) =
            (fun a : String × J => a.1 == k) := by
          funext a
          by_cases ha : a.1 = k
          · simp [ha, Ne.symm h]
          · simp [ha]
        rw [hp]
termination_by fs.length
decreasing_by
  simp_wf
  exact Nat.lt_succ_of_le (List.length_filter_le _ _)

theorem lookupFirst_canonical_fields (fs : List (String × J)) (k : String) :
    lookupFirst ((fs.map (fun p => (p.1, canon p.2))).eraseDupsBy
      (fun a b => a.1 == b.1)) k = (lookupFirst fs k).map canon := by
  rw [lookupFirst_dedup, lookupFirst_map_canon]

theorem dedup_sublist (fs : List (String × J)) :
    (fs.eraseDupsBy (fun a b => a.1 == b.1)).Sublist fs := by
  cases fs with
  | nil => simp
  | cons p ps =>
    rw [List.eraseDupsBy_cons]
    apply List.Sublist.cons_cons
    exact (dedup_sublist (ps.filter (fun b => (b.1 == p.1) = false))).trans List.filter_sublist
termination_by fs.length
decreasing_by
  simp_wf
  exact Nat.lt_succ_of_le (List.length_filter_le _ _)

theorem dedup_keys_nodup (fs : List (String × J)) :
    ((fs.eraseDupsBy (fun a b => a.1 == b.1)).map Prod.fst).Nodup := by
  cases fs with
  | nil => simp
  | cons p ps =>
    rw [List.eraseDupsBy_cons]
    simp only [List.map_cons, List.nodup_cons]
    constructor
    · intro h
      obtain ⟨q, hq, heq⟩ := List.mem_map.mp h
      have hf := (dedup_sublist _).subset hq
      have hn := (List.mem_filter.mp hf).2
      simp only [beq_eq_false_iff_ne, decide_eq_true_eq] at hn
      exact hn heq
    · exact dedup_keys_nodup (ps.filter (fun b => (b.1 == p.1) = false))
termination_by fs.length
decreasing_by
  simp_wf
  exact Nat.lt_succ_of_le (List.length_filter_le _ _)

theorem lookupFirst_of_mem (fs : List (String × J)) (k : String) (v : J)
    (hn : (fs.map Prod.fst).Nodup) (hm : (k, v) ∈ fs) : lookupFirst fs k = some v := by
  induction fs with
  | nil => simp at hm
  | cons p ps ih =>
    simp only [List.map_cons, List.nodup_cons] at hn
    simp only [List.mem_cons] at hm
    rcases hm with he | ht
    · subst p
      simp [lookupFirst]
    · have hne : p.1 ≠ k := by
        intro h
        apply hn.1
        exact List.mem_map.mpr ⟨(k, v), ht, h.symm⟩
      have h := ih hn.2 ht
      simpa [lookupFirst, hne] using h

theorem mem_of_lookupFirst (fs : List (String × J)) (k : String) (v : J)
    (h : lookupFirst fs k = some v) : (k, v) ∈ fs := by
  induction fs with
  | nil => simp [lookupFirst] at h
  | cons p ps ih =>
    by_cases hk : p.1 = k
    · cases p with
      | mk key value =>
        simp only at hk
        subst key
        simp [lookupFirst] at h
        subst value
        simp
    · have ht : lookupFirst ps k = some v := by simpa [lookupFirst, hk] using h
      exact List.mem_cons_of_mem _ (ih ht)

theorem lookupFirst_perm (fs gs : List (String × J)) (k : String)
    (hnf : (fs.map Prod.fst).Nodup) (hng : (gs.map Prod.fst).Nodup)
    (hp : fs.Perm gs) : lookupFirst fs k = lookupFirst gs k := by
  cases hf : lookupFirst fs k with
  | some v =>
    have hm := mem_of_lookupFirst fs k v hf
    exact (lookupFirst_of_mem gs k v hng (hp.mem_iff.mp hm)).symm
  | none =>
    cases hg : lookupFirst gs k with
    | none => rfl
    | some v =>
      have hm := mem_of_lookupFirst gs k v hg
      have hc := lookupFirst_of_mem fs k v hnf (hp.mem_iff.mpr hm)
      rw [hf] at hc
      contradiction

theorem lookupFirst_sort_dedup (fs : List (String × J)) (k : String) :
    lookupFirst ((fs.eraseDupsBy (fun a b => a.1 == b.1)).mergeSort
      (fun a b => a.1 ≤ b.1)) k = lookupFirst fs k := by
  let ds := fs.eraseDupsBy (fun a b => a.1 == b.1)
  have hp : (ds.mergeSort (fun a b => a.1 ≤ b.1)).Perm ds := List.mergeSort_perm ds (fun a b => a.1 ≤ b.1)
  have hn : (ds.map Prod.fst).Nodup := dedup_keys_nodup fs
  have hs : ((ds.mergeSort (fun a b => a.1 ≤ b.1)).map Prod.fst).Nodup :=
    (hp.map Prod.fst).nodup_iff.mpr hn
  change lookupFirst (ds.mergeSort (fun a b => a.1 ≤ b.1)) k = lookupFirst fs k
  rw [lookupFirst_perm _ _ k hs hn hp]
  exact lookupFirst_dedup fs k

theorem same_object_lookup (fs gs : List (String × J))
    (h : same (some (.obj fs)) (some (.obj gs)) = true) (k : String) :
    same (lookupFirst fs k) (lookupFirst gs k) = true := by
  apply (same_eq _ _).2
  have he := (same_eq _ _).1 h
  simp only [Option.map, canon, Option.some.injEq, J.obj.injEq] at he
  have hl := congrArg (fun xs => lookupFirst xs k) he
  rw [lookupFirst_sort_dedup, lookupFirst_sort_dedup, lookupFirst_map_canon,
    lookupFirst_map_canon] at hl
  exact hl

theorem same_object_of_lookup (fs gs : List (String × J))
    (h : ∀ k, same (lookupFirst fs k) (lookupFirst gs k) = true) :
    same (some (.obj fs)) (some (.obj gs)) = true := by
  let f := (fs.map (fun p => (p.1, canon p.2))).eraseDupsBy (fun a b => a.1 == b.1)
  let g := (gs.map (fun p => (p.1, canon p.2))).eraseDupsBy (fun a b => a.1 == b.1)
  have nf : (f.map Prod.fst).Nodup := dedup_keys_nodup _
  have ng : (g.map Prod.fst).Nodup := dedup_keys_nodup _
  have hl : ∀ k, lookupFirst f k = lookupFirst g k := by
    intro k
    dsimp [f, g]
    rw [lookupFirst_canonical_fields, lookupFirst_canonical_fields]
    exact (same_eq _ _).1 (h k)
  have hm : ∀ p, p ∈ f ↔ p ∈ g := by
    intro ⟨k, v⟩
    constructor <;> intro hp
    · exact mem_of_lookupFirst g k v ((hl k).symm.trans (lookupFirst_of_mem f k v nf hp))
    · exact mem_of_lookupFirst f k v ((hl k).trans (lookupFirst_of_mem g k v ng hp))
  have ndf : f.Nodup := nf.of_map Prod.fst (fun _ _ h e => h (congrArg Prod.fst e))
  have ndg : g.Nodup := ng.of_map Prod.fst (fun _ _ h e => h (congrArg Prod.fst e))
  have hp : f.Perm g := (List.perm_ext_iff_of_nodup ndf ndg).2 hm
  have hs : (f.mergeSort (fun a b => a.1 ≤ b.1)).Perm
      (g.mergeSort (fun a b => a.1 ≤ b.1)) :=
    (List.mergeSort_perm _ _).trans (hp.trans (List.mergeSort_perm _ _).symm)
  have sorted : ∀ xs : List (String × J),
      (xs.mergeSort (fun a b => a.1 ≤ b.1)).Pairwise (fun a b => a.1 ≤ b.1) := by
    intro xs
    have hsort := List.pairwise_mergeSort (le := fun a b : String × J => decide (a.1 ≤ b.1))
      (by intro a b c hab hbc; simp only [decide_eq_true_eq] at *; exact Std.le_trans hab hbc)
      (by intro a b; simp only [Bool.or_eq_true, decide_eq_true_eq]; exact Std.le_total) xs
    simpa only [decide_eq_true_eq] using hsort
  have he := hs.eq_of_pairwise (fun a b ha hb hab hba => by
    have hk : a.1 = b.1 := Std.le_antisymm hab hba
    have hfa : a ∈ f := (List.mergeSort_perm f _).mem_iff.mp ha
    have hgb : b ∈ g := (List.mergeSort_perm g _).mem_iff.mp hb
    cases a with
    | mk ka va =>
      cases b with
      | mk kb vb =>
        simp only at hk
        subst kb
        have h1 := lookupFirst_of_mem f ka va nf hfa
        have h2 := lookupFirst_of_mem g ka vb ng hgb
        rw [hl ka, h2] at h1
        cases h1
        rfl) (sorted f) (sorted g)
  apply (same_eq _ _).2
  simpa [canon, f, g] using he

end Nodetto.Merge
