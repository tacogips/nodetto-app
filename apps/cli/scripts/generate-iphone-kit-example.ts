import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCliAsync } from "../src/cli.ts";
import { localIo } from "../src/local-io.ts";

const sourceDirectory = join(
  import.meta.dir,
  "../../../examples/design/iphone-kit",
);
const directory = process.env["NODETTO_EXAMPLE_OUTPUT_DIR"] ?? sourceDirectory;
const document = join(directory, "design.jsonl");
const screens = join(directory, "screens");
mkdirSync(screens, { recursive: true });
writeFileSync(
  document,
  '{"kind":"document","schemaVersion":1,"id":"garden","title":"Garden journal"}\n{"kind":"page","id":"app","name":"App","pageKind":"freeform"}\n',
);
const io = localIo();
async function run(args: string[]) {
  const result = await runCliAsync(args, io, "example");
  if (result.exitCode !== 0)
    throw new Error(`${args.join(" ")}: ${result.stderr}`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}
await run(["edit", document, "--ops", join(sourceDirectory, "build.ops.json")]);
await run([
  "export",
  document,
  "--page",
  "app",
  "--frames",
  "--format",
  "png",
  "--scale",
  "2",
  "--output-dir",
  screens,
]);
await run([
  "export",
  document,
  "--page",
  "app",
  "--prototype",
  "--format",
  "png",
  "--scale",
  "1",
  "--output",
  join(directory, "storyboard.png"),
]);
await run([
  "export",
  document,
  "--page",
  "app",
  "--format",
  "prototype",
  "--output",
  join(directory, "prototype.html"),
]);
