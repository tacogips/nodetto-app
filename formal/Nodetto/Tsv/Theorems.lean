import Lean
import Nodetto.Tsv.Model

namespace Nodetto.Tsv

macro "tsv_scan%" : term =>
  pure <| Lean.mkIdent <| Lean.Name.str (Lean.Name.str (Lean.Name.str
    (Lean.Name.num `_private.Nodetto.Tsv.Model 0) "Nodetto") "Tsv") "scan"

macro "tsv_scan_eq1%" : term =>
  pure <| Lean.mkIdent <| Lean.Name.str (Lean.Name.str (Lean.Name.str (Lean.Name.str
    (Lean.Name.num `_private.Nodetto.Tsv.Model 0) "Nodetto") "Tsv") "scan") "eq_1"

macro "tsv_scan_eq2%" : term =>
  pure <| Lean.mkIdent <| Lean.Name.str (Lean.Name.str (Lean.Name.str (Lean.Name.str
    (Lean.Name.num `_private.Nodetto.Tsv.Model 0) "Nodetto") "Tsv") "scan") "eq_2"

macro "tsv_scan_eq3%" : term =>
  pure <| Lean.mkIdent <| Lean.Name.str (Lean.Name.str (Lean.Name.str (Lean.Name.str
    (Lean.Name.num `_private.Nodetto.Tsv.Model 0) "Nodetto") "Tsv") "scan") "eq_3"

private theorem scan_empty (separator : Nat) (rows : Grid) (row : List Text)
    (field : Text) (quoted ended : Bool) :
    tsv_scan% separator [] rows row field quoted ended =
      (if ended then rows else rows ++ [row ++ [field]]) := by
  exact tsv_scan_eq1% separator rows row field quoted ended

private theorem scan_tab (rest : Text) (rows : Grid) (row : List Text)
    (field : Text) (ended : Bool) :
    tsv_scan% 9 (9 :: rest) rows row field false ended =
      tsv_scan% 9 rest rows (row ++ [field]) [] false false := by
  cases rest with
  | nil => rw [tsv_scan_eq2%]; simp
  | cons c cs => rw [tsv_scan_eq3%]; simp

private theorem scan_newline (rest : Text) (rows : Grid) (row : List Text)
    (field : Text) (ended : Bool) :
    tsv_scan% 9 (10 :: rest) rows row field false ended =
      tsv_scan% 9 rest (rows ++ [row ++ [field]]) [] [] false true := by
  cases rest with
  | nil => rw [tsv_scan_eq2%]; simp
  | cons c cs => rw [tsv_scan_eq3%]; simp

private theorem scan_open_quote (rest : Text) (rows : Grid) (row : List Text)
    (ended : Bool) :
    tsv_scan% 9 (34 :: rest) rows row [] false ended =
      tsv_scan% 9 rest rows row [] true false := by
  cases rest with
  | nil => rw [tsv_scan_eq2%]; simp
  | cons c cs => rw [tsv_scan_eq3%]; simp

private theorem scan_ordinary (c : Nat) (rest : Text) (rows : Grid) (row : List Text)
    (field : Text) (ended : Bool) (hq : c ≠ 34) (ht : c ≠ 9)
    (hn : c ≠ 10) (hr : c ≠ 13) :
    tsv_scan% 9 (c :: rest) rows row field false ended =
      tsv_scan% 9 rest rows row (field ++ [c]) false false := by
  cases rest with
  | nil => rw [tsv_scan_eq2%]; simp [hq, ht, hn, hr]
  | cons d ds => rw [tsv_scan_eq3%]; simp [hq, ht, hn, hr]

private theorem scan_ordinary_stream (text rest : Text) (rows : Grid) (row : List Text)
    (field : Text) (ended : Bool)
    (h : ∀ c ∈ text, c ≠ 34 ∧ c ≠ 9 ∧ c ≠ 10 ∧ c ≠ 13) :
    tsv_scan% 9 (text ++ rest) rows row field false ended =
      tsv_scan% 9 rest rows row (field ++ text) false (if text.isEmpty then ended else false) := by
  induction text generalizing field ended with
  | nil => simp
  | cons c cs ih =>
    have hc := h c (by simp)
    have hs : ∀ x ∈ cs, x ≠ 34 ∧ x ≠ 9 ∧ x ≠ 10 ∧ x ≠ 13 := by
      intro x hx
      exact h x (by simp [hx])
    simp only [List.cons_append, List.isEmpty_cons, Bool.false_eq_true, ↓reduceIte]
    rw [scan_ordinary c (cs ++ rest) rows row field ended hc.1 hc.2.1 hc.2.2.1 hc.2.2.2]
    simpa [List.append_assoc, List.singleton_append] using ih (field ++ [c]) false hs

