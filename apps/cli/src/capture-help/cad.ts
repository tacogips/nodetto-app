import type { CaptureHelpPart } from "../capture-help.ts";

export const cad: CaptureHelpPart = {
  usage: [
    "[--view <name> | --direction <x,y,z> | --eye <x,y,z>]",
    "[--target <x,y,z>] [--up <x,y,z>] [--zoom <n>]",
  ],
  body: `CAD capture uses an orthographic camera. Z is up. On a CAD page --size
sets the exact image dimensions (default 1024x768, 64 to 2048 per side).
The artwork options --element, --padding, --background, --scale and
--font-dir apply to 2D pages only.

  --view       iso (default): from +X,+Y,+Z, showing top, back and right.
               front: from -Y     back: from +Y
               left: from -X      right: from +X
               top: from +Z       bottom: from -Z
  --direction  Look along this vector. Use 1,1,-1 for front-left-top.
  --eye        Look from this point toward --target or the model centre.
  --target     Centre the picture on the projection of this model point.
  --up         Set the camera up vector. Default: Z, or +Y from above
               and -Y from below when looking along Z.
  --zoom       Multiply the fitted scale, from 0.01 to 1000 (default 1).

The camera line reports centre in model coordinates and scale in mm/px.
The frame is cropped when a body box extends outside the picture.
The errors count lists failed features skipped in the capture.

Example:
  nodetto-cli capture plate.jsonl --view top --size 1024x768 --output plate-top.png`,
};
