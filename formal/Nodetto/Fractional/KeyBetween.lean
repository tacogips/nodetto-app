import Nodetto.Fractional.Midpoint
namespace Nodetto.Fractional

theorem keyBetween_between (lo hi : Key) (rng : Rng)
    (hlo : isFractionalKey lo = true) (hhi : isFractionalKey hi = true) (hlt : lo < hi) :
    ∃ k rng', keyBetween (some lo) (some hi) rng = .ok (k, rng') ∧
      lo < k ∧ k < hi ∧ isFractionalKey k = true := by
  obtain ⟨k, r, he, hl, hu, hv⟩ := midpoint_bounded lo hi rng (Or.inr hlo) hhi hlt
  exact ⟨k, r, by simpa [keyBetween, hlo, hhi] using he, hl, hu, hv⟩

theorem keyBetween_below (hi : Key) (rng : Rng) (hhi : isFractionalKey hi = true) :
    ∃ k rng', keyBetween none (some hi) rng = .ok (k, rng') ∧
      k < hi ∧ isFractionalKey k = true := by
  obtain ⟨k, r, he, _, hu, hv⟩ := midpoint_empty_bounded hi rng hhi
  exact ⟨k, r, by simpa [keyBetween, hhi] using he, hu, hv⟩

theorem keyBetween_above (lo : Key) (rng : Rng) (hlo : isFractionalKey lo = true) :
    ∃ k rng', keyBetween (some lo) none rng = .ok (k, rng') ∧
      lo < k ∧ isFractionalKey k = true := by
  obtain ⟨k, r, he, hl, hv⟩ := midpoint_unbounded lo rng (Or.inr hlo)
  exact ⟨k, r, by simpa [keyBetween, hlo] using he, hl, hv⟩

theorem keyBetween_unbounded (rng : Rng) :
    ∃ k rng', keyBetween none none rng = .ok (k, rng') ∧ isFractionalKey k = true := by
  obtain ⟨k, r, he, _, hv⟩ := midpoint_empty_unbounded rng
  exact ⟨k, r, by simpa [keyBetween] using he, hv⟩

theorem keyBetween_rejects_lower (lo : Key) (hi : Option Key) (rng : Rng)
    (h : isFractionalKey lo = false) :
    ∃ e, keyBetween (some lo) hi rng = .error e := by
  exact ⟨"range", by simp [keyBetween, h, throw, throwThe, MonadExceptOf.throw, Bind.bind, Except.bind]⟩

theorem keyBetween_rejects_upper (lo : Option Key) (hi : Key) (rng : Rng)
    (h : isFractionalKey hi = false) :
    ∃ e, keyBetween lo (some hi) rng = .error e := by
  cases lo with
  | none => exact ⟨"range", by simp [keyBetween, h, throw, throwThe, MonadExceptOf.throw, Bind.bind, Except.bind]⟩
  | some lo =>
    cases hv : isFractionalKey lo <;> simp [keyBetween, h, hv, throw, throwThe, MonadExceptOf.throw, Bind.bind, Except.bind]

theorem keyBetween_rejects_inverted (lo hi : Key) (rng : Rng)
    (hlo : isFractionalKey lo = true) (hhi : isFractionalKey hi = true) (h : ¬ lo < hi) :
    ∃ e, keyBetween (some lo) (some hi) rng = .error e := by
  refine ⟨"range", ?_⟩
  simp only [keyBetween, hlo, hhi, Bool.not_true, ↓reduceIte, Option.getD_some, pure, Bind.bind, Except.bind]
  rw [midpoint.eq_def]
  simp [h, throw, throwThe, MonadExceptOf.throw, Bind.bind, Except.bind]

theorem keyAfter_gt (s : Key) (rng : Rng) :
    ∃ k rng', keyAfter (some s) rng = .ok (k, rng') ∧ s < k := by
  by_cases h : isFractionalKey s = true
  · obtain ⟨k, r, he, hl, _⟩ := midpoint_unbounded s rng (Or.inr h)
    exact ⟨k, r, by simpa [keyAfter, h] using he, hl⟩
  · refine ⟨s ++ [DIGITS.getD (randomDigitBetween 0 62 rng).1 48],
      (randomDigitBetween 0 62 rng).2, ?_, ?_⟩
    · simp [keyAfter, h]
    · simpa using (List.append_left_lt (l₁ := s) (List.nil_lt_cons (DIGITS.getD (randomDigitBetween 0 62 rng).1 48) []))

theorem keyAfter_valid (s : Key) (rng : Rng) (h : isFractionalKey s = true) :
    ∃ k rng', keyAfter (some s) rng = .ok (k, rng') ∧ isFractionalKey k = true := by
  obtain ⟨k, r, he, _, hv⟩ := midpoint_unbounded s rng (Or.inr h)
  exact ⟨k, r, by simpa [keyAfter, h] using he, hv⟩

theorem keyAfter_none_valid (rng : Rng) :
    ∃ k rng', keyAfter none rng = .ok (k, rng') ∧ isFractionalKey k = true := by
  obtain ⟨k, r, he, _, hv⟩ := midpoint_empty_unbounded rng
  exact ⟨k, r, by simpa [keyAfter] using he, hv⟩
end Nodetto.Fractional
