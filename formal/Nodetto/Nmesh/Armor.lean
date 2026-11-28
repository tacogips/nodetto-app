import Nodetto.Nmesh.Model

namespace Nodetto.Nmesh

private theorem alphabet_length : alphabet.length = 64 := by
  simp [alphabet]

private theorem alphabet_nodup : alphabet.Nodup := by
  simp [alphabet, List.nodup_cons]

private theorem alphabet_inverse (n : Nat) (hn : n < 64) :
    alphabet.idxOf? (alphabetAt n) = some n := by
  have h : n < alphabet.length := by simpa [alphabet_length] using hn
  rw [List.idxOf?_eq_some_iff]
  refine ⟨h, ?_, ?_⟩
  · simp [alphabetAt, List.getElem?_eq_getElem h]
  · intro j hj eq
    have hj' : j < alphabet.length := by omega
    have eq' : alphabet[j] = alphabet[n] := by
      simpa [alphabetAt, List.getElem?_eq_getElem h] using eq
    have := alphabet_nodup.eq_of_getElem_eq hj' h eq'
    omega

private theorem alphabet_not_padding (n : Nat) (hn : n < 64) : alphabetAt n ≠ 61 := by
  have inverse := alphabet_inverse n hn
  intro eq
  rw [eq] at inverse
  have mem : 61 ∈ alphabet := List.isSome_idxOf?.mp (by rw [inverse]; rfl)
  simp [alphabet] at mem

private theorem block_arithmetic (a b c : Nat) (ha : a < 256) (hb : b < 256) (hc : c < 256) :
    a / 4 < 64 ∧ (a % 4) * 16 + b / 16 < 64 ∧
    (b % 16) * 4 + c / 64 < 64 ∧ c % 64 < 64 ∧
    (a / 4 * 64 + ((a % 4) * 16 + b / 16)) / 16 = a ∧
    (((a / 4 * 64 + ((a % 4) * 16 + b / 16)) % 16 * 64 +
      ((b % 16) * 4 + c / 64)) / 4) = b ∧
    (((a / 4 * 64 + ((a % 4) * 16 + b / 16)) % 16 * 64 +
      ((b % 16) * 4 + c / 64)) % 4 * 64 + c % 64) = c := by
  omega

private theorem tail_arithmetic (a b : Nat) (ha : a < 256) (hb : b < 256) :
    a / 4 < 64 ∧ (a % 4) * 16 < 64 ∧
    (a / 4 * 64 + (a % 4) * 16) / 16 = a ∧
    (a / 4 * 64 + (a % 4) * 16) % 16 = 0 ∧
    (a % 4) * 16 + b / 16 < 64 ∧ (b % 16) * 4 < 64 ∧
    (a / 4 * 64 + ((a % 4) * 16 + b / 16)) / 16 = a ∧
    (((a / 4 * 64 + ((a % 4) * 16 + b / 16)) % 16 * 64 +
      (b % 16) * 4) / 4) = b ∧
    (((a / 4 * 64 + ((a % 4) * 16 + b / 16)) % 16 * 64 +
      (b % 16) * 4) % 4) = 0 := by
  omega

private theorem armor_length (bs : Bytes) :
    (toInline.go bs).length = 4 * ((bs.length + 2) / 3) := by
  match bs with
  | [] => simp [toInline.go]
  | [a] => simp [toInline.go]
  | [a, b] => simp [toInline.go]
  | a :: b :: c :: rest =>
    simp only [toInline.go, List.length_cons]
    have ih := armor_length rest
    omega
termination_by bs.length

private theorem armor_body_nonempty (bs : Bytes) (hne : bs ≠ []) :
    toInline.go bs ≠ [] := by
  cases bs with
  | nil => contradiction
  | cons a rest =>
    cases rest with
    | nil => simp [toInline.go]
    | cons b rest =>
      cases rest with
      | nil => simp [toInline.go]
      | cons c rest => simp [toInline.go]

private theorem armor_body_divisible (bs : Bytes) :
    (toInline.go bs).length % 4 = 0 := by
  rw [armor_length]
  omega

private theorem armor_encode_success (bs : Bytes) (hne : bs ≠ [])
    (hlen : 4 * ((bs.length + 2) / 3) + 7 ≤ 1048576) :
    toInline bs = .ok (inlinePrefix ++ toInline.go bs) := by
  simp [toInline, List.isEmpty_iff, hne, Nat.not_lt.mpr hlen]

