namespace Nodetto.Json

inductive Value where
  | null
  | bool (b : Bool)
  | num (n : Int)
  | str (units : List Nat)
  | arr (items : List Value)
  | obj (fields : List (String × Value))

private def hexDigit (n : Nat) : Char :=
  Char.ofNat (if n < 10 then 48 + n else 87 + n)

private def hex4 (n : Nat) : String :=
  String.ofList [hexDigit (n / 4096 % 16), hexDigit (n / 256 % 16),
    hexDigit (n / 16 % 16), hexDigit (n % 16)]

private def renderUnit (n : Nat) : String :=
  if n == 34 then "\\\""
  else if n == 92 then "\\\\"
  else if 32 ≤ n && n ≤ 126 then String.singleton (Char.ofNat n)
  else "\\u" ++ hex4 n

private def renderString (units : List Nat) : String :=
  "\"" ++ String.join (units.map renderUnit) ++ "\""

def ofAscii (s : String) : Value := .str (s.toList.map Char.toNat)

private def hexValue (c : Char) : Option Nat :=
  let n := c.toNat
  if 48 ≤ n && n ≤ 57 then some (n - 48)
  else if 97 ≤ n && n ≤ 102 then some (n - 87)
  else none

private def decodeE : List Char → Option (List Nat)
  | [] => some []
  | a :: b :: c :: d :: rest => do
    let a ← hexValue a
    let b ← hexValue b
    let c ← hexValue c
    let d ← hexValue d
    let tail ← decodeE rest
    pure ((a * 4096 + b * 256 + c * 16 + d) :: tail)
  | _ => none

def ofE (e : String) : Option Value := (decodeE e.toList).map Value.str

mutual
  def render : Value → String
    | .null => "null"
    | .bool true => "true"
    | .bool false => "false"
    | .num n => toString n
    | .str units => renderString units
    | .arr items => "[" ++ renderItems items ++ "]"
    | .obj fields => "{" ++ renderFields fields ++ "}"
  termination_by v => sizeOf v

  private def renderItems : List Value → String
    | [] => ""
    | [v] => render v
    | v :: rest => render v ++ "," ++ renderItems rest
  termination_by items => sizeOf items

  private def renderFields : List (String × Value) → String
    | [] => ""
    | [(key, value)] => renderString (key.toList.map Char.toNat) ++ ":" ++ render value
    | (key, value) :: rest =>
      renderString (key.toList.map Char.toNat) ++ ":" ++ render value ++ "," ++ renderFields rest
  termination_by fields => sizeOf fields
end

def ok (v : Value) : Value := .obj [("ok", v)]
def err (code : String) : Value := .obj [("error", ofAscii code)]

def document (module : String) (sources : List String) (generator : String)
    (cases : List (String × Value × Value)) : String :=
  let header := "{\"module\":" ++ render (ofAscii module) ++
    ",\"sources\":" ++ render (.arr (sources.map ofAscii)) ++
    ",\"generator\":" ++ render (ofAscii generator) ++ ",\"cases\":[\n"
  let lines := cases.map fun (name, input, output) =>
    render (.obj [("fn", ofAscii name), ("in", input), ("out", output)])
  header ++ String.intercalate ",\n" lines ++ (if lines.isEmpty then "" else "\n") ++ "]}\n"

def lcg (seed : Nat) : Nat :=
  (seed * 6364136223846793005 + 1442695040888963407) % (2 ^ 64)

example : render (.str [0x61, 0x22, 0xd800]) = "\"a\\\"\\ud800\"" := by simp [render, renderItems, renderFields, renderString, renderUnit, hex4, hexDigit, ofAscii, document] <;> decide
example : render (.obj [("ok", .num (-3))]) = "{\"ok\":-3}" := by simp [render, renderItems, renderFields, renderString, renderUnit, hex4, hexDigit, ofAscii, document] <;> decide
example : ofE "0061d800" = some (.str [0x61, 0xd800]) := by rfl
example : ofE "006" = none := by rfl
example : ofE "00G1" = none := by rfl
example : document "x" [] "g" [] =
    "{\"module\":\"x\",\"sources\":[],\"generator\":\"g\",\"cases\":[\n]}\n" := by simp [render, renderItems, renderFields, renderString, renderUnit, hex4, hexDigit, ofAscii, document] <;> decide

end Nodetto.Json
