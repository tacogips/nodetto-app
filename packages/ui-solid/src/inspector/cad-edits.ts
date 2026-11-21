import type { Command } from "@nodetto/core";
import {
  type Element,
  type ElementId,
  getElementTypeDefinition,
  isCadTypeName,
  isPlainObject,
  roundNm,
} from "@nodetto/ir";

type Edit = Command | { error: string };
const unchanged = { error: "unchanged" } as const;
const invalidField = { error: "This parameter is unavailable." } as const;

function decimalMm(text: string): number | undefined {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text.trim()))
    return undefined;
  const value = roundNm(Number(text));
  return Number.isFinite(value) ? value : undefined;
}

function update(element: Element, semantic: Record<string, unknown>): Edit {
  const definition = getElementTypeDefinition(element.type);
  if (!definition) return invalidField;
  const issue = definition.validateSemantic(semantic, "semantic")[0];
  return issue
    ? { error: issue.message }
    : { type: "updateSemantic", id: element.id, semantic };
}

export function setCadNumber(
  element: Element,
  field: string,
  text: string,
): Edit {
  const { type, semantic } = element;
  if (!isPlainObject(semantic)) return invalidField;
  const value = decimalMm(text);
  if (value === undefined) return { error: "Enter a finite decimal length." };
  if (type === "cad.sketch" && field === "offset") {
    const plane = semantic.plane;
    if (!isPlainObject(plane) || typeof plane.base !== "string")
      return invalidField;
    if ((plane.offset ?? 0) === value) return unchanged;
    return update(element, { ...semantic, plane: { ...plane, offset: value } });
  }
  if (
    (type === "cad.circle" && field === "r") ||
    (type === "cad.extrude" && field === "distance")
  ) {
    return semantic[field] === value
      ? unchanged
      : update(element, { ...semantic, [field]: value });
  }
  return invalidField;
}

export function setCadPoint(
  element: Element,
  field: "a" | "b" | "m" | "c",
  axis: 0 | 1,
  text: string,
): Edit {
  const { type, semantic } = element;
  const supported =
    (type === "cad.circle" && field === "c") ||
    (type === "cad.arc" && field !== "c") ||
    (type === "cad.line" && (field === "a" || field === "b"));
  if (!supported || !isPlainObject(semantic)) return invalidField;
  const point = semantic[field];
  if (!Array.isArray(point) || point.length !== 2) return invalidField;
  const value = decimalMm(text);
  if (value === undefined) return { error: "Enter a finite decimal length." };
  if (point[axis] === value) return unchanged;
  return update(element, {
    ...semantic,
    [field]: axis === 0 ? [value, point[1]] : [point[0], value],
  });
}

export function setCadOperation(
  element: Element,
  op: string,
  bodies: readonly ElementId[],
): Edit {
  const { type, semantic } = element;
  if (type !== "cad.extrude" || !isPlainObject(semantic)) return invalidField;
  const { bodies: previous, ...rest } = semantic;
  const targets = op === "new" ? [] : [...new Set(bodies)];
  const existing = Array.isArray(previous) ? previous : [];
  if (
    op === semantic.op &&
    targets.length === existing.length &&
    targets.every((id, index) => id === existing[index])
  )
    return unchanged;
  return update(element, {
    ...rest,
    op,
    ...(targets.length ? { bodies: targets } : {}),
  });
}

export function setCadFlag(
  element: Element,
  field: "construction" | "symmetric" | "suppressed",
  checked: boolean,
): Edit {
  const { type, semantic } = element;
  const supported =
    field === "construction"
      ? type === "cad.line" || type === "cad.arc" || type === "cad.circle"
      : type === "cad.extrude" ||
        (field === "suppressed" && (type === "cad.pcb" || type === "cad.mesh"));
  if (!supported || !isCadTypeName(type) || !isPlainObject(semantic))
    return invalidField;
  if ((semantic[field] === true) === checked) return unchanged;
  return update(element, { ...semantic, [field]: checked });
}
