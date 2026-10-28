// Report types, namespaces and XML builders shared by the BPMN export
// modules.

import type { Element } from "@nodetto/ir";
import type { XmlAttribute, XmlElement, XmlNode } from "./xml.ts";

export const MODEL = "http://www.omg.org/spec/BPMN/20100524/MODEL";
export const BPMNDI = "http://www.omg.org/spec/BPMN/20100524/DI";
export const DC = "http://www.omg.org/spec/DD/20100524/DC";
export const DI = "http://www.omg.org/spec/DD/20100524/DI";
export const XSI = "http://www.w3.org/2001/XMLSchema-instance";
export type Point = { x: number; y: number };
export interface BpmnExportOptions {
  readonly routeOf?: (edge: Element) => readonly Point[] | undefined;
}
export interface BpmnExportWarning {
  readonly elementId?: string;
  readonly message: string;
}
export interface BpmnExportReport {
  readonly xml: string;
  readonly warnings: readonly BpmnExportWarning[];
}
export const semantic = (element: Element): Record<string, unknown> =>
  element.semantic as Record<string, unknown>;
export function element(
  name: string,
  attributes: Record<string, string | undefined> = {},
  nodes: XmlNode[] = [],
): XmlElement {
  const attrs: XmlAttribute[] = Object.entries(attributes)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => ({
      name: key,
      local: key.includes(":") ? (key.split(":").at(-1) as string) : key,
      ...(key.includes(":") ? { prefix: key.split(":")[0] } : {}),
      value,
    }));
  return {
    name,
    ...(name.includes(":")
      ? {
          prefix: name.split(":")[0],
          local: name.split(":").at(-1) as string,
          ns: name.startsWith("bpmn:")
            ? MODEL
            : name.startsWith("bpmndi:")
              ? BPMNDI
              : name.startsWith("dc:")
                ? DC
                : name.startsWith("di:")
                  ? DI
                  : undefined,
        }
      : { local: name }),
    attributes: attrs,
    children: nodes,
  };
}
export function text(value: string): XmlNode {
  return { kind: "text", text: value };
}
export function num(value: number | undefined, fallback: number): string {
  const number = value ?? fallback;
  return String(Math.round(number * 100) / 100);
}
