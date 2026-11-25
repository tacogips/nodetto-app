import type { CaptureHelpPart } from "../capture-help.ts";

export const interference: CaptureHelpPart = {
  usage: [
    "[--no-interference | --interference-cell <mm>] [--interference-bodies <id,id,...>] [--fail-on-interference]",
  ],
  body: `Interference is shared volume above 0.001 mm; touching faces are not
interference. Reference bodies take part. Each pair reports volume and box.

  --no-interference      Skip the check and show an unobstructed view.
  --interference-cell    Set the sampling cell in mm.
  --interference-bodies  Limit the check to these body IDs.
  --fail-on-interference Exit 1 for interference, unchecked or incomplete pairs.

The printed cell is the largest sampling cell used. Interference is always
found when its projection along X, Y or Z contains an axis-aligned square of
that side over which the overlap is longer than the tolerance. Refinement
samples around small loops; a capped pair may miss sub-cell parts. Slivers
between large faces thinner than the cell in two directions may be missed.
Curved surfaces are approximated by facets.

Interference is striped and visible through other bodies; the hatch replaces
shading. Use --no-interference for an unobstructed view. A pair found only
in the picture is marked (found in the picture only); beyond the first 64 such
pairs the volume is not measured. A refinement capped line
reports checked pairs whose sub-cell parts may be missed. If candidates are
not checked, narrow with --interference-bodies to finish the check.`,
};
