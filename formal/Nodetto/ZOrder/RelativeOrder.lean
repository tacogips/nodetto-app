import Nodetto.ZOrder.Model
namespace Nodetto.ZOrder

theorem relativeOrder_perm (ordered : List ElemId) (moved anchorBlock : ElemId → Bool) (side : Side) :
    (relativeOrder ordered moved anchorBlock side).Perm ordered := by
  simp only [relativeOrder]
  generalize hpos : ((ordered.filter (fun id => !moved id)).zipIdx.filter
    (fun x => anchorBlock x.1)).map Prod.snd = positions
  cases positions with
  | nil => exact List.Perm.refl _
  | cons first tail =>
    let rest := ordered.filter (fun id => !moved id)
    let picked := ordered.filter moved
    let pos := match side with
      | .before => first
      | .after => (tail.getLast?.getD first) + 1
    change (rest.take pos ++ picked ++ rest.drop pos).Perm ordered
    have hp : (rest.take pos ++ picked ++ rest.drop pos).Perm (picked ++ rest) := by
      have h := List.Perm.append_right (rest.drop pos) (List.perm_append_comm (l₁ := rest.take pos) (l₂ := picked))
      simpa [List.append_assoc, List.take_append_drop] using h
    exact hp.trans (List.filter_append_perm moved ordered)

private theorem filtered_parts (xs : List ElemId) (p : ElemId → Bool) (n : Nat) :
    ((xs.filter p).take n).filter p = (xs.filter p).take n ∧
    ((xs.filter p).drop n).filter p = (xs.filter p).drop n ∧
    ((xs.filter p).take n).filter (fun x => !p x) = [] ∧
    ((xs.filter p).drop n).filter (fun x => !p x) = [] := by
  have ht : ∀ x ∈ (xs.filter p).take n, p x = true := by
    intro x hx
    exact (List.mem_filter.mp (List.mem_of_mem_take hx)).2
  have hd : ∀ x ∈ (xs.filter p).drop n, p x = true := by
    intro x hx
    exact (List.mem_filter.mp (List.mem_of_mem_drop hx)).2
  refine ⟨List.filter_eq_self.mpr ht, List.filter_eq_self.mpr hd, ?_, ?_⟩
  · apply List.filter_eq_nil_iff.mpr
    intro x hx
    simp [ht x hx]
  · apply List.filter_eq_nil_iff.mpr
    intro x hx
    simp [hd x hx]

theorem relativeOrder_moved_order (ordered : List ElemId) (moved anchorBlock : ElemId → Bool) (side : Side) :
    (relativeOrder ordered moved anchorBlock side).filter moved = ordered.filter moved := by
  simp only [relativeOrder]
  generalize hpos : ((ordered.filter (fun id => !moved id)).zipIdx.filter
    (fun x => anchorBlock x.1)).map Prod.snd = positions
  cases positions with
  | nil => rfl
  | cons first tail =>
    let pos := match side with
      | .before => first
      | .after => (tail.getLast?.getD first) + 1
    change (((ordered.filter (fun id => !moved id)).take pos ++ ordered.filter moved ++
      (ordered.filter (fun id => !moved id)).drop pos).filter moved) = _
    have h := filtered_parts ordered (fun id => !moved id) pos
    have hp : (ordered.filter moved).filter moved = ordered.filter moved := by
      apply List.filter_eq_self.mpr
      intro x hx
      exact (List.mem_filter.mp hx).2
    have ht : ((ordered.filter (fun id => !moved id)).take pos).filter moved = [] := by
      simpa only [Bool.not_not] using h.2.2.1
    have hd : ((ordered.filter (fun id => !moved id)).drop pos).filter moved = [] := by
      simpa only [Bool.not_not] using h.2.2.2
    simp [List.filter_append, hp, ht, hd]

