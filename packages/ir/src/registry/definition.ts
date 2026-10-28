// Element type definition contract plus the reference helpers shared by
// every element family in the registry.

import type { ValidationIssue } from "../issues.ts";
import type { KeyOrder } from "../keyOrder.ts";
import type { ElementType } from "../semantics.ts";
import type { ElementId } from "../types.ts";

/** How an element reacts when an element it points at is deleted. */
export type ReferencePolicy = "cascade" | "detach";

export interface ElementReference {
  /** Dotted path of the referring field within `semantic`. */
  readonly field: string;
  readonly id: ElementId;
}

export type ElementCategory =
  | "node"
  | "edge"
  | "container"
  | "annotation"
  | "resource";

export interface ElementTypeDefinition {
  readonly type: ElementType;
  readonly category: ElementCategory;
  /** Deterministic key order for the semantic payload. */
  readonly keyOrder: KeyOrder;
  /**
   * Deleting an element referenced by this one either deletes this element
   * too (`cascade`, e.g. a relation without its table) or clears the
   * reference (`detach`, e.g. a group losing one member).
   */
  readonly onReferenceDeleted: ReferencePolicy;
  validateSemantic(semantic: unknown, path: string): ValidationIssue[];
  /** Element ids this payload points at, in declaration order. */
  references(semantic: unknown): readonly ElementReference[];
}

export function noReferences(): readonly ElementReference[] {
  return [];
}

/** Reads `field` off a payload only when the payload is an object. */
export function read(semantic: unknown, field: string): unknown {
  if (typeof semantic !== "object" || semantic === null) {
    return undefined;
  }
  return (semantic as Record<string, unknown>)[field];
}

/** Collects `field` as a reference when it holds a non-empty string id. */
export function refFields(
  semantic: unknown,
  fields: readonly string[],
): readonly ElementReference[] {
  const refs: ElementReference[] = [];
  for (const field of fields) {
    const value = read(semantic, field);
    if (typeof value === "string" && value.length > 0) {
      refs.push({ field, id: value });
    }
  }
  return refs;
}
