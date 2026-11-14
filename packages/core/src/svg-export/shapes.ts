// Per-type dispatch for every non-edge element, plus the drawing, image
// and frame types that need little more than a path or an image tag.

import {
  type Element,
  type FrameSemantic,
  type ImageSemantic,
  isBreadboardElementType,
  isPcbElementType,
  type PathSemantic,
  UmlComponentType,
} from "@nodetto/ir";
import { isBpmnShapeType } from "../bpmn/notation.ts";
import type { BreadboardNotation } from "../breadboard/notation.ts";
import { resolvedCornerRadii, roundedRectPath } from "../corner-radii.ts";
import type { Box } from "../geometry.ts";
import { gradientId } from "../gradient.ts";
import { croppedImageBox } from "../image-crop.ts";
import {
  renderIconMarkup,
  renderIconPlaceholder,
} from "../icons/icon-markup.ts";
import { findIcon } from "../icons/icon-registry.ts";
import { compoundPathGeometry } from "../shapes/compound-path.ts";
import { freehandGeometry } from "../shapes/freehand.ts";
import {
  FRAME_OUTSIDE_TITLE_GAP,
  resolveTitlePlacement,
} from "../shapes/frame.ts";
import { stateNodeNotation } from "../shapes/state.ts";
import { useCaseNodeNotation } from "../shapes/usecase.ts";
import {
  renderGeo,
  renderNode,
  renderSequenceActivation,
  renderSequenceParticipant,
  renderUnsupported,
} from "./basic-shapes.ts";
import { fmt, readString, tag, text, wrap } from "./markup.ts";
import {
  renderBpmnShape,
  renderBreadboardShape,
  renderNotationPrimitive,
} from "./notation.ts";
import { styled, textStyled } from "./paint.ts";
import { rectStrokeMarkup, rectStrokeParts } from "./rect-strokes.ts";
import {
  renderDatabaseObject,
  renderErdTable,
  renderUmlClass,
  renderUmlComponent,
} from "./structured-shapes.ts";
import { renderTableSheet } from "./table-sheet.ts";
import { renderTextNote } from "./text-note.ts";
import { renderPcbShape } from "./pcb-shapes.ts";
import type { SvgTheme } from "./theme.ts";
import { renderUiControl } from "./ui-control.ts";

