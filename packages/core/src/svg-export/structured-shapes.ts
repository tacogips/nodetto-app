// Compartmented shapes: ERD tables, database objects, UML classes and
// UML components.

import {
  DATABASE_OBJECT_LABELS,
  type DatabaseObjectSemantic,
  type DatabaseObjectType,
  type Element,
  type ErdColumn,
  type ErdTableSemantic,
  UmlComponentType,
} from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { databaseObjectRows } from "../shapes/databaseObject.ts";
import {
  ERD_TABLE_HEADER_HEIGHT,
  ERD_TABLE_ROW_HEIGHT,
  erdColumnKey,
} from "../shapes/erdTable.ts";
import {
  UML_CLASS_NAME_HEIGHT,
  UML_CLASS_ROW_HEIGHT,
  UML_CLASS_STEREOTYPE_HEIGHT,
  umlAttributesHeight,
  umlNameHeight,
} from "../shapes/umlClass.ts";
import { readField, readList, readString, tag, text } from "./markup.ts";
import { styled } from "./paint.ts";
import { STROKE_WIDTH, type SvgTheme, TEXT_PADDING } from "./theme.ts";

const ROW_PADDING = 10;
/** Grid columns of an ERD row: a 26-unit key column, then a 6-unit gap. */
const ERD_NAME_OFFSET = ROW_PADDING + 26 + 6;

export function renderErdTable(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  const columns = readList(element.semantic, "columns");
  const parts: string[] = [
    tag(
      "rect",
      styled(
        {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rx: 6,
          fill: theme.surface,
          stroke: theme.ink,
          "stroke-width": STROKE_WIDTH,
        },
        element.visual,
        element.id,
      ),
    ),
    tag("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: ERD_TABLE_HEADER_HEIGHT,
      fill: theme.accentSoft,
    }),
    tag("line", {
      x1: box.x,
      y1: box.y + ERD_TABLE_HEADER_HEIGHT,
      x2: box.x + box.width,
      y2: box.y + ERD_TABLE_HEADER_HEIGHT,
      stroke: theme.ink,
      "stroke-width": STROKE_WIDTH,
    }),
    text(
      {
        x: box.x + ROW_PADDING,
        y: box.y + ERD_TABLE_HEADER_HEIGHT / 2,
        "dominant-baseline": "central",
        fill: theme.ink,
        "font-size": theme.fontSize,
        "font-weight": 700,
      },
      readString(element.semantic, "tableName"),
    ),
  ];
  for (const [at, column] of columns.entries()) {
    const middle =
      box.y +
      ERD_TABLE_HEADER_HEIGHT +
      at * ERD_TABLE_ROW_HEIGHT +
      ERD_TABLE_ROW_HEIGHT / 2;
    const key = erdColumnKey(
      element.semantic as Partial<ErdTableSemantic>,
      column as Partial<ErdColumn>,
    );
    if (key) {
      parts.push(
        text(
          {
            x: box.x + ROW_PADDING,
            y: middle,
            "dominant-baseline": "central",
            fill: theme.accent,
            "font-size": 10,
            "font-weight": 700,
          },
          key,
        ),
      );
    }
    parts.push(
      text(
        {
          x: box.x + ERD_NAME_OFFSET,
          y: middle,
          "dominant-baseline": "central",
          fill: theme.ink,
          "font-size": 12,
        },
        readString(column, "name"),
      ),
      text(
        {
          x: box.x + box.width - ROW_PADDING,
          y: middle,
          "text-anchor": "end",
          "dominant-baseline": "central",
          fill: theme.muted,
          "font-size": 12,
        },
        readString(column, "dataType") +
          (readField(column, "nullable") === true ? "?" : ""),
      ),
    );
  }
  return parts.join("");
}

function umlVisibility(member: unknown): string {
  const value = readString(member, "visibility");
  return value === "" ? "+" : value;
}

function umlAttributeText(attribute: unknown): string {
  const type = readString(attribute, "type");
  return `${umlVisibility(attribute)} ${readString(attribute, "name")}${
    type === "" ? "" : `: ${type}`
  }`;
}

function umlMethodText(method: unknown): string {
  const parameters = readList(method, "parameters")
    .map((parameter) => {
      const type = readString(parameter, "type");
      const name = readString(parameter, "name");
      return type === "" ? name : `${name}: ${type}`;
    })
    .join(", ");
  const returns = readString(method, "returnType");
  return `${umlVisibility(method)} ${readString(method, "name")}(${parameters})${
    returns === "" ? "" : `: ${returns}`
  }`;
}

