import Nodetto.Nmesh.Model

namespace Nodetto.Nmesh

structure Mesh where
  positions : List Int
  triangles : List Nat
  groups : List (Nat × Nat)
  deriving Repr, BEq, DecidableEq

-- Insert inside namespace Nodetto.Nmesh after Mesh.
private def vertex (ps : List Int) (i : Nat) : List Int :=
  (ps.drop (3 * i)).take 3

private def lexLT : List Int → List Int → Bool
  | [], [] => false
  | [], _ :: _ => true
  | _ :: _, [] => false
  | a :: as, b :: bs => if a < b then true else if a > b then false else lexLT as bs

private def triangleCoords (ps : List Int) (ts : List Nat) (i : Nat) : List Int :=
  vertex ps (ts[i]?.getD 0) ++ vertex ps (ts[i+1]?.getD 0) ++ vertex ps (ts[i+2]?.getD 0)

private def triangleValid (ps : List Int) (ts : List Nat) (i : Nat) : Bool := Id.run do
  let a := ts[i]?.getD 0
  let b := ts[i+1]?.getD 0
  let c := ts[i+2]?.getD 0
  let get (v axis : Nat) := ps[3*v+axis]?.getD 0
  let abx := get b 0 - get a 0
  let aby := get b 1 - get a 1
  let abz := get b 2 - get a 2
  let acx := get c 0 - get a 0
  let acy := get c 1 - get a 1
  let acz := get c 2 - get a 2
  let degenerate := a == b || b == c || a == c ||
    (aby * acz == abz * acy && abz * acx == abx * acz && abx * acy == aby * acx)
  return !degenerate && lexLT (vertex ps a) (vertex ps b) && lexLT (vertex ps a) (vertex ps c)

private def canonicalGroups (m : Mesh) : List (Nat × Nat) → Nat → Nat → Option Nat → Option (Nat × Nat)
  | [], offset, used, _ => some (offset, used)
  | (face, count) :: rest, offset, used, previous => do
    let stop := offset + count * 3
    if face > 4294967295 || count == 0 || stop > m.triangles.length ||
        previous.any (fun p => face <= p) then none else do
      let used' ← ((m.triangles.drop offset).take (count * 3)).foldlM (fun used v =>
        if v > used || v >= m.positions.length / 3 then none
        else some (if v == used then used + 1 else used)) used
      let valid := (List.range count).all fun t =>
        let i := offset + 3*t
        triangleValid m.positions m.triangles i &&
          (t == 0 || !lexLT (triangleCoords m.positions m.triangles i)
            (triangleCoords m.positions m.triangles (i-3)))
      if !valid then none else canonicalGroups m rest stop used' (some face)

/-- packages/nmesh/src/canonical.ts: isCanonical. -/
def isCanonical (m : Mesh) : Bool := Id.run do
  if m.positions.length % 3 != 0 || m.triangles.length % 3 != 0 then return false
  if m.positions.any (fun x => x < -10000000 || x > 10000000) then return false
  let vertices := (List.range (m.positions.length / 3)).map (vertex m.positions)
  if vertices.eraseDups.length != vertices.length then return false
  match canonicalGroups m m.groups 0 0 none with
  | none => return false
  | some (offset, used) => return offset == m.triangles.length && used == m.positions.length / 3


/-- packages/nmesh/src/encode.ts: encode coordinate deltas by axis. -/
def coordinateCodes (positions : List Int) : List Nat :=
  (positions.zipIdx).map fun (position, i) =>
    zigzag (position - if i < 3 then 0 else positions[i - 3]?.getD 0)

/-- packages/nmesh/src/encode.ts: write the canonical payload before CRC. -/
def encodeBody (m : Mesh) : Bytes :=
  [0x4e, 0x4d, 0x53, 0x48, 1, 0, 3, 0] ++
  writeVarint (m.positions.length / 3) ++ writeVarint (m.triangles.length / 3) ++
  writeVarint m.groups.length ++
  m.groups.flatMap (fun (face, count) => writeVarint face ++ writeVarint count) ++
  (coordinateCodes m.positions).flatMap writeVarint ++
  (encodeIndices m.triangles).flatMap writeVarint