private theorem armor_single (a : Nat) (ha : a < 256) :
    fromInline (inlinePrefix ++ toInline.go [a]) = .ok [a] := by
  have h := tail_arithmetic a 0 ha (by omega)
  have h₁ := alphabet_inverse (a / 4) h.1
  have h₂ := alphabet_inverse ((a % 4) * 16) h.2.1
  simp [fromInline, inlinePrefix, toInline.go, h₁, h₂, h.2.2.1, h.2.2.2.1]
  rfl

private theorem armor_pair (a b : Nat) (ha : a < 256) (hb : b < 256) :
    fromInline (inlinePrefix ++ toInline.go [a, b]) = .ok [a, b] := by
  have h := tail_arithmetic a b ha hb
  have h₁ := alphabet_inverse (a / 4) h.1
  have h₂ := alphabet_inverse ((a % 4) * 16 + b / 16) h.2.2.2.2.1
  have h₃ := alphabet_inverse ((b % 16) * 4) h.2.2.2.2.2.1
  have hp := alphabet_not_padding ((b % 16) * 4) h.2.2.2.2.2.1
  simp [fromInline, inlinePrefix, toInline.go, h₁, h₂, h₃, hp,
    h.2.2.2.2.2.2.1, h.2.2.2.2.2.2.2.1, h.2.2.2.2.2.2.2.2]
  rfl

private theorem armor_triple (a b c : Nat) (ha : a < 256) (hb : b < 256) (hc : c < 256) :
    fromInline (inlinePrefix ++ toInline.go [a, b, c]) = .ok [a, b, c] := by
  have h := block_arithmetic a b c ha hb hc
  have h₁ := alphabet_inverse (a / 4) h.1
  have h₂ := alphabet_inverse ((a % 4) * 16 + b / 16) h.2.1
  have h₃ := alphabet_inverse ((b % 16) * 4 + c / 64) h.2.2.1
  have h₄ := alphabet_inverse (c % 64) h.2.2.2.1
  have hp := alphabet_not_padding (c % 64) h.2.2.2.1
  simp [fromInline, inlinePrefix, toInline.go, h₁, h₂, h₃, h₄, hp,
    h.2.2.2.2.1, h.2.2.2.2.2.1, h.2.2.2.2.2.2]
  simp only [Nat.mod_one, if_pos rfl]
  rfl


private theorem armor_fold_block (a b c : Nat) (out : Bytes)
    (ha : a < 256) (hb : b < 256) (hc : c < 256) :
    ([alphabetAt (a / 4), alphabetAt ((a % 4) * 16 + b / 16),
      alphabetAt ((b % 16) * 4 + c / 64), alphabetAt (c % 64)]).foldlM
      (fun (bits, count, output) ch => do
        let some value := alphabet.idxOf? ch | throw NmeshError.inline
        let bits := bits * 64 + value
        let count := count + 6
        if count >= 8 then
          let count := count - 8
          pure (bits % (2 ^ count), count, output ++ [bits / (2 ^ count)])
        else pure (bits, count, output)) (0, 0, out) =
      (Except.ok (0, 0, out ++ [a, b, c]) : Except NmeshError (Nat × Nat × Bytes)) := by
  have h := block_arithmetic a b c ha hb hc
  have h₁ := alphabet_inverse (a / 4) h.1
  have h₂ := alphabet_inverse ((a % 4) * 16 + b / 16) h.2.1
  have h₃ := alphabet_inverse ((b % 16) * 4 + c / 64) h.2.2.1
  have h₄ := alphabet_inverse (c % 64) h.2.2.2.1
  simp [List.foldlM, h₁, h₂, h₃, h₄, h.2.2.2.2.1,
    h.2.2.2.2.2.1, h.2.2.2.2.2.2, List.append_assoc]
  change Except.ok (c % 1, 0, out ++ [a, b, c]) = _
  exact congrArg (fun n => Except.ok (n, 0, out ++ [a, b, c])) (Nat.mod_one c)

private theorem armor_body_min_length (bs : Bytes) (hne : bs ≠ []) :
    4 ≤ (toInline.go bs).length := by
  have hp : 0 < (toInline.go bs).length := List.length_pos_iff.mpr (armor_body_nonempty bs hne)
  have hd := armor_body_divisible bs
  omega

private theorem armor_padding_suffix (pre : List Nat) (bs : Bytes) (hne : bs ≠ [])
    (n : Nat) (hn : n ≤ 2) :
    (pre ++ toInline.go bs).reverse.take n = (toInline.go bs).reverse.take n := by
  rw [List.reverse_append, List.take_append_of_le_length]
  simp only [List.length_reverse]
  have h := armor_body_min_length bs hne
  omega

