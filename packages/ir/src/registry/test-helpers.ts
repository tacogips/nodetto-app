// Validation helpers shared by the registry test files.

import { expect } from "bun:test";
import type { ValidationIssue } from "../issues.ts";
import { getElementTypeDefinition } from "../registry.ts";

export function codes(issues: readonly ValidationIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

export function validate(
  type: string,
  semantic: unknown,
): readonly ValidationIssue[] {
  const definition = getElementTypeDefinition(type);
  if (!definition) {
    throw new Error(`unregistered type ${type}`);
  }
  return definition.validateSemantic(semantic, "semantic");
}

export function expectValid(type: string, semantic: unknown): void {
  const issues = validate(type, semantic);
  expect({ type, issues }).toEqual({ type, issues: [] });
}
