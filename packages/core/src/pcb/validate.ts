export interface FabricationOutline {
  readonly width: number;
  readonly height: number;
}

interface Aperture {
  readonly kind: "circle" | "rectangle";
  readonly width: number;
  readonly height: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Segment {
  readonly start: Point;
  readonly end: Point;
  readonly halfWidth: number;
  readonly line: number;
}

interface Opening {
  readonly at: Point;
  readonly aperture: Aperture;
  readonly line: number;
}

function lineErrors(text: string): { lines: string[]; errors: string[] } {
  const errors: string[] = [];
  if (text.includes("\r")) errors.push("file: carriage return is not allowed");
  if (!text.endsWith("\n")) errors.push("file: final newline is required");
  const lines = text.split("\n");
  if (text.endsWith("\n")) lines.pop();
  for (const [index, line] of lines.entries()) {
    if (line === "")
      errors.push(`line ${index + 1}: empty lines are not allowed`);
  }
  return { lines, errors };
}

function parseAperture(template: string): Aperture | undefined {
  const circle = /^C,(?<diameter>\d+\.\d+)$/.exec(template)?.groups;
  if (circle?.diameter !== undefined) {
    const diameter = Number(circle.diameter);
    if (diameter > 0)
      return { kind: "circle", width: diameter, height: diameter };
    return undefined;
  }
  const rectangle = /^R,(?<width>\d+\.\d+)X(?<height>\d+\.\d+)$/.exec(
    template,
  )?.groups;
  if (rectangle?.width !== undefined && rectangle.height !== undefined) {
    const width = Number(rectangle.width);
    const height = Number(rectangle.height);
    if (width > 0 && height > 0) return { kind: "rectangle", width, height };
  }
  return undefined;
}

function coordinatePoint(
  match: RegExpExecArray,
  line: number,
  errors: string[],
): Point | undefined {
  const groups = match.groups;
  const xText = groups?.x;
  const yText = groups?.y;
  if (xText === undefined || yText === undefined) return undefined;
  if (
    xText.replace(/^-/, "").length > 10 ||
    yText.replace(/^-/, "").length > 10
  ) {
    errors.push(`line ${line}: coordinate exceeds 4.6 format`);
    return undefined;
  }
  return { x: Number(xText), y: Number(yText) };
}

export function validateGerber(
  text: string,
  outline: FabricationOutline,
): readonly string[] {
  if (text.includes("\r")) return ["file: carriage return is not allowed"];
  const { lines, errors } = lineErrors(text);
  const apertures = new Map<number, Aperture>();
  const seenAttributes = new Map<string, number>();
  let seenFormat = 0;
  let seenUnits = 0;
  let seenPolarity = 0;
  let seenFunction = 0;
  let firstAperture = Number.POSITIVE_INFINITY;
  let currentAperture: number | undefined;
  let hasLinearInterpolation = false;
  let hasCurrentPoint = false;
  let terminationCount = 0;
  let lastNonempty = 0;
  const maxX = Math.round(outline.width * 1_000_000);
  const maxY = Math.round(outline.height * 1_000_000);

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    if (line === "") continue;
    lastNonempty = lineNumber;
    if (line.startsWith("%")) {
      const extended = /^%(?<body>[^%*]+)\*%$/.exec(line)?.groups;
      const body = extended?.body;
      if (body === undefined) {
        errors.push(`line ${lineNumber}: malformed extended command`);
        continue;
      }
      const attr = /^(?<key>TF\.[^,]+),(?<value>[^*%]+)$/.exec(body)?.groups;
      if (attr?.key !== undefined) {
        if (attr.key === "TF.FileFunction") seenFunction += 1;
        if (attr.key === "TF.FilePolarity") seenPolarity += 1;
        seenAttributes.set(attr.key, (seenAttributes.get(attr.key) ?? 0) + 1);
        if (firstAperture !== Number.POSITIVE_INFINITY)
          errors.push(
            `line ${lineNumber}: file attribute after aperture definition`,
          );
        continue;
      }
      if (body === "FSLAX46Y46") {
        seenFormat += 1;
        if (firstAperture !== Number.POSITIVE_INFINITY)
          errors.push(`line ${lineNumber}: format after aperture definition`);
        continue;
      }
      if (body === "MOMM") {
        seenUnits += 1;
        if (firstAperture !== Number.POSITIVE_INFINITY)
          errors.push(`line ${lineNumber}: units after aperture definition`);
        continue;
      }
      if (body === "LPD") {
        continue;
      }
      const definition =
        /^ADD(?<code>\d+)(?<template>C,\d+\.\d+|R,\d+\.\d+X\d+\.\d+)$/.exec(
          body,
        )?.groups;
      if (definition?.code !== undefined && definition.template !== undefined) {
        const code = Number(definition.code);
        const aperture = parseAperture(definition.template);
        firstAperture = Math.min(firstAperture, lineNumber);
        if (code < 10)
          errors.push(`line ${lineNumber}: aperture code must be at least D10`);
        if (apertures.has(code))
          errors.push(`line ${lineNumber}: duplicate aperture D${code}`);
        if (aperture === undefined)
          errors.push(`line ${lineNumber}: invalid aperture dimensions`);
        else if (code >= 10 && !apertures.has(code))
          apertures.set(code, aperture);
        continue;
      }
      errors.push(`line ${lineNumber}: unsupported extended command`);
      continue;
    }

    if (line === "G01*") {
      hasLinearInterpolation = true;
      continue;
    }
    if (line === "M02*") {
      terminationCount += 1;
      continue;
    }
    const select = /^D(?<code>\d+)\*$/.exec(line)?.groups;
    if (select?.code !== undefined) {
      const code = Number(select.code);
      if (code < 10)
        errors.push(`line ${lineNumber}: aperture select must be at least D10`);
      if (!apertures.has(code))
        errors.push(`line ${lineNumber}: undefined aperture D${code}`);
      else currentAperture = code;
      continue;
    }
    const operation = /^X(?<x>-?\d+)Y(?<y>-?\d+)D0(?<op>[123])\*$/.exec(line);
    if (operation !== null) {
      const point = coordinatePoint(operation, lineNumber, errors);
      if (
        point !== undefined &&
        (point.x < 0 || point.x > maxX || point.y < 0 || point.y > maxY)
      )
        errors.push(`line ${lineNumber}: coordinate outside outline`);
      const op = operation.groups?.op;
      if ((op === "1" || op === "3") && currentAperture === undefined)
        errors.push(`line ${lineNumber}: aperture required before D0${op}`);
      if (op === "1" && !hasLinearInterpolation)
        errors.push(`line ${lineNumber}: G01 required before D01`);
      if (op === "1" && !hasCurrentPoint)
        errors.push(`line ${lineNumber}: current point required before D01`);
      if (point !== undefined) hasCurrentPoint = true;
      continue;
    }
    errors.push(`line ${lineNumber}: unsupported data block`);
  }

