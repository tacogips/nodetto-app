import Nodetto.CadEnclosure.Model

namespace Nodetto.CadEnclosure

theorem cad_type_only_on_cad3d (kind elemType : String) (isResource : Bool)
    (hcad : isCadType elemType = true)
    (hacc : pageAccepts kind elemType isResource = true) :
    kind = "cad3d" := by
  unfold pageAccepts at hacc
  rw [hcad] at hacc
  simp at hacc
  exact hacc

theorem cad3d_accepts_resource (elemType : String)
    (hnot : isCadType elemType = false) :
    pageAccepts "cad3d" elemType true = true := by
  unfold pageAccepts
  rw [hnot]
  simp

theorem cad3d_rejects_non_cad_non_resource (elemType : String)
    (hnot : isCadType elemType = false) :
    pageAccepts "cad3d" elemType false = false := by
  unfold pageAccepts
  rw [hnot]
  simp

private def effectiveFloor (inp : ShellInput) : Int :=
  match inp.openFace with | .both => 0 | _ => inp.floorThickness

private theorem computeShellSpec_some (inp : ShellInput) (s : ShellSpec)
    (h : computeShellSpec inp = some s) :
    0 < inp.wallThickness ∧
    0 ≤ effectiveFloor inp ∧
    0 < inp.height - effectiveFloor inp ∧
    s.outerX0 = min inp.x0 inp.x1 ∧
    s.outerX1 = max inp.x0 inp.x1 ∧
    s.outerY0 = min inp.y0 inp.y1 ∧
    s.outerY1 = max inp.y0 inp.y1 ∧
    s.outerWidth = s.outerX1 - s.outerX0 ∧
    s.outerHeight = s.outerY1 - s.outerY0 ∧
    s.innerX0 = s.outerX0 + inp.wallThickness ∧
    s.innerX1 = s.outerX1 - inp.wallThickness ∧
    s.innerY0 = s.outerY0 + inp.wallThickness ∧
    s.innerY1 = s.outerY1 - inp.wallThickness ∧
    s.innerWidth = s.innerX1 - s.innerX0 ∧
    s.innerHeight = s.innerY1 - s.innerY0 ∧
    0 < s.innerWidth ∧
    0 < s.innerHeight ∧
    s.height = inp.height ∧
    s.wallThickness = inp.wallThickness ∧
    s.floorThickness = effectiveFloor inp ∧
    s.cavityDepth = inp.height - effectiveFloor inp ∧
    s.outerRadius = min inp.cornerRadius (min s.outerWidth s.outerHeight / 2) ∧
    s.innerRadius = (if s.outerRadius > inp.wallThickness then s.outerRadius - inp.wallThickness else 0) := by
  unfold computeShellSpec at h
  change
    (let outerX0 := min inp.x0 inp.x1
     let outerX1 := max inp.x0 inp.x1
     let outerY0 := min inp.y0 inp.y1
     let outerY1 := max inp.y0 inp.y1
     let outerWidth := outerX1 - outerX0
     let outerHeight := outerY1 - outerY0
     let height := inp.height
     let wall := inp.wallThickness
     let floor := effectiveFloor inp
     let reqRadius := inp.cornerRadius
     if !(withinExtent outerX0 && withinExtent outerX1 &&
          withinExtent outerY0 && withinExtent outerY1 && withinExtent height) then none
     else if outerWidth ≤ 0 || outerHeight ≤ 0 || height ≤ 0 || wall ≤ 0 || floor < 0 || reqRadius < 0 then none
     else if inp.openFace != .both && (floor ≤ 0 || floor ≥ height) then none
     else
       let innerX0 := outerX0 + wall
       let innerY0 := outerY0 + wall
       let innerX1 := outerX1 - wall
       let innerY1 := outerY1 - wall
       let innerWidth := innerX1 - innerX0
       let innerHeight := innerY1 - innerY0
       if innerWidth ≤ 0 || innerHeight ≤ 0 then none
       else
         let cavityDepth := height - floor
         if cavityDepth ≤ 0 then none
         else
           let maxOuterRadius := min outerWidth outerHeight / 2
           let outerRadius := min reqRadius maxOuterRadius
           let innerRadius := if outerRadius > wall then outerRadius - wall else 0
           some {
             outerX0, outerY0, outerX1, outerY1,
             outerWidth, outerHeight,
             innerX0, innerY0, innerX1, innerY1,
             innerWidth, innerHeight,
             height,
             wallThickness := wall,
             floorThickness := floor,
             cavityDepth,
             outerRadius,
             innerRadius,
             openFace := inp.openFace
           }) = some s at h
  dsimp only at h
  split at h
  · cases h
  · split at h
    · cases h
    · split at h
      · cases h
      · split at h
        · cases h
        · split at h
          · cases h
          · injection h with hs
            subst hs
            rename_i h_ext h_pos h_fl h_in h_cav
            simp only [Bool.or_eq_true, decide_eq_true_eq, not_or] at h_pos h_in h_cav
            dsimp only
            refine ⟨?_, ?_, ?_, rfl, rfl, rfl, rfl, rfl, rfl, rfl, rfl, rfl, rfl, rfl, rfl, ?_, ?_, rfl, rfl, rfl, rfl, rfl, rfl⟩ <;> omega

