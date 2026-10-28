// Breadboard element payloads and part metadata.

export const BREADBOARD_PITCH = 10;
export const BREADBOARD_ELEMENT_TYPES = [
  "breadboard.board",
  "breadboard.wire",
  "breadboard.resistor",
  "breadboard.led",
  "breadboard.capacitor",
  "breadboard.diode",
  "breadboard.transistor",
  "breadboard.button",
  "breadboard.potentiometer",
  "breadboard.ic",
  "breadboard.header",
  "breadboard.battery",
  "breadboard.netlist",
] as const;
export type BreadboardElementType = (typeof BREADBOARD_ELEMENT_TYPES)[number];
export const BREADBOARD_PART_TYPES = [
  "breadboard.resistor",
  "breadboard.led",
  "breadboard.capacitor",
  "breadboard.diode",
  "breadboard.transistor",
  "breadboard.button",
  "breadboard.potentiometer",
  "breadboard.ic",
  "breadboard.header",
  "breadboard.battery",
] as const;
export type BreadboardPartType = (typeof BREADBOARD_PART_TYPES)[number];
export function isBreadboardElementType(
  type: string,
): type is BreadboardElementType {
  return (BREADBOARD_ELEMENT_TYPES as readonly string[]).includes(type);
}
export function isBreadboardPartType(type: string): type is BreadboardPartType {
  return (BREADBOARD_PART_TYPES as readonly string[]).includes(type);
}

export const BREADBOARD_REFERENCE_PREFIX: Readonly<
  Record<BreadboardPartType, string>
> = {
  "breadboard.resistor": "R",
  "breadboard.led": "D",
  "breadboard.capacitor": "C",
  "breadboard.diode": "D",
  "breadboard.transistor": "Q",
  "breadboard.button": "SW",
  "breadboard.potentiometer": "RV",
  "breadboard.ic": "U",
  "breadboard.header": "J",
  "breadboard.battery": "BT",
};
export const BREADBOARD_BOARD_SIZES = ["full", "half", "mini"] as const;
export const BREADBOARD_WIRE_COLORS = [
  "red",
  "black",
  "blue",
  "green",
  "yellow",
  "orange",
  "white",
  "gray",
] as const;
export const BREADBOARD_LED_COLORS = [
  "red",
  "green",
  "yellow",
  "blue",
  "white",
  "orange",
] as const;
export const BREADBOARD_CAPACITOR_STYLES = ["ceramic", "electrolytic"] as const;
export const BREADBOARD_TRANSISTOR_POLARITIES = ["npn", "pnp"] as const;
export const BREADBOARD_TRANSISTOR_PINOUTS = [
  "EBC",
  "ECB",
  "BEC",
  "BCE",
  "CEB",
  "CBE",
] as const;
export const BREADBOARD_TOLERANCES = [
  0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20,
] as const;
export const BREADBOARD_NETLIST_FORMATS = ["kicad_sch", "kicad_net"] as const;

export interface BreadboardBoardSemantic {
  readonly size: (typeof BREADBOARD_BOARD_SIZES)[number];
}
export interface BreadboardWireSemantic {
  readonly color: (typeof BREADBOARD_WIRE_COLORS)[number];
  readonly points: readonly { readonly x: number; readonly y: number }[];
}
export interface BreadboardResistorSemantic {
  readonly reference: string;
  readonly value: string;
  readonly span: number;
  readonly bands: 4 | 5;
  readonly tolerance?: (typeof BREADBOARD_TOLERANCES)[number];
}
export interface BreadboardLedSemantic {
  readonly reference: string;
  readonly value: string;
  readonly color: (typeof BREADBOARD_LED_COLORS)[number];
}
export interface BreadboardCapacitorSemantic {
  readonly reference: string;
  readonly value: string;
  readonly style: (typeof BREADBOARD_CAPACITOR_STYLES)[number];
  readonly span: number;
}
export interface BreadboardDiodeSemantic {
  readonly reference: string;
  readonly value: string;
  readonly span: number;
}
export interface BreadboardTransistorSemantic {
  readonly reference: string;
  readonly value: string;
  readonly polarity: (typeof BREADBOARD_TRANSISTOR_POLARITIES)[number];
  readonly pinout: (typeof BREADBOARD_TRANSISTOR_PINOUTS)[number];
}
export interface BreadboardButtonSemantic {
  readonly reference: string;
  readonly value: string;
}
export interface BreadboardPotentiometerSemantic {
  readonly reference: string;
  readonly value: string;
}
export interface BreadboardIcSemantic {
  readonly reference: string;
  readonly value: string;
  readonly pinCount: number;
}
export interface BreadboardHeaderSemantic {
  readonly reference: string;
  readonly value: string;
  readonly pinCount: number;
}
export interface BreadboardBatterySemantic {
  readonly reference: string;
  readonly value: string;
}
export interface BreadboardNetlistSemantic {
  readonly source: string;
  readonly format: (typeof BREADBOARD_NETLIST_FORMATS)[number];
  readonly parts: readonly {
    readonly reference: string;
    readonly value: string;
    readonly type: BreadboardPartType;
  }[];
  readonly nets: readonly {
    readonly name: string;
    readonly nodes: readonly {
      readonly reference: string;
      readonly pin: number;
    }[];
  }[];
}
export type BreadboardPartSemantic =
  | BreadboardResistorSemantic
  | BreadboardLedSemantic
  | BreadboardCapacitorSemantic
  | BreadboardDiodeSemantic
  | BreadboardTransistorSemantic
  | BreadboardButtonSemantic
  | BreadboardPotentiometerSemantic
  | BreadboardIcSemantic
  | BreadboardHeaderSemantic
  | BreadboardBatterySemantic;
