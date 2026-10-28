// Report types, mxGraph XML builders and value readers shared by the
// draw.io export modules.

import type { XmlElement } from "../bpmn/xml.ts";

export interface DrawioExportWarning {
  readonly elementId?: string;
  readonly message: string;
}

export interface DrawioExportReport {
  readonly xml: string;
  readonly warnings: readonly DrawioExportWarning[];
}

export interface DrawioExportOptions {
  /** Export only these pages; all pages when omitted. */
  readonly pageIds?: readonly string[];
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type Entry = readonly [string, string | number | undefined];

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function xml(
  name: string,
  attributes: Readonly<Record<string, string | number | undefined>>,
  children: readonly XmlElement[] = [],
): XmlElement {
  return {
    name,
    local: name,
    attributes: Object.entries(attributes).flatMap(([key, value]) =>
      value === undefined
        ? []
        : [{ name: key, local: key, value: String(value) }],
    ),
    children,
  };
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function geometry(
  box: Box,
  children: readonly XmlElement[] = [],
): XmlElement {
  return xml(
    "mxGeometry",
    {
      x: round(box.x),
      y: round(box.y),
      width: round(box.width),
      height: round(box.height),
      as: "geometry",
    },
    children,
  );
}

export function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
