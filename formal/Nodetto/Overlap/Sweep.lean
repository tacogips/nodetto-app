import Nodetto.Overlap.Model
import Lean

open Lean in
macro "overlapScan" : term =>
  pure <| Lean.mkIdent <| Lean.Name.str (Lean.Name.str (Lean.Name.str
    (Lean.Name.num `_private.Nodetto.Overlap.Model 0) "Nodetto") "Overlap") "scan"
open Lean in
macro "overlapScanCons" : term =>
  pure <| Lean.mkIdent <| Lean.Name.str (Lean.Name.str (Lean.Name.str (Lean.Name.str
    (Lean.Name.num `_private.Nodetto.Overlap.Model 0) "Nodetto") "Overlap") "scan") "eq_2"
open Lean in
macro "overlapSweepItems" : term =>
  pure <| Lean.mkIdent <| Lean.Name.str (Lean.Name.str (Lean.Name.str
    (Lean.Name.num `_private.Nodetto.Overlap.Model 0) "Nodetto") "Overlap") "sweepItems"
open Lean in
macro "overlapSweepItemsCons" : term =>
  pure <| Lean.mkIdent <| Lean.Name.str (Lean.Name.str (Lean.Name.str (Lean.Name.str
    (Lean.Name.num `_private.Nodetto.Overlap.Model 0) "Nodetto") "Overlap") "sweepItems") "eq_2"

namespace Nodetto.Overlap

/-- Sorting retains exactly the indexed input boxes. -/
theorem sorted_perm (boxes : List Box) (axis : Axis) :
    (sorted boxes axis).Perm (boxes.zipIdx.map fun (b, i) => (i, b)) := by
  exact List.mergeSort_perm _ _

/-- The sweep processes boxes in nondecreasing lower-bound order. -/
theorem sorted_lower_pairwise (boxes : List Box) (axis : Axis) :
    (sorted boxes axis).Pairwise (fun a b => lower a.2 axis ≤ lower b.2 axis) := by
  let rel (a b : Nat × Box) : Bool :=
    lower a.2 axis < lower b.2 axis ||
      (lower a.2 axis == lower b.2 axis && a.1 ≤ b.1)
  have trans : ∀ a b c, rel a b → rel b c → rel a c := by
    intro a b c hab hbc
    simp only [rel, Bool.or_eq_true, Bool.and_eq_true, decide_eq_true_eq, beq_iff_eq] at *
    omega
  have total : ∀ a b, rel a b || rel b a := by
    intro a b
    simp only [rel, Bool.or_eq_true, Bool.and_eq_true, decide_eq_true_eq, beq_iff_eq]
    omega
  have hs := List.pairwise_mergeSort trans total (boxes.zipIdx.map fun (b, i) => (i, b))
  apply List.Pairwise.imp _ hs
  intro a b h
  simp only [rel, Bool.or_eq_true, Bool.and_eq_true, decide_eq_true_eq, beq_iff_eq] at h
  omega

/-- Closed-box overlap is symmetric, including for inverted bounds. -/
theorem overlaps_symm (a b : Box) : overlaps a b = overlaps b a := by
  simp [overlaps, Bool.and_assoc, Bool.and_left_comm, Bool.and_comm]

/-- Normalization does not depend on the order in which indices are visited. -/
theorem norm_swap (i j : Nat) : norm (i, j) = norm (j, i) := by
  simp [norm, Nat.min_comm, Nat.max_comm]

/-- An overlapping pair cannot be excluded by the sweep-axis bound. -/
theorem overlap_lower_le_upper (a b : Box) (axis : Axis)
    (h : overlaps a b = true) : lower b axis ≤ upper a axis := by
  simp only [overlaps, Bool.and_eq_true, decide_eq_true_eq] at h
  cases axis with
  | x =>
    change b.minX ≤ a.maxX
    exact h.1.1.2
  | y =>
    change b.minY ≤ a.maxY
    exact h.2

/-- Once a sorted scan reaches this bound, no later box can overlap. -/
theorem expired_tail (a b : Nat × Box) (axis : Axis) (rest : List (Nat × Box))
    (sorted : (b :: rest).Pairwise (fun x y => lower x.2 axis ≤ lower y.2 axis))
    (expired : upper a.2 axis < lower b.2 axis) :
    ∀ c ∈ b :: rest, overlaps a.2 c.2 = false := by
  intro c hc
  have bound : lower b.2 axis ≤ lower c.2 axis := by
    simp only [List.mem_cons] at hc
    rcases hc with rfl | hc
    · exact Int.le_refl _
    · exact (List.pairwise_cons.mp sorted).1 c hc
  cases h : overlaps a.2 c.2 with
  | false => rfl
  | true =>
    have := overlap_lower_le_upper a.2 c.2 axis h
    omega

