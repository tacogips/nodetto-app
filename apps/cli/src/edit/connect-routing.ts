import {
  CONNECTOR_ROUTINGS,
  getElementTypeDefinition,
  isPlainObject,
} from "@nodetto/ir";
import type { Batch } from "./batch.ts";
import { OperationError, type JsonObject } from "./operation-input.ts";

export function splitVisualRouting(
  visual: JsonObject,
  index: number,
): { routing: JsonObject; visual: JsonObject } {
  const { routing, routingAvoidObstacles, ...rest } = visual;
  const fields: Record<string, unknown> = {};
  if (routing !== undefined) fields["routing"] = routing;
  if (routingAvoidObstacles !== undefined)
    fields["routingAvoidObstacles"] = routingAvoidObstacles;
  validateRouting(fields, index);
  return { routing: fields, visual: rest };
}

function validateRouting(fields: JsonObject, index: number): void {
  const routing = fields["routing"];
  if (
    routing !== undefined &&
    (typeof routing !== "string" ||
      !CONNECTOR_ROUTINGS.some((value) => value === routing))
  )
    throw new OperationError(
      index,
      '"routing" must be straight, orthogonal or manual',
    );
  if (
    fields["routingAvoidObstacles"] !== undefined &&
    typeof fields["routingAvoidObstacles"] !== "boolean"
  )
    throw new OperationError(
      index,
      '"routingAvoidObstacles" must be a boolean',
    );
}

export function supportsRouting(type: string): boolean {
  return (
    getElementTypeDefinition(type)?.keyOrder.keys.includes("routing") ?? false
  );
}

export function pageRoutingConvention(
  batch: Batch,
  pageId: string,
): JsonObject | undefined {
  const peers = batch.editor.store
    .getPageElements(pageId)
    .filter((element) => supportsRouting(element.type));
  if (!peers.length) return undefined;
  let mode: unknown;
  let avoid: boolean | undefined;
  let anyTrue = false;
  for (const peer of peers) {
    const semantic = isPlainObject(peer.semantic) ? peer.semantic : {};
    const visual = isPlainObject(peer.visual) ? peer.visual : {};
    const extensions = isPlainObject(visual["extensions"])
      ? visual["extensions"]
      : {};
    const routing =
      semantic["routing"] ?? visual["routing"] ?? extensions["routing"];
    const storedAvoid =
      semantic["routingAvoidObstacles"] ??
      visual["routingAvoidObstacles"] ??
      extensions["routingAvoidObstacles"];
    if (routing !== "straight" && routing !== "orthogonal") return undefined;
    const key = storedAvoid !== false;
    if (mode !== undefined && (mode !== routing || avoid !== key))
      return undefined;
    mode = routing;
    avoid = key;
    if (storedAvoid === true) anyTrue = true;
  }
  return {
    routing: mode as string,
    ...(avoid === false
      ? { routingAvoidObstacles: false }
      : anyTrue
        ? { routingAvoidObstacles: true }
        : {}),
  };
}

export function resolveConnectRouting(
  batch: Batch,
  pageId: string,
  operation: JsonObject,
  index: number,
): { routing: JsonObject; visual: JsonObject | undefined; explicit: boolean } {
  const inputVisual = operation["visual"];
  if (inputVisual !== undefined && !isPlainObject(inputVisual))
    throw new OperationError(index, '"visual" must be an object');
  const split = splitVisualRouting(
    isPlainObject(inputVisual) ? inputVisual : {},
    index,
  );
  const top: Record<string, unknown> = {};
  for (const key of ["routing", "routingAvoidObstacles"])
    if (operation[key] !== undefined) top[key] = operation[key];
  validateRouting(top, index);
  const semantic = isPlainObject(operation["semantic"])
    ? operation["semantic"]
    : {};
  const explicitTiers = [top, semantic, split.routing];
  const explicit = explicitTiers.some(
    (tier) =>
      tier["routing"] !== undefined ||
      tier["routingAvoidObstacles"] !== undefined,
  );
  const page = batch.editor.store
    .listPages()
    .find((item) => item.id === pageId);
  const tiers: readonly JsonObject[] = [
    ...explicitTiers,
    { ...page?.connectorRouting },
    pageRoutingConvention(batch, pageId) ?? {},
  ];
  const source = tiers.find((tier) => tier["routing"] !== undefined);
  const routing: Record<string, unknown> = {};
  if (source) routing["routing"] = source["routing"];
  const explicitAvoid = explicitTiers.find(
    (tier) => tier["routingAvoidObstacles"] !== undefined,
  );
  const avoid =
    explicitAvoid?.["routingAvoidObstacles"] ??
    source?.["routingAvoidObstacles"];
  if (avoid !== undefined) routing["routingAvoidObstacles"] = avoid;
  return {
    routing,
    visual: inputVisual === undefined ? undefined : split.visual,
    explicit,
  };
}
