# ipd-27c reproduction progress

The generator builds screens 01-10 in separate edit batches. The sidecar build, rebuild, validation, literal-ID gate (11 ops files), ten-frame gate, scale-2 export, comparison generation and reproduction lint gate exited 0. Lint reports 0 errors and 162 app-misaligned findings. Evidence is under `tmp/ipd-s772/ipd-27c-reproduction-search-more/`. The four comparison images were inspected with a 4-point grid and the prescribed top and bottom shifts.

| Screen | app-misaligned | Position | Icons | Colors | Weight | Missing |
| --- | ---: | --- | --- | --- | --- | ---: |
| 07 | 10 | within 4 points of reference | yes | yes | yes | 0 |
| 08 | 16 | within 4 points of reference | yes | yes | yes | 0 |
| 09 | 8 | within 4 points of reference | yes | yes | yes | 0 |
| 10 | 3 | within 4 points of reference | yes | yes | yes | 0 |

The missing overlay found in the first pass was added before the final rebuild. Prototype links, the flow start and the output copy remain assigned to ipd-27-reproduction. Formal review remains downstream.
