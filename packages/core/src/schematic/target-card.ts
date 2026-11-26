import {
  BREADBOARD_PITCH,
  type BreadboardNetlistSemantic,
  type PageId,
} from "@nodetto/ir";
import { NETLIST_CARD_SIZE } from "../breadboard/catalogue.ts";
import type { Command } from "../commands.ts";
import type { PageEditing } from "../editor/facade/page-editing.ts";

export function planBreadboardTarget(
  editor: PageEditing,
  pageId: PageId,
  target: BreadboardNetlistSemantic,
): Command[] {
  if (editor.store.getPage(pageId)?.kind !== "breadboard") return [];
  const card = editor.store
    .getPageElements(pageId)
    .find(
      (element) =>
        element.type === "breadboard.netlist" && !element.visual.hidden,
    );
  if (card) return [{ type: "updateSemantic", id: card.id, semantic: target }];
  const bounds = editor.pageBounds(pageId);
  const element = editor.buildElement("breadboard.netlist", {
    page: pageId,
    semantic: target,
    visual: {
      x: bounds ? bounds.x + bounds.width + 2 * BREADBOARD_PITCH : 0,
      y: bounds?.y ?? 0,
      width: NETLIST_CARD_SIZE.width * BREADBOARD_PITCH,
      height: NETLIST_CARD_SIZE.height * BREADBOARD_PITCH,
    },
  });
  return [{ type: "createElement", element }];
}
