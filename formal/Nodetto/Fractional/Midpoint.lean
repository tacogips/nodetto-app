import Nodetto.Fractional.Model

namespace Nodetto.Fractional

theorem randomDigitBetween_bounds (low high : Nat) (rng : Rng)
    (h : high - low > 1) :
    low < (randomDigitBetween low high rng).1 ∧
      (randomDigitBetween low high rng).1 < high := by
  unfold randomDigitBetween
  simp only
  have hm := Nat.min_le_right (rng.headD 0 * (high - low - 1) / 2 ^ 20)
    (high - low - 1 - 1)
  omega

theorem digit_code_unit (d : Nat) (h : d ∈ DIGITS) :
    (48 ≤ d ∧ d ≤ 57) ∨ (65 ≤ d ∧ d ≤ 90) ∨ (97 ≤ d ∧ d ≤ 122) := by
  simp only [DIGITS, List.mem_append, List.mem_map, List.mem_range] at h
  rcases h with (⟨n, hn, rfl⟩ | ⟨n, hn, rfl⟩) | ⟨n, hn, rfl⟩ <;> omega

theorem digits_sorted : DIGITS.Pairwise (· < ·) := by
  have hm (n c : Nat) : ((List.range n).map (· + c)).Pairwise (· < ·) := by
    rw [List.pairwise_map]
    exact List.Pairwise.imp (by intro a b h; omega) List.pairwise_lt_range
  unfold DIGITS
  rw [List.pairwise_append, List.pairwise_append]
  refine ⟨⟨hm 10 48, hm 26 65, ?_⟩, hm 26 97, ?_⟩
  · intro a ha b hb
    simp only [List.mem_map, List.mem_range] at ha hb
    obtain ⟨i, hi, rfl⟩ := ha
    obtain ⟨j, hj, rfl⟩ := hb
    omega
  · intro a ha b hb
    simp only [List.mem_append, List.mem_map, List.mem_range] at ha hb
    obtain ⟨j, hj, rfl⟩ := hb
    rcases ha with ⟨i, hi, rfl⟩ | ⟨i, hi, rfl⟩ <;> omega

theorem digit_index_inverse (i : Nat) (hi : i < DIGITS.length) :
    DIGITS.idxOf DIGITS[i] = i := by
  have hn : DIGITS.Nodup := digits_sorted.imp Nat.ne_of_lt
  exact hn.idxOf_getElem i hi

theorem digit_index_order (i j : Nat) (hi : i < DIGITS.length)
    (hj : j < DIGITS.length) (hij : i < j) : DIGITS[i] < DIGITS[j] :=
  List.Pairwise.rel_getElem_of_lt hi hj digits_sorted hij

theorem digit_heads_order (i j : Nat) (hi : i < DIGITS.length)
    (hj : j < DIGITS.length) (hij : i < j) (xs ys : Key) :
    DIGITS[i] :: xs < DIGITS[j] :: ys :=
  List.cons_lt_cons_of_lt (digit_index_order i j hi hj hij)

theorem digit_positive_ne_zero (i : Nat) (hi : i < DIGITS.length) (hp : 0 < i) :
    DIGITS[i] ≠ 48 := by
  have h0 : (0 : Nat) < DIGITS.length := by simp [DIGITS]
  have hs := digit_index_order 0 i h0 hi hp
  have hz : DIGITS[0] = 48 := by simp [DIGITS]
  omega

theorem digit_singleton_valid (i : Nat) (hi : i < DIGITS.length) (hp : 0 < i) :
    isFractionalKey [DIGITS[i]] = true := by
  have hm : DIGITS[i] ∈ DIGITS := List.getElem_mem hi
  have hn := digit_positive_ne_zero i hi hp
  simp [isFractionalKey, List.contains_iff_mem, hm, hn]

theorem valid_cons (d : Nat) (xs : Key) (hd : d ∈ DIGITS)
    (hv : isFractionalKey xs = true) : isFractionalKey (d :: xs) = true := by
  cases xs with
  | nil => simp [isFractionalKey] at hv
  | cons x rest =>
    simp only [isFractionalKey, List.isEmpty_cons, Bool.not_false, Bool.true_and,
      List.all_cons, Bool.and_eq_true] at hv ⊢
    simpa [List.contains_iff_mem, hd] using hv

