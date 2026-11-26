// Schematic element payloads and part metadata.

export const SCHEMATIC_PITCH = 10;
export const SCHEMATIC_COORDINATE_LIMIT = 1e9;
export const SCHEMATIC_ELEMENT_TYPES = [
  "schematic.resistor",
  "schematic.capacitor",
  "schematic.inductor",
  "schematic.diode",
  "schematic.led",
  "schematic.bjt",
  "schematic.mosfet",
  "schematic.switch",
  "schematic.potentiometer",
  "schematic.battery",
  "schematic.voltageSource",
  "schematic.connector",
  "schematic.ic",
  "schematic.power",
  "schematic.wire",
  "schematic.junction",
  "schematic.label",
  "schematic.noConnect",
] as const;
export type SchematicElementType = (typeof SCHEMATIC_ELEMENT_TYPES)[number];
export const SCHEMATIC_PART_TYPES = [
  "schematic.resistor",
  "schematic.capacitor",
  "schematic.inductor",
  "schematic.diode",
  "schematic.led",
  "schematic.bjt",
  "schematic.mosfet",
  "schematic.switch",
  "schematic.potentiometer",
  "schematic.battery",
  "schematic.voltageSource",
  "schematic.connector",
  "schematic.ic",
] as const;
export type SchematicPartType = (typeof SCHEMATIC_PART_TYPES)[number];
export function isSchematicElementType(
  type: string,
): type is SchematicElementType {
  return (SCHEMATIC_ELEMENT_TYPES as readonly string[]).includes(type);
}
export function isSchematicPartType(type: string): type is SchematicPartType {
  return (SCHEMATIC_PART_TYPES as readonly string[]).includes(type);
}

export const SCHEMATIC_REFERENCE_PREFIX: Readonly<
  Record<SchematicPartType, string>
> = {
  "schematic.resistor": "R",
  "schematic.capacitor": "C",
  "schematic.inductor": "L",
  "schematic.diode": "D",
  "schematic.led": "D",
  "schematic.bjt": "Q",
  "schematic.mosfet": "Q",
  "schematic.switch": "SW",
  "schematic.potentiometer": "RV",
  "schematic.battery": "BT",
  "schematic.voltageSource": "V",
  "schematic.connector": "J",
  "schematic.ic": "U",
};
export const SCHEMATIC_BJT_POLARITIES = ["npn", "pnp"] as const;
export const SCHEMATIC_MOSFET_CHANNELS = ["n", "p"] as const;
export const SCHEMATIC_SWITCH_STYLES = ["toggle", "push"] as const;
export const SCHEMATIC_POWER_STYLES = ["ground", "rail"] as const;
export const SCHEMATIC_IC_SIDES = ["left", "right", "top", "bottom"] as const;
export const SCHEMATIC_CONNECTOR_MAX_PINS = 40;
export const SCHEMATIC_IC_MAX_PINS = 256;

export interface SchematicPartBaseSemantic {
  readonly reference: string;
  readonly value: string;
}
export interface SchematicResistorSemantic extends SchematicPartBaseSemantic {}
export interface SchematicCapacitorSemantic extends SchematicPartBaseSemantic {
  readonly polarized: boolean;
}
export interface SchematicInductorSemantic extends SchematicPartBaseSemantic {}
export interface SchematicDiodeSemantic extends SchematicPartBaseSemantic {}
export interface SchematicLedSemantic extends SchematicPartBaseSemantic {}
export interface SchematicBjtSemantic extends SchematicPartBaseSemantic {
  readonly polarity: (typeof SCHEMATIC_BJT_POLARITIES)[number];
}
export interface SchematicMosfetSemantic extends SchematicPartBaseSemantic {
  readonly channel: (typeof SCHEMATIC_MOSFET_CHANNELS)[number];
}
export interface SchematicSwitchSemantic extends SchematicPartBaseSemantic {
  readonly style: (typeof SCHEMATIC_SWITCH_STYLES)[number];
}
export interface SchematicPotentiometerSemantic
  extends SchematicPartBaseSemantic {}
export interface SchematicBatterySemantic extends SchematicPartBaseSemantic {}
export interface SchematicVoltageSourceSemantic
  extends SchematicPartBaseSemantic {}
export interface SchematicConnectorSemantic extends SchematicPartBaseSemantic {
  readonly pinCount: number;
}
export interface SchematicIcSemantic extends SchematicPartBaseSemantic {
  readonly pins: readonly {
    readonly number: number;
    readonly name: string;
    readonly side: (typeof SCHEMATIC_IC_SIDES)[number];
  }[];
}
export type SchematicPartSemantic =
  | SchematicResistorSemantic
  | SchematicCapacitorSemantic
  | SchematicInductorSemantic
  | SchematicDiodeSemantic
  | SchematicLedSemantic
  | SchematicBjtSemantic
  | SchematicMosfetSemantic
  | SchematicSwitchSemantic
  | SchematicPotentiometerSemantic
  | SchematicBatterySemantic
  | SchematicVoltageSourceSemantic
  | SchematicConnectorSemantic
  | SchematicIcSemantic;
export interface SchematicPowerSemantic {
  readonly style: (typeof SCHEMATIC_POWER_STYLES)[number];
  readonly net: string;
}
export interface SchematicWireSemantic {
  readonly points: readonly { readonly x: number; readonly y: number }[];
}
export type SchematicJunctionSemantic = Readonly<Record<string, never>>;
export interface SchematicLabelSemantic {
  readonly net: string;
}
export type SchematicNoConnectSemantic = Readonly<Record<string, never>>;