/-- On a sorted tail, the early exit omits only non-overlapping boxes. -/
theorem scan_eq_filter (a : Nat × Box) (axis : Axis) (items : List (Nat × Box))
    (sorted : items.Pairwise (fun x y => lower x.2 axis ≤ lower y.2 axis)) :
    overlapScan a axis items =
      (items.filter (fun b => overlaps a.2 b.2)).map (fun b => (a.1, b.1)) := by
  induction items with
  | nil => rfl
  | cons b rest ih =>
    by_cases h : lower b.2 axis > upper a.2 axis
    · have absent := expired_tail a b axis rest sorted h
      have hf : (b :: rest).filter (fun c => overlaps a.2 c.2) = [] := by
        apply List.filter_eq_nil_iff.mpr
        intro c hc
        simp [absent c hc]
      rw [overlapScanCons]
      simp [h, hf]
    · have tail := (List.pairwise_cons.mp sorted).2
      rw [overlapScanCons]
      cases hb : overlaps a.2 b.2 <;> simp [h, ih tail, hb]

/-- Enumerate each overlapping pair in list order. -/
def orderedPairs : List (Nat × Box) → List (Nat × Nat)
  | [] => []
  | a :: rest => (rest.filter (fun b => overlaps a.2 b.2)).map (fun b => (a.1, b.1)) ++
      orderedPairs rest

/-- A sorted sweep enumerates the overlapping pairs in list order. -/
theorem sweepItems_eq_orderedPairs (axis : Axis) (items : List (Nat × Box))
    (sorted : items.Pairwise (fun x y => lower x.2 axis ≤ lower y.2 axis)) :
    overlapSweepItems axis items = orderedPairs items := by
  induction items with
  | nil => rfl
  | cons a rest ih =>
    have tail := (List.pairwise_cons.mp sorted).2
    rw [overlapSweepItemsCons, orderedPairs, scan_eq_filter a axis rest tail, ih tail]

theorem sweep_eq_orderedPairs (boxes : List Box) (axis : Axis) :
    sweep boxes axis = orderedPairs (sorted boxes axis) := by
  exact sweepItems_eq_orderedPairs axis (sorted boxes axis) (sorted_lower_pairwise boxes axis)

/-- Reordering inputs does not change the multiset of normalized overlapping pairs. -/
theorem orderedPairs_perm {xs ys : List (Nat × Box)} (h : xs.Perm ys) :
    ((orderedPairs xs).map norm).Perm ((orderedPairs ys).map norm) := by
  induction h with
  | nil => exact List.Perm.nil
  | @cons a xs ys h ih =>
    simp only [orderedPairs, List.map_append]
    exact List.Perm.append (((h.filter _).map _).map norm) ih
  | @swap a b rest =>
    have hba : overlaps b.2 a.2 = overlaps a.2 b.2 := overlaps_symm _ _
    cases hab : overlaps a.2 b.2 <;>
      simp [orderedPairs, hba, hab, norm_swap]
      <;> rw [← List.append_assoc, ← List.append_assoc]
      <;> exact List.perm_append_comm.append_right _
  | trans _ _ ih₁ ih₂ => exact ih₁.trans ih₂

theorem sweep_perm_input_pairs (boxes : List Box) (axis : Axis) :
    ((sweep boxes axis).map norm).Perm
      ((orderedPairs (boxes.zipIdx.map fun (b, i) => (i, b))).map norm) := by
  rw [sweep_eq_orderedPairs]
  exact orderedPairs_perm (sorted_perm boxes axis)

/-- Ordered indices already have the canonical orientation. -/
theorem orderedPairs_norm (items : List (Nat × Box))
    (ordered : items.Pairwise (fun a b => a.1 < b.1)) :
    (orderedPairs items).map norm = orderedPairs items := by
  induction items with
  | nil => rfl
  | cons a rest ih =>
    have h := List.pairwise_cons.mp ordered
    simp only [orderedPairs, List.map_append, ih h.2]
    congr 1
    simp only [List.map_map]
    apply List.map_congr_left
    intro b hb
    have hab := h.1 b (List.mem_filter.mp hb).1
    simp [norm, Nat.min_eq_left (Nat.le_of_lt hab), Nat.max_eq_right (Nat.le_of_lt hab)]

theorem indexed_ordered (boxes : List Box) :
    (boxes.zipIdx.map fun (b, i) => (i, b)).Pairwise (fun a b => a.1 < b.1) := by
  have h := List.pairwise_lt_range' (s := 0) (n := boxes.length)
  simpa [← List.zipIdx_map_snd, List.pairwise_map] using h

theorem sweep_perm_indexed_pairs (boxes : List Box) (axis : Axis) :
    ((sweep boxes axis).map norm).Perm
      (orderedPairs (boxes.zipIdx.map fun (b, i) => (i, b))) := by
  simpa [orderedPairs_norm _ (indexed_ordered boxes)] using sweep_perm_input_pairs boxes axis

