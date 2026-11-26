import Std

namespace Nodetto.Merge

inductive J where
  | null | bool (b : Bool) | num (n : Int) | str (s : String)
  | arr (items : List J) | obj (fields : List (String × J))
  deriving Repr

mutual
  def jEq : J → J → Bool
    | .null, .null => true
    | .bool a, .bool b => a == b
    | .num a, .num b => a == b
    | .str a, .str b => a == b
    | .arr a, .arr b => itemsEq a b
    | .obj a, .obj b => fieldsEq a b
    | _, _ => false
  termination_by a _ => sizeOf a

  def itemsEq : List J → List J → Bool
    | [], [] => true
    | a :: as, b :: bs => jEq a b && itemsEq as bs
    | _, _ => false
  termination_by a _ => sizeOf a

  def fieldsEq : List (String × J) → List (String × J) → Bool
    | [], [] => true
    | (ka, a) :: as, (kb, b) :: bs => (ka == kb) && jEq a b && fieldsEq as bs
    | _, _ => false
  termination_by a _ => sizeOf a
end

mutual
  theorem jEq_correct (a b : J) : jEq a b = true ↔ a = b := by
    cases a <;> cases b <;> simp only [jEq, Bool.false_eq_true, reduceCtorEq, iff_self, beq_iff_eq, J.bool.injEq, J.num.injEq, J.str.injEq, J.arr.injEq, J.obj.injEq]
    · exact itemsEq_correct _ _
    · exact fieldsEq_correct _ _
  termination_by sizeOf a

  theorem itemsEq_correct (a b : List J) : itemsEq a b = true ↔ a = b := by
    cases a with
    | nil => cases b <;> simp [itemsEq]
    | cons x xs =>
      cases b with
      | nil => simp [itemsEq]
      | cons y ys => simp only [itemsEq, Bool.and_eq_true, List.cons.injEq, jEq_correct x y, itemsEq_correct xs ys]
  termination_by sizeOf a

  theorem fieldsEq_correct (a b : List (String × J)) : fieldsEq a b = true ↔ a = b := by
    cases a with
    | nil => cases b <;> simp [fieldsEq]
    | cons a as =>
      cases b with
      | nil => simp [fieldsEq]
      | cons b bs =>
        cases a with
        | mk ka va =>
          cases b with
          | mk kb vb => simp only [fieldsEq, Bool.and_eq_true, beq_iff_eq, List.cons.injEq, Prod.mk.injEq, jEq_correct va vb, fieldsEq_correct as bs, and_assoc]
  termination_by sizeOf a
end

instance : BEq J := ⟨jEq⟩

def lookupFirst (fs : List (String × J)) (k : String) : Option J :=
  (fs.find? fun p => p.1 == k).map Prod.snd

def keysUnion (a b : List (String × J)) : List String :=
  ((a ++ b).map Prod.fst).eraseDups

/-- Canonicalize JSON, corresponding to `canonicalJson` in packages/core/src/document-merge.ts. -/
def canon : J → J
  | .null => .null
  | .bool b => .bool b
  | .num n => .num n
  | .str s => .str s
  | .arr xs => .arr (xs.map canon)
  | .obj fs => .obj (((fs.map (fun p => (p.1, canon p.2))).eraseDupsBy (fun a b => a.1 == b.1)).mergeSort (fun a b => a.1 ≤ b.1))
termination_by v => sizeOf v
decreasing_by
  all_goals simp_wf
  all_goals have hm := List.sizeOf_lt_of_mem (by assumption)
  all_goals try omega
  all_goals cases p <;> simp_all <;> omega

theorem lookupFirst_size (fs : List (String × J)) (k : String) (v : J)
    (h : lookupFirst fs k = some v) : sizeOf v < 1 + sizeOf fs := by
  unfold lookupFirst at h
  have hm : (k, v) ∈ fs := by
    induction fs with
    | nil => simp at h
    | cons p ps ih =>
      simp only [List.find?_cons] at h
      split at h
      · cases p <;> simp_all
      · exact List.mem_cons_of_mem _ (ih h)
  have hs := List.sizeOf_lt_of_mem hm
  simp at hs
  omega

