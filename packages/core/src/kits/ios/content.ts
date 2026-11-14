import type { Element, FrameLayout } from "@nodetto/ir";
import type { Editor } from "../../editor.ts";
import type { Vec } from "../../geometry.ts";
import {
  IOS_BG,
  IOS_LABEL,
  IOS_SECONDARY_LABEL,
  IOS_SEPARATOR,
  IOS_TINT,
  textLayer,
} from "./style.ts";
import type { KitComponent, KitProp } from "./types.ts";

const target = (key: string, field: KitProp["targets"][number]["field"]) => ({
  key,
  field,
});
const prop = (
  name: string,
  type: KitProp["type"],
  value: string | number | boolean,
  targets: KitProp["targets"] = [],
  extra: Partial<KitProp> = {},
): KitProp => ({ name, type, default: value, targets, ...extra });
const autoHeight = (element: Element): Element => ({
  ...element,
  visual: { ...element.visual, textResize: "auto-height" },
});
const hide = (element: Element): Element => ({
  ...element,
  visual: { ...element.visual, hidden: true },
});
function icon(
  editor: Editor,
  key: string,
  name: string,
  x: number,
  y: number,
  size: number,
  color = IOS_LABEL,
): Element {
  return editor.buildElement("ui.icon", {
    semantic: { icon: name },
    visual: {
      x,
      y,
      width: size,
      height: size,
      componentKey: key,
      style: { fill: "none", stroke: color, strokeWidth: 2 },
    },
  });
}
function rect(
  editor: Editor,
  key: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  radius = 0,
  stroke = "none",
): Element {
  return editor.buildElement("shape.geo", {
    semantic: { geo: "rect" },
    visual: {
      x,
      y,
      width,
      height,
      componentKey: key,
      style: {
        fill,
        stroke,
        strokeWidth: stroke === "none" ? 0 : 1,
        cornerRadius: radius,
      },
    },
  });
}
function shadowRect(editor: Editor, p: Vec): Element {
  const shape = rect(editor, "background", p.x, p.y, 56, 56, IOS_TINT, 28);
  return {
    ...shape,
    visual: {
      ...shape.visual,
      style: {
        ...shape.visual.style,
        effects: [
          {
            type: "drop-shadow",
            x: 0,
            y: 0,
            blur: 4,
            color: "#000000",
            opacity: 0.2,
          },
        ],
      },
    },
  };
}
function control(
  editor: Editor,
  key: string,
  kind: "input" | "switch",
  x: number,
  y: number,
  width: number,
  height: number,
  label = "",
): Element {
  return editor.buildElement("ui.control", {
    semantic: { control: kind, label },
    visual: {
      x,
      y,
      width,
      height,
      componentKey: key,
      style: {
        fill: IOS_BG,
        stroke: IOS_SEPARATOR,
        strokeWidth: 1,
        cornerRadius: 10,
      },
    },
  });
}
function component(
  { id }: { readonly id: KitComponent["id"] },
  label: string,
  width: number,
  height: number,
  fullWidth: boolean,
  props: readonly KitProp[],
  children: (editor: Editor, at: Vec) => readonly Element[],
  layout?: FrameLayout,
): KitComponent {
  return {
    id,
    version: 1,
    label,
    width,
    height,
    fullWidth,
    props,
    build(editor, at) {
      const built = children(editor, at).map((child) => {
        const key = child.visual.componentKey;
        const absolute =
          layout &&
          (key === "background" ||
            key === "divider" ||
            key === "accentColor" ||
            key === "sendBackground");
        return {
          ...child,
          visual: {
            ...child.visual,
            ...(absolute ? { layoutPosition: "absolute" as const } : {}),
            ...(key === "divider" && id === "ios:list-row"
              ? {
                  verticalConstraint: "end" as const,
                  horizontalConstraint: "stretch" as const,
                }
              : {}),
            ...(key === "background" &&
            (id === "ios:chip" || id === "ios:badge" || id === "ios:card")
              ? {
                  horizontalConstraint: "stretch" as const,
                  ...(id === "ios:card"
                    ? { verticalConstraint: "stretch" as const }
                    : {}),
                }
              : {}),
          },
        };
      });
      const nested: Element[] = [];
      const group = (
        key: string,
        memberKeys: readonly string[],
        x: number,
        y: number,
        w: number,
        h: number,
        childLayout?: FrameLayout,
      ): void => {
        const members = built.filter((child) =>
          memberKeys.includes(child.visual.componentKey ?? ""),
        );
        const frame = editor.buildElement("frame", {
          semantic: {
            name: key,
            showTitle: false,
            memberIds: members.map((child) => child.id),
            ...(childLayout ? { layout: childLayout } : {}),
          },
          visual: {
            x,
            y,
            width: w,
            height: h,
            componentKey: key,
            style: { fill: "none", stroke: "none", strokeWidth: 0 },
            ...(key === "textColumn" ? { layoutGrow: 1 } : {}),
          },
        });
        nested.push(frame);
      };
      if (id === "ios:list-row")
        group(
          "textColumn",
          ["title", "subtitle"],
          at.x + 52,
          at.y + 2,
          205,
          40,
          {
            direction: "vertical",
            gap: 0,
            padding: 0,
            sizing: "fixed",
            heightSizing: "hug",
            align: "start",
          },
        );
      if (id === "ios:composer")
        group(
          "sendButton",
          ["sendBackground", "sendIcon"],
          at.x + 334,
          at.y + 8,
          44,
          44,
        );
      const nestedIds = new Set(
        nested.flatMap(
          (item) =>
            (item.semantic as { memberIds: readonly string[] }).memberIds,
        ),
      );
      const top = [
        ...built.filter((child) => !nestedIds.has(child.id)),
        ...nested,
      ];
      if (id === "ios:list-row")
        top.sort(
          (a, b) =>
            [
              "leadingIcon",
              "textColumn",
              "value",
              "chevron",
              "switch",
              "checkmark",
              "divider",
            ].indexOf(a.visual.componentKey ?? "") -
            [
              "leadingIcon",
              "textColumn",
              "value",
              "chevron",
              "switch",
              "checkmark",
              "divider",
            ].indexOf(b.visual.componentKey ?? ""),
        );
      return {
        frame: editor.buildElement("frame", {
          semantic: {
            name: label,
            showTitle: false,
            component: true,
            kit: `${id}@1`,
            memberIds: top.map((child) => child.id),
            ...(layout ? { layout } : {}),
          },
          visual: {
            ...at,
            width,
            height,
            componentKey: "root",
            ...(id === "ios:badge" ? { minWidth: 20 } : {}),
            style: { fill: "none", stroke: "none", strokeWidth: 0 },
          },
        }),
        children: [...built, ...nested],
      };
    },
  };
}
const text = (
  editor: Editor,
  key: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  size = 17,
  color = IOS_LABEL,
  weight = 400,
) =>
  textLayer(
    editor,
    key,
    value,
    { x, y, width, height },
    { size, color, weight },
  );

