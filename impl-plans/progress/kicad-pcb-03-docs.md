# Progress: kicad-pcb-03-docs

## Intent snapshot

Document the accepted PCB page behavior for users, add CLI navigation, and
add one README feature bullet. Scope is limited to the four paths in the plan.
No out-of-scope features are promised.

## Changes

- Added `docs/pcb/kicad-pcb.md` with import/open behavior, supported and skipped
  content, page units and colors, editing limits, the six-element save table,
  Gerber/drill files and exact export warnings/note, command syntax and summary,
  exit codes, and angle/large-board limits.
- Added `PCB boards (KiCad)` commands and a guide link to `docs/cli.md`.
- Added one PCB feature bullet linking the guide to `README.md`.

## Source hashes

Before changes:

- `docs/cli.md`: `5caab406cb388c1b686d5e725dfc21d3425069e79399858ca2e457d8c5327d0b`
- `README.md`: `dcd891d5cb8570a773721889aaa72a777e88a8c0376d5b822fc4eb8337a07ec2`

After changes:

- `docs/pcb/kicad-pcb.md`: `75179469d259538f1b923e1330bf06800f7f97665b7fef1cd337b05668a0aa04`
- `docs/cli.md`: `e40734271c1d1dd844898b05db1be1b1d94a37254e2c930b446daba9d0a6d025`
- `README.md`: `498e2ddaa609bff209c0126e9ff0a56e4c3b1c9e12212465e9ba836840cd02bf`

## Verification

All logs are in `tmp/kicad-pcb-s530/kicad-pcb-03-docs/`.

- `LC_ALL=C perl -ne 'if (/[\x80-\xFF]/) { print "non-ASCII byte on line $.\n"; $bad = 1 } END { exit($bad ? 1 : 0) }' docs/pcb/kicad-pcb.md`: exit 0; no non-ASCII bytes (`ascii-final.log`).
- `grep -c 'pcb import\|pcb gerber' docs/cli.md`: exit 0; count 2 (`cli-commands.log`).
- `grep -q 'kicad-pcb.md' README.md && grep -q 'kicad-pcb.md' docs/cli.md`: exit 0 (`links.log`).
- `bunx biome check docs/pcb/kicad-pcb.md`: n/a; Biome does not check Markdown.
- `test "$(git diff --numstat -- README.md | awk '{print $1 + $2}')" -le 2`: exit 0; README diff is 2 changed lines (`readme-diff-lines.log`).
- `test -s impl-plans/progress/kicad-pcb-03-docs.md`: exit 0 (`progress-file.log`).

The plan's prescribed `grep -cP` ASCII command is not supported by the
macOS/BSD grep installed here (`grep: invalid option -- P`). Its shell wrapper
returned zero despite the grep diagnostic, so it is not counted as a passing
gate. The byte check above is the equivalent replacement and passed.

## Done criteria

- [x] User guide and CLI/README references are written.
- [x] ASCII, command, and link checks pass.
- [x] README changed-line and progress-file checks pass.