theorem valid_tail (d : Nat) (xs : Key)
    (hv : isFractionalKey (d :: xs) = true) :
    xs = [] ∨ isFractionalKey xs = true := by
  cases xs with
  | nil => exact Or.inl rfl
  | cons x rest =>
    right
    simp only [isFractionalKey, List.isEmpty_cons, Bool.not_false, Bool.true_and,
      List.all_cons, Bool.and_eq_true] at hv ⊢
    exact ⟨hv.1, hv.2.2⟩

theorem midpoint_empty_unbounded (rng : Rng) :
    ∃ k rng', midpoint [] none rng = .ok (k, rng') ∧
      ([] : Key) < k ∧ isFractionalKey k = true := by
  let d := (randomDigitBetween 0 62 rng).1
  have hd := randomDigitBetween_bounds 0 62 rng (by omega)
  have hlen : DIGITS.length = 62 := by simp [DIGITS]
  have hi : d < DIGITS.length := by dsimp [d]; omega
  have hp : 0 < d := by dsimp [d]; omega
  refine ⟨[DIGITS[d]], (randomDigitBetween 0 62 rng).2, ?_, ?_,
    digit_singleton_valid d hi hp⟩
  · simp [midpoint, d, List.getD_eq_getElem?_getD, hi]
    rfl
  · exact List.nil_lt_cons _ _

theorem midpoint_unbounded_room (i : Nat) (hi : i < DIGITS.length)
    (hroom : 62 - i > 1) (xs : Key) (rng : Rng) :
    ∃ k rng', midpoint (DIGITS[i] :: xs) none rng = .ok (k, rng') ∧
      DIGITS[i] :: xs < k ∧ isFractionalKey k = true := by
  let d := (randomDigitBetween i 62 rng).1
  have hd := randomDigitBetween_bounds i 62 rng hroom
  have hlen : DIGITS.length = 62 := by simp [DIGITS]
  have hdi : d < DIGITS.length := by dsimp [d]; omega
  have hpos : 0 < d := by dsimp [d]; omega
  have hid : i < d := by dsimp [d]; omega
  refine ⟨[DIGITS[d]], (randomDigitBetween i 62 rng).2, ?_,
    digit_heads_order i d hi hdi hid xs [], digit_singleton_valid d hdi hpos⟩
  simp [midpoint, digit_index_inverse i hi, hroom, d,
    List.getD_eq_getElem?_getD, hdi]
  rfl

theorem midpoint_unbounded (lower : Key) (rng : Rng)
    (hv : lower = [] ∨ isFractionalKey lower = true) :
    ∃ k rng', midpoint lower none rng = .ok (k, rng') ∧
      lower < k ∧ isFractionalKey k = true := by
  induction lower generalizing rng with
  | nil => exact midpoint_empty_unbounded rng
  | cons x xs ih =>
    have hv' : isFractionalKey (x :: xs) = true := by simpa using hv
    have hm : x ∈ DIGITS := by
      simp only [isFractionalKey, List.isEmpty_cons, Bool.not_false, Bool.true_and,
        List.all_cons, Bool.and_eq_true] at hv'
      simpa [List.contains_iff_mem] using hv'.2.1
    have hi : DIGITS.idxOf x < DIGITS.length := List.idxOf_lt_length_of_mem hm
    have hx : DIGITS[DIGITS.idxOf x] = x := List.getElem_idxOf hi
    by_cases hr : 62 - DIGITS.idxOf x > 1
    · simpa [hx] using midpoint_unbounded_room (DIGITS.idxOf x) hi hr xs rng
    · obtain ⟨k, rng', he, hk, hvalid⟩ := ih rng (valid_tail x xs hv')
      refine ⟨x :: k, rng', ?_, List.cons_lt_cons_self.mpr hk, valid_cons x k hm hvalid⟩
      simp [midpoint, hr, List.getD_eq_getElem?_getD, hi, hx, he]
      rfl

