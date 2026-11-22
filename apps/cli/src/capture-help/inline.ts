import type { CaptureHelpPart } from "../capture-help.ts";

export const inline: CaptureHelpPart = {
  usage: ["[--inline]"],
  body: `--inline adds the image to the MCP tool result (up to 1 MiB). It is ignored
in a terminal. Visual token cost follows pixel size. A 1024 x 768 image, the
default for 3D, costs about 1,036 tokens at 28 x 28 pixels per token.
MCP clients apply their own limits and may refuse or shrink a picture well
below 1 MiB. Try --format jpg with a smaller --size, or open the returned path.`,
};
