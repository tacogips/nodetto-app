import {
  BREADBOARD_LED_COLORS,
  isBreadboardPartType,
  type BreadboardImportDiagnostic,
  type BreadboardPartType,
} from "@nodetto/ir";

export interface KicadSymbolInput {
  readonly lib: string;
  readonly name: string;
  readonly reference: string;
  readonly value: string;
  readonly pins: readonly { readonly number: string; readonly name?: string }[];
  readonly footprint?: string;
}
export type KicadSymbolMapping =
  | {
      readonly kind: "part";
      readonly type: BreadboardPartType;
      readonly parameters: Record<string, unknown>;
      readonly pinMap: ReadonlyMap<string, number>;
      readonly diagnostics: BreadboardImportDiagnostic[];
    }
  | {
      readonly kind: "skip";
      readonly diagnostics: BreadboardImportDiagnostic[];
    };

const warn = (
  code: string,
  reference: string,
  message: string,
): BreadboardImportDiagnostic => ({
  severity: "warning",
  code,
  reference,
  message,
});
const distinctPins = (pins: KicadSymbolInput["pins"]) => [
  ...new Set(pins.map((pin) => pin.number)),
];
// Catalogue part names (design 3.4) that do not lower-case to a type name.
const CATALOGUE_PART_TYPES: Readonly<Record<string, BreadboardPartType>> = {
  CapacitorPolarized: "breadboard.capacitor",
  TransistorNPN: "breadboard.transistor",
  TransistorPNP: "breadboard.transistor",
  PushButton: "breadboard.button",
  DIP: "breadboard.ic",
};
const refPrefix = (reference: string) =>
  reference.match(/^[A-Za-z]+/)?.[0] ?? "";
const identity = (numbers: readonly string[]) =>
  new Map(
    numbers.flatMap((number) =>
      /^[1-9]\d*$/.test(number) ? [[number, Number(number)] as const] : [],
    ),
  );
const params = (
  type: BreadboardPartType,
  count: number,
  value: string,
  footprint?: string,
  symbolName = "",
) => {
  switch (type) {
    case "breadboard.resistor": {
      const span = footprint?.match(/Resistor_P(\d+)/)?.[1];
      return { span: span ? Number(span) : 4, bands: 4 };
    }
    case "breadboard.led":
      return {
        color: BREADBOARD_LED_COLORS.includes(
          value.toLowerCase() as (typeof BREADBOARD_LED_COLORS)[number],
        )
          ? value.toLowerCase()
          : "red",
      };
    case "breadboard.capacitor":
      return {
        style:
          symbolName.startsWith("C_Polarized") ||
          symbolName === "CP" ||
          symbolName.startsWith("CP_") ||
          symbolName === "CapacitorPolarized"
            ? "electrolytic"
            : "ceramic",
        span: 1,
      };
    case "breadboard.diode":
      return { span: 4 };
    case "breadboard.transistor":
      return {
        polarity: /PNP/.test(symbolName) || /PNP/.test(value) ? "pnp" : "npn",
        pinout: "EBC",
      };
    case "breadboard.ic":
      return { pinCount: count };
    case "breadboard.header":
      return { pinCount: count };
    default:
      return {};
  }
};

