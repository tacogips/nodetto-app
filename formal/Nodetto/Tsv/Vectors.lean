import Nodetto.Tsv.Model
import Nodetto.Json

open Nodetto.Tsv Nodetto.Json

private def gridJson (grid : Grid) : Value :=
  .arr (grid.map fun row => .arr (row.map Value.str))

private def texts : List Text :=
  [[], [97], [98], [9], [10], [13], [13, 10], [34], [97, 34, 98],
   [0xd800], [34, 97, 34, 98], [97, 10], [34, 34], [9, 9], [97, 13, 10, 98]]

private def grids : List Grid :=
  [[], [[]], [[[97]], []], [[], [[97]]], [[[97]], [], [[98]]], [[[]]], [[[], []]],
   [[[97]], [[98], [9]]], [[[34]], [[13, 10]], [[0xd800]]]] ++
  (texts.flatMap fun a => texts.map fun b => [[a, b], [b]])

private def parseCase (t : Text) : String × Value × Value :=
  ("parseTsv", .obj [("text", .str t)], ok (gridJson (parseTsv t)))

private def serializeCase (g : Grid) : String × Value × Value :=
  ("serializeTsv", .obj [("grid", gridJson g)], ok (.str (serializeTsv g)))

private def roundCase (g : Grid) : String × Value × Value :=
  ("roundTrip", .obj [("grid", gridJson g)], ok (gridJson (parseTsv (serializeTsv g))))

def main : IO Unit := do
  let inputs := texts ++ (texts.flatMap fun a => texts.map fun b => a ++ b)
  let cases := inputs.map parseCase ++ grids.map serializeCase ++ grids.map roundCase
  IO.print (document "tsv" ["packages/core/src/table-sheet/delimited.ts"]
    "formal/Nodetto/Tsv/Vectors.lean" cases)
