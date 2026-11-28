namespace Nodetto.CadEnclosure

/-- Maximum CAD coordinate in nanometres (±10000 mm = ±10_000_000_000 nm). -/
def maxCadCoordNm : Int := 10000000000

/-- Whether a type name belongs to the CAD namespace (`cad.*`). -/
def isCadType (elemType : String) : Bool :=
  elemType.startsWith "cad."

/-- `packages/ir/src/page-content.ts`: Rule R page content enforcement. -/
def pageAccepts (kind : String) (elemType : String) (isResource : Bool) : Bool :=
  if isCadType elemType then kind == "cad3d"
  else if kind != "cad3d" then true
  else isResource

inductive OpenFace where
  | endFace
  | startFace
  | both
  deriving Repr, BEq, DecidableEq

/-- Integer nanometre inputs to `computeShellSpec`. -/
structure ShellInput where
  x0 : Int
  y0 : Int
  x1 : Int
  y1 : Int
  height : Int
  wallThickness : Int
  floorThickness : Int
  cornerRadius : Int
  openFace : OpenFace
  deriving Repr, BEq

/-- Validated enclosure shell specification in nanometres. -/
structure ShellSpec where
  outerX0 : Int
  outerY0 : Int
  outerX1 : Int
  outerY1 : Int
  outerWidth : Int
  outerHeight : Int
  innerX0 : Int
  innerY0 : Int
  innerX1 : Int
  innerY1 : Int
  innerWidth : Int
  innerHeight : Int
  height : Int
  wallThickness : Int
  floorThickness : Int
  cavityDepth : Int
  outerRadius : Int
  innerRadius : Int
  openFace : OpenFace
  deriving Repr, BEq

def withinExtent (v : Int) : Bool :=
  decide (-maxCadCoordNm ≤ v ∧ v ≤ maxCadCoordNm)

/-- Exact integer-nanometre model of `packages/core/src/cad/enclosure.ts` `computeShellSpec`. -/
def computeShellSpec (inp : ShellInput) : Option ShellSpec :=
  let outerX0 := min inp.x0 inp.x1
  let outerX1 := max inp.x0 inp.x1
  let outerY0 := min inp.y0 inp.y1
  let outerY1 := max inp.y0 inp.y1
  let outerWidth := outerX1 - outerX0
  let outerHeight := outerY1 - outerY0
  let height := inp.height
  let wall := inp.wallThickness
  let floor := match inp.openFace with | .both => 0 | _ => inp.floorThickness
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
        }

/-- Integer nanometre inputs to `computePcbEnclosureDims`. -/
structure PcbEnclosureInput where
  boardMinX : Int
  boardMinY : Int
  boardMaxX : Int
  boardMaxY : Int
  boardThickness : Int
  clearance : Int
  wallThickness : Int
  floorThickness : Int
  standoffHeight : Int
  componentHeadroom : Int
  cornerRadius : Int
  deriving Repr, BEq

structure PcbEnclosureDims where
  cavityX0 : Int
  cavityY0 : Int
  cavityX1 : Int
  cavityY1 : Int
  baseOffsetZ : Int
  shell : ShellSpec
  deriving Repr, BEq

/-- Exact integer-nanometre model of `computePcbEnclosureDims`. -/
def computePcbEnclosureDims (inp : PcbEnclosureInput) : Option PcbEnclosureDims :=
  let minX := min inp.boardMinX inp.boardMaxX
  let maxX := max inp.boardMinX inp.boardMaxX
  let minY := min inp.boardMinY inp.boardMaxY
  let maxY := max inp.boardMinY inp.boardMaxY
  if maxX ≤ minX || maxY ≤ minY || inp.boardThickness ≤ 0 || inp.clearance < 0 ||
     inp.wallThickness ≤ 0 || inp.floorThickness ≤ 0 || inp.standoffHeight < 0 ||
     inp.componentHeadroom ≤ 0 then none
  else
    let cavityX0 := minX - inp.clearance
    let cavityY0 := minY - inp.clearance
    let cavityX1 := maxX + inp.clearance
    let cavityY1 := maxY + inp.clearance
    let outerX0 := cavityX0 - inp.wallThickness
    let outerY0 := cavityY0 - inp.wallThickness
    let outerX1 := cavityX1 + inp.wallThickness
    let outerY1 := cavityY1 + inp.wallThickness
    let cavityDepth := inp.standoffHeight + inp.boardThickness + inp.componentHeadroom
    let height := inp.floorThickness + cavityDepth
    let baseOffsetZ := -(inp.floorThickness + inp.standoffHeight)
    if !withinExtent baseOffsetZ then none
    else
      match computeShellSpec {
        x0 := outerX0, y0 := outerY0, x1 := outerX1, y1 := outerY1,
        height, wallThickness := inp.wallThickness, floorThickness := inp.floorThickness,
        cornerRadius := inp.cornerRadius, openFace := .endFace
      } with
      | none => none
      | some shell => some { cavityX0, cavityY0, cavityX1, cavityY1, baseOffsetZ, shell }

end Nodetto.CadEnclosure
