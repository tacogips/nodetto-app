import Nodetto.Merge.Model
import Nodetto.Json

open Nodetto.Merge

namespace MergeVectors

private def encoded (s : String) : Except String String := do
  let some value := Nodetto.Json.ofE s | throw s!"Malformed E: {s}"
  pure (Nodetto.Json.render value)

mutual
  private def value : J → Except String String
    | .null => pure "null"
    | .bool b => pure (if b then "true" else "false")
    | .num n => pure (toString n)
    | .str s => encoded s
    | .arr xs => do
      let ys ← values xs
      pure ("[" ++ String.intercalate "," ys ++ "]")
    | .obj fs => do
      let ys ← fields fs
      pure ("{" ++ String.intercalate "," ys ++ "}")
  termination_by v => sizeOf v

  private def values : List J → Except String (List String)
    | [] => pure []
    | x :: xs => do
      let y ← value x
      let ys ← values xs
      pure (y :: ys)
  termination_by xs => sizeOf xs

  private def fields : List (String × J) → Except String (List String)
    | [] => pure []
    | (k, v) :: fs => do
      let key ← encoded k
      let val ← value v
      let rest ← fields fs
      pure ((key ++ ":" ++ val) :: rest)
  termination_by fs => sizeOf fs
end

private def optionalField (key : String) (v : Option J) : Except String (List String) := do
  match v with
  | none => pure []
  | some v => pure ["\"" ++ key ++ "\":" ++ (← value v)]

private def boolText (b : Bool) : String := if b then "true" else "false"

private def valueCase (b l r : Option J) : Except String String := do
  let input ← (do
    let a ← optionalField "base" b
    let c ← optionalField "ours" l
    let d ← optionalField "theirs" r
    pure (a ++ c ++ d))
  let (v, conflict) := mergeValue b l r
  let output ← optionalField "value" v
  pure ("{\"fn\":\"mergeValue\",\"in\":{" ++ String.intercalate "," input ++
    "},\"out\":{\"ok\":{" ++ String.intercalate "," (output ++ ["\"conflict\":" ++ boolText conflict]) ++ "}}}")

private def records (rs : List (String × J)) : Except String String := do
  let entries ← rs.mapM fun (id, v) => do
    let key ← encoded id
    let val ← value v
    pure ("[" ++ key ++ "," ++ val ++ "]")
  pure ("[" ++ String.intercalate "," entries ++ "]")

private def reason : Reason → String
  | .bothChanged => "both-changed"
  | .deletedLocally => "deleted-locally"
  | .deletedRemotely => "deleted-remotely"

private def recordCase (b l r : List (String × J)) : Except String String := do
  let bs ← records b
  let ls ← records l
  let rs ← records r
  let (out, cs) := mergeById b l r
  let result ← records out
  let conflicts ← cs.mapM fun c => do
    let id ← encoded c.id
    pure ("[" ++ id ++ ",\"" ++ reason c.reason ++ "\"]")
  pure ("{\"fn\":\"mergeById\",\"in\":{\"base\":" ++ bs ++ ",\"ours\":" ++ ls ++
    ",\"theirs\":" ++ rs ++ "},\"out\":{\"ok\":{\"records\":" ++ result ++
    ",\"conflicts\":[" ++ String.intercalate "," conflicts ++ "]}}}")

private def object (n : Int) : J := .obj [("0061", .num n), ("0062", .bool true)]
private def record (id : String) (n : Int) : String × J :=
  (id, .obj [("00690064", .str id), ("0076", .num n)])

private def normalValue (n : Nat) : Except String String :=
  let x : Int := Int.ofNat n
  match n % 10 with
  | 0 => valueCase none (some (.num x)) none
  | 1 => valueCase (some (.num x)) (some (.num x)) (some (.num (x + 1)))
  | 2 => valueCase (some (.num x)) (some (.num (x + 1))) (some (.num (x + 2)))
  | 3 => valueCase (some (object x)) (some (.obj [("0062", .bool true), ("0061", .num x)])) (some (object (x + 1)))
  | 4 => valueCase (some (.arr [object x])) (some (.arr [object (x + 1)])) (some (.arr [object (x + 2)]))
  | 5 => valueCase (some .null) none (some (.bool true))
  | 6 => valueCase (some (.obj [("005f005f00700072006f0074006f005f005f", .num x)])) (some (.obj [("005f005f00700072006f0074006f005f005f", .num (x + 1))])) (some (.obj [("005f005f00700072006f0074006f005f005f", .num x), ("0063006f006e007300740072007500630074006f0072", .bool true)]))
  | 7 => valueCase (some (.obj [("0074006f0053007400720069006e0067", object x)])) (some (.obj [("0074006f0053007400720069006e0067", object (x + 1))])) (some (.obj [("0074006f0053007400720069006e0067", object x), ("0061", .num x)]))
  | 8 => valueCase none (some .null) (some .null)
  | _ => valueCase (some (object x)) none (some (object (x + 1)))

private def normalRecord (n : Nat) : Except String String :=
  let x : Int := Int.ofNat n
  let a := record "0061" x
  let b := record "0062" (x + 1)
  let changed := record "0061" (x + 2)
  match n % 8 with
  | 0 => recordCase [] [a] []
  | 1 => recordCase [a] [a] [changed]
  | 2 => recordCase [a] [changed] [a]
  | 3 => recordCase [a] [] [changed]
  | 4 => recordCase [a] [changed] []
  | 5 => recordCase [] [a] [changed]
  | 6 => recordCase [a, b] [b, changed] [a, b]
  | _ => recordCase [a, b] [a] [a, b]

private def surrogateCases : List (Except String String) :=
  [ valueCase (some (.obj [("d800", .num 0), ("d801", .num 0)]))
      (some (.obj [("d800", .num 1), ("d801", .num 0)]))
      (some (.obj [("d800", .num 0), ("d801", .num 2)])),
    valueCase (some (.obj [])) (some (.obj [("d800", .num 1)]))
      (some (.obj [("d801", .num 2)])),
    valueCase (some (.str "d800")) (some (.str "d801")) (some (.str "d800")) ]

private def output : Except String String := do
  let a ← (List.range 120).mapM normalValue
  let b ← (List.range 100).mapM normalRecord
  let c ← surrogateCases.mapM id
  pure ("{\"module\":\"merge\",\"sources\":[\"packages/core/src/document-merge.ts\"],\"generator\":\"formal/Nodetto/Merge/Vectors.lean\",\"cases\":[\n" ++
    String.intercalate ",\n" (c ++ a ++ b) ++ "\n]}\n")

end MergeVectors

def main : IO Unit := do
  match MergeVectors.output with
  | .ok s => IO.print s
  | .error s => throw (IO.userError s)