/-- packages/nmesh/src/encode.ts: append the little-endian CRC-32. -/
def appendCrc (body : Bytes) : Bytes :=
  let crc := crc32 body
  body ++ [crc % 256, crc / 256 % 256, crc / 65536 % 256, crc / 16777216 % 256]

/-- packages/nmesh/src/encode.ts: encodeNmesh. -/
def encodeNmesh (m : Mesh) : Except NmeshError Bytes :=
  if isCanonical m then .ok (appendCrc (encodeBody m)) else .error .canonical

private def readGroups : Nat → Nat → Option Nat → Nat → Bytes → Except NmeshError (List (Nat × Nat) × Bytes)
  | 0, total, _, expected, bs =>
    if total = expected then .ok ([], bs) else .error .groups
  | n + 1, total, previous, expected, bs => do
    let (face, bs) ← readVarint bs
    let (count, bs) ← readVarint bs
    let total := total + count
    if previous.any (fun p => face ≤ p) || total > expected then throw .groups
    let (rest, bs) ← readGroups n total (some face) expected bs
    pure ((face, count) :: rest, bs)

private def readPositions : Nat → Nat → List Int → Bytes → Except NmeshError (List Int × Bytes)
  | 0, _, _, bs => .ok ([], bs)
  | n + 1, i, previous, bs => do
    let (encoded, bs) ← readVarint bs
    let axis := i % 3
    let position := previous[axis]?.getD 0 + unzigzag encoded
    if position.natAbs > 10000000 then throw .range
    let previous := previous.set axis position
    let (rest, bs) ← readPositions n (i + 1) previous bs
    pure (position :: rest, bs)

private def readIndices : Nat → Nat → Nat → Bytes → Except NmeshError (List Nat × Bytes)
  | 0, vertices, used, bs =>
    if used = vertices then .ok ([], bs) else .error .index
  | n + 1, vertices, used, bs => do
    let (code, bs) ← readVarint bs
    let (vertex, used) ← indexStep vertices used code
    let (rest, bs) ← readIndices n vertices used bs
    pure (vertex :: rest, bs)

/-- packages/nmesh/src/decode.ts: readNmesh in full mode. -/
def decodeNmesh (bytes : Bytes) : Except NmeshError Mesh := do
  if bytes.length < 12 then throw .truncated
  if bytes.take 4 != [0x4e, 0x4d, 0x53, 0x48] then throw .magic
  if bytes[4]?.getD 0 != 1 then throw .version
  if bytes[5]?.getD 0 != 0 || bytes[7]?.getD 0 != 0 then throw .flags
  if bytes[6]?.getD 0 != 3 then throw .unit
  let body := bytes.take (bytes.length - 4)
  let tail := bytes.drop (bytes.length - 4)
  let expected := tail[0]?.getD 0 + 256 * tail[1]?.getD 0 +
    65536 * tail[2]?.getD 0 + 16777216 * tail[3]?.getD 0
  let (vertices, rest) ← readVarint (body.drop 8)
  let (triangles, rest) ← readVarint rest
  let (groups, rest) ← readVarint rest
  if 3 * vertices + 3 * triangles + 2 * groups > bytes.length - 12 then throw .count
  if crc32 body != expected then throw .crc
  if triangles > 0 && groups = 0 then throw .groups
  let (groups, rest) ← readGroups groups 0 none triangles rest
  let (positions, rest) ← readPositions (vertices * 3) 0 [0, 0, 0] rest
  let (indices, rest) ← readIndices (triangles * 3) vertices 0 rest
  if !rest.isEmpty then throw .trailing
  pure ⟨positions, indices, groups⟩

end Nodetto.Nmesh
