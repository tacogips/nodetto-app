// Shared geometry for every edge-like element type.
//
// A connector owns no box of its own: it is drawn between the boundaries of
// the two elements it references, so its geometry is recomputed whenever
// either endpoint moves. When an endpoint cannot be resolved the connector
// has no geometry at all and every query answers "nothing here" — the
// renderer draws nothing rather than a line to the origin.
//
// The implementation lives under `connector/`; this module is its public face.

export {
  connectorWaypointFromPage,
  connectorWaypointToPage,
} from "@nodetto/ir";
export {
  type ConnectorEndpoints,
  connectorWaypointsWithInsertion,
  type EndpointReader,
} from "./connector/route.ts";
export { connectionPorts, connectorEndpoints } from "./connector/boundary.ts";
export {
  CONNECTOR_OBSTACLE_CLEARANCE,
  resolveConnector,
} from "./connector/resolve.ts";
export {
  CONNECTOR_HIT_TOLERANCE,
  createConnectorUtil,
  endpointReaderFor,
  readDirectEndpoints,
  readTableEndpoints,
} from "./connector/util.ts";
export {
  MARKER_GEOMETRY,
  MARKER_IDS,
  type MarkerEnd,
  type MarkerGeometry,
  type MarkerKind,
  type MarkerPaint,
  type MarkerPart,
  type MarkerVariant,
  markerVariant,
} from "./connector/markers.ts";
export {
  type ConnectorDecoration,
  connectorDecoration,
  connectorDefaultDash,
} from "./connector/decoration.ts";
