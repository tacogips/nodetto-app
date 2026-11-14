import { findIcon, normalizeIconName, searchIcons } from "@nodetto/core";
import { OperationError, type JsonObject } from "./operation-input.ts";

export function isIconShapeId(id: string): boolean {
  return id.startsWith("icon:");
}

export function iconShapeCreation(
  id: string,
  index: number,
): {
  readonly type: "ui.icon";
  readonly semantic: JsonObject;
  readonly visual: JsonObject;
} {
  const name = id.slice("icon:".length);
  const normalized = normalizeIconName(name);
  if (!normalized || !findIcon(normalized)) {
    const suggestions = searchIcons(name, 5);
    const hint = suggestions.length
      ? `Did you mean: ${suggestions.join(", ")}?`
      : "Search with nodetto-cli shapes icon <query>.";
    throw new OperationError(index, `unknown icon "${name}". ${hint}`);
  }
  return {
    type: "ui.icon",
    semantic: { icon: normalized },
    visual: {
      width: 24,
      height: 24,
      style: { stroke: "#000000", strokeWidth: 2 },
    },
  };
}