export function renderUmlClass(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  const semantic = element.semantic;
  const nameHeight = umlNameHeight(semantic);
  const attributesHeight = umlAttributesHeight(semantic);
  const stereotype = readString(semantic, "stereotype");
  const parts: string[] = [
    tag(
      "rect",
      styled(
        {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          fill: theme.surface,
          stroke: theme.ink,
          "stroke-width": STROKE_WIDTH,
        },
        element.visual,
        element.id,
      ),
    ),
    tag("line", {
      x1: box.x,
      y1: box.y + nameHeight,
      x2: box.x + box.width,
      y2: box.y + nameHeight,
      stroke: theme.ink,
      "stroke-width": STROKE_WIDTH,
    }),
    tag("line", {
      x1: box.x,
      y1: box.y + nameHeight + attributesHeight,
      x2: box.x + box.width,
      y2: box.y + nameHeight + attributesHeight,
      stroke: theme.line,
      "stroke-width": 1,
    }),
  ];
  if (stereotype !== "") {
    parts.push(
      text(
        {
          x: box.x + box.width / 2,
          y: box.y + UML_CLASS_STEREOTYPE_HEIGHT / 2,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          fill: theme.muted,
          "font-size": 10,
        },
        `«${stereotype}»`,
      ),
    );
  }
  // The stereotype line sits above the name; what is left of the band is
  // always one `UML_CLASS_NAME_HEIGHT` row, whether or not it is there.
  parts.push(
    text(
      {
        x: box.x + box.width / 2,
        y:
          box.y +
          (nameHeight - UML_CLASS_NAME_HEIGHT) +
          UML_CLASS_NAME_HEIGHT / 2,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        fill: theme.ink,
        "font-size": theme.fontSize,
        "font-weight": 700,
      },
      readString(semantic, "name"),
    ),
  );

  const row = (
    top: number,
    at: number,
    content: string,
    member: unknown,
  ): string =>
    text(
      {
        x: box.x + TEXT_PADDING,
        y: top + at * UML_CLASS_ROW_HEIGHT + UML_CLASS_ROW_HEIGHT / 2,
        "dominant-baseline": "central",
        fill: theme.ink,
        "font-size": 12,
        "text-decoration":
          readField(member, "static") === true ? "underline" : undefined,
        "font-style":
          readField(member, "abstract") === true ? "italic" : undefined,
      },
      content,
    );

  for (const [at, attribute] of readList(semantic, "attributes").entries()) {
    parts.push(
      row(box.y + nameHeight, at, umlAttributeText(attribute), attribute),
    );
  }
  for (const [at, method] of readList(semantic, "methods").entries()) {
    parts.push(
      row(
        box.y + nameHeight + attributesHeight,
        at,
        umlMethodText(method),
        method,
      ),
    );
  }
  return parts.join("");
}

export function renderUmlComponent(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  const port = element.type === UmlComponentType.Port;
  const component = element.type === UmlComponentType.Component;
  const style = element.visual.style;
  const stroke = style?.stroke ?? theme.ink;
  const fill = style?.fill ?? theme.surface;
  const shape =
    component || port
      ? tag("rect", {
          x: box.x + 1,
          y: box.y + 1,
          width: Math.max(0, box.width - 2),
          height: Math.max(0, box.height - 2),
          stroke,
          fill,
          "stroke-width": style?.strokeWidth ?? 1.5,
        })
      : readString(element.semantic, "kind") === "required"
        ? tag("path", {
            d: `M${box.x + box.width / 2} ${box.y + 2} A${Math.max(1, box.width / 2 - 2)} ${Math.max(1, box.height / 2 - 2)} 0 0 0 ${box.x + box.width / 2} ${box.y + box.height - 2}`,
            fill: "none",
            stroke,
            "stroke-width": style?.strokeWidth ?? 1.5,
          })
        : tag("ellipse", {
            cx: box.x + box.width / 2,
            cy: box.y + box.height / 2,
            rx: Math.max(1, box.width / 2 - 2),
            ry: Math.max(1, box.height / 2 - 2),
            stroke,
            fill,
            "stroke-width": style?.strokeWidth ?? 1.5,
          });
  const icon = component
    ? tag("path", {
        d: `M${box.x + box.width - 27} ${box.y + 10}h16v20h-16zM${box.x + box.width - 31} ${box.y + 14}h8v5h-8zM${box.x + box.width - 31} ${box.y + 23}h8v5h-8z`,
        stroke,
        fill,
        "stroke-width": style?.strokeWidth ?? 1.5,
      })
    : "";
  return (
    shape +
    icon +
    text(
      {
        x: box.x + box.width / 2,
        y: component ? box.y + box.height / 2 + 5 : box.y + box.height + 17,
        "text-anchor": "middle",
        fill: style?.color ?? theme.ink,
        "font-size": style?.fontSize ?? 13,
        "font-family": style?.fontFamily ?? "system-ui, sans-serif",
      },
      readString(element.semantic, "name"),
    )
  );
}

export function renderDatabaseObject(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  const semantic = element.semantic as DatabaseObjectSemantic;
  return (
    tag(
      "rect",
      styled(
        {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rx: 4,
          fill: theme.surface,
          stroke: theme.ink,
          "stroke-width": 1.5,
        },
        element.visual,
      ),
    ) +
    tag("line", {
      x1: box.x,
      y1: box.y + 52,
      x2: box.x + box.width,
      y2: box.y + 52,
      stroke: theme.ink,
    }) +
    text(
      { x: box.x + 8, y: box.y + 15, fill: theme.ink, "font-size": 10 },
      DATABASE_OBJECT_LABELS[element.type as DatabaseObjectType],
    ) +
    text(
      {
        x: box.x + 8,
        y: box.y + 37,
        fill: theme.ink,
        "font-size": 14,
        "font-weight": 600,
      },
      semantic.name,
    ) +
    databaseObjectRows(element)
      .map((row, index) =>
        text(
          {
            x: box.x + 8,
            y: box.y + 69 + index * 24,
            fill: theme.ink,
            "font-size": 12,
          },
          row,
        ),
      )
      .join("")
  );
}
