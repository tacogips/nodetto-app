// Where an edge label sits on the page, for picking and inline editing. It
// follows the same layout the renderers draw (label-layout.ts); an unlabelled
// edge gets a small zone on its route midpoint so a label can be added there.

import type { Element } from "@nodetto/ir";
import type { Box } from "../../geometry.ts";
import {
  connectorLabelExtent,
  connectorLabelLayout,
} from "../../label-layout.ts";
import type { ShapeContext } from "../../shape-util.ts";
import { connectorDecoration } from "./decoration.ts";
import { resolveConnector } from "./resolve.ts";
import { endpointReaderFor } from "./util.ts";

const EMPTY_LABEL_WIDTH = 48;
const EMPTY_LABEL_HEIGHT = 20;

/**
 * The page box of an edge's label, or null when the route cannot be
 * resolved. BPMN flows place their names through their notation instead.
 */
export function connectorLabelBox(
  element: Element,
  context: ShapeContext,
): Box | null {
  if (element.type.startsWith("bpmn.")) return null;
  const resolved = resolveConnector(
    element,
    context,
    endpointReaderFor(element.type),
  );
  if (!resolved) return null;
  const anchor = resolved.labelPoint;
  const layout = connectorLabelLayout(
    connectorDecoration(element).label,
    element.visual,
  );
  const text = connectorLabelExtent(layout, anchor);
  if (!text)
    return {
      x: anchor.x - EMPTY_LABEL_WIDTH / 2,
      y: anchor.y - EMPTY_LABEL_HEIGHT / 2,
      width: EMPTY_LABEL_WIDTH,
      height: EMPTY_LABEL_HEIGHT,
    };
  const width = Math.max(EMPTY_LABEL_WIDTH, text.width);
  return { ...text, x: anchor.x - width / 2, width };
}
