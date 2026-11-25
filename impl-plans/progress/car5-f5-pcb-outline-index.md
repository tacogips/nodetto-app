# car5-f5-pcb-outline-index progress

Implementation: done. Indexed boards and eligible graphics per scan, memoized
page outlines, and cached per-page evaluator graphics keys. The memo is scoped
to its scan; thickness remains per reference and outline changes invalidate keys.

Before production changes, separate-page capture reads at N=32/128 were
2,080/32,896, shared-board capture reads were 3,360/50,304, and shared-board
evaluation reads were 6,720/100,608. The shared scene SHA-256 was
`f41508a20cd44bcd36306b9bfe9bd62077b8e8f313cad23a566b66773b978834`.
Baseline log: `tmp/car5-r5/car5-f5-pcb-outline-index/baseline-test.log`.

Final reads were 96/384, 105/393, and 140/524 respectively. The pinned digest,
alternating thickness, widening, unchanged memo control and rebuild assertions
pass. Focused Biome and test gate: 73 passed, 0 failed, exit 0;
`tmp/car5-r5/car5-f5-pcb-outline-index/verification-final-2.log`.

Formal integrity/adversarial review and workspace-wide integration checks are
owned by later workflow steps.
