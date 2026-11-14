// Which board layer a fabrication file holds: from its Gerber X2
// `.FileFunction` attribute when present, otherwise from file-name
// conventions (Protel extensions, KiCad layer names, Eagle extensions).

export type PcbLayerKind =
  | "copper"
  | "soldermask"
  | "silkscreen"
  | "paste"
  | "outline"
  | "drill"
  | "other";

export type PcbLayerSide = "top" | "bottom" | "inner" | "board";

export interface PcbLayerRole {
  readonly kind: PcbLayerKind;
  readonly side: PcbLayerSide;
  /** Inner copper layer number, 1 for the first inner layer. */
  readonly inner?: number;
}

const KIND_NAMES: Record<PcbLayerKind, string> = {
  copper: "copper",
  soldermask: "solder mask",
  silkscreen: "silkscreen",
  paste: "solder paste",
  outline: "board outline",
  drill: "drill",
  other: "layer",
};

/** A human name such as "Top copper" or "Inner copper 2". */
export function layerName(role: PcbLayerRole): string {
  const kind = KIND_NAMES[role.kind];
  switch (role.side) {
    case "top":
      return `Top ${kind}`;
    case "bottom":
      return `Bottom ${kind}`;
    case "inner":
      return `Inner ${kind} ${role.inner ?? ""}`.trimEnd();
    case "board":
      return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
}

function sideOf(value: string | undefined): PcbLayerSide | undefined {
  if (value === "Top") return "top";
  if (value === "Bot") return "bottom";
  if (value === "Inr") return "inner";
  return undefined;
}

function fromFileFunction(values: readonly string[]): PcbLayerRole | undefined {
  const [function_, first, second] = values;
  switch (function_) {
    case "Copper": {
      const side = sideOf(second) ?? "inner";
      const number = Number(/^L(\d+)$/.exec(first ?? "")?.[1]);
      return side === "inner" && Number.isFinite(number)
        ? { kind: "copper", side, inner: number - 1 }
        : { kind: "copper", side };
    }
    case "Soldermask":
      return { kind: "soldermask", side: sideOf(first) ?? "top" };
    case "Legend":
      return { kind: "silkscreen", side: sideOf(first) ?? "top" };
    case "Paste":
      return { kind: "paste", side: sideOf(first) ?? "top" };
    case "Profile":
      return { kind: "outline", side: "board" };
    case "Plated":
    case "NonPlated":
      return { kind: "drill", side: "board" };
    default:
      return undefined;
  }
}

const EXTENSIONS: Record<string, PcbLayerRole> = {
  gtl: { kind: "copper", side: "top" },
  gbl: { kind: "copper", side: "bottom" },
  gts: { kind: "soldermask", side: "top" },
  gbs: { kind: "soldermask", side: "bottom" },
  gto: { kind: "silkscreen", side: "top" },
  gbo: { kind: "silkscreen", side: "bottom" },
  gtp: { kind: "paste", side: "top" },
  gbp: { kind: "paste", side: "bottom" },
  gko: { kind: "outline", side: "board" },
  gm1: { kind: "outline", side: "board" },
  gml: { kind: "outline", side: "board" },
  gm: { kind: "outline", side: "board" },
  drl: { kind: "drill", side: "board" },
  xln: { kind: "drill", side: "board" },
  exc: { kind: "drill", side: "board" },
  cmp: { kind: "copper", side: "top" },
  sol: { kind: "copper", side: "bottom" },
  stc: { kind: "soldermask", side: "top" },
  sts: { kind: "soldermask", side: "bottom" },
  plc: { kind: "silkscreen", side: "top" },
  pls: { kind: "silkscreen", side: "bottom" },
  crc: { kind: "paste", side: "top" },
  crs: { kind: "paste", side: "bottom" },
};

const KICAD_NAMES: readonly (readonly [RegExp, PcbLayerRole])[] = [
  [/F[._]Cu$/i, { kind: "copper", side: "top" }],
  [/B[._]Cu$/i, { kind: "copper", side: "bottom" }],
  [/F[._]Mask$/i, { kind: "soldermask", side: "top" }],
  [/B[._]Mask$/i, { kind: "soldermask", side: "bottom" }],
  [/F[._]Silk(S|screen)$/i, { kind: "silkscreen", side: "top" }],
  [/B[._]Silk(S|screen)$/i, { kind: "silkscreen", side: "bottom" }],
  [/F[._]Paste$/i, { kind: "paste", side: "top" }],
  [/B[._]Paste$/i, { kind: "paste", side: "bottom" }],
  [/Edge[._]Cuts$/i, { kind: "outline", side: "board" }],
];

/**
 * The layer a file holds. `fileFunction` is the file's `.FileFunction`
 * attribute values, which take precedence over the name.
 */
export function identifyLayer(
  fileName: string,
  fileFunction?: readonly string[],
): PcbLayerRole {
  const attributed = fileFunction ? fromFileFunction(fileFunction) : undefined;
  if (attributed) return attributed;
  const base = fileName.split(/[\\/]/).at(-1) ?? fileName;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  const byExtension = EXTENSIONS[extension];
  if (byExtension) return byExtension;
  const inner = /^g(\d+)$/.exec(extension) ?? /In(\d+)[._]Cu$/i.exec(stem);
  if (inner?.[1])
    return { kind: "copper", side: "inner", inner: Number(inner[1]) };
  for (const [pattern, role] of KICAD_NAMES)
    if (pattern.test(stem)) return role;
  return { kind: "other", side: "board" };
}
