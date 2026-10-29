// `nodetto-cli shapes`: the palette's shapes under the shape IDs that
// `nodetto-cli draw` and edit's {"op":"add","shape":...} draw, filterable by
// words and category, and for one shape what drawing it creates.

import {
  Editor,
  findShape,
  SHAPE_CATEGORIES,
  type ShapeCatalogueEntry,
  shapeCategoryLabel,
  shapeCreation,
  searchShapes,
} from "@nodetto/core";
import {
  type CommandIo,
  type CommandResult,
  fail,
  ok,
  parseArgs,
} from "./commands.ts";
import { helpFor } from "./help.ts";

const SHAPES_OPTIONS = new Set(["--category", "--format"]);
const SHAPES_FLAGS = new Set(["--connectors", "--no-connectors"]);

function summary(shape: ShapeCatalogueEntry) {
  return {
    id: shape.id,
    label: shape.label,
    category: shape.category,
    connector: shape.connector,
    type: shape.type,
  };
}

function listing(shapes: readonly ShapeCatalogueEntry[]): string {
  const width = Math.max(...shapes.map((shape) => shape.id.length));
  const lines: string[] = [];
  for (const category of SHAPE_CATEGORIES) {
    const members = shapes.filter((shape) => shape.category === category.id);
    if (!members.length) continue;
    lines.push(`${category.label} (${category.id})`);
    for (const shape of members)
      lines.push(
        `  ${shape.id.padEnd(width)}  ${shape.label}${shape.connector ? " (connector)" : ""}`,
      );
  }
  return lines.join("\n");
}

function details(shape: ShapeCatalogueEntry, format: string): CommandResult {
  const creation = shapeCreation(shape.id);
  const util = new Editor().registry.getOrFallback(shape.type);
  const semantic = creation?.semantic ?? util.defaultSemantic();
  const visual = { ...util.defaultVisual(), ...(creation?.visual ?? {}) };
  const draw = shape.connector
    ? `nodetto-cli draw <doc> ${shape.id} --from <id> --to <id>`
    : `nodetto-cli draw <doc> ${shape.id} --label <text>`;
  const operation = shape.connector
    ? { op: "connect", shape: shape.id, from: "<id>", to: "<id>" }
    : { op: "add", page: "<page id>", shape: shape.id };
  if (format === "json")
    return ok(
      `${JSON.stringify(
        {
          ...summary(shape),
          ...(shape.connector ? {} : { semantic, visual }),
          draw,
          operation,
        },
        null,
        2,
      )}\n`,
    );
  const lines = [
    `${shape.id}: ${shape.label} (${shapeCategoryLabel(shape.category)}${shape.connector ? ", connector" : ""})`,
    `Creates: ${shape.type} (run "nodetto-cli types ${shape.type}" for its fields)`,
    ...(shape.connector
      ? []
      : [
          `Starts from semantic: ${JSON.stringify(semantic)}`,
          `Starts from visual: ${JSON.stringify(visual)}`,
        ]),
    "",
    `Draw it:  ${draw}`,
    `Edit op:  ${JSON.stringify(operation)}`,
  ];
  return ok(`${lines.join("\n")}\n`);
}

export function shapesCommand(
  _io: CommandIo,
  args: readonly string[],
): CommandResult {
  const parsed = parseArgs(args, SHAPES_OPTIONS, SHAPES_FLAGS);
  if (typeof parsed === "string")
    return fail(`${parsed}\n\n${helpFor("shapes")}`);
  const format = parsed.options.get("--format") ?? "text";
  if (format !== "text" && format !== "json")
    return fail(`Unsupported format "${format}". Choose text or json.`);
  if (parsed.flags.has("--connectors") && parsed.flags.has("--no-connectors"))
    return fail("Use only one of --connectors and --no-connectors.");
  const category = parsed.options.get("--category");
  if (category !== undefined && !searchShapes({ category }).length)
    return fail(
      `Unknown shape category "${category}". Choose ${SHAPE_CATEGORIES.map((entry) => entry.id).join(", ")}.`,
    );

  const [first] = parsed.positional;
  const exact =
    parsed.positional.length === 1 && first !== undefined
      ? findShape(first)
      : undefined;
  if (exact && category === undefined && parsed.flags.size === 0)
    return details(exact, format);

  const shapes = searchShapes({
    query: parsed.positional.join(" "),
    ...(category === undefined ? {} : { category }),
    ...(parsed.flags.has("--connectors")
      ? { connector: true }
      : parsed.flags.has("--no-connectors")
        ? { connector: false }
        : {}),
  });
  if (format === "json")
    return ok(`${JSON.stringify(shapes.map(summary), null, 2)}\n`);
  if (!shapes.length)
    return ok(
      'No shapes match. Run "nodetto-cli shapes" for every shape ID.\n',
    );
  return ok(
    `${listing(shapes)}\n\nRun "nodetto-cli shapes <shape-id>" for its defaults; draw it with "nodetto-cli draw <doc> <shape-id>".\n`,
  );
}
