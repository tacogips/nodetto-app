import type { ConnectorEndpoints } from "@nodetto/core";

function samePoint(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number } | undefined,
): boolean {
  return a === b || Boolean(a && b && a.x === b.x && a.y === b.y);
}

/** Suppress SVG updates when another element's edit leaves this route intact. */
export function sameConnectorGeometry(
  a: ConnectorEndpoints | null,
  b: ConnectorEndpoints | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const samePoints = (
    left: readonly { x: number; y: number }[] | undefined,
    right: readonly { x: number; y: number }[] | undefined,
  ) =>
    left === right ||
    Boolean(
      left &&
        right &&
        left.length === right.length &&
        left.every((point, i) => samePoint(point, right[i])),
    );
  return (
    samePoint(a.start, b.start) &&
    samePoint(a.end, b.end) &&
    samePoint(a.labelPoint, b.labelPoint) &&
    samePoint(a.bendPoint, b.bendPoint) &&
    a.bendAxis === b.bendAxis &&
    samePoints(a.points, b.points) &&
    samePoints(a.waypointPoints, b.waypointPoints) &&
    samePoint(a.fromBox, b.fromBox) &&
    a.fromBox.width === b.fromBox.width &&
    a.fromBox.height === b.fromBox.height &&
    samePoint(a.toBox, b.toBox) &&
    a.toBox.width === b.toBox.width &&
    a.toBox.height === b.toBox.height
  );
}
