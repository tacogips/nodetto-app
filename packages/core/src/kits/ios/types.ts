import type { Element } from "@nodetto/ir";
import type { Editor } from "../../editor.ts";
import type { Vec } from "../../geometry.ts";

export type KitPropType =
  | "text"
  | "icon"
  | "color"
  | "boolean"
  | "enum"
  | "integer";

export interface KitPropTarget {
  readonly key: string;
  readonly field:
    | "text"
    | "label"
    | "icon"
    | "fill"
    | "stroke"
    | "color"
    | "hidden"
    | "value"
    | "checked";
}

export type KitPropEffect =
  | {
      readonly kind: "geometry";
      readonly key: string;
      readonly condition: "non-empty" | "equals";
      readonly equals?: string | number | boolean;
      readonly width?: {
        readonly whenTrue: number;
        readonly whenFalse: number;
      };
      readonly height?: {
        readonly whenTrue: number;
        readonly whenFalse: number;
      };
    }
  | {
      readonly kind: "variant";
      readonly selector?: "non-empty";
      readonly keys: readonly string[];
      readonly cases: Readonly<Record<string, readonly string[]>>;
    }
  | {
      readonly kind: "style";
      readonly key: string;
      readonly cases?: Readonly<
        Record<
          string,
          {
            readonly fill?: string;
            readonly stroke?: string;
            readonly color?: string;
          }
        >
      >;
      readonly valueField?: "fill" | "stroke" | "color";
      readonly whenStrokeSide?: "top" | "right" | "bottom" | "left";
    }
  | {
      readonly kind: "strokeSides";
      readonly key: string;
      readonly cases: Readonly<
        Record<
          string,
          {
            readonly strokeSides?: {
              readonly top?: number;
              readonly right?: number;
              readonly bottom?: number;
              readonly left?: number;
            };
            readonly strokeAlign?: "inside" | "center" | "outside";
            readonly stroke?: string;
            readonly strokeFrom?: string;
          }
        >
      >;
    };

export interface KitProp {
  readonly name: string;
  readonly type: KitPropType;
  readonly default: string | number | boolean;
  readonly values?: readonly string[];
  readonly targets: readonly KitPropTarget[];
  readonly effects?: readonly KitPropEffect[];
}

export interface KitComponent {
  readonly id: `ios:${string}`;
  readonly version: 1;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly fullWidth: boolean;
  readonly slots?: { readonly prefix: string; readonly count: number };
  readonly props: readonly KitProp[];
  build(
    editor: Editor,
    at: Vec,
  ): { readonly frame: Element; readonly children: readonly Element[] };
}
