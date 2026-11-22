import type { CaptureHelpPart } from "../capture-help.ts";

export const general: CaptureHelpPart = {
  usage: [
    "[--page <query> | --page-number <n>] [--output <file>] [--format png] [--force]",
    "[--size <W>x<H>] [--scale <n>] [--theme light|dark] [--element <id>]",
    "[--padding <n>] [--background <#rrggbb>] [--font-dir <dir>] [--json] [--inline]",
  ],
  body: `Capture a page as a PNG for a quick look. Open the reported path with an
image-capable file reader to see the picture.

  --page         Select a page by full ID, short ID or name.
  --page-number  Select by the number from nodetto-cli pages. Default: first page.
  --output      Write a .png file in an existing directory. The default is a
                 digest-named file in the private per-user nodetto-capture
                 directory under the system temporary directory.
  --format      Image format (png in this build).
  --force       Replace an existing regular file at --output. Without this flag
                 different bytes are refused. Identical bytes succeed without
                 rewriting the file. Default captures never replace a file.
  --size        Fit inside a W-by-H pixel box without enlarging the artwork.
                 Default: 1568x1568 and at most 1.15 megapixels.
  --scale       Replace the fit with a scale from 0.01 to 4, rounded down to
                 three decimals (8192 pixels per side, 32 megapixels max).
                 Very large artwork may need --scale, --size or --element.
  --theme       Canvas background, light by default. On 2D pages dark changes
                 only the background. Shapes keep their own colours, so dark
                 strokes may be easier to read on the light background.
  --element     Capture a frame or a single element by ID or unique prefix.
  --padding     Artwork margin, from 0 to 256 (default 16). Frames use their
                 artboard dimensions.
  --background  Override the 2D background with a six-digit hex colour.
  --font-dir    Load extra fonts from this directory.
  --json        Print a JSON object with path, format, width, height, bytes and page.
  --inline      Reserved for MCP image content. Ignored in the terminal.

Stdout lists path, format, size (WxH), bytes and page. The path is absolute,
including when --output was relative. Warnings go to stderr.
Mac App Store build: use --output inside the authorized folder so the agent
can read the image.

Examples:
  nodetto-cli capture drawing.jsonl
  nodetto-cli capture drawing.jsonl --page Overview --size 960x720 --output overview.png --json`,
};