theorem midpoint_bounded_room (i j : Nat) (hi : i < DIGITS.length)
    (hj : j < DIGITS.length) (hroom : j - i > 1) (xs ys : Key) (rng : Rng) :
    ∃ k rng', midpoint (DIGITS[i] :: xs) (some (DIGITS[j] :: ys)) rng = .ok (k, rng') ∧
      DIGITS[i] :: xs < k ∧ k < DIGITS[j] :: ys ∧ isFractionalKey k = true := by
  let d := (randomDigitBetween i j rng).1
  have hd := randomDigitBetween_bounds i j rng hroom
  have hid : i < d := by dsimp [d]; omega
  have hdj : d < j := by dsimp [d]; omega
  have hdi : d < DIGITS.length := by omega
  have hpos : 0 < d := by omega
  have hij : i < j := by omega
  have hlt := digit_heads_order i j hi hj hij xs ys
  have hne : DIGITS[i] ≠ DIGITS[j] := Nat.ne_of_lt (digit_index_order i j hi hj hij)
  refine ⟨[DIGITS[d]], (randomDigitBetween i j rng).2, ?_,
    digit_heads_order i d hi hdi hid xs [],
    digit_heads_order d j hdi hj hdj [] ys, digit_singleton_valid d hdi hpos⟩
  simp [midpoint, hlt, hne, digit_index_inverse i hi, digit_index_inverse j hj,
    hroom, d, List.getD_eq_getElem?_getD, hdi]
  rfl

theorem midpoint_bounded_truncate (i j : Nat) (hi : i < DIGITS.length)
    (hj : j < DIGITS.length) (hij : i < j) (hroom : ¬ j - i > 1)
    (xs : Key) (y : Nat) (ys : Key) (rng : Rng) :
    ∃ k rng', midpoint (DIGITS[i] :: xs) (some (DIGITS[j] :: y :: ys)) rng = .ok (k, rng') ∧
      DIGITS[i] :: xs < k ∧ k < DIGITS[j] :: y :: ys ∧ isFractionalKey k = true := by
  have hlt := digit_heads_order i j hi hj hij xs (y :: ys)
  have hne : DIGITS[i] ≠ DIGITS[j] := Nat.ne_of_lt (digit_index_order i j hi hj hij)
  refine ⟨[DIGITS[j]], rng, ?_, digit_heads_order i j hi hj hij xs [],
    List.cons_lt_cons_self.mpr (List.nil_lt_cons y ys), digit_singleton_valid j hj (by omega)⟩
  simp [midpoint, hlt, hne, digit_index_inverse i hi, digit_index_inverse j hj, hroom]
  rfl

theorem midpoint_bounded_adjacent (i j : Nat) (hi : i < DIGITS.length)
    (hj : j < DIGITS.length) (hij : i < j) (hroom : ¬ j - i > 1)
    (xs : Key) (rng : Rng) (hv : xs = [] ∨ isFractionalKey xs = true) :
    ∃ k rng', midpoint (DIGITS[i] :: xs) (some [DIGITS[j]]) rng = .ok (k, rng') ∧
      DIGITS[i] :: xs < k ∧ k < [DIGITS[j]] ∧ isFractionalKey k = true := by
  obtain ⟨k, rng', he, hl, hk⟩ := midpoint_unbounded xs rng hv
  have hlt := digit_heads_order i j hi hj hij xs []
  have hne : DIGITS[i] ≠ DIGITS[j] := Nat.ne_of_lt (digit_index_order i j hi hj hij)
  refine ⟨DIGITS[i] :: k, rng', ?_, List.cons_lt_cons_self.mpr hl,
    digit_heads_order i j hi hj hij k [], valid_cons _ _ (List.getElem_mem hi) hk⟩
  simp [midpoint, hlt, hne, digit_index_inverse i hi, digit_index_inverse j hj,
    hroom, List.getD_eq_getElem?_getD, hi, he]
  rfl

