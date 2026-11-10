// `nodetto-cli shapes`: the palette's shapes under the shape IDs that
// `nodetto-cli draw` and edit's {"op":"add","shape":...} draw, filterable by
// words and category, and for one shape what drawing it creates.

import {
  Editor,
  IOS_KIT,
  findKitComponent,
  findIcon,
  findShape,
  normalizeIconName,
  searchIcons,
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
const SHAPES_FLAGS = new Set(["--connectors", "--no-connectors", "--all"]);

function summary(shape: ListedShape) {
  return {
    id: shape.id,
    label: shape.label,
    category: shape.category,
    connector: shape.connector,
    type: shape.type,
  };
}

type ListedShape = Omit<ShapeCatalogueEntry, "id" | "category"> & {
  readonly id: string;
  readonly category: string;
};

const ICON_ROW: ListedShape = {
  id: "icon:<name>",
  label: "Icon (any Lucide name; see shapes icon <query>)",
  category: "ui-control",
  connector: false,
  type: "ui.icon",
};

function listing(shapes: readonly ListedShape[]): string {
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
  const kit = shapes.filter((shape) => shape.category === "ios-kit");
  if (kit.length) {
    lines.push("iOS kit (ios-kit)");
    for (const shape of kit)
      lines.push(`  ${shape.id.padEnd(width)}  ${shape.label}`);
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
  if (
    category !== undefined &&
    category !== "ios-kit" &&
    !searchShapes({ category }).length
  )
    return fail(
      `Unknown shape category "${category}". Choose ${SHAPE_CATEGORIES.map((entry) => entry.id).join(", ")}.`,
    );

  const [first] = parsed.positional;
  if (first?.startsWith("ios:") && parsed.positional.length === 1) {
    const kit = findKitComponent(first);
    if (!kit) return fail(`unknown kit component "${first}"`);
    const operation = { op: "add", page: "<page id>", shape: kit.id };
    const draw = `nodetto-cli draw <doc> ${kit.id}`;
    if (format === "json")
      return ok(
        `${JSON.stringify({ id: kit.id, label: kit.label, category: "ios-kit", type: "frame", width: kit.width, height: kit.height, properties: kit.props, draw, operation }, null, 2)}\n`,
      );
    return ok(
      `${kit.id}: ${kit.label} (iOS kit)\nCreates: frame (${kit.width}x${kit.height})\nProperties:\n${kit.slots ? "  items array (label, icon?, badge?)\n" : ""}${kit.props.map((prop) => `  ${prop.name} ${prop.type} ${JSON.stringify(prop.default)}${prop.values ? ` [${prop.values.join(", ")}]` : ""}`).join("\n")}\n\nDraw it:  ${draw}\nEdit op:  ${JSON.stringify(operation)}\n`,
    );
  }
  if (first === "icon") {
    const query = parsed.positional.slice(1).join(" ");
    const names = searchIcons(query, parsed.flags.has("--all") ? 0 : 50);
    if (!names.length)
      return ok(
        `no icon matches "${query}". Search with nodetto-cli shapes icon <query>.\n`,
      );
    return ok(
      `${names.map((name) => `${name}\t${findIcon(name)?.tags.join(",") ?? ""}`).join("\n")}\n`,
    );
  }
  if (first?.startsWith("icon:") && parsed.positional.length === 1) {
    const name = first.slice(5);
    const normalized = normalizeIconName(name);
    if (!normalized || !findIcon(normalized)) {
      const matches = searchIcons(name, 5);
      return fail(
        `unknown icon "${name}". ${matches.length ? `Did you mean: ${matches.join(", ")}?` : "Search with nodetto-cli shapes icon <query>."}`,
      );
    }
    const semantic = { icon: normalized };
    const visual = {
      width: 24,
      height: 24,
      style: { stroke: "#000000", strokeWidth: 2 },
    };
    const draw = `nodetto-cli draw <doc> icon:${normalized}`;
    const operation = {
      op: "add",
      page: "<page id>",
      shape: `icon:${normalized}`,
    };
    if (format === "json")
      return ok(
        `${JSON.stringify({ ...ICON_ROW, id: `icon:${normalized}`, semantic, visual, draw, operation }, null, 2)}\n`,
      );
    return ok(
      `icon:${normalized}: Icon (UI controls)\nCreates: ui.icon\nStarts from semantic: ${JSON.stringify(semantic)}\nStarts from visual: ${JSON.stringify(visual)}\n\nDraw it:  ${draw}\nEdit op:  ${JSON.stringify(operation)}\n`,
    );
  }
  const exact =
    parsed.positional.length === 1 && first !== undefined
      ? findShape(first)
      : undefined;
  if (exact && category === undefined && parsed.flags.size === 0)
    return details(exact, format);

  const shapes =
    category === "ios-kit"
      ? []
      : searchShapes({
          query: parsed.positional.join(" "),
          ...(category === undefined ? {} : { category }),
          ...(parsed.flags.has("--connectors")
            ? { connector: true }
            : parsed.flags.has("--no-connectors")
              ? { connector: false }
              : {}),
        });
  const query = parsed.positional.join(" ").toLowerCase();
  const includeIcon =
    (!category || category === "ui-control") &&
    !parsed.flags.has("--connectors") &&
    (!query ||
      `${ICON_ROW.id} ${ICON_ROW.label} ${ICON_ROW.type}`
        .toLowerCase()
        .includes(query));
  const listed: readonly ListedShape[] = includeIcon
    ? [...shapes, ICON_ROW]
    : shapes;
  const kitRows =
    (!category || category === "ios-kit") && !parsed.flags.has("--connectors")
      ? IOS_KIT.filter((kit) =>
          `${kit.id} ${kit.label}`.toLowerCase().includes(query),
        ).map((kit) => ({
          id: kit.id,
          label: kit.label,
          category: "ios-kit",
          connector: false,
          type: "frame",
        }))
      : [];
  const allListed = [...listed, ...kitRows];
  if (format === "json")
    return ok(`${JSON.stringify(allListed.map(summary), null, 2)}\n`);
  if (!allListed.length)
    return ok(
      'No shapes match. Run "nodetto-cli shapes" for every shape ID.\n',
    );
  return ok(
    `${listing(allListed)}\n\nRun "nodetto-cli shapes <shape-id>" for its defaults; draw it with "nodetto-cli draw <doc> <shape-id>".\n`,
  );
}
