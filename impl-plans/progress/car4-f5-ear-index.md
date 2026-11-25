# car4-f5-ear-index progress

Implementation done: ordered live reflex/collinear candidates preserve the original ear predicate and removal order. The old scan is retained as a test oracle; both windings, the fixed notch series, comb, collinear and diagonal cases match. Concave preview mesh positions and indices are fixed by regression assertions.

Candidate visits for 3,000 / 6,000 / 12,000 vertices: 10,491 / 20,991 / 41,991 in both windings; queries: 2,997 / 5,997 / 11,997. Formal review and integration are downstream.
