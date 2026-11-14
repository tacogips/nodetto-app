import type { Element } from "@nodetto/ir";
import type { Editor } from "../../editor.ts";
import { APP_FONT_STACK } from "../../text-measure.ts";

export const IOS_LABEL = "#000000";
export const IOS_SECONDARY_LABEL = "#3c3c4399";
export const IOS_SEPARATOR = "#3c3c434a";
export const IOS_TINT = "#007aff";
export const IOS_GROUPED_BG = "#f2f2f7";
export const IOS_BG = "#ffffff";
export const IOS_BODY_SIZE = 17;
export const IOS_SUBHEAD_SIZE = 15;
export const IOS_CAPTION_SIZE = 12;
export const IOS_TAB_LABEL_SIZE = 10;
/** Transparent outer frames preserve a 44-point touch target for smaller visuals. */
export const IOS_MIN_TOUCH = 44;

export function textLayer(
  editor: Editor,
  key: string,
  text: string,
  box: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  options: {
    readonly size?: number;
    readonly weight?: number;
    readonly color?: string;
  } = {},
): Element {
  return editor.buildElement("text.note", {
    semantic: { text },
    visual: {
      ...box,
      componentKey: key,
      textMeasure: "proportional",
      textPadding: 0,
      style: {
        fill: "none",
        stroke: "none",
        strokeWidth: 0,
        color: options.color ?? IOS_LABEL,
        fontFamily: APP_FONT_STACK,
        fontSize: options.size ?? IOS_BODY_SIZE,
        fontWeight: options.weight ?? 400,
      },
    },
  });
}
