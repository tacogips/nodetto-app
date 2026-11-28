import Nodetto.Overlap.Model

namespace Nodetto.Overlap

/-- Closed-box overlap is symmetric, including for inverted bounds. -/
theorem overlaps_comm (a b : Box) : overlaps a b = overlaps b a := by
  simp only [overlaps]
  simp only [Bool.and_assoc, Bool.and_left_comm, Bool.and_comm]

end Nodetto.Overlap