const rowLayout: FrameLayout = {
  direction: "horizontal",
  gap: 12,
  padding: 0,
  paddingLeft: 16,
  paddingRight: 16,
  sizing: "fixed",
  align: "center",
};
const chipLayout: FrameLayout = {
  direction: "horizontal",
  gap: 6,
  padding: 0,
  paddingLeft: 12,
  paddingRight: 12,
  sizing: "fixed",
  widthSizing: "hug",
  align: "center",
};
const cardLayout: FrameLayout = {
  direction: "vertical",
  gap: 6,
  padding: 16,
  sizing: "fixed",
  heightSizing: "hug",
  align: "start",
};
const composerLayout: FrameLayout = {
  direction: "horizontal",
  gap: 8,
  padding: 8,
  paddingLeft: 16,
  paddingRight: 16,
  sizing: "fixed",
  align: "center",
};
const badgeLayout: FrameLayout = {
  direction: "horizontal",
  gap: 0,
  padding: 0,
  paddingLeft: 6,
  paddingRight: 6,
  sizing: "fixed",
  widthSizing: "hug",
  align: "center",
};

export const IOS_CONTENT_COMPONENTS: readonly KitComponent[] = [
  component(
    { id: "ios:search-field" },
    "Search field",
    358,
    44,
    false,
    [
      prop("placeholder", "text", "Search", [target("placeholder", "text")]),
      prop("value", "text", "", [target("value", "text")], {
        effects: [
          {
            kind: "variant",
            keys: ["placeholder", "value"],
            selector: "non-empty",
            cases: { false: ["placeholder"], true: ["value"] },
          },
        ],
      }),
    ],
    (e, p) => [
      rect(e, "background", p.x, p.y + 4, 358, 36, "#7676801f", 10),
      icon(
        e,
        "searchIcon",
        "search",
        p.x + 8,
        p.y + 14,
        17,
        IOS_SECONDARY_LABEL,
      ),
      text(
        e,
        "placeholder",
        "Search",
        p.x + 33,
        p.y + 11,
        317,
        22,
        17,
        IOS_SECONDARY_LABEL,
      ),
      hide(text(e, "value", "", p.x + 33, p.y + 11, 317, 22)),
    ],
  ),
  component(
    { id: "ios:list-row" },
    "List row",
    390,
    44,
    true,
    [
      prop("title", "text", "Title", [target("title", "text")]),
      prop("subtitle", "text", "", [target("subtitle", "text")], {
        effects: [
          {
            kind: "geometry",
            key: "root",
            condition: "non-empty",
            height: { whenTrue: 60, whenFalse: 44 },
          },
          {
            kind: "variant",
            keys: ["subtitle"],
            selector: "non-empty",
            cases: { false: [], true: ["subtitle"] },
          },
        ],
      }),
      prop("leadingIcon", "icon", "circle", [target("leadingIcon", "icon")]),
      prop("accessory", "enum", "chevron", [], {
        values: ["none", "chevron", "value", "switch", "checkmark"],
        effects: [
          {
            kind: "variant",
            keys: ["chevron", "value", "switch", "checkmark"],
            cases: {
              none: [],
              chevron: ["chevron"],
              value: ["value"],
              switch: ["switch"],
              checkmark: ["checkmark"],
            },
          },
        ],
      }),
      prop("value", "text", "Value", [target("value", "text")]),
      prop("divider", "boolean", true, [target("divider", "hidden")]),
    ],
    (e, p) => [
      icon(e, "leadingIcon", "circle", p.x + 16, p.y + 10, 24, IOS_TINT),
      text(e, "title", "Title", p.x + 52, p.y + 11, 205, 22),
      hide(
        text(
          e,
          "subtitle",
          "Subtitle",
          p.x + 52,
          p.y + 33,
          205,
          20,
          15,
          IOS_SECONDARY_LABEL,
        ),
      ),
      hide(
        text(
          e,
          "value",
          "Value",
          p.x + 265,
          p.y + 11,
          80,
          22,
          17,
          IOS_SECONDARY_LABEL,
        ),
      ),
      icon(
        e,
        "chevron",
        "chevron-right",
        p.x + 357,
        p.y + 13,
        18,
        IOS_SECONDARY_LABEL,
      ),
      hide(control(e, "switch", "switch", p.x + 324, p.y + 6, 51, 32)),
      hide(icon(e, "checkmark", "check", p.x + 356, p.y + 10, 24, IOS_TINT)),
      rect(e, "divider", p.x + 56, p.y + 43, 334, 1, IOS_SEPARATOR),
    ],
    rowLayout,
  ),
  component(
    { id: "ios:section-header" },
    "Section header",
    390,
    38,
    true,
    [prop("title", "text", "Title", [target("title", "text")])],
    (e, p) => [
      text(
        e,
        "title",
        "Title",
        p.x + 16,
        p.y + 14,
        358,
        18,
        13,
        IOS_SECONDARY_LABEL,
      ),
    ],
  ),
  component(
    { id: "ios:chip" },
    "Chip",
    92,
    44,
    false,
    [
      prop("label", "text", "Label", [target("label", "text")]),
      prop("selected", "boolean", false, [], {
        effects: [
          {
            kind: "style",
            key: "background",
            cases: {
              true: { fill: IOS_TINT, stroke: IOS_TINT },
              false: { fill: IOS_BG, stroke: IOS_SEPARATOR },
            },
          },
          {
            kind: "style",
            key: "label",
            cases: { true: { color: "#ffffff" }, false: { color: IOS_LABEL } },
          },
        ],
      }),
      prop("leadingIcon", "icon", "", [target("leadingIcon", "icon")], {
        effects: [
          {
            kind: "variant",
            keys: ["leadingIcon"],
            selector: "non-empty",
            cases: { false: [], true: ["leadingIcon"] },
          },
        ],
      }),
    ],
    (e, p) => [
      rect(e, "background", p.x, p.y + 6, 92, 32, IOS_BG, 16, IOS_SEPARATOR),
      hide(icon(e, "leadingIcon", "circle", p.x + 12, p.y + 14, 16)),
      text(e, "label", "Label", p.x + 20, p.y + 12, 60, 20, 15),
    ],
    chipLayout,
  ),
  component(
    { id: "ios:fab" },
    "Floating action button",
    56,
    56,
    false,
    [
      prop("icon", "icon", "plus", [target("icon", "icon")]),
      prop("color", "color", IOS_TINT, [target("background", "fill")]),
    ],
    (e, p) => [
      shadowRect(e, p),
      icon(e, "icon", "plus", p.x + 16, p.y + 16, 24, "#ffffff"),
    ],
  ),
  component(
    { id: "ios:icon-button" },
    "Icon button",
    44,
    44,
    false,
    [prop("icon", "icon", "circle", [target("icon", "icon")])],
    (e, p) => [icon(e, "icon", "circle", p.x + 10, p.y + 10, 24)],
  ),
  component(
    { id: "ios:text-field" },
    "Text field",
    358,
    44,
    false,
    [
      prop("placeholder", "text", "Title", [target("input", "label")]),
      prop("value", "text", "", [target("input", "value")]),
    ],
    (e, p) => [control(e, "input", "input", p.x, p.y, 358, 44, "Title")],
  ),
  component(
    { id: "ios:composer" },
    "Composer",
    390,
    60,
    true,
    [
      prop("placeholder", "text", "Message", [target("input", "label")]),
      prop("sendIcon", "icon", "arrow-up", [target("sendIcon", "icon")]),
    ],
    (e, p) => [
      control(e, "input", "input", p.x + 16, p.y + 8, 314, 44, "Message"),
      rect(e, "sendBackground", p.x + 338, p.y + 12, 36, 36, IOS_TINT, 18),
      icon(e, "sendIcon", "arrow-up", p.x + 344, p.y + 18, 24, "#ffffff"),
    ],
    composerLayout,
  ),
  component(
    { id: "ios:card" },
    "Card",
    358,
    90,
    false,
    [
      prop("title", "text", "Title", [target("title", "text")]),
      prop("body", "text", "Subtitle", [target("body", "text")]),
      prop("accentSide", "enum", "none", [], {
        values: ["none", "left"],
        effects: [
          {
            kind: "strokeSides",
            key: "background",
            cases: {
              none: {
                strokeSides: {},
                strokeAlign: "inside",
                stroke: IOS_SEPARATOR,
              },
              left: {
                strokeSides: { left: 4 },
                strokeAlign: "inside",
                strokeFrom: "accentColor",
              },
            },
          },
        ],
      }),
      prop(
        "accentColor",
        "color",
        IOS_TINT,
        [target("accentColor", "stroke")],
        {
          effects: [
            {
              kind: "style",
              key: "background",
              valueField: "stroke",
              whenStrokeSide: "left",
            },
          ],
        },
      ),
    ],
    (e, p) => [
      rect(e, "background", p.x, p.y, 358, 90, IOS_BG, 12, IOS_SEPARATOR),
      hide(icon(e, "accentColor", "circle", p.x, p.y, 1, IOS_TINT)),
      text(
        e,
        "title",
        "Title",
        p.x + 16,
        p.y + 16,
        326,
        22,
        17,
        IOS_LABEL,
        600,
      ),
      autoHeight(
        text(
          e,
          "body",
          "Subtitle",
          p.x + 16,
          p.y + 44,
          326,
          30,
          15,
          IOS_SECONDARY_LABEL,
        ),
      ),
    ],
    cardLayout,
  ),
  component(
    { id: "ios:badge" },
    "Badge",
    20,
    20,
    false,
    [prop("count", "text", "1", [target("count", "text")])],
    (e, p) => [
      rect(e, "background", p.x, p.y, 20, 20, "#ff3b30", 10),
      text(e, "count", "1", p.x + 6, p.y + 1, 14, 18, 13, "#ffffff", 700),
    ],
    badgeLayout,
  ),
];
