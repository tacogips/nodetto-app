import {
  coordinateKey,
  roundCoordinate,
  type Element,
  type SchematicWireSemantic,
} from "@nodetto/ir";
import type { SchematicPagePin } from "./symbols.ts";

export interface KeyPoint {
  readonly kx: number;
  readonly ky: number;
}

export function keyCoordinate(k: number): number {
  return roundCoordinate(k * 0.01);
}
export function localCoordinateForKey(k: number, originField: number): number {
  return keyCoordinate(k - coordinateKey(originField));
}

export function shiftedTarget(origin: number, sharedDelta: number): number {
  return roundCoordinate(
    roundCoordinate(origin) + roundCoordinate(sharedDelta),
  );
}
export function canonicalTarget(value: number): number {
  return roundCoordinate(value);
}
export function pinKey(element: Element, pin: SchematicPagePin): KeyPoint {
  const x = element.visual.x ?? 0;
  const y = element.visual.y ?? 0;
  return {
    kx: coordinateKey(x) + Math.round((pin.x - x) * 100),
    ky: coordinateKey(y) + Math.round((pin.y - y) * 100),
  };
}
export function wirePointKeys(element: Element): readonly KeyPoint[] {
  const { points } = element.semantic as SchematicWireSemantic;
  const x = coordinateKey(element.visual.x ?? 0);
  const y = coordinateKey(element.visual.y ?? 0);
  return points.map((point) => ({
    kx: x + coordinateKey(point.x),
    ky: y + coordinateKey(point.y),
  }));
}
export function pointElementKey(element: Element): KeyPoint {
  return {
    kx: coordinateKey(element.visual.x ?? 0),
    ky: coordinateKey(element.visual.y ?? 0),
  };
}
