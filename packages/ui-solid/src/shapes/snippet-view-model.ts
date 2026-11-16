import type { Box } from "@nodetto/core";

export function snippetViewBox(box: Box): string {
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
}
