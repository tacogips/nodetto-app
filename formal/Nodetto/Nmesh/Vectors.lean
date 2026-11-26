import Nodetto.Json
import Nodetto.Nmesh.Codec

open Nodetto.Json Nodetto.Nmesh

private def nums (xs : List Nat) : Value := .arr (xs.map fun x => .num (Int.ofNat x))
private def ints (xs : List Int) : Value := .arr (xs.map Value.num)
private def meshJson (m : Mesh) : Value :=
  .obj [("positions", ints m.positions), ("triangles", nums m.triangles),
    ("groups", .arr (m.groups.map fun (face, count) => nums [face, count]))]
private def bytesResult (r : Except NmeshError Bytes) : Value :=
  match r with | .ok bs => ok (nums bs) | .error e => err e.code
private def meshResult (r : Except NmeshError Mesh) : Value :=
  match r with | .ok m => ok (meshJson m) | .error e => err e.code
private def textResult (r : Except NmeshError (List Nat)) : Value :=
  match r with | .ok s => ok (.str s) | .error e => err e.code
private def encodeCase (m : Mesh) : String × Value × Value :=
  ("encodeNmesh", meshJson m, bytesResult (encodeNmesh m))
private def decodeCase (bs : Bytes) : String × Value × Value :=
  ("decodeNmesh", .obj [("bytes", nums bs)], meshResult (decodeNmesh bs))
private def toCase (bs : Bytes) : String × Value × Value :=
  ("toInline", .obj [("bytes", nums bs)], textResult (toInline bs))
private def fromCase (s : List Nat) : String × Value × Value :=
  ("fromInline", .obj [("text", .str s)], bytesResult (fromInline s))
private def mesh (x : Int) (face : Nat) : Mesh :=
  ⟨[x, 0, 0, x, 1, 0, x, 0, 1], [0, 1, 2], [(face, 1)]⟩
private def sharedMesh : Mesh :=
  ⟨[0,0,0, 1,0,0, 0,1,0, 1,1,0], [0,1,2, 1,3,2], [(0,1),(1,1)]⟩
private def invalidMeshes : List Mesh :=
  [⟨[0], [], []⟩, ⟨[], [0], []⟩,
   ⟨[10000001,0,0], [], []⟩, ⟨[0,0,0, 0,0,0], [], []⟩,
   ⟨[0,0,0, 1,0,0, 0,1,0], [0,1,2], [(0,0)]⟩,
   ⟨[0,0,0, 1,0,0, 0,1,0], [0,1,2], [(4294967296,1)]⟩,
   ⟨[0,0,0, 1,0,0, 0,1,0], [0,2,1], [(0,1)]⟩,
   ⟨[0,0,0, 1,0,0, 2,0,0], [0,1,2], [(0,1)]⟩,
   ⟨[0,0,0, 1,0,0, 0,1,0], [1,0,2], [(0,1)]⟩]
private def header : Bytes := [78,77,83,72,1,0,3,0]
private def frame (body : Bytes) : Bytes := appendCrc (header ++ body)
private def malformed : List Bytes :=
  [[], header, [0,77,83,72,1,0,3,0,0,0,0,0],
   [78,77,83,72,2,0,3,0,0,0,0,0], [78,77,83,72,1,1,3,0,0,0,0,0],
   [78,77,83,72,1,0,4,0,0,0,0,0],
   header ++ [128,0,0,0,0,0,0,0], header ++ [128,0,0,0,0],
   header ++ [0,0,0,0,0,0,0], frame [1,0,0],
   frame [0,1,0,0,0,0], frame [0,1,1,0,2,0,0,0],
   frame [0,0,0,0], frame [1,0,0,0,0,0],
   frame [1,1,1,0,1,0,0,0,1,0,0],
   frame [1,1,1,0,1,128,128,128,128,16,0,0,0,0,0]]
private def payloads : List Bytes :=
  (List.range 60).map (fun n => appendCrc (encodeBody (mesh (Int.ofNat n - 30) n))) ++
  [appendCrc (encodeBody sharedMesh)] ++ malformed ++
  ([127,128,16383,16384,2097152,268435456,4294967295].map fun n =>
    frame (writeVarint n ++ [0,0]))
private def armorInputs : List Bytes :=
  [[]] ++ (List.range 60).map (fun n => (List.range (n % 5 + 1)).map (fun i => (n * 17 + i * 53) % 256)) ++
  [List.replicate 786432 0]
private def badText : List (List Nat) :=
  [[], inlinePrefix, inlinePrefix ++ [65,65,65], inlinePrefix ++ [33,65,65,65],
   inlinePrefix ++ [65,65,61,65], inlinePrefix ++ [65,66,61,61],
   inlinePrefix ++ [65,65,66,61], List.replicate 1048577 65]
private def texts : List (List Nat) :=
  badText ++ (armorInputs.take 61).filterMap (fun bs => (toInline bs).toOption)
private def meshes : List Mesh :=
  [⟨[], [], []⟩, mesh (-10000000) 0, mesh 9999999 4294967295, sharedMesh] ++
  (List.range 60).map (fun n => mesh (Int.ofNat n - 30) n) ++ invalidMeshes
private def cases : List (String × Value × Value) :=
  meshes.map encodeCase ++ payloads.map decodeCase ++ armorInputs.map toCase ++ texts.map fromCase

def main : IO Unit :=
  IO.print (document "nmesh" ["packages/nmesh/src/encode.ts", "packages/nmesh/src/decode.ts",
    "packages/nmesh/src/armor.ts", "packages/nmesh/src/canonical.ts", "packages/nmesh/src/crc32.ts"]
    "vectors-nmesh" cases)