export function renderShape(
  element: Element,
  box: Box,
  theme: SvgTheme,
  resolveAsset?: (source: string) => string,
  breadboard?: BreadboardNotation,
): string {
  if (isBreadboardElementType(element.type))
    return renderBreadboardShape(element, box, breadboard);
  if (isBpmnShapeType(element.type)) return renderBpmnShape(element, box);
  if (isPcbElementType(element.type)) return renderPcbShape(element);
  switch (element.type) {
    case "draw.path": {
      const geometry = compoundPathGeometry(element);
      if (!geometry) return "";
      const closedPath = geometry.path
        ? tag(
            "path",
            styled(
              {
                d: geometry.path,
                transform: `translate(${fmt(box.x)} ${fmt(box.y)})`,
                fill: theme.ink,
                stroke: "none",
                "fill-rule": (element.semantic as PathSemantic).fillRule,
              },
              element.visual,
              element.id,
            ),
          )
        : "";
      const openPath = geometry.openPath
        ? tag("path", {
            ...styled(
              {
                d: geometry.openPath,
                transform: `translate(${fmt(box.x)} ${fmt(box.y)})`,
                fill: "none",
                stroke: theme.ink,
              },
              element.visual,
              element.id,
            ),
            fill: "none",
          })
        : "";
      return closedPath + openPath;
    }
    case "draw.freehand": {
      const geometry = freehandGeometry(element);
      if (!geometry) return "";
      if (geometry.pressureOutline) {
        const style = element.visual.style;
        const hasFill =
          (element.semantic as { closed?: boolean }).closed === true &&
          Boolean(
            style?.fillGradient ||
              (style?.fill &&
                style.fill !== "none" &&
                style.fill !== "transparent"),
          );
        const paths: string[] = [];
        if (hasFill) {
          const fill = styled(
            { d: geometry.path, stroke: "none" },
            element.visual,
            element.id,
          );
          fill["stroke"] = "none";
          fill["stroke-width"] = undefined;
          fill["stroke-dasharray"] = undefined;
          fill["stroke-linecap"] = undefined;
          fill["stroke-linejoin"] = undefined;
          fill["stroke-miterlimit"] = undefined;
          fill["opacity"] = undefined;
          paths.push(tag("path", fill));
        }
        const outline = styled(
          { d: geometry.pressureOutline.path, fill: "none", stroke: theme.ink },
          element.visual,
          element.id,
        );
        outline["fill"] = outline["stroke"] ?? theme.ink;
        outline["fill-rule"] = "evenodd";
        outline["stroke"] = "none";
        outline["stroke-width"] = undefined;
        outline["stroke-dasharray"] = undefined;
        outline["stroke-linecap"] = undefined;
        outline["stroke-linejoin"] = undefined;
        outline["stroke-miterlimit"] = undefined;
        outline["opacity"] = undefined;
        paths.push(tag("path", outline));
        return wrap(
          "g",
          {
            transform: `translate(${fmt(box.x)} ${fmt(box.y)})`,
            opacity: style?.opacity,
          },
          paths.join(""),
        );
      }
      return tag(
        "path",
        styled(
          {
            d: geometry.path,
            transform: `translate(${fmt(box.x)} ${fmt(box.y)})`,
            fill: "none",
            stroke: theme.ink,
            "stroke-width": 2,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
          },
          element.visual,
          element.id,
        ),
      );
    }
    case "image.raster": {
      const semantic = element.semantic as ImageSemantic;
      const imageBox = semantic.crop
        ? croppedImageBox(semantic.crop, {
            x: 0,
            y: 0,
            width: box.width,
            height: box.height,
          })
        : box;
      const image = tag("image", {
        ...imageBox,
        href: resolveAsset ? resolveAsset(semantic.src) : semantic.src,
        "aria-label": semantic.alt,
        opacity: element.visual.style?.opacity ?? 1,
        preserveAspectRatio: semantic.crop
          ? "none"
          : semantic.fit === "fill"
            ? "none"
            : semantic.fit === "cover"
              ? "xMidYMid slice"
              : "xMidYMid meet",
      });
      const painted = semantic.crop
        ? wrap("svg", { ...box, overflow: "hidden" }, image)
        : image;
      if (
        !element.visual.style?.cornerRadii &&
        !element.visual.style?.cornerRadius
      )
        return painted;
      const clipId = `${gradientId(element.id)}-corners`;
      return (
        wrap(
          "defs",
          {},
          wrap(
            "clipPath",
            { id: clipId, clipPathUnits: "userSpaceOnUse" },
            tag("path", {
              d: roundedRectPath(
                box,
                resolvedCornerRadii(element.visual.style),
              ),
            }),
          ),
        ) + wrap("g", { "clip-path": `url(#${clipId})` }, painted)
      );
    }
    case "frame": {
      const semantic = element.semantic as FrameSemantic;
      const outside = resolveTitlePlacement(semantic) === "outside";
      const parts = rectStrokeParts(box, element.visual.style);
      const paint = styled(
        { fill: "#ffffff", stroke: "#cbd5e1" },
        element.visual,
        element.id,
      );
      const clipId = `nd-strokes-${Array.from(element.id, (c) => c.codePointAt(0)?.toString(16)).join("-")}`;
      return (
        (parts
          ? rectStrokeMarkup(
              parts,
              {
                fill: String(paint.fill),
                stroke: String(paint.stroke),
                opacity: element.visual.style?.opacity,
              },
              clipId,
            )
          : tag(
              element.visual.style?.cornerRadii ? "path" : "rect",
              styled(
                element.visual.style?.cornerRadii
                  ? {
                      d: roundedRectPath(
                        box,
                        resolvedCornerRadii(element.visual.style),
                      ),
                      fill: "#ffffff",
                      stroke: "#cbd5e1",
                      "stroke-width": 1,
                    }
                  : {
                      ...box,
                      rx: element.visual.style?.cornerRadius ?? 0,
                      fill: "#ffffff",
                      stroke: "#cbd5e1",
                      "stroke-width": 1,
                    },
                element.visual,
                element.id,
              ),
            )) +
        (semantic.showTitle === false
          ? ""
          : text(
              textStyled(
                {
                  x: outside ? box.x : box.x + 8,
                  y: outside ? box.y - FRAME_OUTSIDE_TITLE_GAP : box.y + 16,
                  fill: theme.ink,
                  "font-size": 12,
                },
                element.visual,
              ),
              readString(element.semantic, "name"),
            ))
      );
    }
    case "shape.geo":
      return renderGeo(element, box, theme);
    case "node.generic":
      return renderNode(element, box, theme);
    case "sequence.participant":
      return renderSequenceParticipant(element, box, theme);
    case "sequence.activation":
      return renderSequenceActivation(element, box, theme);
    case "erd.view":
    case "erd.materialized-view":
    case "erd.function":
    case "erd.procedure":
      return renderDatabaseObject(element, box, theme);
    case "erd.table":
      return renderErdTable(element, box, theme);
    case "table.sheet":
      return renderTableSheet(element, box, theme);
    case UmlComponentType.Component:
    case UmlComponentType.Interface:
    case UmlComponentType.Port:
      return renderUmlComponent(element, box, theme);
    case "state.node":
      return stateNodeNotation(element, box)
        .map((primitive) => renderNotationPrimitive(primitive))
        .join("");
    case "usecase.node":
      return useCaseNodeNotation(element, box)
        .map((primitive) => renderNotationPrimitive(primitive))
        .join("");
    case "uml.class":
      return renderUmlClass(element, box, theme);
    case "ui.control":
      return renderUiControl(element, box, theme);
    case "ui.icon": {
      const semantic = element.semantic as {
        icon?: string;
        path?: string;
        viewBox?: number;
      };
      const style = element.visual.style;
      const source =
        semantic.path !== undefined
          ? { path: semantic.path }
          : findIcon(semantic.icon ?? "");
      const stroke = style?.stroke ?? "#000000";
      const painted = source
        ? renderIconMarkup(source, box, {
            stroke,
            strokeWidth: style?.strokeWidth ?? 2,
            fill: style?.fill ?? "none",
            viewBox: semantic.viewBox ?? 24,
            opacity: style?.opacity,
          })
        : wrap(
            "g",
            { opacity: style?.opacity },
            renderIconPlaceholder(box, stroke),
          );
      const flipX = element.visual.flipX === true;
      const flipY = element.visual.flipY === true;
      if (!flipX && !flipY) return painted;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      return wrap(
        "g",
        {
          transform: `translate(${fmt(cx)} ${fmt(cy)}) scale(${flipX ? -1 : 1} ${flipY ? -1 : 1}) translate(${fmt(-cx)} ${fmt(-cy)})`,
        },
        painted,
      );
    }
    case "text.note":
      return renderTextNote(element, box, theme);
    default:
      return renderUnsupported(element, box, theme);
  }
}
