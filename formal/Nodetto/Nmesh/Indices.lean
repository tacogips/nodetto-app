import Nodetto.Nmesh.Model

namespace Nodetto.Nmesh

private theorem firstUse_go_le (xs : List Nat) (used final : Nat)
    (h : firstUse.go used xs = some final) : used ≤ final := by
  induction xs generalizing used with
  | nil => simp [firstUse.go] at h; omega
  | cons x xs ih =>
    simp only [firstUse.go] at h
    split at h
    next hx => exact ih used h
    next hx =>
      split at h
      next he => have hh := ih (used + 1) h; omega
      next he => simp at h

private theorem decode_encode_go (xs : List Nat) (used count : Nat)
    (h : firstUse.go used xs = some count) :
    decodeIndices.go count used (encodeIndices.go used xs) = .ok xs := by
  induction xs generalizing used with
  | nil =>
    simp [firstUse.go] at h
    subst count
    simp [encodeIndices.go, decodeIndices.go]
  | cons x xs ih =>
    simp only [firstUse.go] at h
    by_cases hx : x < used
    · have hne : x ≠ used := by omega
      have hd : 0 < used - x := by omega
      have hdle : used - x ≤ used := by omega
      have hv : used - (used - x) = x := by omega
      have hnlt : ¬ used < used - x := by omega
      have hnz : used - x ≠ 0 := by omega
      simp only [hx, ↓reduceIte] at h
      simp [encodeIndices.go, hne, decodeIndices.go, indexStep, hnlt, hnz, hv, Except.bind, Except.map]
      change (do let vs ← decodeIndices.go count used (encodeIndices.go used xs); pure (x :: vs)) = _
      rw [ih used h]
      rfl
    · by_cases he : x = used
      · subst x
        simp only [hx, ↓reduceIte, ↓reduceIte] at h
        have hl := firstUse_go_le xs (used + 1) count h
        have hn : used ≠ count := by omega
        simp [encodeIndices.go, decodeIndices.go, indexStep, hn, Except.bind, Except.map]
        change (do let vs ← decodeIndices.go count (used + 1) (encodeIndices.go (used + 1) xs); pure (used :: vs)) = _
        rw [ih (used + 1) h]
        rfl
      · simp [hx, he] at h

theorem decodeIndices_encodeIndices (triangles : List Nat) (vertexCount : Nat)
    (h : firstUse triangles = some vertexCount) :
    decodeIndices vertexCount (encodeIndices triangles) = .ok triangles := by
  exact decode_encode_go triangles 0 vertexCount h

private theorem encode_decode_go (codes : List Nat) (count used : Nat) (triangles : List Nat)
    (h : decodeIndices.go count used codes = .ok triangles) :
    firstUse.go used triangles = some count ∧ encodeIndices.go used triangles = codes := by
  induction codes generalizing used triangles with
  | nil =>
    simp only [decodeIndices.go] at h
    split at h
    next he => cases h; simp [firstUse.go, encodeIndices.go, he]
    next he => simp at h
  | cons c cs ih =>
    simp only [decodeIndices.go, indexStep] at h
    split at h
    next bad =>
      change Except.error NmeshError.index = Except.ok triangles at h
      cases h
    next good =>
      have hc : c ≤ used := by simp only [Bool.or_eq_true, Bool.and_eq_true, decide_eq_true_eq] at good; omega
      by_cases hz : c = 0
      · subst c
        simp only [Nat.sub_zero, ↓reduceIte] at h
        change (do let vs ← decodeIndices.go count (used + 1) cs; pure (used :: vs)) = .ok triangles at h
        cases hr : decodeIndices.go count (used + 1) cs with
        | error e =>
          rw [hr] at h
          change Except.error e = Except.ok triangles at h
          cases h
        | ok vs =>
          rw [hr] at h
          change Except.ok (used :: vs) = Except.ok triangles at h
          have ht : triangles = used :: vs := by cases h; rfl
          subst triangles
          obtain ⟨hf, he⟩ := ih (used + 1) vs hr
          simp [firstUse.go, encodeIndices.go, hf, he]
      · have hl : used - c < used := by omega
        have hd : used - (used - c) = c := by omega
        have hne : used - c ≠ used := by omega
        simp only [hz, ↓reduceIte] at h
        change (do let vs ← decodeIndices.go count used cs; pure ((used - c) :: vs)) = .ok triangles at h
        cases hr : decodeIndices.go count used cs with
        | error e =>
          rw [hr] at h
          change Except.error e = Except.ok triangles at h
          cases h
        | ok vs =>
          rw [hr] at h
          change Except.ok ((used - c) :: vs) = Except.ok triangles at h
          have ht : triangles = (used - c) :: vs := by cases h; rfl
          subst triangles
          obtain ⟨hf, he⟩ := ih used vs hr
          simp [firstUse.go, encodeIndices.go, hl, hne, hd, hf, he]

theorem encodeIndices_decodeIndices (vertexCount : Nat) (codes triangles : List Nat)
    (h : decodeIndices vertexCount codes = .ok triangles) :
    firstUse triangles = some vertexCount ∧ encodeIndices triangles = codes := by
  exact encode_decode_go codes vertexCount 0 triangles h

end Nodetto.Nmesh
