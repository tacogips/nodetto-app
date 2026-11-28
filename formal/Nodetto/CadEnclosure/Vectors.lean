import Nodetto.CadEnclosure.Model
import Nodetto.Json

open Nodetto.CadEnclosure Nodetto.Json

private def n (x : Int) : Value := .num x
private def s (x : String) : Value := ofAscii x
private def b (x : Bool) : Value := .bool x
private def obj (xs : List (String × Value)) : Value := .obj xs

private def openFaceStr : OpenFace → String
  | .endFace => "end"
  | .startFace => "start"
  | .both => "both"

private def shellSpecJson (sp : ShellSpec) : Value :=
  obj [
    ("outerX0", n sp.outerX0), ("outerY0", n sp.outerY0),
    ("outerX1", n sp.outerX1), ("outerY1", n sp.outerY1),
    ("outerWidth", n sp.outerWidth), ("outerHeight", n sp.outerHeight),
    ("innerX0", n sp.innerX0), ("innerY0", n sp.innerY0),
    ("innerX1", n sp.innerX1), ("innerY1", n sp.innerY1),
    ("innerWidth", n sp.innerWidth), ("innerHeight", n sp.innerHeight),
    ("height", n sp.height), ("wallThickness", n sp.wallThickness),
    ("floorThickness", n sp.floorThickness), ("cavityDepth", n sp.cavityDepth),
    ("outerRadius", n sp.outerRadius), ("innerRadius", n sp.innerRadius),
    ("openFace", s (openFaceStr sp.openFace))
  ]

private def pageAcceptsCases : List (String × Value × Value) :=
  let kinds := ["cad3d", "freeform", "pcb", "erd", "bpmn"]
  let types := [
    ("cad.sketch", false), ("cad.extrude", false), ("cad.pcb", false),
    ("cad.mesh", false), ("cad.future", false),
    ("node.generic", false), ("pcb.board", false),
    ("design.token", true), ("review.comment", true)
  ]
  kinds.flatMap fun kind =>
    types.map fun (t, res) =>
      ("pageAccepts",
        obj [("kind", s kind), ("type", s t), ("isResource", b res)],
        ok (b (pageAccepts kind t res)))

private def shellCase (i : Nat) : String × Value × Value :=
  let scale : Int := 1000000
  let x0 : Int := ((Int.ofNat (i % 7)) - 3) * 10 * scale
  let y0 : Int := ((Int.ofNat ((i / 7) % 5)) - 2) * 10 * scale
  let w : Int := (Int.ofNat ((i % 9) + 1)) * 10 * scale
  let h : Int := (Int.ofNat (((i / 3) % 8) + 1)) * 10 * scale
  let flip := i % 5 == 0
  let ax0 := if flip then x0 + w else x0
  let ax1 := if flip then x0 else x0 + w
  let height : Int := (Int.ofNat ((i % 6) + 1)) * 5 * scale
  let wall : Int := (Int.ofNat ((i % 7) + 1)) * 2 * scale
  let floor : Int := (Int.ofNat (i % 6)) * 2 * scale
  let radius : Int := (Int.ofNat (i % 8)) * 3 * scale
  let openFace : OpenFace :=
    match i % 3 with
    | 0 => .endFace
    | 1 => .startFace
    | _ => .both
  let inp : ShellInput := {
    x0 := ax0, y0, x1 := ax1, y1 := y0 + h,
    height, wallThickness := wall, floorThickness := floor,
    cornerRadius := radius, openFace
  }
  let out := match computeShellSpec inp with
    | none => .null
    | some sp => shellSpecJson sp
  ("computeShellSpec",
    obj [
      ("x0Nm", n inp.x0), ("y0Nm", n inp.y0),
      ("x1Nm", n inp.x1), ("y1Nm", n inp.y1),
      ("heightNm", n inp.height), ("wallThicknessNm", n inp.wallThickness),
      ("floorThicknessNm", n inp.floorThickness), ("cornerRadiusNm", n inp.cornerRadius),
      ("openFace", s (openFaceStr inp.openFace))
    ],
    ok out)

private def pcbCase (i : Nat) : String × Value × Value :=
  let scale : Int := 1000000
  let bx0 : Int := (Int.ofNat (i % 5)) * 5 * scale
  let by0 : Int := (Int.ofNat ((i / 5) % 4)) * 5 * scale
  let bw : Int := (Int.ofNat ((i % 6) + 2)) * 10 * scale
  let bh : Int := (Int.ofNat (((i / 2) % 5) + 2)) * 10 * scale
  let bt : Int := if i % 11 == 0 then 0 else 1600000
  let clearance : Int := (Int.ofNat (i % 4)) * 500000
  let wall : Int := (Int.ofNat ((i % 3) + 1)) * 1000000
  let floor : Int := if i % 13 == 0 then 0 else (Int.ofNat ((i % 3) + 1)) * 1000000
  let standoff : Int := (Int.ofNat (i % 4)) * 1000000
  let headroom : Int := (Int.ofNat ((i % 4) + 1)) * 4000000
  let radius : Int := (Int.ofNat (i % 4)) * 1000000
  let inp : PcbEnclosureInput := {
    boardMinX := bx0, boardMinY := by0,
    boardMaxX := bx0 + bw, boardMaxY := by0 + bh,
    boardThickness := bt, clearance,
    wallThickness := wall, floorThickness := floor,
    standoffHeight := standoff, componentHeadroom := headroom,
    cornerRadius := radius
  }
  let out := match computePcbEnclosureDims inp with
    | none => .null
    | some d => obj [
        ("cavityX0", n d.cavityX0), ("cavityY0", n d.cavityY0),
        ("cavityX1", n d.cavityX1), ("cavityY1", n d.cavityY1),
        ("baseOffsetZ", n d.baseOffsetZ),
        ("shell", shellSpecJson d.shell)
      ]
  ("computePcbEnclosureDims",
    obj [
      ("boardMinXNm", n inp.boardMinX), ("boardMinYNm", n inp.boardMinY),
      ("boardMaxXNm", n inp.boardMaxX), ("boardMaxYNm", n inp.boardMaxY),
      ("boardThicknessNm", n inp.boardThickness), ("clearanceNm", n inp.clearance),
      ("wallThicknessNm", n inp.wallThickness), ("floorThicknessNm", n inp.floorThickness),
      ("standoffHeightNm", n inp.standoffHeight), ("componentHeadroomNm", n inp.componentHeadroom),
      ("cornerRadiusNm", n inp.cornerRadius)
    ],
    ok out)

def main : IO Unit := do
  let cases :=
    pageAcceptsCases ++
    (List.range 100).map shellCase ++
    (List.range 80).map pcbCase
  IO.print (document "cad-enclosure"
    ["packages/ir/src/page-content.ts", "packages/core/src/cad/enclosure.ts"]
    "formal/Nodetto/CadEnclosure/Vectors.lean" cases)