theorem shell_inner_strictly_inside (inp : ShellInput) (s : ShellSpec)
    (h : computeShellSpec inp = some s) :
    s.outerX0 < s.innerX0 ∧ s.innerX0 < s.innerX1 ∧ s.innerX1 < s.outerX1 ∧
    s.outerY0 < s.innerY0 ∧ s.innerY0 < s.innerY1 ∧ s.innerY1 < s.outerY1 := by
  have hs := computeShellSpec_some inp s h
  omega

theorem shell_wall_margins (inp : ShellInput) (s : ShellSpec)
    (h : computeShellSpec inp = some s) :
    s.innerX0 - s.outerX0 = s.wallThickness ∧
    s.outerX1 - s.innerX1 = s.wallThickness ∧
    s.innerY0 - s.outerY0 = s.wallThickness ∧
    s.outerY1 - s.innerY1 = s.wallThickness := by
  have hs := computeShellSpec_some inp s h
  omega

theorem shell_cavity_bounds (inp : ShellInput) (s : ShellSpec)
    (h : computeShellSpec inp = some s) :
    0 < s.cavityDepth ∧ s.cavityDepth ≤ s.height ∧
    s.cavityDepth + s.floorThickness = s.height := by
  have hs := computeShellSpec_some inp s h
  omega

theorem shell_radius_safe (inp : ShellInput) (s : ShellSpec)
    (h : computeShellSpec inp = some s) :
    0 ≤ s.innerRadius ∧ 2 * s.innerRadius ≤ s.innerWidth ∧ 2 * s.innerRadius ≤ s.innerHeight := by
  have hs := computeShellSpec_some inp s h
  rcases hs with ⟨_, _, _, _, _, _, _, h_ow, h_oh, h_ix0, h_ix1, h_iy0, h_iy1, h_iw, h_ih, _, _, _, h_w, _, _, h_or, h_ir⟩
  rw [h_ir]
  split <;> omega

theorem pcb_enclosure_clearance (inp : PcbEnclosureInput) (d : PcbEnclosureDims)
    (h : computePcbEnclosureDims inp = some d) :
    d.shell.innerX0 = min inp.boardMinX inp.boardMaxX - inp.clearance ∧
    d.shell.innerX1 = max inp.boardMinX inp.boardMaxX + inp.clearance ∧
    d.shell.innerY0 = min inp.boardMinY inp.boardMaxY - inp.clearance ∧
    d.shell.innerY1 = max inp.boardMinY inp.boardMaxY + inp.clearance := by
  unfold computePcbEnclosureDims at h
  dsimp only at h
  split at h
  · cases h
  · split at h
    · cases h
    · cases hsh : computeShellSpec {
        x0 := min inp.boardMinX inp.boardMaxX - inp.clearance - inp.wallThickness,
        y0 := min inp.boardMinY inp.boardMaxY - inp.clearance - inp.wallThickness,
        x1 := max inp.boardMinX inp.boardMaxX + inp.clearance + inp.wallThickness,
        y1 := max inp.boardMinY inp.boardMaxY + inp.clearance + inp.wallThickness,
        height := inp.floorThickness + (inp.standoffHeight + inp.boardThickness + inp.componentHeadroom),
        wallThickness := inp.wallThickness,
        floorThickness := inp.floorThickness,
        cornerRadius := inp.cornerRadius,
        openFace := .endFace
      } with
      | none => rw [hsh] at h; cases h
      | some sh =>
        rw [hsh] at h
        injection h with hd
        subst hd
        rename_i h1 _
        simp only [Bool.or_eq_true, decide_eq_true_eq, not_or] at h1
        have hs := computeShellSpec_some _ sh hsh
        dsimp only at hs ⊢
        omega

theorem pcb_enclosure_vertical_stack (inp : PcbEnclosureInput) (d : PcbEnclosureDims)
    (h : computePcbEnclosureDims inp = some d) :
    d.shell.height = inp.floorThickness + inp.standoffHeight + inp.boardThickness + inp.componentHeadroom ∧
    d.shell.cavityDepth = inp.standoffHeight + inp.boardThickness + inp.componentHeadroom ∧
    d.baseOffsetZ + inp.floorThickness + inp.standoffHeight = 0 := by
  unfold computePcbEnclosureDims at h
  dsimp only at h
  split at h
  · cases h
  · split at h
    · cases h
    · cases hsh : computeShellSpec {
        x0 := min inp.boardMinX inp.boardMaxX - inp.clearance - inp.wallThickness,
        y0 := min inp.boardMinY inp.boardMaxY - inp.clearance - inp.wallThickness,
        x1 := max inp.boardMinX inp.boardMaxX + inp.clearance + inp.wallThickness,
        y1 := max inp.boardMinY inp.boardMaxY + inp.clearance + inp.wallThickness,
        height := inp.floorThickness + (inp.standoffHeight + inp.boardThickness + inp.componentHeadroom),
        wallThickness := inp.wallThickness,
        floorThickness := inp.floorThickness,
        cornerRadius := inp.cornerRadius,
        openFace := .endFace
      } with
      | none => rw [hsh] at h; cases h
      | some sh =>
        rw [hsh] at h
        injection h with hd
        subst hd
        have hs := computeShellSpec_some _ sh hsh
        dsimp only [effectiveFloor] at hs ⊢
        omega

end Nodetto.CadEnclosure
