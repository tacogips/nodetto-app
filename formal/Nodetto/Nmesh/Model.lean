import Std
namespace Nodetto.Nmesh

abbrev Bytes := List Nat
inductive NmeshError where
  | truncated | magic | version | flags | unit | count | crc | groups | range | index | trailing | canonical | inline
  deriving Repr, BEq, DecidableEq

def NmeshError.code : NmeshError → String
  | .truncated => "nmesh.truncated" | .magic => "nmesh.magic" | .version => "nmesh.version"
  | .flags => "nmesh.flags" | .unit => "nmesh.unit" | .count => "nmesh.count"
  | .crc => "nmesh.crc" | .groups => "nmesh.groups" | .range => "nmesh.range"
  | .index => "nmesh.index" | .trailing => "nmesh.trailing" | .canonical => "nmesh.canonical"
  | .inline => "nmesh.inline"

/-- packages/nmesh/src/encode.ts: writeVarint. -/
def writeVarint (v : Nat) : Bytes :=
  if h : v < 128 then [v] else (v % 128 + 128) :: writeVarint (v / 128)
termination_by v
decreasing_by omega

/-- packages/nmesh/src/decode.ts: readVarint. -/
def readVarint (bs : Bytes) : Except NmeshError (Nat × Bytes) := go 0 0 1 bs
where
  go (place value factor : Nat) (bs : Bytes) : Except NmeshError (Nat × Bytes) :=
    match bs with
    | [] => .error .truncated
    | b :: rest =>
      if place = 4 && b > 15 then .error .range
      else
        let value' := value + (b % 128) * factor
        if b < 128 then
          if place != 0 && b = 0 then .error .range else .ok (value', rest)
        else if place < 4 then go (place + 1) value' (factor * 128) rest
        else .error .range
  termination_by 5 - place

/-- packages/nmesh/src/encode.ts: coordinate delta encoding. -/
def zigzag (d : Int) : Nat := if d < 0 then (2 * (-d) - 1).toNat else (2 * d).toNat
/-- packages/nmesh/src/decode.ts: coordinate delta decoding. -/
def unzigzag (n : Nat) : Int := if n % 2 = 0 then (n / 2 : Nat) else -((n + 1) / 2 : Nat)

/-- packages/nmesh/src/canonical.ts: first-use ordering. -/
def firstUse (triangles : List Nat) : Option Nat := go 0 triangles
where go (used : Nat) : List Nat → Option Nat
  | [] => some used
  | v :: vs => if v < used then go used vs else if v = used then go (used + 1) vs else none

/-- packages/nmesh/src/encode.ts: triangle index coding. -/
def encodeIndices (triangles : List Nat) : List Nat := go 0 triangles
where go (used : Nat) : List Nat → List Nat
  | [] => []
  | v :: vs => (used - v) :: go (if v = used then used + 1 else used) vs

/-- packages/nmesh/src/decode.ts: one triangle index. -/
def indexStep (vertexCount used code : Nat) : Except NmeshError (Nat × Nat) :=
  if code > used || (code = 0 && used = vertexCount) then .error .index
  else .ok (used - code, if code = 0 then used + 1 else used)

/-- packages/nmesh/src/decode.ts: triangle index loop. -/
def decodeIndices (vertexCount : Nat) (codes : List Nat) : Except NmeshError (List Nat) := go 0 codes
where go (used : Nat) : List Nat → Except NmeshError (List Nat)
  | [] => if used = vertexCount then .ok [] else .error .index
  | c :: cs => do
    let (v, used') ← indexStep vertexCount used c
    let vs ← go used' cs
    pure (v :: vs)

/-- packages/nmesh/src/crc32.ts: table generation and CRC-32. -/
def crc32 (bs : Bytes) : Nat :=
  let tableEntry (n : Nat) := (List.range 8).foldl (fun c _ => (c >>> 1) ^^^ (if c &&& 1 = 1 then 0xEDB88320 else 0)) n
  (bs.foldl (fun c b => (c >>> 8) ^^^ tableEntry ((c ^^^ b) &&& 255)) 0xFFFFFFFF) ^^^ 0xFFFFFFFF

def alphabet : List Nat := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".toList.map Char.toNat
def inlinePrefix : List Nat := [110, 109, 101, 115, 104, 49, 58]
def alphabetAt (n : Nat) : Nat := alphabet[n]?.getD 0

/-- packages/nmesh/src/armor.ts: toInline. -/
def toInline (bs : Bytes) : Except NmeshError (List Nat) :=
  if bs.isEmpty || 4 * ((bs.length + 2) / 3) + 7 > 1048576 then .error .inline
  else .ok (inlinePrefix ++ go bs)
where
  go : Bytes → List Nat
  | a :: b :: c :: rest => alphabetAt (a / 4) :: alphabetAt ((a % 4) * 16 + b / 16) :: alphabetAt ((b % 16) * 4 + c / 64) :: alphabetAt (c % 64) :: go rest
  | [a, b] => [alphabetAt (a / 4), alphabetAt ((a % 4) * 16 + b / 16), alphabetAt ((b % 16) * 4), 61]
  | [a] => [alphabetAt (a / 4), alphabetAt ((a % 4) * 16), 61, 61]
  | [] => []

/-- packages/nmesh/src/armor.ts: fromInline. -/
def fromInline (text : List Nat) : Except NmeshError Bytes := do
  if text.length > 1048576 || text.take 7 != inlinePrefix then throw .inline
  let body := text.drop 7
  if body.isEmpty || body.length % 4 != 0 then throw .inline
  let pad := if body.reverse.take 2 = [61, 61] then 2 else if body.reverse.take 1 = [61] then 1 else 0
  let data := body.take (body.length - pad)
  let (bits, _, out) ← data.foldlM (fun (bits, count, out) ch => do
    let some value := alphabet.idxOf? ch | throw .inline
    let bits := bits * 64 + value
    let count := count + 6
    if count >= 8 then
      let count := count - 8
      pure (bits % (2 ^ count), count, out ++ [bits / (2 ^ count)])
    else pure (bits, count, out)) (0, 0, [])
  if bits != 0 then throw .inline
  pure out

example : crc32 [49, 50, 51, 52, 53, 54, 55, 56, 57] = 0xCBF43926 := by decide

end Nodetto.Nmesh
