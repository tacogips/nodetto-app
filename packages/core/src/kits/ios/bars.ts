import type { Element } from "@nodetto/ir";
import type { Editor } from "../../editor.ts";
import type { Vec } from "../../geometry.ts";
import {
  IOS_BG,
  IOS_GROUPED_BG,
  IOS_LABEL,
  IOS_SEPARATOR,
  IOS_TINT,
  textLayer,
} from "./style.ts";
import type { KitComponent, KitProp } from "./types.ts";

const prop = (
  name: string,
  type: KitProp["type"],
  value: string | number | boolean,
  targets: KitProp["targets"] = [],
  values?: readonly string[],
): KitProp => ({
  name,
  type,
  default: value,
  targets,
  ...(values ? { values } : {}),
});
const target = (key: string, field: KitProp["targets"][number]["field"]) => ({
  key,
  field,
});
const hidden = (element: Element): Element => ({
  ...element,
  visual: { ...element.visual, hidden: true },
});
const centered = (element: Element): Element => ({
  ...element,
  visual: {
    ...element.visual,
    style: { ...element.visual.style, textAlign: "middle" },
  },
});
const styleProp = prop("style", "enum", "dark", [], ["dark", "light"]);

function frame(
  editor: Editor,
  name: string,
  at: Vec,
  width: number,
  height: number,
  children: readonly Element[],
  kit?: string,
): Element {
  return editor.buildElement("frame", {
    semantic: {
      name,
      showTitle: false,
      ...(kit ? { component: true, kit: `${kit}@1` } : {}),
      memberIds: children.map((child) => child.id),
    },
    visual: {
      ...at,
      width,
      height,
      style: { fill: "none", stroke: "none", strokeWidth: 0 },
    },
  });
}
function icon(
  editor: Editor,
  key: string,
  name: string,
  x: number,
  y: number,
  size = 24,
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
): Element {
  return editor.buildElement("shape.geo", {
    semantic: { geo: "rect" },
    visual: {
      x,
      y,
      width,
      height,
      componentKey: key,
      style: { fill, stroke: "none", strokeWidth: 0, cornerRadius: radius },
    },
  });
}
function component(
  id: KitComponent["id"],
  label: string,
  width: number,
  height: number,
  fullWidth: boolean,
  props: readonly KitProp[],
  buildChildren: (editor: Editor, at: Vec) => readonly Element[],
  slots?: KitComponent["slots"],
): KitComponent {
  return {
    id,
    version: 1,
    label,
    width,
    height,
    fullWidth,
    props,
    ...(slots ? { slots } : {}),
    build(editor, at) {
      const children = buildChildren(editor, at).map((child) => {
        const key = child.visual.componentKey ?? "";
        const constraint: Element["visual"]["horizontalConstraint"] =
          /^(signal|wifi|battery|trailingButton|trailingIcon)$/.test(key)
            ? "end"
            : /^(indicator|title)$/.test(key) || /^item\d+Icon$/.test(key)
              ? "center"
              : /^(separator|background|largeTitle)$/.test(key) ||
                  /^item\d+(Label|Indicator)$/.test(key)
                ? "stretch"
                : /^item\d+$/.test(key)
                  ? "scale"
                  : /^item\d+Badge(?:Background)?$/.test(key)
                    ? "center"
                    : undefined;
        return constraint
          ? {
              ...child,
              visual: { ...child.visual, horizontalConstraint: constraint },
            }
          : child;
      });
      const nested = new Set(
        children.flatMap((child) =>
          child.type === "frame" &&
          Array.isArray(
            (child.semantic as Record<string, unknown>)["memberIds"],
          )
            ? ((child.semantic as Record<string, unknown>)[
                "memberIds"
              ] as string[])
            : [],
        ),
      );
      return {
        frame: frame(
          editor,
          label,
          at,
          width,
          height,
          children.filter((child) => !nested.has(child.id)),
          id,
        ),
        children,
      };
    },
  };
}

const status = component(
  "ios:status-bar",
  "Status bar",
  390,
  47,
  true,
  [prop("time", "text", "9:41", [target("time", "text")]), styleProp],
  (editor, at) => [
    textLayer(
      editor,
      "time",
      "9:41",
      { x: at.x + 33, y: at.y + 12, width: 70, height: 23 },
      { size: 17, weight: 600 },
    ),
    icon(editor, "signal", "signal", at.x + 300, at.y + 15, 18),
    icon(editor, "wifi", "wifi", at.x + 323, at.y + 15, 18),
    icon(editor, "battery", "battery-full", at.x + 347, at.y + 15, 22),
  ],
);
const home = component(
  "ios:home-indicator",
  "Home indicator",
  390,
  44,
  true,
  [styleProp],
  (editor, at) => [
    rect(editor, "indicator", at.x + 128, at.y + 31, 134, 5, IOS_LABEL, 2.5),
  ],
);
const nav = component(
  "ios:nav-bar",
  "Navigation bar",
  390,
  44,
  true,
  [
    prop("title", "text", "Title", [
      target("title", "text"),
      target("largeTitle", "text"),
    ]),
    prop("back", "boolean", true, [
      target("backIcon", "hidden"),
      target("backLabel", "hidden"),
    ]),
    prop("backLabel", "text", "Back", [target("backLabel", "text")]),
    prop("trailingIcon", "icon", "ellipsis", [target("trailingIcon", "icon")]),
    prop("large", "boolean", false, []),
  ],
  (editor, at) => {
    const backIcon = icon(
      editor,
      "backIcon",
      "chevron-left",
      at.x + 8,
      at.y + 10,
      24,
      IOS_TINT,
    );
    const backLabel = textLayer(
      editor,
      "backLabel",
      "Back",
      { x: at.x + 32, y: at.y + 11, width: 70, height: 22 },
      { color: IOS_TINT },
    );
    const backButton = frame(editor, "Back button", at, 102, 44, [
      backIcon,
      backLabel,
    ]);
    const trailing = icon(
      editor,
      "trailingIcon",
      "ellipsis",
      at.x + 356,
      at.y + 10,
      24,
      IOS_TINT,
    );
    const trailingFrame = frame(
      editor,
      "Trailing button",
      { x: at.x + 346, y: at.y },
      44,
      44,
      [],
    );
    return [
      {
        ...backButton,
        visual: { ...backButton.visual, componentKey: "backButton" },
      },
      backIcon,
      backLabel,
      centered(
        textLayer(
          editor,
          "title",
          "Title",
          { x: at.x + 145, y: at.y + 11, width: 100, height: 22 },
          { size: 17, weight: 600 },
        ),
      ),
      hidden(
        textLayer(
          editor,
          "largeTitle",
          "Title",
          { x: at.x + 16, y: at.y + 48, width: 358, height: 42 },
          { size: 34, weight: 700 },
        ),
      ),
      {
        ...trailingFrame,
        visual: { ...trailingFrame.visual, componentKey: "trailingButton" },
      },
      trailing,
    ];
  },
);