theorem relativeOrder_unmoved_order (ordered : List ElemId) (moved anchorBlock : ElemId → Bool) (side : Side) :
    (relativeOrder ordered moved anchorBlock side).filter (fun id => !moved id) =
      ordered.filter (fun id => !moved id) := by
  simp only [relativeOrder]
  generalize hpos : ((ordered.filter (fun id => !moved id)).zipIdx.filter
    (fun x => anchorBlock x.1)).map Prod.snd = positions
  cases positions with
  | nil => rfl
  | cons first tail =>
    let pos := match side with
      | .before => first
      | .after => (tail.getLast?.getD first) + 1
    change (((ordered.filter (fun id => !moved id)).take pos ++ ordered.filter moved ++
      (ordered.filter (fun id => !moved id)).drop pos).filter (fun id => !moved id)) = _
    have h := filtered_parts ordered (fun id => !moved id) pos
    have hp : (ordered.filter moved).filter (fun id => !moved id) = [] := by
      apply List.filter_eq_nil_iff.mpr
      intro x hx
      simp [(List.mem_filter.mp hx).2]
    simp [List.filter_append, h.1, h.2.1, hp, List.take_append_drop]

theorem relativeOrder_no_anchor (ordered : List ElemId) (moved anchorBlock : ElemId → Bool) (side : Side)
    (h : ∀ id ∈ ordered, moved id = false → anchorBlock id = false) :
    relativeOrder ordered moved anchorBlock side = ordered := by
  have hz : ((ordered.filter (fun id => !moved id)).zipIdx.filter
      (fun x => anchorBlock x.1)) = [] := by
    apply List.filter_eq_nil_iff.mpr
    intro x hx
    have hm := List.mem_filter.mp (List.fst_mem_of_mem_zipIdx hx)
    have hf : moved x.1 = false := by simpa using hm.2
    simpa [h x.1 hm.1 hf]
  simp [relativeOrder, hz]

private theorem first_position (xs : List ElemId) (p : ElemId → Bool) :
    ((xs.zipIdx.filter (fun x => p x.1)).map Prod.snd).head? = xs.findIdx? p := by
  simpa only [List.head?_map, List.head?_filter] using
    (List.findIdx?_eq_fst_find?_zipIdx (xs := xs) (p := p)).symm

