import Nodetto.Merge.Canon

namespace Nodetto.Merge

theorem diffPaths_of_same (b x : Option J) (h : same b x = true) :
    diffPaths b x = [] := by
  cases b with
  | none => simp [diffPaths, h]
  | some b =>
    cases b <;> cases x <;> try simp_all [diffPaths]
    all_goals rename_i x; cases x <;> simp_all [diffPaths]

theorem diffPaths_object_mem (bs xs : List (String × J)) (p : List String)
    (h : same (some (.obj bs)) (some (.obj xs)) = false) :
    p ∈ diffPaths (some (.obj bs)) (some (.obj xs)) ↔
      ∃ k ∈ keysUnion bs xs, ∃ q, q ∈ diffPaths (lookupFirst bs k) (lookupFirst xs k) ∧ p = k :: q := by
  simp [diffPaths, h, List.mem_flatMap, List.mem_map, eq_comm]

theorem lookupFirst_absent (fs : List (String × J)) (k : String)
    (h : k ∉ fs.map Prod.fst) : lookupFirst fs k = none := by
  induction fs with
  | nil => rfl
  | cons a as ih =>
    have hk : a.1 ≠ k := by
      intro e
      apply h
      simp [e]
    have ht : k ∉ as.map Prod.fst := by
      intro hm
      apply h
      simp [hm]
    simpa [lookupFirst, hk] using ih ht

theorem diffPaths_object_step (bs xs : List (String × J)) (p : List String)
    (h : same (some (.obj bs)) (some (.obj xs)) = false) :
    p ∈ diffPaths (some (.obj bs)) (some (.obj xs)) ↔
      ∃ k q, q ∈ diffPaths (lookupFirst bs k) (lookupFirst xs k) ∧ p = k :: q := by
  rw [diffPaths_object_mem bs xs p h]
  constructor
  · rintro ⟨k, _, q, hq, hp⟩
    exact ⟨k, q, hq, hp⟩
  · rintro ⟨k, q, hq, hp⟩
    refine ⟨k, ?_, q, hq, hp⟩
    by_cases hk : k ∈ keysUnion bs xs
    · exact hk
    · have hn : k ∉ bs.map Prod.fst ∧ k ∉ xs.map Prod.fst := by
        simpa [keysUnion] using hk
      rw [lookupFirst_absent bs k hn.1, lookupFirst_absent xs k hn.2,
        diffPaths_of_same none none (same_refl none)] at hq
      simp at hq

theorem diffPaths_nonobject (b x : Option J) (h : same b x = false)
    (hn : ¬ ∃ bs xs, b = some (.obj bs) ∧ x = some (.obj xs)) :
    diffPaths b x = [[]] := by
  cases b with
  | none => simp [diffPaths, h]
  | some b =>
    cases b <;> cases x <;> simp_all [diffPaths] <;>
      rename_i x <;> cases x <;> simp_all [diffPaths]

theorem diffPaths_prefix_free (b x : Option J) (p q : List String)
    (hp : p ∈ diffPaths b x) (hq : q ∈ diffPaths b x) (hpre : p <+: q) : p = q := by
  classical
  by_cases he : same b x = true
  · rw [diffPaths_of_same b x he] at hp
    simp at hp
  · have hf : same b x = false := Bool.eq_false_iff.mpr he
    by_cases ho : ∃ bs xs, b = some (.obj bs) ∧ x = some (.obj xs)
    · obtain ⟨bs, xs, rfl, rfl⟩ := ho
      obtain ⟨k, a, ha, rfl⟩ := (diffPaths_object_step bs xs p hf).1 hp
      obtain ⟨j, c, hc, rfl⟩ := (diffPaths_object_step bs xs q hf).1 hq
      obtain ⟨hkj, hab⟩ := List.cons_prefix_cons.mp hpre
      subst j
      congr 1
      exact diffPaths_prefix_free (lookupFirst bs k) (lookupFirst xs k) a c ha hc hab
    · rw [diffPaths_nonobject b x hf ho] at hp hq
      simp only [List.mem_singleton] at hp hq
      exact hp.trans hq.symm
termination_by sizeOf b
decreasing_by
  simp_wf
  all_goals simp_all
  cases h : lookupFirst bs j with
  | none => simp [h]; omega
  | some v =>
    have hm := lookupFirst_size bs j v h
    simp [h]
    omega