def same (a b : Option J) : Bool := a.map canon == b.map canon

/-- `mergeValue` in packages/core/src/document-merge.ts. -/
def mergeValue (base ours theirs : Option J) : Option J × Bool :=
  if same ours theirs then (ours, false)
  else if same ours base then (theirs, false)
  else if same theirs base then (ours, false)
  else match base, ours, theirs with
    | some (.obj bs), some (.obj os), some (.obj ts) =>
      let keys := (keysUnion bs os ++ ts.map Prod.fst).eraseDups
      let parts := keys.map fun k => (k, mergeValue (lookupFirst bs k) (lookupFirst os k) (lookupFirst ts k))
      (some (.obj (parts.filterMap fun (k, (v, _)) => v.map (k, ·))), parts.any fun p => p.2.2)
    | _, _, _ => (ours, true)
termination_by sizeOf base
decreasing_by
  all_goals simp_wf
  all_goals cases h : lookupFirst bs k with
  | none => simp [h]; omega
  | some v =>
    have hm := lookupFirst_size bs k v h
    simp [h]
    omega

def getPath : Option J → List String → Option J
  | v, [] => v
  | some (.obj fs), k :: p => getPath (lookupFirst fs k) p
  | _, _ :: _ => none

def diffPaths (b v : Option J) : List (List String) :=
  if same b v then []
  else match b, v with
    | some (.obj bs), some (.obj vs) =>
      (keysUnion bs vs).flatMap fun k => (diffPaths (lookupFirst bs k) (lookupFirst vs k)).map (k :: ·)
    | _, _ => [[]]
termination_by sizeOf b
decreasing_by
  all_goals simp_wf
  all_goals cases h : lookupFirst bs k with
  | none => simp [h]; omega
  | some v =>
    have hm := lookupFirst_size bs k v h
    simp [h]
    omega

def FieldConflict (b l r : Option J) : Prop :=
  ∃ p ∈ diffPaths b l, ∃ q ∈ diffPaths b r,
    (p <+: q ∨ q <+: p) ∧ ¬ (p = q ∧ same (getPath l p) (getPath r p) = true)

inductive Reason where
  | bothChanged | deletedLocally | deletedRemotely
  deriving Repr, BEq, DecidableEq
structure Conflict where
  id : String
  reason : Reason
  deriving Repr, BEq, DecidableEq

def find (records : List (String × J)) (id : String) : Option J :=
  lookupFirst records.reverse id

def recordBase : Option J → Option J → Option J → Option J
  | none, some _, some _ => some (.obj [])
  | b, _, _ => b

/-- `mergeById` in packages/core/src/document-merge.ts. -/
def mergeById (base ours theirs : List (String × J)) : List (String × J) × List Conflict :=
  let ids := ((ours ++ theirs ++ base).map Prod.fst).eraseDups
  ids.foldl (fun (rs, cs) id =>
    let b := find base id
    let l := find ours id
    let r := find theirs id
    let emit (v : J) := (rs ++ [(id, v)], cs)
    let conflict (reason : Reason) := cs ++ [{ id := id, reason := reason }]
    match b, l, r with
    | _, none, none => (rs, cs)
    | none, some lv, some rv =>
      if same (some lv) (some rv) then emit lv
      else let (v, c) := mergeValue (some (.obj [])) (some lv) (some rv)
           (rs ++ v.toList.map (id, ·), if c then conflict .bothChanged else cs)
    | none, some lv, none => emit lv
    | none, none, some rv => emit rv
    | some bv, none, some rv => (rs, if same (some rv) (some bv) then cs else conflict .deletedLocally)
    | some bv, some lv, none =>
      if same (some lv) (some bv) then (rs, cs) else (rs ++ [(id, lv)], conflict .deletedRemotely)
    | some bv, some lv, some rv =>
      let (v, c) := mergeValue (some bv) (some lv) (some rv)
      (rs ++ v.toList.map (id, ·), if c then conflict .bothChanged else cs)) ([], [])

end Nodetto.Merge
