import type { Page } from "@nodetto/ir";
import type { ShapeContext } from "../shape-util.ts";
import type { Store } from "../store.ts";
import { lintRules } from "./rules.ts";
import { collectLintNodes, isAppLintPage } from "./scope.ts";

export const APP_LINT_RULE_IDS = [
  "app-off-frame",
  "app-text-overflow",
  "app-text-truncated",
  "app-control-overlap",
  "app-off-grid",
  "app-misaligned",
  "app-touch-target",
] as const;
export type AppLintRuleId = (typeof APP_LINT_RULE_IDS)[number];
export type { AppLintFinding } from "./rules.ts";
export { isAppLintPage } from "./scope.ts";

export function lintAppDesignPage(
  store: Store,
  page: Page,
  context: ShapeContext,
) {
  if (!isAppLintPage(store, page)) return [];
  return lintRules(store, page, collectLintNodes(store, page, context));
}