theorem getPath_same (x y : Option J) (p : List String)
    (h : same x y = true) : same (getPath x p) (getPath y p) = true := by
  induction p generalizing x y with
  | nil => simpa [getPath] using h
  | cons k p ih =>
    cases x with
    | none =>
      have hy := (same_none y).1 h
      subst y
      exact same_refl _
    | some x =>
      cases x with
      | obj fs =>
        obtain ⟨gs, rfl⟩ := same_object_shape fs y h
        exact ih _ _ (same_object_lookup fs gs h k)
      | null | bool _ | num _ | str _ | arr _ =>
        cases y with
        | none => simp [same_eq] at h
        | some y =>
          cases y <;> simp_all [same_eq, canon, getPath, same_refl]

theorem diffPaths_same (b x y : Option J) (p : List String)
    (h : same x y = true) : p ∈ diffPaths b x ↔ p ∈ diffPaths b y := by
  classical
  by_cases hb : same b x = true
  · have hy := same_trans b x y hb h
    rw [diffPaths_of_same b x hb, diffPaths_of_same b y hy]
  · have hx : same b x = false := Bool.eq_false_iff.mpr hb
    have hy : same b y = false := by
      cases he : same b y with
      | false => rfl
      | true =>
        exfalso
        apply hb
        exact same_trans b y x he ((same_symm y x).trans h)
    by_cases ho : ∃ bs xs, b = some (.obj bs) ∧ x = some (.obj xs)
    · obtain ⟨bs, xs, rfl, rfl⟩ := ho
      obtain ⟨ys, rfl⟩ := same_object_shape xs y h
      rw [diffPaths_object_step bs xs p hx, diffPaths_object_step bs ys p hy]
      constructor <;> rintro ⟨k, q, hq, hp⟩
      · exact ⟨k, q, (diffPaths_same (lookupFirst bs k) (lookupFirst xs k) (lookupFirst ys k) q (same_object_lookup xs ys h k)).mp hq, hp⟩
      · exact ⟨k, q, (diffPaths_same (lookupFirst bs k) (lookupFirst xs k) (lookupFirst ys k) q (same_object_lookup xs ys h k)).mpr hq, hp⟩
    · have hn : ¬ ∃ bs ys, b = some (.obj bs) ∧ y = some (.obj ys) := by
        rintro ⟨bs, ys, hb, hy⟩
        subst y
        obtain ⟨xs, hx⟩ := same_object_shape ys x ((same_symm _ _).trans h)
        exact ho ⟨bs, xs, hb, hx⟩
      rw [diffPaths_nonobject b x hx ho, diffPaths_nonobject b y hy hn]
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

theorem diffPaths_empty_same (b x : Option J) (hd : diffPaths b x = []) :
    same b x = true := by
  classical
  by_cases he : same b x = true
  · exact he
  · have hf : same b x = false := Bool.eq_false_iff.mpr he
    by_cases ho : ∃ bs xs, b = some (.obj bs) ∧ x = some (.obj xs)
    · obtain ⟨bs, xs, rfl, rfl⟩ := ho
      apply False.elim
      apply he
      apply same_object_of_lookup
      intro k
      have hc : diffPaths (lookupFirst bs k) (lookupFirst xs k) = [] := by
        cases hcase : diffPaths (lookupFirst bs k) (lookupFirst xs k) with
        | nil => rfl
        | cons a rest =>
          have hm : a ∈ diffPaths (lookupFirst bs k) (lookupFirst xs k) := by simp [hcase]
          have hm' := (diffPaths_object_step bs xs (k :: a) hf).2 ⟨k, a, hm, rfl⟩
          rw [hd] at hm'
          simp at hm'
      exact diffPaths_empty_same (lookupFirst bs k) (lookupFirst xs k) hc
    · rw [diffPaths_nonobject b x hf ho] at hd
      contradiction
termination_by sizeOf b
decreasing_by
  simp_wf
  simp_all
  cases hk : lookupFirst bs k with
  | none => simp [hk]; omega
  | some v =>
    have hs := lookupFirst_size bs k v hk
    simp [hk]
    omega

theorem diffPaths_empty_iff (b x : Option J) :
    diffPaths b x = [] ↔ same b x = true :=
  ⟨diffPaths_empty_same b x, diffPaths_of_same b x⟩

theorem fieldConflict_symm (b l r : Option J) :
    FieldConflict b l r ↔ FieldConflict b r l := by
  constructor <;> intro ⟨p, hp, q, hq, ho, hn⟩
  · refine ⟨q, hq, p, hp, ho.symm, ?_⟩
    intro ⟨he, hs⟩
    subst q
    apply hn
    exact ⟨rfl, (same_symm _ _).trans hs⟩
  · refine ⟨q, hq, p, hp, ho.symm, ?_⟩
    intro ⟨he, hs⟩
    subst q
    apply hn
    exact ⟨rfl, (same_symm _ _).trans hs⟩

end Nodetto.Merge