theorem midpoint_shared_head (d : Nat) (lo hi k : Key) (rng rng' : Rng)
    (hd : d ∈ DIGITS) (hl : lo < k) (hu : k < hi)
    (hv : isFractionalKey k = true)
    (he : midpoint lo (some hi) rng = .ok (k, rng')) :
    midpoint (d :: lo) (some (d :: hi)) rng = .ok (d :: k, rng') ∧
      d :: lo < d :: k ∧ d :: k < d :: hi ∧ isFractionalKey (d :: k) = true := by
  have hlt : lo < hi := List.lt_trans hl hu
  refine ⟨?_, List.cons_lt_cons_self.mpr hl, List.cons_lt_cons_self.mpr hu,
    valid_cons d k hd hv⟩
  simp [midpoint, List.cons_lt_cons_self.mpr hlt, he]
  rfl

theorem midpoint_empty_shared_zero (hi k : Key) (rng rng' : Rng)
    (hu : k < hi) (hv : isFractionalKey k = true)
    (he : midpoint [] (some hi) rng = .ok (k, rng')) :
    midpoint [] (some (48 :: hi)) rng = .ok (48 :: k, rng') ∧
      ([] : Key) < 48 :: k ∧ 48 :: k < 48 :: hi ∧
      isFractionalKey (48 :: k) = true := by
  have hm : 48 ∈ DIGITS := by simp [DIGITS]
  refine ⟨?_, List.nil_lt_cons _ _, List.cons_lt_cons_self.mpr hu,
    valid_cons 48 k hm hv⟩
  simp [midpoint, he]
  rfl

theorem midpoint_empty_eq_zero (j : Nat) (hj : j < DIGITS.length)
    (hp : 0 < j) (ys : Key) (rng : Rng) :
    midpoint [] (some (DIGITS[j] :: ys)) rng =
      midpoint [48] (some (DIGITS[j] :: ys)) rng := by
  have h0 : 0 < DIGITS.length := by simp [DIGITS]
  have hz : DIGITS[0] = 48 := by simp [DIGITS]
  have hlt : 48 < DIGITS[j] := by
    have h := digit_index_order 0 j h0 hj hp
    omega
  have hlist : ([48] : Key) < DIGITS[j] :: ys := List.cons_lt_cons_of_lt hlt
  have hne : 48 ≠ DIGITS[j] := by omega
  have hidx : DIGITS.idxOf 48 = 0 := by
    rw [← hz]
    exact digit_index_inverse 0 h0
  conv => lhs; rw [midpoint]
  conv => rhs; rw [midpoint]
  simp [hlist, hne, hidx, hlt]

theorem midpoint_empty_positive (j : Nat) (hj : j < DIGITS.length)
    (hp : 0 < j) (ys : Key) (rng : Rng) :
    ∃ k rng', midpoint [] (some (DIGITS[j] :: ys)) rng = .ok (k, rng') ∧
      ([] : Key) < k ∧ k < DIGITS[j] :: ys ∧ isFractionalKey k = true := by
  have h0 : 0 < DIGITS.length := by simp [DIGITS]
  have hz : DIGITS[0] = 48 := by simp [DIGITS]
  have hs : ∃ k rng', midpoint [48] (some (DIGITS[j] :: ys)) rng = .ok (k, rng') ∧
      ([48] : Key) < k ∧ k < DIGITS[j] :: ys ∧ isFractionalKey k = true := by
    by_cases hr : j - 0 > 1
    · simpa [hz] using midpoint_bounded_room 0 j h0 hj hr [] ys rng
    · cases ys with
      | nil =>
        simpa [hz] using midpoint_bounded_adjacent 0 j h0 hj hp hr [] rng (Or.inl rfl)
      | cons y rest =>
        simpa [hz] using midpoint_bounded_truncate 0 j h0 hj hp hr [] y rest rng
  obtain ⟨k, rng', he, hl, hu, hv⟩ := hs
  refine ⟨k, rng', ?_, List.lt_trans (List.nil_lt_cons 48 []) hl, hu, hv⟩
  rw [midpoint_empty_eq_zero j hj hp ys rng]
  exact he

theorem midpoint_empty_bounded (upper : Key) (rng : Rng)
    (hv : isFractionalKey upper = true) :
    ∃ k rng', midpoint [] (some upper) rng = .ok (k, rng') ∧
      ([] : Key) < k ∧ k < upper ∧ isFractionalKey k = true := by
  induction upper generalizing rng with
  | nil => simp [isFractionalKey] at hv
  | cons x xs ih =>
    have hm : x ∈ DIGITS := by
      simp only [isFractionalKey, List.isEmpty_cons, Bool.not_false, Bool.true_and,
        List.all_cons, Bool.and_eq_true] at hv
      simpa [List.contains_iff_mem] using hv.2.1
    have hi : DIGITS.idxOf x < DIGITS.length := List.idxOf_lt_length_of_mem hm
    have hx : DIGITS[DIGITS.idxOf x] = x := List.getElem_idxOf hi
    by_cases hp : 0 < DIGITS.idxOf x
    · simpa [hx] using midpoint_empty_positive (DIGITS.idxOf x) hi hp xs rng
    · have hidx : DIGITS.idxOf x = 0 := by omega
      have hx0 : x = 48 := by
        have hx' : DIGITS[0] = x := by simpa only [hidx] using hx
        have hz : DIGITS[0] = 48 := by simp [DIGITS]
        exact hx'.symm.trans hz
      subst x
      have htail : isFractionalKey xs = true := by
        rcases valid_tail 48 xs hv with he | he
        · subst xs; simp [isFractionalKey] at hv
        · exact he
      obtain ⟨k, rng', he, hl, hu, hk⟩ := ih rng htail
      exact ⟨48 :: k, rng', midpoint_empty_shared_zero xs k rng rng' hu hk he⟩

theorem midpoint_bounded (lower upper : Key) (rng : Rng)
    (hlow : lower = [] ∨ isFractionalKey lower = true)
    (hupp : isFractionalKey upper = true) (hlt : lower < upper) :
    ∃ k rng', midpoint lower (some upper) rng = .ok (k, rng') ∧
      lower < k ∧ k < upper ∧ isFractionalKey k = true := by
  induction upper generalizing lower rng with
  | nil => simp [isFractionalKey] at hupp
  | cons y ys ih =>
    cases lower with
    | nil => exact midpoint_empty_bounded (y :: ys) rng hupp
    | cons x xs =>
      have hv : isFractionalKey (x :: xs) = true := by simpa using hlow
      have hmx : x ∈ DIGITS := by
        simp only [isFractionalKey, List.isEmpty_cons, Bool.not_false, Bool.true_and,
          List.all_cons, Bool.and_eq_true] at hv
        simpa [List.contains_iff_mem] using hv.2.1
      have hmy : y ∈ DIGITS := by
        simp only [isFractionalKey, List.isEmpty_cons, Bool.not_false, Bool.true_and,
          List.all_cons, Bool.and_eq_true] at hupp
        simpa [List.contains_iff_mem] using hupp.2.1
      by_cases heq : x = y
      · subst y
        have ht : xs < ys := List.cons_lt_cons_self.mp hlt
        have hy : isFractionalKey ys = true := by
          rcases valid_tail x ys hupp with h | h
          · subst ys; simp at ht
          · exact h
        obtain ⟨k, rng', he, hk, hu, hvalid⟩ := ih xs rng (valid_tail x xs hv) hy ht
        exact ⟨x :: k, rng', midpoint_shared_head x xs ys k rng rng' hmx hk hu hvalid he⟩
      · have hxy : x < y := by
          rcases List.cons_lt_cons_iff.mp hlt with h | ⟨h, _⟩
          · exact h
          · exact (heq h).elim
        have hi : DIGITS.idxOf x < DIGITS.length := List.idxOf_lt_length_of_mem hmx
        have hj : DIGITS.idxOf y < DIGITS.length := List.idxOf_lt_length_of_mem hmy
        have hx : DIGITS[DIGITS.idxOf x] = x := List.getElem_idxOf hi
        have hy : DIGITS[DIGITS.idxOf y] = y := List.getElem_idxOf hj
        have hij : DIGITS.idxOf x < DIGITS.idxOf y := by
          apply Nat.lt_of_not_ge
          intro hle
          rcases Nat.eq_or_lt_of_le hle with h | h
          · have he : DIGITS.getD (DIGITS.idxOf y) 48 = DIGITS.getD (DIGITS.idxOf x) 48 :=
              congrArg (fun i => DIGITS.getD i 48) h
            simp [List.getD_eq_getElem?_getD, hi, hj, hx, hy] at he
            omega
          · have hrev := digit_index_order (DIGITS.idxOf y) (DIGITS.idxOf x) hj hi h
            simp only [hx, hy] at hrev
            omega
        by_cases hr : DIGITS.idxOf y - DIGITS.idxOf x > 1
        · simpa [hx, hy] using midpoint_bounded_room _ _ hi hj hr xs ys rng
        · cases ys with
          | nil =>
            simpa [hx, hy] using midpoint_bounded_adjacent _ _ hi hj hij hr xs rng (valid_tail x xs hv)
          | cons z zs =>
            simpa [hx, hy] using midpoint_bounded_truncate _ _ hi hj hij hr xs z zs rng

theorem prefix_bounds (p lo k hi : Key) (hl : lo < k) (hu : k < hi) :
    p ++ lo < p ++ k ∧ p ++ k < p ++ hi :=
  ⟨List.append_left_lt hl, List.append_left_lt hu⟩

end Nodetto.Fractional