private theorem scan_quoted_char (c : Nat) (rest : Text) (rows : Grid) (row : List Text)
    (field : Text) (ended : Bool) (hq : c ≠ 34) :
    tsv_scan% 9 (c :: rest) rows row field true ended =
      tsv_scan% 9 rest rows row (field ++ [c]) true false := by
  cases rest with
  | nil => rw [tsv_scan_eq2%]; simp [hq]
  | cons d ds => rw [tsv_scan_eq3%]; simp [hq]

private theorem scan_quoted_escape (rest : Text) (rows : Grid) (row : List Text)
    (field : Text) (ended : Bool) :
    tsv_scan% 9 (34 :: 34 :: rest) rows row field true ended =
      tsv_scan% 9 rest rows row (field ++ [34]) true false := by
  rw [tsv_scan_eq3%]
  simp

private theorem scan_quoted_stream (text rest : Text) (rows : Grid) (row : List Text)
    (field : Text) (ended : Bool) (hrest : ∀ c cs, rest = c :: cs → c ≠ 34) :
    tsv_scan% 9 (text.flatMap (fun c => if c == 34 then [34, 34] else [c]) ++ [34] ++ rest)
      rows row field true ended = tsv_scan% 9 rest rows row (field ++ text) false false := by
  induction text generalizing field ended with
  | nil =>
    simp only [List.flatMap_nil, List.nil_append, List.append_nil, List.singleton_append]
    cases rest with
    | nil => rw [tsv_scan_eq2%]; simp
    | cons c cs =>
      have hc := hrest c cs rfl
      rw [tsv_scan_eq3%]
      simp [hc]
  | cons c cs ih =>
    by_cases hc : c = 34
    · subst c
      simp only [List.flatMap_cons, beq_self_eq_true, ↓reduceIte, List.cons_append]
      rw [scan_quoted_escape]
      have hh : (field ++ [34]) ++ cs = field ++ (34 :: cs) := by simp [List.append_assoc]
      rw [← hh]
      exact ih (field ++ [34]) false
    · simp only [List.flatMap_cons, beq_iff_eq, hc, ↓reduceIte, List.cons_append, List.nil_append]
      rw [scan_quoted_char c _ rows row field ended hc]
      simpa [List.append_assoc, List.singleton_append] using ih (field ++ [c]) false

private theorem scan_quoted_field (text rest : Text) (rows : Grid) (row : List Text)
    (ended : Bool) (hrest : ∀ c cs, rest = c :: cs → c ≠ 34) :
    tsv_scan% 9 ([34] ++ text.flatMap (fun c => if c == 34 then [34, 34] else [c]) ++ [34] ++ rest)
      rows row [] false ended = tsv_scan% 9 rest rows row text false false := by
  simp only [List.singleton_append, List.cons_append, List.append_assoc, List.nil_append]
  rw [scan_open_quote (text.flatMap (fun c => if c == 34 then [34, 34] else [c]) ++ 34 :: rest) rows row ended]
  simpa using scan_quoted_stream text rest rows row [] false hrest