theorem relativeOrder_before (ordered : List ElemId) (moved anchorBlock : ElemId → Bool)
    (h : ∃ id ∈ ordered, moved id = false ∧ anchorBlock id = true) :
    ∃ pre post, relativeOrder ordered moved anchorBlock .before = pre ++ ordered.filter moved ++ post ∧
      pre ++ post = ordered.filter (fun id => !moved id) ∧
      (∀ id ∈ pre, anchorBlock id = false) ∧
      ∃ a rest, post = a :: rest ∧ anchorBlock a = true := by
  let rest := ordered.filter (fun id => !moved id)
  let positions := (rest.zipIdx.filter (fun x => anchorBlock x.1)).map Prod.snd
  have hex : ∃ x ∈ rest, anchorBlock x = true := by
    obtain ⟨x, hx, hm, ha⟩ := h
    exact ⟨x, List.mem_filter.mpr ⟨hx, by simp [hm]⟩, ha⟩
  have hpos := first_position rest anchorBlock
  change positions.head? = rest.findIdx? anchorBlock at hpos
  cases hp : positions with
  | nil =>
    have hn : rest.findIdx? anchorBlock = none := by simpa [hp] using hpos.symm
    have hn' := List.findIdx?_eq_none_iff.mp hn
    obtain ⟨x, hx, ha⟩ := hex
    simp [hn' x hx] at ha
  | cons first tail =>
    have hi : rest.findIdx? anchorBlock = some first := by simpa [hp] using hpos.symm
    obtain ⟨hlt, ha, hearly⟩ := List.findIdx?_eq_some_iff_getElem.mp hi
    refine ⟨rest.take first, rest.drop first, ?_, List.take_append_drop _ _, ?_, ?_⟩
    · simp only [relativeOrder]
      change (match positions with
        | [] => ordered
        | n :: _ => rest.take n ++ ordered.filter moved ++ rest.drop n) = _
      rw [hp]
    · intro x hx
      rw [List.mem_take_iff_getElem] at hx
      obtain ⟨j, hj, hxe⟩ := hx
      have hjfirst : j < first := by omega
      have hh := hearly j hjfirst
      simp only [Bool.not_eq_true] at hh
      simpa [hxe] using hh
    · exact ⟨rest[first], rest.drop (first + 1), List.drop_eq_getElem_cons hlt, ha⟩


private theorem last_match (xs : List ElemId) (p : ElemId → Bool)
    (h : ∃ a ∈ xs, p a = true) :
    ∃ pre a post, xs = pre ++ a :: post ∧ p a = true ∧
      ∀ b ∈ post, p b = false := by
  have hs : (xs.reverse.find? p).isSome := by
    rw [List.find?_isSome]
    simpa using h
  cases hf : xs.reverse.find? p with
  | none => simp [hf] at hs
  | some a =>
    obtain ⟨ha, pre, post, heq, hpre⟩ := List.find?_eq_some_iff_append.mp hf
    refine ⟨post.reverse, a, pre.reverse, ?_, ha, ?_⟩
    · have hr := congrArg List.reverse heq
      simpa using hr
    · intro b hb
      have hb' : b ∈ pre := by simpa using hb
      have hp := hpre b hb'
      simpa using hp


private theorem last_match_position (pre post : List ElemId) (a : ElemId) (p : ElemId → Bool)
    (ha : p a = true) (hp : ∀ b ∈ post, p b = false) :
    ((((pre ++ a :: post).zipIdx).filter (fun x => p x.1)).map Prod.snd).getLast? = some pre.length := by
  have hz : ∀ k, (post.zipIdx k).filter (fun x => p x.1) = [] := by
    intro k
    apply List.filter_eq_nil_iff.mpr
    intro x hx
    have hm : x.1 ∈ post := List.fst_mem_of_mem_zipIdx hx
    simp [hp x.1 hm]
  simp [List.zipIdx_append, List.zipIdx_cons, List.filter_append, ha, hz]


theorem relativeOrder_after (ordered : List ElemId) (moved anchorBlock : ElemId → Bool)
    (h : ∃ id ∈ ordered, moved id = false ∧ anchorBlock id = true) :
    ∃ pre post, relativeOrder ordered moved anchorBlock .after = pre ++ ordered.filter moved ++ post ∧
      pre ++ post = ordered.filter (fun id => !moved id) ∧
      (∀ id ∈ post, anchorBlock id = false) ∧
      ∃ init a, pre = init ++ [a] ∧ anchorBlock a = true := by
  let rest := ordered.filter (fun id => !moved id)
  let positions := (rest.zipIdx.filter (fun x => anchorBlock x.1)).map Prod.snd
  have hex : ∃ x ∈ rest, anchorBlock x = true := by
    obtain ⟨x, hx, hm, ha⟩ := h
    exact ⟨x, List.mem_filter.mpr ⟨hx, by simp [hm]⟩, ha⟩
  obtain ⟨pre, a, post, hr, ha, hp⟩ := last_match rest anchorBlock hex
  have hl : positions.getLast? = some pre.length := by
    dsimp [positions]
    rw [hr]
    exact last_match_position pre post a anchorBlock ha hp
  cases hpos : positions with
  | nil => simp [hpos] at hl
  | cons first tail =>
    have hi : tail.getLast?.getD first = pre.length := by
      simpa [hpos, List.getLast?_cons] using hl
    refine ⟨pre ++ [a], post, ?_, ?_, hp, ⟨pre, a, rfl, ha⟩⟩
    · simp only [relativeOrder]
      change (match positions with
        | [] => ordered
        | first :: tail => rest.take (tail.getLast?.getD first + 1) ++
          ordered.filter moved ++ rest.drop (tail.getLast?.getD first + 1)) = _
      rw [hpos]
      simp only
      rw [hi, hr]
      simp [List.take_append, List.drop_append, List.append_assoc,
        List.take_of_length_le (show pre.length ≤ pre.length + 1 by omega),
        List.drop_eq_nil_of_le (show pre.length ≤ pre.length + 1 by omega)]
    · simpa [rest, List.append_assoc] using hr.symm

end Nodetto.ZOrder