  for (const key of ["TF.FileFunction", "TF.FilePolarity"] as const) {
    if ((seenAttributes.get(key) ?? 0) !== 1)
      errors.push(`file: ${key} must appear exactly once`);
  }
  if (seenFormat !== 1)
    errors.push("file: FSLAX46Y46 must appear exactly once");
  if (seenUnits !== 1) errors.push("file: MOMM must appear exactly once");
  for (const [index, line] of lines.entries()) {
    if (line.startsWith("%ADD") && index + 1 < firstAperture) continue;
    if (
      (line.startsWith("%TF.") ||
        line === "%FSLAX46Y46*%" ||
        line === "%MOMM*%") &&
      index + 1 > firstAperture
    )
      errors.push(
        `line ${index + 1}: required header command after aperture definition`,
      );
  }
  if (terminationCount !== 1) errors.push("file: M02 must appear exactly once");
  if (terminationCount === 1 && lines[lastNonempty - 1] !== "M02*")
    errors.push(`line ${lastNonempty}: M02 must be the last non-empty line`);
  return errors;
}

export function validateExcellon(
  text: string,
  outline: FabricationOutline,
): readonly string[] {
  if (text.includes("\r")) return ["file: carriage return is not allowed"];
  const { lines, errors } = lineErrors(text);
  const tools = new Set<number>();
  const first = lines[0];
  if (first !== "M48") return ["line 1: expected M48 header"];
  let bodyStart = -1;
  let metricCount = 0;
  let terminationCount = 0;
  let selectedTool: number | undefined;
  let lastNonempty = 0;
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    if (line === "") continue;
    lastNonempty = lineNumber;
    if (bodyStart < 0) {
      if (line === "%") {
        bodyStart = index + 1;
        continue;
      }
      if (line.startsWith(";") || line === "M48" || line === "FMAT,2") continue;
      if (line === "METRIC") {
        metricCount += 1;
        continue;
      }
      const tool = /^T(?<tool>\d+)C(?<diameter>\d+\.\d+)$/.exec(line)?.groups;
      if (tool?.tool !== undefined && tool.diameter !== undefined) {
        const number = Number(tool.tool);
        if (tools.has(number))
          errors.push(`line ${lineNumber}: duplicate tool T${number}`);
        else tools.add(number);
        continue;
      }
      errors.push(`line ${lineNumber}: invalid Excellon header line`);
      continue;
    }

    if (line === "M30") {
      terminationCount += 1;
      continue;
    }
    if (line === "G90" || line === "G05") continue;
    const selected = /^T(?<tool>\d+)$/.exec(line)?.groups;
    if (selected?.tool !== undefined) {
      const number = Number(selected.tool);
      if (!tools.has(number))
        errors.push(`line ${lineNumber}: undefined tool T${number}`);
      else selectedTool = number;
      continue;
    }
    const hit = /^X(?<x>-?\d+\.\d+)Y(?<y>-?\d+\.\d+)$/.exec(line);
    if (hit !== null) {
      const xText = hit.groups?.x;
      const yText = hit.groups?.y;
      if (selectedTool === undefined)
        errors.push(`line ${lineNumber}: tool select required before hit`);
      if (xText !== undefined && yText !== undefined) {
        const x = Number(xText);
        const y = Number(yText);
        if (
          x < -1e-9 ||
          x > outline.width + 1e-9 ||
          y < -1e-9 ||
          y > outline.height + 1e-9
        )
          errors.push(`line ${lineNumber}: coordinate outside outline`);
      }
      continue;
    }
    errors.push(`line ${lineNumber}: invalid Excellon body line`);
  }
  if (bodyStart < 0) errors.push("file: missing % header terminator");
  if (metricCount === 0) errors.push("file: METRIC units required");
  if (terminationCount !== 1) errors.push("file: M30 must appear exactly once");
  if (terminationCount === 1 && lines[lastNonempty - 1] !== "M30")
    errors.push(`line ${lastNonempty}: M30 must be the last non-empty line`);
  return errors;
}

