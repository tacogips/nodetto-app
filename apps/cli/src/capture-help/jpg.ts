import type { CaptureHelpPart } from "../capture-help.ts";

export const jpg: CaptureHelpPart = {
  usage: ["[--format png|jpg] [--quality <1-100>]"],
  body: `Image formats
  --format      png or jpg. Defaults to the --output extension, or png if no
                 output was given. An explicit format must match the extension.
  --quality     JPG quality, an integer from 1 to 100 (default 90).

JPG capture needs the native nodetto-cli and flattens the image on its
background colour. Use --theme or --background to choose that colour.

This software is based in part on the work of the Independent JPEG Group.`,
};
