import Nodetto.Rotate.Model
import Std.Tactic

namespace Nodetto.Rotate

theorem rotate_anchor_snapped (g : Geometry) (p p' : Part) (t : Turn)
    (h : rotate g p t = some p') :
    anchor g p' = (anchor g p).map snapPoint := by
  cases g with
  | mk cx cy pins =>
    cases pins with
    | nil => simp [rotate, anchor, pinPositions] at h
    | cons q qs =>
      cases p with
      | mk x y turns =>
        cases t <;>
          simp [rotate, anchor, pinPositions] at h ⊢ <;>
          subst p' <;>
          simp [anchor, pinPositions, snapPoint] <;>
          constructor <;> omega

private theorem snap_fixed (v : Int) (h : (20 : Int) ∣ v) : snap v = v := by
  obtain ⟨k, rfl⟩ := h
  simp [snap, Int.fdiv_eq_ediv]
  omega

theorem rotate_anchor_fixed (g : Geometry) (p p' : Part) (t : Turn) (a : Int × Int)
    (h : rotate g p t = some p') (ha : anchor g p = some a) (hl : OnLattice a) :
    anchor g p' = some a := by
  rw [rotate_anchor_snapped g p p' t h, ha]
  simp [snapPoint, snap_fixed _ hl.1, snap_fixed _ hl.2]

private theorem turns_cw_ccw (u : Fin 4) : (u + 1) + 3 = u := by
  apply Fin.ext
  simp [Fin.val_add]
  have := u.isLt
  omega

private theorem turns_ccw_cw (u : Fin 4) : (u + 3) + 1 = u := by
  apply Fin.ext
  simp [Fin.val_add]
  have := u.isLt
  omega

theorem rotate_cw_ccw (g : Geometry) (p p1 : Part) (a : Int × Int)
    (ha : anchor g p = some a) (hl : OnLattice a) (h : rotate g p .cw = some p1) :
    rotate g p1 .ccw = some p := by
  cases g with
  | mk cx cy pins =>
    cases pins with
    | nil => simp [anchor, pinPositions] at ha
    | cons q qs =>
      cases p with
      | mk x y turns =>
        simp [anchor, pinPositions] at ha
        subst a
        have hx := snap_fixed _ hl.1
        have hy := snap_fixed _ hl.2
        simp [rotate, anchor, pinPositions, snapPoint, hx, hy] at h
        subst p1
        have ex : x + (x + cx + (rotateVec turns (q.1 - cx, q.2 - cy)).1) -
            (x + cx + (rotateVec (turns + 1) (q.1 - cx, q.2 - cy)).1) + cx +
            (rotateVec (turns + 1) (q.1 - cx, q.2 - cy)).1 =
            x + cx + (rotateVec turns (q.1 - cx, q.2 - cy)).1 := by omega
        have ey : y + (y + cy + (rotateVec turns (q.1 - cx, q.2 - cy)).2) -
            (y + cy + (rotateVec (turns + 1) (q.1 - cx, q.2 - cy)).2) + cy +
            (rotateVec (turns + 1) (q.1 - cx, q.2 - cy)).2 =
            y + cy + (rotateVec turns (q.1 - cx, q.2 - cy)).2 := by omega
        simp [rotate, anchor, pinPositions, snapPoint, turns_cw_ccw, ex, ey, hx, hy]
        congr 1 <;> omega

theorem rotate_ccw_cw (g : Geometry) (p p1 : Part) (a : Int × Int)
    (ha : anchor g p = some a) (hl : OnLattice a) (h : rotate g p .ccw = some p1) :
    rotate g p1 .cw = some p := by
  cases g with
  | mk cx cy pins =>
    cases pins with
    | nil => simp [anchor, pinPositions] at ha
    | cons q qs =>
      cases p with
      | mk x y turns =>
        simp [anchor, pinPositions] at ha
        subst a
        have hx := snap_fixed _ hl.1
        have hy := snap_fixed _ hl.2
        simp [rotate, anchor, pinPositions, snapPoint, hx, hy] at h
        subst p1
        have ex : x + (x + cx + (rotateVec turns (q.1 - cx, q.2 - cy)).1) -
            (x + cx + (rotateVec (turns + 3) (q.1 - cx, q.2 - cy)).1) + cx +
            (rotateVec (turns + 3) (q.1 - cx, q.2 - cy)).1 =
            x + cx + (rotateVec turns (q.1 - cx, q.2 - cy)).1 := by omega
        have ey : y + (y + cy + (rotateVec turns (q.1 - cx, q.2 - cy)).2) -
            (y + cy + (rotateVec (turns + 3) (q.1 - cx, q.2 - cy)).2) + cy +
            (rotateVec (turns + 3) (q.1 - cx, q.2 - cy)).2 =
            y + cy + (rotateVec turns (q.1 - cx, q.2 - cy)).2 := by omega
        simp [rotate, anchor, pinPositions, snapPoint, turns_ccw_cw, ex, ey, hx, hy]
        congr 1 <;> omega

theorem rotate_pins_on_lattice (g : Geometry) (p p' : Part) (t : Turn)
    (hg : PinsOnPitch g) (h : rotate g p t = some p') :
    ∀ q ∈ pinPositions g p', OnLattice q := by
  cases g with
  | mk cx cy pins =>
    cases pins with
    | nil => simp [rotate, anchor, pinPositions] at h
    | cons q0 qs =>
      have hs := rotate_anchor_snapped _ _ _ _ h
      simp [anchor, pinPositions, snapPoint] at hs
      have hlx : (20 : Int) ∣ (p'.x + cx + (rotateVec p'.turns (q0.1 - cx, q0.2 - cy)).1) := by
        rw [hs.1]
        simp [snap, Int.mul_comm]
      have hly : (20 : Int) ∣ (p'.y + cy + (rotateVec p'.turns (q0.1 - cx, q0.2 - cy)).2) := by
        rw [hs.2]
        simp [snap, Int.mul_comm]
      intro q hq
      simp only [pinPositions, List.mem_map] at hq
      obtain ⟨v, hv, rfl⟩ := hq
      have hvp := hg q0 (by simp) v hv
      obtain ⟨kx, hkx⟩ := hvp.1
      obtain ⟨ky, hky⟩ := hvp.2
      obtain ⟨ax, hax⟩ := hlx
      obtain ⟨ay, hay⟩ := hly
      unfold OnLattice
      dsimp
      have ht : p'.turns.val = 0 ∨ p'.turns.val = 1 ∨ p'.turns.val = 2 ∨ p'.turns.val = 3 := by
        have := p'.turns.isLt
        omega
      rcases ht with ht | ht | ht | ht <;> simp [rotateVec, ht] at hax hay ⊢ <;>
        constructor <;> first | exact ⟨ax + kx, by omega⟩ | exact ⟨ax - kx, by omega⟩ |
          exact ⟨ax + ky, by omega⟩ | exact ⟨ax - ky, by omega⟩ |
          exact ⟨ay + kx, by omega⟩ | exact ⟨ay - kx, by omega⟩ |
          exact ⟨ay + ky, by omega⟩ | exact ⟨ay - ky, by omega⟩

private theorem rotate_exists (g : Geometry) (p : Part) (t : Turn) (a : Int × Int)
    (ha : anchor g p = some a) : ∃ p', rotate g p t = some p' := by
  cases g with
  | mk cx cy pins =>
    cases pins with
    | nil => simp [anchor, pinPositions] at ha
    | cons q qs =>
      cases t <;> simp [rotate, anchor, pinPositions]

private theorem rotate_turns (g : Geometry) (p p' : Part) (t : Turn)
    (h : rotate g p t = some p') :
    p'.turns = p.turns + (match t with | .cw => 1 | .ccw => 3) := by
  cases g with
  | mk cx cy pins =>
    cases pins with
    | nil => simp [rotate, anchor, pinPositions] at h
    | cons q qs =>
      cases t <;> simp [rotate, anchor, pinPositions] at h <;> subst p' <;> rfl

private theorem part_unique (g : Geometry) (p q : Part) (a : Int × Int)
    (hp : anchor g p = some a) (hq : anchor g q = some a) (ht : p.turns = q.turns) : p = q := by
  cases g with
  | mk cx cy pins =>
    cases pins with
    | nil => simp [anchor, pinPositions] at hp
    | cons pin pins =>
      cases p with
      | mk x y u =>
        cases q with
        | mk x' y' v =>
          simp at ht
          subst v
          simp [anchor, pinPositions] at hp hq
          cases a
          simp_all
          congr 1 <;> omega

theorem rotate_four (g : Geometry) (p : Part) (t : Turn) (a : Int × Int)
    (ha : anchor g p = some a) (hl : OnLattice a) :
    (((rotate g p t).bind (rotate g · t)).bind (rotate g · t)).bind (rotate g · t) = some p := by
  obtain ⟨p1, h1⟩ := rotate_exists g p t a ha
  have a1 := rotate_anchor_fixed g p p1 t a h1 ha hl
  obtain ⟨p2, h2⟩ := rotate_exists g p1 t a a1
  have a2 := rotate_anchor_fixed g p1 p2 t a h2 a1 hl
  obtain ⟨p3, h3⟩ := rotate_exists g p2 t a a2
  have a3 := rotate_anchor_fixed g p2 p3 t a h3 a2 hl
  obtain ⟨p4, h4⟩ := rotate_exists g p3 t a a3
  have a4 := rotate_anchor_fixed g p3 p4 t a h4 a3 hl
  have t1 := rotate_turns g p p1 t h1
  have t2 := rotate_turns g p1 p2 t h2
  have t3 := rotate_turns g p2 p3 t h3
  have t4 := rotate_turns g p3 p4 t h4
  have ht : p4.turns = p.turns := by
    rw [t4, t3, t2, t1]
    cases t <;> apply Fin.ext <;> simp [Fin.val_add] <;> have := p.turns.isLt <;> omega
  have eq := part_unique g p4 p a a4 ha ht
  simp [h1, h2, h3, h4, eq]

end Nodetto.Rotate