function slots(kind: "tab" | "top" | "segmented"): KitComponent {
  const id =
    kind === "tab"
      ? "ios:tab-bar"
      : kind === "top"
        ? "ios:top-tabs"
        : "ios:segmented";
  const label =
    kind === "tab"
      ? "Tab bar"
      : kind === "top"
        ? "Top tabs"
        : "Segmented control";
  const width = kind === "segmented" ? 358 : 390;
  const height = kind === "tab" ? 83 : 44;
  const props: KitProp[] = [
    prop("count", "integer", 5),
    prop("active", "integer", 0),
    prop("activeColor", "color", IOS_TINT),
    prop("inactiveColor", "color", "#999999"),
  ];
  for (let n = 1; n <= 5; n++)
    props.push(
      prop(`item${n}Label`, "text", `Label ${n}`, [
        target(`item${n}Label`, "text"),
      ]),
      prop(`item${n}Icon`, "icon", "circle", [target(`item${n}Icon`, "icon")]),
      prop(`item${n}Badge`, "text", "", [target(`item${n}Badge`, "text")]),
    );
  return component(
    id,
    label,
    width,
    height,
    kind !== "segmented",
    props,
    (editor, at) => {
      const all: Element[] = [];
      if (kind === "tab")
        all.push(
          rect(editor, "separator", at.x, at.y, width, 1, IOS_SEPARATOR),
        );
      if (kind === "segmented")
        all.push(
          rect(
            editor,
            "background",
            at.x,
            at.y + 6,
            width,
            32,
            IOS_GROUPED_BG,
            9,
          ),
        );
      for (let n = 1; n <= 5; n++) {
        const left = Math.round(((n - 1) * width) / 5);
        const right = Math.round((n * width) / 5);
        const x = at.x + left;
        const slotWidth = right - left;
        const children: Element[] = [];
        if (kind === "tab")
          children.push(
            icon(
              editor,
              `item${n}Icon`,
              "circle",
              x + Math.floor(slotWidth / 2) - 12,
              at.y + 3,
              24,
              n === 1 ? IOS_TINT : "#999999",
            ),
          );
        if (kind === "tab")
          children.push(
            (n === 1 ? (element: Element) => element : hidden)(
              rect(
                editor,
                `item${n}Indicator`,
                x,
                at.y,
                slotWidth - (slotWidth % 2),
                1,
                "none",
              ),
            ),
          );
        if (kind !== "tab")
          children.push(
            (n === 1 ? (element: Element) => element : hidden)(
              rect(
                editor,
                `item${n}Indicator`,
                x,
                kind === "top" ? at.y + 42 : at.y + 8,
                slotWidth,
                kind === "top" ? 2 : 28,
                kind === "top" ? IOS_TINT : IOS_BG,
                kind === "top" ? 0 : 7,
              ),
            ),
          );
        children.push(
          centered(
            textLayer(
              editor,
              `item${n}Label`,
              `Label ${n}`,
              {
                x,
                y: at.y + (kind === "tab" ? 29 : 12),
                width: kind === "tab" ? slotWidth - (slotWidth % 2) : slotWidth,
                height: kind === "tab" ? 16 : 20,
              },
              {
                size: kind === "tab" ? 10 : 15,
                color: n === 1 ? IOS_TINT : "#999999",
              },
            ),
          ),
        );
        if (kind === "tab")
          children.push(
            hidden(
              rect(
                editor,
                `item${n}BadgeBackground`,
                x + Math.floor(slotWidth / 2) + 8,
                at.y + 3,
                20,
                16,
                "#ff3b30",
                8,
              ),
            ),
            hidden(
              centered(
                textLayer(
                  editor,
                  `item${n}Badge`,
                  "",
                  {
                    x: x + Math.floor(slotWidth / 2) + 8,
                    y: at.y + 3,
                    width: 20,
                    height: 16,
                  },
                  { size: 10, weight: 600, color: "#ffffff" },
                ),
              ),
            ),
          );
        const group = frame(
          editor,
          `Item ${n}`,
          { x, y: at.y },
          slotWidth,
          kind === "tab" ? 49 : 44,
          children,
        );
        all.push(
          { ...group, visual: { ...group.visual, componentKey: `item${n}` } },
          ...children,
        );
      }
      return all;
    },
    { prefix: "item", count: 5 },
  );
}
export const IOS_BAR_COMPONENTS: readonly KitComponent[] = [
  status,
  home,
  nav,
  slots("tab"),
  slots("top"),
  slots("segmented"),
];