function pointSegmentDistance(point: Point, segment: Segment): number {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    const px = point.x - segment.start.x;
    const py = point.y - segment.start.y;
    return Math.sqrt(px * px + py * py);
  }
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) /
        lengthSquared,
    ),
  );
  const px = point.x - (segment.start.x + projection * dx);
  const py = point.y - (segment.start.y + projection * dy);
  return Math.sqrt(px * px + py * py);
}

function segmentIntersectsRectangle(
  segment: Segment,
  left: number,
  bottom: number,
  right: number,
  top: number,
): boolean {
  let lower = 0;
  let upper = 1;
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const bounds = [
    { p: -dx, q: segment.start.x - left },
    { p: dx, q: right - segment.start.x },
    { p: -dy, q: segment.start.y - bottom },
    { p: dy, q: top - segment.start.y },
  ];
  for (const bound of bounds) {
    if (bound.p === 0) {
      if (bound.q < 0) return false;
      continue;
    }
    const ratio = bound.q / bound.p;
    if (bound.p < 0) lower = Math.max(lower, ratio);
    else upper = Math.min(upper, ratio);
    if (lower > upper) return false;
  }
  return true;
}

function pointRectangleDistance(
  point: Point,
  left: number,
  bottom: number,
  right: number,
  top: number,
): number {
  const dx = Math.max(left - point.x, 0, point.x - right);
  const dy = Math.max(bottom - point.y, 0, point.y - top);
  return Math.sqrt(dx * dx + dy * dy);
}

function segmentRectangleDistance(segment: Segment, opening: Opening): number {
  const { at, aperture } = opening;
  const left = at.x - aperture.width / 2;
  const right = at.x + aperture.width / 2;
  const bottom = at.y - aperture.height / 2;
  const top = at.y + aperture.height / 2;
  if (segmentIntersectsRectangle(segment, left, bottom, right, top)) return 0;
  const corners = [
    { x: left, y: bottom },
    { x: left, y: top },
    { x: right, y: bottom },
    { x: right, y: top },
  ];
  let distance = Number.POSITIVE_INFINITY;
  for (const corner of corners)
    distance = Math.min(distance, pointSegmentDistance(corner, segment));
  distance = Math.min(
    distance,
    pointRectangleDistance(segment.start, left, bottom, right, top),
    pointRectangleDistance(segment.end, left, bottom, right, top),
  );
  return distance;
}

