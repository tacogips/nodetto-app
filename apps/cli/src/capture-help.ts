import { cad } from "./capture-help/cad.ts";
import { general } from "./capture-help/general.ts";
import { inline } from "./capture-help/inline.ts";
import { interference } from "./capture-help/interference.ts";
import { jpg } from "./capture-help/jpg.ts";

export interface CaptureHelpPart {
  readonly usage: readonly string[];
  readonly body: string;
}

const parts = [general, jpg, cad, interference, inline];
export const CAPTURE_HELP = [
  [
    "Usage: nodetto-cli capture <doc.jsonl>",
    ...parts.flatMap((part) => part.usage).map((line) => `       ${line}`),
  ].join("\n"),
  ...parts.map((part) => part.body).filter(Boolean),
  `Exit codes: 0 image written (including identical existing bytes); 1 only with
--fail-on-interference for an interfering pair, an unchecked candidate or an
incomplete coarse check; 2 for usage, input, output, refusal or work limit errors.`,
  `The desktop Export dialog offers PNG/JPG for 2D and "3D view image" for CAD;
see docs/capture.md.`,
].join("\n\n");