export function mapKicadSymbol(input: KicadSymbolInput): KicadSymbolMapping {
  const diagnostics: BreadboardImportDiagnostic[] = [];
  const pins = distinctPins(input.pins);
  const count = pins.length;
  const prefix = refPrefix(input.reference);
  const name = input.name;
  let type: BreadboardPartType | undefined;
  let missingNames = false;
  let matched = false;
  let unsupported = false;

  const catalogueType =
    CATALOGUE_PART_TYPES[name] ??
    (name.toLowerCase().startsWith("breadboard.")
      ? name.toLowerCase()
      : `breadboard.${name.toLowerCase()}`);
  if (input.lib === "nodetto" && isBreadboardPartType(catalogueType)) {
    type = catalogueType as BreadboardPartType;
    matched = true;
  } else if (name.startsWith("R_Potentiometer")) {
    type = "breadboard.potentiometer";
    matched = true;
    if (count !== 3) unsupported = true;
  } else if (name === "R" || name.startsWith("R_")) {
    type = "breadboard.resistor";
    matched = true;
    if (count !== 2) unsupported = true;
  } else if (
    name.startsWith("C_Polarized") ||
    name === "CP" ||
    name.startsWith("CP_")
  ) {
    type = "breadboard.capacitor";
    matched = true;
    if (count !== 2) unsupported = true;
  } else if (name === "C" || name.startsWith("C_")) {
    type = "breadboard.capacitor";
    matched = true;
    if (count !== 2) unsupported = true;
  } else if (name.startsWith("LED")) {
    type = "breadboard.led";
    matched = true;
    if (count !== 2) unsupported = true;
  } else if (name === "D" || name.startsWith("D_")) {
    type = "breadboard.diode";
    matched = true;
    if (count !== 2) unsupported = true;
  } else if (name.includes("NPN") || name.includes("PNP")) {
    type = "breadboard.transistor";
    matched = true;
    if (count !== 3) unsupported = true;
  } else if (name.startsWith("SW_Push")) {
    type = "breadboard.button";
    matched = true;
    if (count !== 2) unsupported = true;
  } else if (name.startsWith("Conn_")) {
    type = "breadboard.header";
    matched = true;
    if (count < 1 || count > 40) unsupported = true;
  } else if (name.startsWith("Battery")) {
    type = "breadboard.battery";
    matched = true;
    if (count !== 2) unsupported = true;
  } else if (name.includes("DIP") || prefix === "U") {
    type = "breadboard.ic";
    matched = true;
    if (count < 4 || count > 40 || count % 2 !== 0) unsupported = true;
  } else if (
    ["R", "RV", "C", "D", "Q", "SW", "J", "P", "BT"].includes(prefix)
  ) {
    matched = true;
    type =
      prefix === "RV"
        ? "breadboard.potentiometer"
        : ["R", "C", "D", "Q", "SW", "J", "P", "BT"].includes(prefix)
          ? (
              {
                R: "breadboard.resistor",
                C: "breadboard.capacitor",
                D: "breadboard.diode",
                Q: "breadboard.transistor",
                SW: "breadboard.button",
                J: "breadboard.header",
                P: "breadboard.header",
                BT: "breadboard.battery",
              } as const
            )[prefix as "R" | "C" | "D" | "Q" | "SW" | "J" | "P" | "BT"]
          : undefined;
    if (
      type === "breadboard.resistor" ||
      type === "breadboard.diode" ||
      type === "breadboard.capacitor" ||
      type === "breadboard.battery"
    )
      unsupported = count !== 2;
    else if (type === "breadboard.potentiometer") unsupported = count !== 3;
    else if (type === "breadboard.transistor") {
      unsupported = count !== 3;
      missingNames = true;
    } else if (type === "breadboard.button") unsupported = count !== 2;
    else if (type === "breadboard.header")
      unsupported = count < 1 || count > 40;
  }

  if (matched && unsupported) {
    type = undefined;
    diagnostics.push(
      warn(
        "kicad.unsupportedSymbol",
        input.reference,
        `Unsupported pin count for '${name}'.`,
      ),
    );
  }
  if (!type) {
    if (count < 1 || count > 40) {
      diagnostics.push(
        warn(
          "kicad.skippedSymbol",
          input.reference,
          `Symbol '${name}' has no supported pin count.`,
        ),
      );
      return { kind: "skip", diagnostics };
    }
    type =
      count >= 4 && count <= 40 && count % 2 === 0
        ? "breadboard.ic"
        : "breadboard.header";
    if (!unsupported)
      diagnostics.push(
        warn(
          "kicad.unsupportedSymbol",
          input.reference,
          `Symbol '${name}' is mapped to a generic part.`,
        ),
      );
  }

  let pinMap = identity(pins);
  const named = new Map(
    input.pins
      .filter((pin) => pin.name)
      .map((pin) => [pin.name as string, pin.number]),
  );
  if (type === "breadboard.button" && name.startsWith("SW_Push") && count === 2)
    pinMap = new Map([
      [pins[0], 1],
      [pins[1], 3],
    ]);
  if (type === "breadboard.led" || type === "breadboard.diode") {
    const a = named.get("A");
    const k = named.get("K");
    if (a && k)
      pinMap = new Map([
        [a, 1],
        [k, 2],
      ]);
    else missingNames = true;
  }
  if (
    (type === "breadboard.capacitor" &&
      (name.startsWith("C_Polarized") ||
        name === "CP" ||
        name.startsWith("CP_"))) ||
    type === "breadboard.battery"
  ) {
    const positive = named.get("+");
    const negative = named.get("-");
    if (positive && negative)
      pinMap = new Map([
        [positive, 1],
        [negative, 2],
      ]);
  }
  if (type === "breadboard.transistor") {
    const numbered = ["1", "2", "3"].map(
      (number) => input.pins.find((pin) => pin.number === number)?.name,
    );
    const pinout = numbered.join("");
    if (["EBC", "ECB", "BEC", "BCE", "CEB", "CBE"].includes(pinout)) {
    } else missingNames = true;
  }
  if (missingNames)
    diagnostics.push(
      warn(
        "kicad.pinNamesMissing",
        input.reference,
        "Pin names are incomplete; numbered pin order was used.",
      ),
    );
  const parameters = params(type, count, input.value, input.footprint, name);
  if (type === "breadboard.transistor") {
    const pinout = ["1", "2", "3"]
      .map((number) => input.pins.find((pin) => pin.number === number)?.name)
      .join("");
    if (["EBC", "ECB", "BEC", "BCE", "CEB", "CBE"].includes(pinout))
      parameters.pinout = pinout;
  }
  if (type === "breadboard.transistor" && name.includes("PNP"))
    parameters.polarity = "pnp";
  return { kind: "part", type, parameters, pinMap, diagnostics };
}
