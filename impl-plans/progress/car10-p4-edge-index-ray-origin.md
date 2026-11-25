# car10-p4-edge-index-ray-origin progress

Implementation status: done; formal review and integration are downstream.

- Pre-edit SHA-256: loops.test.ts `849f89a776018ad51d029087e8cb129c2e38613c72032186e80ac541c9b67760`; edge-y-index.ts `d7c9cdf070d2b64e44c8559b53965177182286357c522c2d62fbee03b3b5bc1b`; loops.ts `7a0fbecfd3317186d60cb39e9636a62bea501125ded1ef3f2bab75e1da66df5b`. Per-edit intentions and subsequent hashes are in `tmp/car10-r10/car10-p4-edge-index-ray-origin/`.
- Added slotted-rim ordered geometry and work-count regression. Before the fix, `before.log` records 530176 work units against a 40983 limit (exit 1, one test failed).
- Added non-horizontal edge aggregates and exact-leaf parity traversal; `contains` retains the grid predicate. Existing iterator remains available.
- `gate.log`: Biome passed and 22 tests passed, zero failed. Original q series: 5632, 6144, 11264, 12288. Mirrored q series: 7936, 8704, 15872, 17408. Detailed-rim and PCB tests passed.
- `typecheck.log`: `bun run typecheck` exit 0. Checks ran on a shared moving tree; integration repeats repository gates after all plans land.
