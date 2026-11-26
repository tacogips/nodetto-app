import Nodetto.Nmesh.Codec
import Nodetto.Nmesh.Varint
import Nodetto.Nmesh.Indices

namespace Nodetto.Nmesh

/-- Successful encoding entails the canonicality check and the exact encoded bytes. -/
theorem encodeNmesh_success (m : Mesh) (bs : Bytes) (h : encodeNmesh m = .ok bs) :
    isCanonical m = true ∧ bs = appendCrc (encodeBody m) := by
  unfold encodeNmesh at h
  split at h
  next hc =>
    have hb : appendCrc (encodeBody m) = bs := Except.ok.inj h
    exact ⟨hc, hb.symm⟩
  next => contradiction

/-- The encoded vertex and triangle counts fit the varint reader's domain. -/
theorem payload_count_bounds (m : Mesh)
    (hV : m.positions.length < 3 * 2 ^ 32) (hT : m.triangles.length < 3 * 2 ^ 32) :
    m.positions.length / 3 < 2 ^ 32 ∧ m.triangles.length / 3 < 2 ^ 32 := by
  constructor <;> omega

end Nodetto.Nmesh
