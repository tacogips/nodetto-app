import Nodetto.Nmesh.Model

namespace Nodetto.Nmesh

theorem writeVarint_bytes (v : Nat) :
    ∀ b ∈ writeVarint v, b < 256 := by
  induction v using Nat.strongRecOn with
  | ind v ih =>
    rw [writeVarint]
    split
    next h => simp only [List.mem_singleton]; intro b hb; subst b; omega
    next h =>
      simp only [List.mem_cons]
      intro b hb
      rcases hb with rfl | hb
      · have := Nat.mod_lt v (by omega : 0 < 128); omega
      · exact ih (v / 128) (by omega) b hb

private theorem writeVarint_cons (low high : Nat) (hl : low < 128) (hh : 0 < high) :
    writeVarint (low + 128 * high) = (low + 128) :: writeVarint high := by
  rw [writeVarint]
  have hge : ¬ low + 128 * high < 128 := by omega
  simp only [hge, dite_false]
  have hm : (low + 128 * high) % 128 = low := by omega
  have hd : (low + 128 * high) / 128 = high := by omega
  rw [hm, hd]

private theorem readVarint_canonical_one (b : Nat) (tail rest : Bytes) (v : Nat)
    (hb : b < 128) (h : readVarint (b :: tail) = .ok (v, rest)) :
    v < 2 ^ 32 ∧ b :: tail = writeVarint v ++ rest := by
  simp [readVarint, readVarint.go, hb, Nat.mod_eq_of_lt hb] at h
  rcases h with ⟨rfl, rfl⟩
  constructor
  · omega
  · simp [writeVarint, hb]