private theorem armor_take_padding (pre : List Nat) (bs : Bytes) (hne : bs ≠ [])
    (pad : Nat) (hp : pad ≤ 2) :
    (pre ++ toInline.go bs).take ((pre ++ toInline.go bs).length - pad) =
      pre ++ (toInline.go bs).take ((toInline.go bs).length - pad) := by
  have h := armor_body_min_length bs hne
  simp only [List.length_append, List.take_append]
  have h₁ : pre.length + (toInline.go bs).length - pad ≥ pre.length := by omega
  rw [List.take_of_length_le h₁]
  congr 1
  congr 1
  omega


private theorem armor_fold_single (a : Nat) (out : Bytes) (ha : a < 256) :
    ([alphabetAt (a / 4), alphabetAt ((a % 4) * 16)]).foldlM
      (fun (bits, count, output) ch => do
        let some value := alphabet.idxOf? ch | throw NmeshError.inline
        let bits := bits * 64 + value
        let count := count + 6
        if count >= 8 then
          let count := count - 8
          pure (bits % (2 ^ count), count, output ++ [bits / (2 ^ count)])
        else pure (bits, count, output)) (0, 0, out) =
      (Except.ok (0, 4, out ++ [a]) : Except NmeshError (Nat × Nat × Bytes)) := by
  have h := tail_arithmetic a 0 ha (by omega)
  have h₁ := alphabet_inverse (a / 4) h.1
  have h₂ := alphabet_inverse ((a % 4) * 16) h.2.1
  simp [List.foldlM, h₁, h₂, h.2.2.1, h.2.2.2.1]
  rfl

private theorem armor_fold_pair (a b : Nat) (out : Bytes) (ha : a < 256) (hb : b < 256) :
    ([alphabetAt (a / 4), alphabetAt ((a % 4) * 16 + b / 16),
      alphabetAt ((b % 16) * 4)]).foldlM
      (fun (bits, count, output) ch => do
        let some value := alphabet.idxOf? ch | throw NmeshError.inline
        let bits := bits * 64 + value
        let count := count + 6
        if count >= 8 then
          let count := count - 8
          pure (bits % (2 ^ count), count, output ++ [bits / (2 ^ count)])
        else pure (bits, count, output)) (0, 0, out) =
      (Except.ok (0, 2, out ++ [a, b]) : Except NmeshError (Nat × Nat × Bytes)) := by
  have h := tail_arithmetic a b ha hb
  have h₁ := alphabet_inverse (a / 4) h.1
  have h₂ := alphabet_inverse ((a % 4) * 16 + b / 16) h.2.2.2.2.1
  have h₃ := alphabet_inverse ((b % 16) * 4) h.2.2.2.2.2.1
  simp [List.foldlM, h₁, h₂, h₃, h.2.2.2.2.2.2.1,
    h.2.2.2.2.2.2.2.1, h.2.2.2.2.2.2.2.2, List.append_assoc]
  rfl


private theorem armor_fold_block_append (a b c : Nat) (out rest : Bytes)
    (ha : a < 256) (hb : b < 256) (hc : c < 256) :
    let step : (Nat × Nat × Bytes) → Nat → Except NmeshError (Nat × Nat × Bytes) :=
      fun (bits, count, output) ch => do
      let some value := alphabet.idxOf? ch | throw NmeshError.inline
      let bits := bits * 64 + value
      let count := count + 6
      if count >= 8 then
        let count := count - 8
        pure (bits % (2 ^ count), count, output ++ [bits / (2 ^ count)])
      else pure (bits, count, output)
    let block := [alphabetAt (a / 4), alphabetAt ((a % 4) * 16 + b / 16),
      alphabetAt ((b % 16) * 4 + c / 64), alphabetAt (c % 64)]
    (block ++ rest).foldlM step (0, 0, out) =
      rest.foldlM step (0, 0, out ++ [a, b, c]) := by
  dsimp only
  rw [List.foldlM_append, armor_fold_block a b c out ha hb hc]
  rfl