function parseGerberGeometry(text: string): {
  readonly apertures: Map<number, Aperture>;
  readonly operations: { line: number; code: number; at: Point }[];
} {
  const apertures = new Map<number, Aperture>();
  const operations: { line: number; code: number; at: Point }[] = [];
  for (const [index, line] of text.split("\n").entries()) {
    const definition =
      /^%ADD(?<code>\d+)(?<template>C,\d+\.\d+|R,\d+\.\d+X\d+\.\d+)\*%$/.exec(
        line,
      )?.groups;
    if (definition?.code !== undefined && definition.template !== undefined) {
      const aperture = parseAperture(definition.template);
      if (aperture !== undefined)
        apertures.set(Number(definition.code), aperture);
      continue;
    }
    const select = /^D(?<code>\d+)\*$/.exec(line)?.groups;
    if (select?.code !== undefined) {
      operations.push({
        line: index + 1,
        code: Number(select.code),
        at: { x: Number.NaN, y: Number.NaN },
      });
      continue;
    }
    const operation = /^X(?<x>-?\d+)Y(?<y>-?\d+)D0(?<op>[123])\*$/.exec(
      line,
    )?.groups;
    if (
      operation?.x !== undefined &&
      operation.y !== undefined &&
      operation.op !== undefined
    )
      operations.push({
        line: index + 1,
        code: Number(operation.op),
        at: { x: Number(operation.x) / 1e6, y: Number(operation.y) / 1e6 },
      });
  }
  return { apertures, operations };
}

export function legendClearanceErrors(input: {
  readonly gto: string;
  readonly gts: string;
  readonly outline: FabricationOutline;
  readonly padClearance: number;
  readonly edgeClearance: number;
  readonly tolerance?: number;
}): readonly string[] {
  const tolerance = input.tolerance ?? 1e-5;
  // A missing rule must not turn every comparison against NaN into a pass.
  for (const [name, value] of Object.entries({
    padClearance: input.padClearance,
    edgeClearance: input.edgeClearance,
    tolerance,
  }))
    if (!Number.isFinite(value))
      throw new Error(`legendClearanceErrors: ${name} must be a finite number`);
  const errors: string[] = [];
  const mask = parseGerberGeometry(input.gts);
  const maskFlashes: Opening[] = [];
  let maskAperture: Aperture | undefined;
  for (const operation of mask.operations) {
    if (operation.code >= 10) maskAperture = mask.apertures.get(operation.code);
    else if (operation.code === 3 && maskAperture !== undefined)
      maskFlashes.push({
        at: operation.at,
        aperture: maskAperture,
        line: operation.line,
      });
  }

  const legend = parseGerberGeometry(input.gto);
  const segments: Segment[] = [];
  let currentAperture: Aperture | undefined;
  let currentPoint: Point | undefined;
  for (const operation of legend.operations) {
    if (operation.code >= 10) {
      currentAperture = legend.apertures.get(operation.code);
      continue;
    }
    if (operation.code === 3) {
      errors.push(`line ${operation.line}: unexpected flash`);
      continue;
    }
    if (operation.code === 2) {
      currentPoint = operation.at;
      continue;
    }
    if (operation.code === 1) {
      if (currentAperture === undefined || currentPoint === undefined) continue;
      if (currentAperture.kind !== "circle") continue;
      segments.push({
        start: currentPoint,
        end: operation.at,
        halfWidth: currentAperture.width / 2,
        line: operation.line,
      });
      currentPoint = operation.at;
    }
  }

  for (const segment of segments) {
    for (const opening of maskFlashes) {
      const distance =
        opening.aperture.kind === "circle"
          ? pointSegmentDistance(opening.at, segment) -
            opening.aperture.width / 2
          : segmentRectangleDistance(segment, opening);
      const clearance = distance - segment.halfWidth;
      if (clearance < input.padClearance - tolerance)
        errors.push(
          `line ${segment.line}: opening at (${opening.at.x.toFixed(4)}, ${opening.at.y.toFixed(4)}) clearance ${clearance.toFixed(4)} mm`,
        );
    }
    const { start, end, halfWidth, line } = segment;
    const points = [start, end];
    for (const point of points) {
      if (
        point.x - halfWidth < input.edgeClearance - tolerance ||
        input.outline.width - point.x - halfWidth <
          input.edgeClearance - tolerance ||
        point.y - halfWidth < input.edgeClearance - tolerance ||
        input.outline.height - point.y - halfWidth <
          input.edgeClearance - tolerance
      )
        errors.push(`line ${line}: stroke violates board edge clearance`);
    }
  }
  return errors;
}
