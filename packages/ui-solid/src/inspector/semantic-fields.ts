// Shared props and semantic payload readers for the small semantic sections.

import type { Editor } from "@nodetto/core";
import type { Element } from "@nodetto/ir";

export interface ElementSectionProps {
  readonly editor: Editor;
  readonly element: Element;
}

export function record(semantic: unknown): Record<string, unknown> {
  return typeof semantic === "object" && semantic !== null
    ? (semantic as Record<string, unknown>)
    : {};
}

export function stringOf(semantic: unknown, field: string): string {
  const value = record(semantic)[field];
  return typeof value === "string" ? value : "";
}