theorem orderedPairs_flatMap (items : List (Nat × Box))
    (ordered : items.Pairwise (fun a b => a.1 < b.1)) :
    orderedPairs items = items.flatMap (fun a =>
      (items.filter (fun b => decide (a.1 < b.1) && overlaps a.2 b.2)).map
        (fun b => (a.1, b.1))) := by
  induction items with
  | nil => rfl
  | cons a rest ih =>
    have h := List.pairwise_cons.mp ordered
    simp only [orderedPairs, List.flatMap_cons, ih h.2]
    congr 1
    · simp only [List.filter_cons, Nat.lt_irrefl, decide_false, Bool.false_and, Bool.false_eq_true,
        ↓reduceIte]
      congr 1
      apply List.filter_congr
      intro b hb
      simp [h.1 b hb]
    · simp only [List.flatMap]
      congr 1
      apply List.map_congr_left
      intro b hb
      have hab := h.1 b hb
      simp [show ¬ b.1 < a.1 by omega]

theorem indexed_eq_range (boxes : List Box) :
    (boxes.zipIdx.map fun (b, i) => (i, b)) =
      (List.range boxes.length).map (fun i => (i, boxes[i]!)) := by
  apply List.ext_getElem
  · simp
  · intro i hi hj
    have h : i < boxes.length := by simpa using hi
    simp [List.getElem_zipIdx, getElem!_pos, h]

theorem indexed_pairs_eq_bruteForce (boxes : List Box) :
    orderedPairs (boxes.zipIdx.map fun (b, i) => (i, b)) = bruteForce boxes := by
  rw [orderedPairs_flatMap _ (indexed_ordered boxes), indexed_eq_range]
  simp only [List.flatMap_map, List.filter_map, List.map_map, Function.comp_def, bruteForce]
  simp only [List.flatMap]
  congr 1
  apply List.map_congr_left
  intro i hi
  have hi' : i < boxes.length := List.mem_range.mp hi
  apply congrArg
  apply List.filter_congr
  intro j hj
  have hj' : j < boxes.length := List.mem_range.mp hj
  simp [getElem!_pos, hi', hj']

theorem mem_bruteForce (boxes : List Box) (i j : Nat) :
    (i, j) ∈ bruteForce boxes ↔
      i < j ∧ ∃ a b, boxes[i]? = some a ∧ boxes[j]? = some b ∧ overlaps a b = true := by
  simp only [bruteForce, List.mem_flatMap, List.mem_range, List.mem_map,
    List.mem_filter, Bool.and_eq_true, decide_eq_true_eq, Prod.mk.injEq]
  constructor
  · rintro ⟨k, hk, l, ⟨hl, hkl, hover⟩, hki, hlj⟩
    subst k
    subst l
    cases ha : boxes[i]? with
    | none => simp [ha] at hover
    | some a =>
      cases hb : boxes[j]? with
      | none => simp [ha, hb] at hover
      | some b => exact ⟨hkl, a, b, rfl, rfl, by simpa [ha, hb] using hover⟩
  · rintro ⟨hij, a, b, ha, hb, hover⟩
    have hi : i < boxes.length := List.getElem?_eq_some_iff.mp ha |>.1
    have hj : j < boxes.length := List.getElem?_eq_some_iff.mp hb |>.1
    exact ⟨i, hi, j, ⟨hj, hij, by simp [ha, hb, hover]⟩, rfl, rfl⟩

/-- Branch selection preserves sweep correctness when both axes are correct. -/
theorem overlappingPairs_sweep_of_sweep (boxes : List Box)
    (correct : ∀ axis, ((sweep boxes axis).map norm).Perm (bruteForce boxes))
    (h : (overlappingPairs boxes).1 ≠ .tree) :
    ((overlappingPairs boxes).2.map norm).Perm (bruteForce boxes) := by
  by_cases branch : min (overlapCount boxes .x) (overlapCount boxes .y) ≤ (boxes.length : Int) * 8
  · by_cases axis : overlapCount boxes .x ≤ overlapCount boxes .y
    · simpa [overlappingPairs, branch, axis] using correct .x
    · simpa [overlappingPairs, branch, axis] using correct .y
  · simp [overlappingPairs, branch] at h

theorem sweep_visits_overlaps (boxes : List Box) (axis : Axis) :
    ((sweep boxes axis).map norm).Perm (bruteForce boxes) := by
  simpa [indexed_pairs_eq_bruteForce] using sweep_perm_indexed_pairs boxes axis

theorem overlappingPairs_sweep (boxes : List Box) (h : (overlappingPairs boxes).1 ≠ .tree) :
    ((overlappingPairs boxes).2.map norm).Perm (bruteForce boxes) := by
  exact overlappingPairs_sweep_of_sweep boxes (sweep_visits_overlaps boxes) h

end Nodetto.Overlap
