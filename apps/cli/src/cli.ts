// Entry point used by main.ts: the synchronous commands plus the ones that
// need to await (rendering), behind one dispatcher.

import { type CommandIo, type CommandResult, runCli } from "./commands.ts";
import { applyQuiet, extractQuiet } from "./warnings.ts";
import { openCommand } from "./open-command.ts";
import { exportCommand } from "./export-command.ts";
import { compareCommand } from "./compare-command.ts";
import { rasterize } from "./raster-backend.ts";

const ASYNC_COMMANDS: Readonly<
  Record<
    string,
    (io: CommandIo, args: readonly string[]) => Promise<CommandResult>
  >
> = {
  export: exportCommand,
  compare: (io, args) => compareCommand(io, args, { rasterize }),
  open: openCommand,
};

export async function runCliAsync(
  args: readonly string[],
  io: CommandIo,
  version: string,
): Promise<CommandResult> {
  const extracted = extractQuiet(args);
  const [command, ...rest] = extracted.args;
  const handler = command === undefined ? undefined : ASYNC_COMMANDS[command];
  const wantsHelp = rest.includes("--help") || rest.includes("-h");
  const result =
    handler && !wantsHelp
      ? await handler(io, rest)
      : runCli(extracted.args, io, version);
  return extracted.quiet ? applyQuiet(command ?? "", result) : result;
}
