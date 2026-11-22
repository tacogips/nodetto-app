import {
  CAD_PAGE_KIND,
  comparePageOrder,
  type Element,
  isCadTypeName,
  type Page,
  type PageId,
  pageAcceptsElementType,
} from "@nodetto/ir";
import { type Command, planElementRelocations } from "../commands.ts";
import { keyBetween } from "../fractional.ts";
import { planPageOrder } from "../page-order.ts";
import type { Store } from "../store.ts";

export function recoveredShapesPageId(pageId: PageId): PageId {
  return `${pageId}-shapes`;
}

export function recoveredCadPageId(pageId: PageId): PageId {
  return `${pageId}-cad`;
}

/** Restore page content rules without deleting any record or reference. */
export function planContentRepair(
  store: Pick<Store, "listPages" | "listElements">,
): Command[] {
  const pages = [...store.listPages()].sort(comparePageOrder);
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const contents = new Map<PageId, { cad: Element[]; shapes: Element[] }>();
  for (const element of store.listElements()) {
    const cad = isCadTypeName(element.type);
    if (!cad && pageAcceptsElementType(CAD_PAGE_KIND, element.type)) continue;
    let content = contents.get(element.page);
    if (!content) {
      content = { cad: [], shapes: [] };
      contents.set(element.page, content);
    }
    (cad ? content.cad : content.shapes).push(element);
  }

  const commands: Command[] = [];
  const orders = new Map(pages.map((page) => [page.id, page.order]));
  let ordersReady = false;
  const midpoint = () => 0.5;

  for (const [index, page] of pages.entries()) {
    const content = contents.get(page.id);
    if (!content) continue;
    const isCadPage = page.kind === CAD_PAGE_KIND;
    const moved = isCadPage ? content.shapes : content.cad;
    if (!moved.length) continue;
    if (!isCadPage && !content.shapes.length) {
      commands.push({
        type: "updatePage",
        id: page.id,
        page: { kind: CAD_PAGE_KIND },
      });
      continue;
    }

    const preferredId = isCadPage
      ? recoveredShapesPageId(page.id)
      : recoveredCadPageId(page.id);
    const kind = isCadPage ? "freeform" : CAD_PAGE_KIND;
    let id = preferredId;
    let destination = pagesById.get(id);
    // A legacy edit can change the kind of an existing recovery page.
    for (let suffix = 2; destination && destination.kind !== kind; suffix++) {
      id = `${preferredId}-${suffix}`;
      destination = pagesById.get(id);
    }
    if (!destination) {
      if (!ordersReady) {
        // Legacy or tied keys need materializing before inserting a tab.
        const orderPlan = planPageOrder(pages, index + 1, midpoint);
        for (const command of orderPlan.commands) {
          if (command.type === "updatePage" && command.page.order != null)
            orders.set(command.id, command.page.order);
          commands.push(command);
        }
        ordersReady = true;
      }
      const successor = pages[index + 1];
      const recovery: Page = {
        id,
        kind,
        name: `${page.name} ${isCadPage ? "shapes" : "3D CAD"}`,
        order: keyBetween(
          orders.get(page.id) ?? null,
          successor ? (orders.get(successor.id) ?? null) : null,
          midpoint,
        ),
      };
      pagesById.set(id, recovery);
      commands.push({ type: "createPage", page: recovery });
    }

    commands.push(...planElementRelocations(moved, id));
  }
  return commands;
}