macro "tsv_encode%" : term =>
  pure <| Lean.mkIdent <| Lean.Name.str (Lean.Name.str (Lean.Name.str
    (Lean.Name.num `_private.Nodetto.Tsv.Model 0) "Nodetto") "Tsv") "encodeField"

private theorem scan_encoded_field (single : Bool) (text rest : Text) (rows : Grid)
    (row : List Text) (hrest : ∀ c cs, rest = c :: cs → c ≠ 34) :
    tsv_scan% 9 (tsv_encode% single text ++ rest) rows row [] false false =
      tsv_scan% 9 rest rows row text false false := by
  change tsv_scan% 9 ((if text.any (fun c => c == 9 || c == 13 || c == 10 || c == 34) ||
    (text.isEmpty && single) then [34] ++ text.flatMap (fun c => if c == 34 then [34, 34] else [c]) ++ [34]
    else text) ++ rest) rows row [] false false = _
  split
  · exact scan_quoted_field text rest rows row false hrest
  · rename_i h
    have hany : text.any (fun c => c == 9 || c == 13 || c == 10 || c == 34) = false := by
      cases hh : text.any (fun c => c == 9 || c == 13 || c == 10 || c == 34) <;> simp_all
    have hall : ∀ c ∈ text, c ≠ 34 ∧ c ≠ 9 ∧ c ≠ 10 ∧ c ≠ 13 := by
      intro c hc
      have hc' := (List.any_eq_false.mp hany) c hc
      simp_all
    simpa using scan_ordinary_stream text rest rows row [] false hall

private theorem scan_nonempty_ended (c : Nat) (cs : Text) (rows : Grid) (row : List Text)
    (field : Text) (quoted ended : Bool) :
    tsv_scan% 9 (c :: cs) rows row field quoted ended =
      tsv_scan% 9 (c :: cs) rows row field quoted false := by
  cases cs with
  | nil => rw [tsv_scan_eq2%, tsv_scan_eq2%]
  | cons d ds => rw [tsv_scan_eq3%, tsv_scan_eq3%]

private theorem scan_encoded_field_cont (single : Bool) (text : Text) (c : Nat) (cs : Text)
    (rows : Grid) (row : List Text) (ended : Bool) (hc : c ≠ 34) :
    tsv_scan% 9 (tsv_encode% single text ++ c :: cs) rows row [] false ended =
      tsv_scan% 9 (c :: cs) rows row text false false := by
  have heq : ∀ (xs : Text), tsv_scan% 9 (xs ++ c :: cs) rows row [] false ended =
      tsv_scan% 9 (xs ++ c :: cs) rows row [] false false := by
    intro xs
    cases xs with
    | nil => exact scan_nonempty_ended c cs rows row [] false ended
    | cons x xs => exact scan_nonempty_ended x (xs ++ c :: cs) rows row [] false ended
  rw [heq]
  apply scan_encoded_field
  intro d ds hd
  cases hd
  exact hc

private theorem scan_row_fields (single : Bool) (f : Text) (fs : List Text) (rest : Text)
    (rows : Grid) (row : List Text) (hrest : ∀ c cs, rest = c :: cs → c ≠ 34) :
    tsv_scan% 9 (tsv_encode% single f ++ fs.flatMap (fun g => 9 :: tsv_encode% single g) ++ rest)
      rows row [] false false =
      tsv_scan% 9 rest rows (row ++ (f :: fs).dropLast) (f :: fs).getLast! false false := by
  induction fs generalizing f row with
  | nil =>
    simpa using scan_encoded_field single f rest rows row hrest
  | cons g gs ih =>
    simp only [List.flatMap_cons, List.cons_append, List.append_assoc]
    rw [scan_encoded_field single f (9 :: (tsv_encode% single g ++ (gs.flatMap (fun x => 9 :: tsv_encode% single x) ++ rest))) rows row (by intro c cs h; cases h; decide)]
    rw [scan_tab]
    cases gs <;> simpa [List.dropLast, List.getLast!, List.getLast?, List.append_assoc] using ih g (row ++ [f])

private theorem scan_row_eof (single : Bool) (f : Text) (fs : List Text)
    (rows : Grid) (row : List Text) :
    tsv_scan% 9 (tsv_encode% single f ++ fs.flatMap (fun g => 9 :: tsv_encode% single g))
      rows row [] false false = rows ++ [row ++ f :: fs] := by
  have h := scan_row_fields single f fs [] rows row (by simp)
  simp only [List.append_nil] at h
  rw [h, scan_empty]
  simp only [Bool.false_eq_true, ↓reduceIte, List.append_assoc]
  congr 2
  simpa [List.getLast!, List.getLast?, List.getLast] using congrArg (fun x => row ++ x) (List.dropLast_concat_getLast (List.cons_ne_nil f fs))

private theorem scan_row_newline (single : Bool) (f : Text) (fs : List Text)
    (rest : Text) (rows : Grid) (row : List Text) :
    tsv_scan% 9 (tsv_encode% single f ++ fs.flatMap (fun g => 9 :: tsv_encode% single g) ++ 10 :: rest)
      rows row [] false false = tsv_scan% 9 rest (rows ++ [row ++ f :: fs]) [] [] false true := by
  rw [scan_row_fields single f fs (10 :: rest) rows row (by intro c cs h; cases h; decide)]
  rw [scan_newline]
  have h := congrArg (fun x => row ++ x) (List.dropLast_concat_getLast (List.cons_ne_nil f fs))
  simp only [List.append_assoc] at *
  simpa [List.getLast!, List.getLast?, List.getLast] using congrArg
    (fun x => tsv_scan% 9 rest (rows ++ [x]) [] [] false true) h

private theorem encode_single_nonempty (field : Text) : tsv_encode% true field ≠ [] := by
  change (if field.any (fun c => c == 9 || c == 13 || c == 10 || c == 34) ||
    (field.isEmpty && true) then [34] ++ field.flatMap (fun c => if c == 34 then [34, 34] else [c]) ++ [34]
    else field) ≠ []
  split
  · simp
  · rename_i h
    intro he
    subst field
    simp at h

private theorem encoded_row_nonempty (f : Text) (fs : List Text) :
    tsv_encode% ((f :: fs).length == 1) f ++
      fs.flatMap (fun g => 9 :: tsv_encode% ((f :: fs).length == 1) g) ≠ [] := by
  cases fs with
  | nil => simpa using encode_single_nonempty f
  | cons g gs => simp

macro "tsv_join%" : term =>
  pure <| Lean.mkIdent <| Lean.Name.str (Lean.Name.str (Lean.Name.str
    (Lean.Name.num `_private.Nodetto.Tsv.Model 0) "Nodetto") "Tsv") "joinWith"