private theorem readVarint_canonical_two (a b : Nat) (tail rest : Bytes) (v : Nat)
    (ha : 128 ≤ a) (ha' : a < 256) (hb : b < 128)
    (h : readVarint (a :: b :: tail) = .ok (v, rest)) :
    v < 2 ^ 32 ∧ a :: b :: tail = writeVarint v ++ rest := by
  by_cases hz : b = 0
  · simp [readVarint, readVarint.go, show ¬ a < 128 by omega, hb, hz] at h
  simp [readVarint, readVarint.go, show ¬ a < 128 by omega, hb, hz,
    Nat.mod_eq_of_lt hb] at h
  have hbpos : 0 < b := by omega
  rcases h with ⟨rfl, rfl⟩
  have hm : a % 128 + 128 = a := by omega
  have hmod : a % 128 < 128 := Nat.mod_lt _ (by omega)
  constructor
  · omega
  · rw [show a % 128 + b * 128 = a % 128 + 128 * b by omega,
      writeVarint_cons _ _ hmod hbpos, hm]
    simp [writeVarint, hb]

private theorem readVarint_canonical_three (a b c : Nat) (tail rest : Bytes) (v : Nat)
    (ha : 128 ≤ a) (ha' : a < 256) (hb : 128 ≤ b) (hb' : b < 256) (hc : c < 128)
    (h : readVarint (a :: b :: c :: tail) = .ok (v, rest)) :
    v < 2 ^ 32 ∧ a :: b :: c :: tail = writeVarint v ++ rest := by
  by_cases hz : c = 0
  · simp [readVarint, readVarint.go, show ¬ a < 128 by omega,
      show ¬ b < 128 by omega, hc, hz] at h
  simp [readVarint, readVarint.go, show ¬ a < 128 by omega,
    show ¬ b < 128 by omega, hc, hz, Nat.mod_eq_of_lt hc] at h
  have hcpos : 0 < c := by omega
  rcases h with ⟨rfl, rfl⟩
  have ham : a % 128 + 128 = a := by omega
  have hbm : b % 128 + 128 = b := by omega
  have hal : a % 128 < 128 := Nat.mod_lt _ (by omega)
  have hbl : b % 128 < 128 := Nat.mod_lt _ (by omega)
  constructor
  · omega
  · rw [show a % 128 + b % 128 * 128 + c * 16384 =
        a % 128 + 128 * (b % 128 + 128 * c) by omega,
      writeVarint_cons _ _ hal (by omega), ham,
      writeVarint_cons _ _ hbl hcpos, hbm]
    simp [writeVarint, hc]

private theorem readVarint_canonical_4 (a b c d : Nat) (tail rest : Bytes) (v : Nat)
    (ah : 128 ≤ a) (ah' : a < 256) (bh : 128 ≤ b) (bh' : b < 256) (ch : 128 ≤ c) (ch' : c < 256) (dh : d < 128)
    (h : readVarint (a :: b :: c :: d :: tail) = .ok (v, rest)) :
    v < 2 ^ 32 ∧ a :: b :: c :: d :: tail = writeVarint v ++ rest := by
  by_cases hz : d = 0
  · simp [readVarint, readVarint.go, show ¬ a < 128 by omega, show ¬ b < 128 by omega, show ¬ c < 128 by omega, dh, hz] at h
  simp [readVarint, readVarint.go, show ¬ a < 128 by omega, show ¬ b < 128 by omega, show ¬ c < 128 by omega, dh, hz, Nat.mod_eq_of_lt dh] at h
  have hpos : 0 < d := by omega
  rcases h with ⟨rfl, rfl⟩
  have am : a % 128 + 128 = a := by omega
  have al : a % 128 < 128 := Nat.mod_lt _ (by omega)
  have bm : b % 128 + 128 = b := by omega
  have bl : b % 128 < 128 := Nat.mod_lt _ (by omega)
  have cm : c % 128 + 128 = c := by omega
  have cl : c % 128 < 128 := Nat.mod_lt _ (by omega)
  constructor
  · omega
  ·
    rw [show a % 128 + b % 128 * 128 + c % 128 * 16384 + d * 2097152 = a % 128 + 128 * (b % 128 + 128 * (c % 128 + 128 * (d))) by omega,
      writeVarint_cons _ _ al (by omega), am,
      writeVarint_cons _ _ bl (by omega), bm,
      writeVarint_cons _ _ cl hpos, cm]
    simp [writeVarint, dh]

private theorem readVarint_canonical_5 (a b c d e : Nat) (tail rest : Bytes) (v : Nat)
    (ah : 128 ≤ a) (ah' : a < 256) (bh : 128 ≤ b) (bh' : b < 256) (ch : 128 ≤ c) (ch' : c < 256) (dh : 128 ≤ d) (dh' : d < 256) (eh : e < 128)
    (h : readVarint (a :: b :: c :: d :: e :: tail) = .ok (v, rest)) :
    v < 2 ^ 32 ∧ a :: b :: c :: d :: e :: tail = writeVarint v ++ rest := by
  by_cases hr : 15 < e
  · simp [readVarint, readVarint.go, show ¬ a < 128 by omega, show ¬ b < 128 by omega, show ¬ c < 128 by omega, show ¬ d < 128 by omega, hr] at h
  by_cases hz : e = 0
  · simp [readVarint, readVarint.go, show ¬ a < 128 by omega, show ¬ b < 128 by omega, show ¬ c < 128 by omega, show ¬ d < 128 by omega, eh, hz] at h
  simp [readVarint, readVarint.go, show ¬ a < 128 by omega, show ¬ b < 128 by omega, show ¬ c < 128 by omega, show ¬ d < 128 by omega, eh, hz, hr, Nat.mod_eq_of_lt eh] at h
  have hpos : 0 < e := by omega
  rcases h with ⟨rfl, rfl⟩
  have am : a % 128 + 128 = a := by omega
  have al : a % 128 < 128 := Nat.mod_lt _ (by omega)
  have bm : b % 128 + 128 = b := by omega
  have bl : b % 128 < 128 := Nat.mod_lt _ (by omega)
  have cm : c % 128 + 128 = c := by omega
  have cl : c % 128 < 128 := Nat.mod_lt _ (by omega)
  have dm : d % 128 + 128 = d := by omega
  have dl : d % 128 < 128 := Nat.mod_lt _ (by omega)
  constructor
  · omega
  ·
    rw [show a % 128 + b % 128 * 128 + c % 128 * 16384 + d % 128 * 2097152 + e * 268435456 = a % 128 + 128 * (b % 128 + 128 * (c % 128 + 128 * (d % 128 + 128 * (e)))) by omega,
      writeVarint_cons _ _ al (by omega), am,
      writeVarint_cons _ _ bl (by omega), bm,
      writeVarint_cons _ _ cl (by omega), cm,
      writeVarint_cons _ _ dl hpos, dm]
    simp [writeVarint, eh]

theorem readVarint_canonical (bs rest : Bytes) (v : Nat) (hb : ∀ b ∈ bs, b < 256)
    (h : readVarint bs = .ok (v, rest)) :
    v < 2 ^ 32 ∧ bs = writeVarint v ++ rest := by
  cases bs with
  | nil => simp [readVarint, readVarint.go] at h
  | cons a bs =>
    have ha : a < 256 := hb a (by simp)
    by_cases h1 : a < 128
    · exact readVarint_canonical_one a bs rest v h1 h
    cases bs with
    | nil => simp [readVarint, readVarint.go, h1] at h
    | cons b bs =>
      have hb' : b < 256 := hb b (by simp)
      by_cases h2 : b < 128
      · exact readVarint_canonical_two a b bs rest v (by omega) ha h2 h
      cases bs with
      | nil => simp [readVarint, readVarint.go, h1, h2] at h
      | cons c bs =>
        have hc : c < 256 := hb c (by simp)
        by_cases h3 : c < 128
        · exact readVarint_canonical_three a b c bs rest v (by omega) ha (by omega) hb' h3 h
        cases bs with
        | nil => simp [readVarint, readVarint.go, h1, h2, h3] at h
        | cons d bs =>
          have hd : d < 256 := hb d (by simp)
          by_cases h4 : d < 128
          · exact readVarint_canonical_4 a b c d bs rest v (by omega) ha (by omega) hb' (by omega) hc h4 h
          cases bs with
          | nil => simp [readVarint, readVarint.go, h1, h2, h3, h4] at h
          | cons e bs =>
            by_cases h5 : e < 128
            · exact readVarint_canonical_5 a b c d e bs rest v (by omega) ha (by omega) hb' (by omega) hc (by omega) hd h5 h
            · simp [readVarint, readVarint.go, h1, h2, h3, h4, show 15 < e by omega] at h

private theorem readVarint_writeVarint_one (v : Nat) (rest : Bytes) (h : v < 128) :
    readVarint (writeVarint v ++ rest) = .ok (v, rest) := by
  simp [writeVarint, h, readVarint, readVarint.go, Nat.mod_eq_of_lt h]

private theorem readVarint_writeVarint_two (v : Nat) (rest : Bytes)
    (hlo : 128 ≤ v) (hhi : v < 16384) :
    readVarint (writeVarint v ++ rest) = .ok (v, rest) := by
  have hd : v / 128 < 128 := by omega
  have hdpos : 0 < v / 128 := by omega
  have hm : v % 128 < 128 := Nat.mod_lt _ (by omega)
  rw [writeVarint]
  simp only [show ¬ v < 128 by omega, dite_false, List.cons_append]
  rw [writeVarint]
  simp [hd, readVarint, readVarint.go, Nat.mod_eq_of_lt hd]
  simp only [show ¬ v % 128 + 128 < 128 by omega, show ¬ v < 128 by omega, ite_false, Except.ok.injEq, Prod.mk.injEq]
  constructor
  · omega
  · trivial

private theorem readVarint_writeVarint_three (v : Nat) (rest : Bytes)
    (hlo : 16384 ≤ v) (hhi : v < 2097152) :
    readVarint (writeVarint v ++ rest) = .ok (v, rest) := by
  have h1 : 128 ≤ v / 128 := by omega
  have h2 : v / 128 / 128 < 128 := by omega
  have h2pos : 0 < v / 128 / 128 := by omega
  have hm1 : v % 128 < 128 := Nat.mod_lt _ (by omega)
  have hm2 : v / 128 % 128 < 128 := Nat.mod_lt _ (by omega)
  rw [writeVarint]
  simp only [show ¬ v < 128 by omega, dite_false, List.cons_append]
  rw [writeVarint]
  simp only [show ¬ v / 128 < 128 by omega, dite_false, List.cons_append]
  rw [writeVarint]
  simp [h2, readVarint, readVarint.go, Nat.mod_eq_of_lt h2]
  simp only [show ¬ v % 128 + 128 < 128 by omega,
    show ¬ v / 128 % 128 + 128 < 128 by omega,
    show ¬ v / 128 < 128 by omega, ite_false, Except.ok.injEq, Prod.mk.injEq]
  constructor
  · omega
  · trivial

private theorem readVarint_writeVarint_four (v : Nat) (rest : Bytes)
    (hlo : 2097152 ≤ v) (hhi : v < 268435456) :
    readVarint (writeVarint v ++ rest) = .ok (v, rest) := by
  have h3 : v / 128 / 128 / 128 < 128 := by omega
  have h3pos : 0 < v / 128 / 128 / 128 := by omega
  have hm1 : v % 128 < 128 := Nat.mod_lt _ (by omega)
  have hm2 : v / 128 % 128 < 128 := Nat.mod_lt _ (by omega)
  have hm3 : v / 128 / 128 % 128 < 128 := Nat.mod_lt _ (by omega)
  rw [writeVarint]
  simp only [show ¬ v < 128 by omega, dite_false, List.cons_append]
  rw [writeVarint]
  simp only [show ¬ v / 128 < 128 by omega, dite_false, List.cons_append]
  rw [writeVarint]
  simp only [show ¬ v / 128 / 128 < 128 by omega, dite_false, List.cons_append]
  rw [writeVarint]
  simp [h3, readVarint, readVarint.go, Nat.mod_eq_of_lt h3]
  simp only [show ¬ v % 128 + 128 < 128 by omega,
    show ¬ v / 128 % 128 + 128 < 128 by omega,
    show ¬ v / 128 / 128 % 128 + 128 < 128 by omega,
    show ¬ v / 128 / 128 < 128 by omega, ite_false, Except.ok.injEq, Prod.mk.injEq]
  constructor
  · omega
  · trivial

private theorem readVarint_writeVarint_five (v : Nat) (rest : Bytes)
    (hlo : 268435456 ≤ v) (hhi : v < 4294967296) :
    readVarint (writeVarint v ++ rest) = .ok (v, rest) := by
  have h4 : v / 128 / 128 / 128 / 128 < 16 := by omega
  have h4pos : 0 < v / 128 / 128 / 128 / 128 := by omega
  have hm1 : v % 128 < 128 := Nat.mod_lt _ (by omega)
  have hm2 : v / 128 % 128 < 128 := Nat.mod_lt _ (by omega)
  have hm3 : v / 128 / 128 % 128 < 128 := Nat.mod_lt _ (by omega)
  have hm4 : v / 128 / 128 / 128 % 128 < 128 := Nat.mod_lt _ (by omega)
  rw [writeVarint]
  simp only [show ¬ v < 128 by omega, dite_false, List.cons_append]
  rw [writeVarint]
  simp only [show ¬ v / 128 < 128 by omega, dite_false, List.cons_append]
  rw [writeVarint]
  simp only [show ¬ v / 128 / 128 < 128 by omega, dite_false, List.cons_append]
  rw [writeVarint]
  simp only [show ¬ v / 128 / 128 / 128 < 128 by omega, dite_false, List.cons_append]
  rw [writeVarint]
  simp [show v / 128 / 128 / 128 / 128 < 128 by omega, readVarint, readVarint.go,
    Nat.mod_eq_of_lt (show v / 128 / 128 / 128 / 128 < 128 by omega)]
  simp only [show ¬ v % 128 + 128 < 128 by omega,
    show ¬ v / 128 % 128 + 128 < 128 by omega,
    show ¬ v / 128 / 128 % 128 + 128 < 128 by omega,
    show ¬ v / 128 / 128 / 128 % 128 + 128 < 128 by omega,
    show ¬ v / 128 / 128 / 128 < 128 by omega,
    show ¬ 15 < v / 128 / 128 / 128 / 128 by omega, ite_false, Except.ok.injEq, Prod.mk.injEq]
  constructor
  · omega
  · trivial

theorem readVarint_writeVarint (v : Nat) (rest : Bytes) (h : v < 2 ^ 32) :
    readVarint (writeVarint v ++ rest) = .ok (v, rest) := by
  by_cases h1 : v < 128
  · exact readVarint_writeVarint_one v rest h1
  by_cases h2 : v < 16384
  · exact readVarint_writeVarint_two v rest (by omega) h2
  by_cases h3 : v < 2097152
  · exact readVarint_writeVarint_three v rest (by omega) h3
  by_cases h4 : v < 268435456
  · exact readVarint_writeVarint_four v rest (by omega) h4
  · exact readVarint_writeVarint_five v rest (by omega) (by omega)

private theorem readVarint_go_prefix (bs rest : Bytes) (place value factor v k : Nat)
    (h : readVarint.go place value factor bs = .ok (v, rest))
    (hk : k < bs.length - rest.length) :
    readVarint.go place value factor (bs.take k) = .error .truncated := by
  induction bs generalizing place value factor k with
  | nil => simp at hk
  | cons b bs ih =>
    cases k with
    | zero => simp [readVarint.go]
    | succ k =>
      simp only [readVarint.go] at h
      split at h
      · contradiction
      · split at h
        · split at h
          · contradiction
          · cases h
            simp at hk
        · split at h
          · simp only [List.take_succ_cons, readVarint.go]
            split
            · contradiction
            · exact ih _ _ _ _ h (by simp only [List.length_cons] at hk; omega)
          · contradiction

theorem readVarint_truncated (v k : Nat) (h : v < 2 ^ 32) (hk : k < (writeVarint v).length) :
    readVarint ((writeVarint v).take k) = .error .truncated := by
  apply readVarint_go_prefix (writeVarint v) [] 0 0 1 v k
  · simpa [readVarint] using readVarint_writeVarint v [] h
  · simpa using hk

theorem unzigzag_zigzag (d : Int) :
    unzigzag (zigzag d) = d := by
  unfold zigzag unzigzag
  split <;> rename_i h
  all_goals split <;> omega

theorem zigzag_unzigzag (n : Nat) :
    zigzag (unzigzag n) = n := by
  unfold zigzag unzigzag
  split <;> rename_i h
  all_goals split <;> omega

end Nodetto.Nmesh
