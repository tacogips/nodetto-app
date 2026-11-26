namespace Nodetto.Tsv

abbrev Text := List Nat
abbrev Grid := List (List Text)

private def scan (separator : Nat) : Text → Grid → List Text → Text → Bool → Bool → Grid
  | [], rows, row, field, _, ended =>
    if ended then rows else rows ++ [row ++ [field]]
  | c :: cs, rows, row, field, quoted, _ =>
    if quoted then
      if c == 34 then
        match cs with
        | [] => scan separator [] rows row field false false
        | d :: rest => if d == 34 then scan separator rest rows row (field ++ [34]) true false
          else scan separator (d :: rest) rows row field false false
      else scan separator cs rows row (field ++ [c]) true false
    else if c == 34 && field.isEmpty then
      scan separator cs rows row field true false
    else if c == separator then
      scan separator cs rows (row ++ [field]) [] false false
    else if c == 10 || c == 13 then
      if c == 13 then
        match cs with
        | [] => scan separator [] (rows ++ [row ++ [field]]) [] [] false true
        | d :: rest => if d == 10 then scan separator rest (rows ++ [row ++ [field]]) [] [] false true
          else scan separator (d :: rest) (rows ++ [row ++ [field]]) [] [] false true
      else scan separator cs (rows ++ [row ++ [field]]) [] [] false true
    else scan separator cs rows row (field ++ [c]) false false
termination_by text => text.length

/-- Models `parse` in `packages/core/src/table-sheet/delimited.ts`. -/
def parse (text : Text) (separator : Nat) : Grid :=
  if text.isEmpty then [] else scan separator text [] [] [] false false

/-- Models `parseTsv` in `packages/core/src/table-sheet/delimited.ts`. -/
def parseTsv (text : Text) : Grid := parse text 9

private def joinWith (sep : Nat) : List Text → Text
  | [] => []
  | x :: xs => x ++ xs.flatMap (fun y => sep :: y)

private def encodeField (single : Bool) (field : Text) : Text :=
  if field.any (fun c => c == 9 || c == 13 || c == 10 || c == 34) ||
      (field.isEmpty && single) then
    [34] ++ field.flatMap (fun c => if c == 34 then [34, 34] else [c]) ++ [34]
  else field

/-- Models `serializeTsv` in `packages/core/src/table-sheet/delimited.ts`. -/
def serializeTsv (grid : Grid) : Text :=
  joinWith 10 (grid.map fun row => joinWith 9 (row.map (encodeField (row.length == 1))))

end Nodetto.Tsv