private def encodedRow (row : List Text) : Text :=
  tsv_join% 9 (row.map (tsv_encode% (row.length == 1)))

private theorem encoded_row_form (f : Text) (fs : List Text) :
    encodedRow (f :: fs) = tsv_encode% ((f :: fs).length == 1) f ++
      fs.flatMap (fun g => 9 :: tsv_encode% ((f :: fs).length == 1) g) := by
  change tsv_encode% ((f :: fs).length == 1) f ++
    (fs.map (tsv_encode% ((f :: fs).length == 1))).flatMap (fun g => 9 :: g) = _
  simp [List.flatMap_map]

private theorem scan_grid (f : Text) (fs : List Text) (rest : Grid) (rows : Grid)
    (ended : Bool) (h : ∀ row ∈ rest, row ≠ []) :
    tsv_scan% 9 (encodedRow (f :: fs) ++
      rest.flatMap (fun row => 10 :: encodedRow row)) rows [] [] false ended =
      rows ++ ((f :: fs) :: rest) := by
  induction rest generalizing f fs rows ended with
  | nil =>
    simp only [List.flatMap_nil, List.append_nil, List.append_assoc]
    rw [encoded_row_form]
    have hn := encoded_row_nonempty f fs
    have he : tsv_scan% 9 (tsv_encode% ((f :: fs).length == 1) f ++
        fs.flatMap (fun g => 9 :: tsv_encode% ((f :: fs).length == 1) g)) rows [] [] false ended =
        tsv_scan% 9 (tsv_encode% ((f :: fs).length == 1) f ++
        fs.flatMap (fun g => 9 :: tsv_encode% ((f :: fs).length == 1) g)) rows [] [] false false := by
      cases hx : (tsv_encode% ((f :: fs).length == 1) f ++ fs.flatMap (fun g => 9 :: tsv_encode% ((f :: fs).length == 1) g)) with
      | nil => exact False.elim (hn hx)
      | cons c cs => exact scan_nonempty_ended c cs rows [] [] false ended
    rw [he, scan_row_eof]
    simp
  | cons r rs ih =>
    have hr := h r (by simp)
    have hs : ∀ row ∈ rs, row ≠ [] := by
      intro row hm
      exact h row (by simp [hm])
    cases r with
    | nil => exact False.elim (hr rfl)
    | cons g gs =>
      simp only [List.flatMap_cons, List.cons_append, List.append_assoc]
      rw [encoded_row_form]
      have he : tsv_scan% 9 (tsv_encode% ((f :: fs).length == 1) f ++
          fs.flatMap (fun g => 9 :: tsv_encode% ((f :: fs).length == 1) g) ++
          10 :: (encodedRow (g :: gs) ++ rs.flatMap (fun row => 10 :: encodedRow row))) rows [] [] false ended =
          tsv_scan% 9 (tsv_encode% ((f :: fs).length == 1) f ++
          fs.flatMap (fun g => 9 :: tsv_encode% ((f :: fs).length == 1) g) ++
          10 :: (encodedRow (g :: gs) ++ rs.flatMap (fun row => 10 :: encodedRow row))) rows [] [] false false := by
        cases hx : (tsv_encode% ((f :: fs).length == 1) f ++ fs.flatMap (fun g => 9 :: tsv_encode% ((f :: fs).length == 1) g) ++ 10 :: (encodedRow (g :: gs) ++ rs.flatMap (fun row => 10 :: encodedRow row))) with
        | nil => simp at hx
        | cons c cs => exact scan_nonempty_ended c cs rows [] [] false ended
      rw [he, scan_row_newline]
      simpa [List.append_assoc] using ih g gs (rows ++ [f :: fs]) true hs