private theorem armor_fold_complete (bs out : Bytes)
    (hb : ∀ b ∈ bs, b < 256) (hlen : bs.length % 3 = 0) :
    (toInline.go bs).foldlM
      (fun (bits, count, output) ch => do
        let some value := alphabet.idxOf? ch | throw NmeshError.inline
        let bits := bits * 64 + value
        let count := count + 6
        if count >= 8 then
          let count := count - 8
          pure (bits % (2 ^ count), count, output ++ [bits / (2 ^ count)])
        else pure (bits, count, output)) (0, 0, out) =
      (Except.ok (0, 0, out ++ bs) : Except NmeshError (Nat × Nat × Bytes)) := by
  match bs with
  | [] => simp [toInline.go]; rfl
  | [a] => simp at hlen
  | [a, b] => simp at hlen
  | a :: b :: c :: rest =>
    have ha : a < 256 := hb a (by simp)
    have hb' : b < 256 := hb b (by simp)
    have hc : c < 256 := hb c (by simp)
    have hr : ∀ x ∈ rest, x < 256 := by
      intro x hx
      exact hb x (by simp [hx])
    have hl : rest.length % 3 = 0 := by simp only [List.length_cons] at hlen; omega
    have ih := armor_fold_complete rest (out ++ [a, b, c]) hr hl
    change ([alphabetAt (a / 4), alphabetAt ((a % 4) * 16 + b / 16),
      alphabetAt ((b % 16) * 4 + c / 64), alphabetAt (c % 64)] ++ toInline.go rest).foldlM _ _ = _
    rw [armor_fold_block_append a b c out (toInline.go rest) ha hb' hc]
    simpa [List.append_assoc] using ih
termination_by bs.length

private theorem armor_fold_complete_single (bs : Bytes) (a : Nat)
    (hb : ∀ b ∈ bs, b < 256) (hlen : bs.length % 3 = 0) (ha : a < 256) :
    ((toInline.go bs) ++ [alphabetAt (a / 4), alphabetAt ((a % 4) * 16)]).foldlM
      (fun (bits, count, output) ch => do
        let some value := alphabet.idxOf? ch | throw NmeshError.inline
        let bits := bits * 64 + value
        let count := count + 6
        if count >= 8 then
          let count := count - 8
          pure (bits % (2 ^ count), count, output ++ [bits / (2 ^ count)])
        else pure (bits, count, output)) (0, 0, []) =
      (Except.ok (0, 4, bs ++ [a]) : Except NmeshError (Nat × Nat × Bytes)) := by
  rw [List.foldlM_append, armor_fold_complete bs [] hb hlen]
  simp only [List.nil_append, Except.bind]
  exact armor_fold_single a bs ha

private theorem armor_fold_complete_pair (bs : Bytes) (a b : Nat)
    (hb : ∀ x ∈ bs, x < 256) (hlen : bs.length % 3 = 0) (ha : a < 256) (hb' : b < 256) :
    ((toInline.go bs) ++ [alphabetAt (a / 4), alphabetAt ((a % 4) * 16 + b / 16),
      alphabetAt ((b % 16) * 4)]).foldlM
      (fun (bits, count, output) ch => do
        let some value := alphabet.idxOf? ch | throw NmeshError.inline
        let bits := bits * 64 + value
        let count := count + 6
        if count >= 8 then
          let count := count - 8
          pure (bits % (2 ^ count), count, output ++ [bits / (2 ^ count)])
        else pure (bits, count, output)) (0, 0, []) =
      (Except.ok (0, 2, bs ++ [a, b]) : Except NmeshError (Nat × Nat × Bytes)) := by
  rw [List.foldlM_append, armor_fold_complete bs [] hb hlen]
  simp only [List.nil_append, Except.bind]
  exact armor_fold_pair a b bs ha hb'

private def armorPad (body : List Nat) : Nat :=
  if body.reverse.take 2 = [61, 61] then 2
  else if body.reverse.take 1 = [61] then 1 else 0

private def armorStep : (Nat × Nat × Bytes) → Nat → Except NmeshError (Nat × Nat × Bytes) :=
  fun (bits, count, output) ch => do
    let some value := alphabet.idxOf? ch | throw NmeshError.inline
    let bits := bits * 64 + value
    let count := count + 6
    if count >= 8 then
      let count := count - 8
      pure (bits % (2 ^ count), count, output ++ [bits / (2 ^ count)])
    else pure (bits, count, output)

private theorem armor_fold_all (bs out : Bytes) (hb : ∀ b ∈ bs, b < 256) :
    ∃ count, ((toInline.go bs).take ((toInline.go bs).length - armorPad (toInline.go bs))).foldlM
      armorStep (0, 0, out) = .ok (0, count, out ++ bs) := by
  match bs with
  | [] => exact ⟨0, by simp [toInline.go, armorPad]; rfl⟩
  | [a] =>
    have ha : a < 256 := hb a (by simp)
    refine ⟨4, ?_⟩
    simpa [toInline.go, armorPad, armorStep] using armor_fold_single a out ha
  | [a, b] =>
    have ha : a < 256 := hb a (by simp)
    have hb' : b < 256 := hb b (by simp)
    have hp := alphabet_not_padding ((b % 16) * 4) (tail_arithmetic a b ha hb').2.2.2.2.2.1
    refine ⟨2, ?_⟩
    simpa [toInline.go, armorPad, armorStep, hp] using armor_fold_pair a b out ha hb'
  | [a, b, c] =>
    have ha : a < 256 := hb a (by simp)
    have hb' : b < 256 := hb b (by simp)
    have hc : c < 256 := hb c (by simp)
    have hp := alphabet_not_padding (c % 64) (block_arithmetic a b c ha hb' hc).2.2.2.1
    refine ⟨0, ?_⟩
    simpa [toInline.go, armorPad, armorStep, hp] using armor_fold_block a b c out ha hb' hc
  | a :: b :: c :: d :: rest =>
    have ha : a < 256 := hb a (by simp)
    have hb' : b < 256 := hb b (by simp)
    have hc : c < 256 := hb c (by simp)
    have hr : ∀ x ∈ d :: rest, x < 256 := by
      intro x hx
      exact hb x (by simp [hx])
    let block := [alphabetAt (a / 4), alphabetAt ((a % 4) * 16 + b / 16),
      alphabetAt ((b % 16) * 4 + c / 64), alphabetAt (c % 64)]
    have hpad : armorPad (block ++ toInline.go (d :: rest)) = armorPad (toInline.go (d :: rest)) := by
      simp only [armorPad, armor_padding_suffix block (d :: rest) (by simp) 2 (by omega),
        armor_padding_suffix block (d :: rest) (by simp) 1 (by omega)]
    have hp : armorPad (toInline.go (d :: rest)) ≤ 2 := by
      simp only [armorPad]; split <;> (first | omega | (split <;> omega))
    obtain ⟨count, ih⟩ := armor_fold_all (d :: rest) (out ++ [a, b, c]) hr
    refine ⟨count, ?_⟩
    change ((block ++ toInline.go (d :: rest)).take
      ((block ++ toInline.go (d :: rest)).length - armorPad (block ++ toInline.go (d :: rest)))).foldlM
        armorStep (0, 0, out) = _
    rw [hpad, armor_take_padding block (d :: rest) (by simp) _ hp]
    dsimp only [block] at *
    unfold armorStep at *
    rw [armor_fold_block_append a b c out _ ha hb' hc]
    simpa [List.append_assoc] using ih
termination_by bs.length

theorem fromInline_toInline (bs : Bytes) (hb : ∀ b ∈ bs, b < 256) (hne : bs ≠ [])
    (hlen : 4 * ((bs.length + 2) / 3) + 7 ≤ 1048576) :
    ∃ text, toInline bs = .ok text ∧ fromInline text = .ok bs := by
  refine ⟨inlinePrefix ++ toInline.go bs, armor_encode_success bs hne hlen, ?_⟩
  obtain ⟨count, hfold⟩ := armor_fold_all bs [] hb
  have hlim : ¬1048576 < (toInline.go bs).length + 1 + 1 + 1 + 1 + 1 + 1 + 1 := by
    rw [armor_length]
    omega
  have hne' := armor_body_nonempty bs hne
  have hdiv := armor_body_divisible bs
  have hempty : (toInline.go bs).isEmpty = false := by simpa [List.isEmpty_iff] using hne'
  simp only [List.nil_append] at hfold
  simp only [fromInline, inlinePrefix, List.cons_append, List.nil_append, List.length_cons,
    List.take, List.drop, hlim, hempty, hdiv, Bool.false_or, Bool.or_false, Bool.false_eq_true,
    Bool.not_true, Bool.not_false, decide_false, beq_self_eq_true, bne_self_eq_false,
    if_false, if_true]
  change (do
    let r ← ((toInline.go bs).take ((toInline.go bs).length - armorPad (toInline.go bs))).foldlM
      armorStep (0, 0, [])
    if r.1 != 0 then throw NmeshError.inline
    pure r.2.2) = .ok bs
  rw [hfold]
  rfl

end Nodetto.Nmesh