theorem parseTsv_serializeTsv (grid : Grid) (h : ∀ row ∈ grid, row ≠ []) :
    parseTsv (serializeTsv grid) = grid := by
  cases grid with
  | nil => rfl
  | cons row rest =>
    have hr := h row (by simp)
    have hs : ∀ r ∈ rest, r ≠ [] := by
      intro r hm
      exact h r (by simp [hm])
    cases row with
    | nil => exact False.elim (hr rfl)
    | cons f fs =>
      have hn : encodedRow (f :: fs) ≠ [] := by
        rw [encoded_row_form]
        exact encoded_row_nonempty f fs
      have ht : encodedRow (f :: fs) ++ rest.flatMap (fun r => 10 :: encodedRow r) ≠ [] := by
        exact List.append_ne_nil_of_left_ne_nil hn _
      simp only [parseTsv, parse, serializeTsv, List.map_cons]
      change (if (encodedRow (f :: fs) ++ (rest.map encodedRow).flatMap (fun r => 10 :: r)).isEmpty then [] else
        tsv_scan% 9 (encodedRow (f :: fs) ++ (rest.map encodedRow).flatMap (fun r => 10 :: r)) [] [] [] false false) = _
      simp only [List.flatMap_map]
      change (if (encodedRow (f :: fs) ++ rest.flatMap (fun r => 10 :: encodedRow r)).isEmpty then [] else
        tsv_scan% 9 (encodedRow (f :: fs) ++ rest.flatMap (fun r => 10 :: encodedRow r)) [] [] [] false false) = _
      have hb : (encodedRow (f :: fs) ++ rest.flatMap (fun r => 10 :: encodedRow r)).isEmpty = false := by
        cases hx : (encodedRow (f :: fs) ++ rest.flatMap (fun r => 10 :: encodedRow r)) with
        | nil => exact False.elim (ht hx)
        | cons c cs => rfl
      simp only [hb, Bool.false_eq_true, ↓reduceIte]
      simpa using scan_grid f fs rest [] false hs

private theorem roundtrip_empty : parseTsv (serializeTsv []) = [] := by rfl

private theorem roundtrip_single_empty : parseTsv (serializeTsv [[[]]]) = [[[]]] := by
  decide +kernel

theorem tsv_trailing_empty_row_lost :
    parseTsv (serializeTsv [[[97]], []]) = [[[97]]] := by decide +kernel

theorem tsv_only_empty_row_lost :
    parseTsv (serializeTsv [[]]) = [] := by decide +kernel

theorem tsv_inner_empty_row_reads_as_empty_field :
    parseTsv (serializeTsv [[], [[97]]]) = [[[]], [[97]]] := by decide +kernel

end Nodetto.Tsv
