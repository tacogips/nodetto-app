// Connector handles: quick-connect points on the selected or hovered shape,
// and the endpoint, bend and waypoint handles of a selected connector.

import type { Editor, Vec } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import { type Accessor, For, Index, type JSX, Show } from "solid-js";
import {
  removeConnectorWaypoint,
  straightenConnectors,
} from "../connector-routing.ts";
import type { ConnectorEnd, Interaction } from "../interaction.ts";
import {
  CONNECT_HANDLE_RADIUS,
  type ConnectorHandles,
  ENDPOINT_HANDLE_RADIUS,
} from "./geometry.ts";
import type { ConnectionTarget } from "./overlay-targets.ts";

export interface ConnectorEditHandlesProps {
  readonly editor: Editor;
  readonly connectionTargets: Accessor<readonly ConnectionTarget[]>;
  readonly connectorHandles: Accessor<ConnectorHandles | null>;
  readonly zoom: Accessor<number>;
  readonly interaction: Interaction;
}

export function ConnectorEditHandles(
  props: ConnectorEditHandlesProps,
): JSX.Element {
  const zoom = props.zoom;

  const endpointHandle = (
    id: ElementId,
    end: ConnectorEnd,
    at: Vec,
  ): JSX.Element => (
    <g
      onPointerDown={(event) =>
        props.interaction.startReconnect(id, end, event)
      }
      onDblClick={(event) => event.stopPropagation()}
    >
      <circle
        cx={at.x}
        cy={at.y}
        r={12 / zoom()}
        fill="transparent"
        style={{ "pointer-events": "all", cursor: "crosshair" }}
      />
      <circle
        class="nodetto-endpoint-handle"
        cx={at.x}
        cy={at.y}
        r={ENDPOINT_HANDLE_RADIUS / zoom()}
        vector-effect="non-scaling-stroke"
        style={{ "pointer-events": "none" }}
      />
      <title>Drag endpoint to a shape point or empty canvas</title>
    </g>
  );

  return (
    <>
      <For each={props.connectionTargets()}>
        {(port) => (
          <circle
            class="nodetto-connect-handle"
            cx={port.point.x}
            cy={port.point.y}
            r={CONNECT_HANDLE_RADIUS / zoom()}
            vector-effect="non-scaling-stroke"
            onPointerDown={(event) =>
              props.interaction.startConnect(port.elementId, event, port.id)
            }
          >
            <title>
              {port.id ? `Connect from ${port.id}` : "Create timeline message"}
            </title>
          </circle>
        )}
      </For>
      <Show when={props.connectorHandles()}>
        {(handles) => (
          <>
            {endpointHandle(handles().id, "from", handles().start)}
            {endpointHandle(handles().id, "to", handles().end)}
            <Show when={handles().bend}>
              {(bend) => (
                <circle
                  class="nodetto-handle"
                  cx={bend().x}
                  cy={bend().y}
                  r={5 / zoom()}
                  style={{ cursor: "move" }}
                  vector-effect="non-scaling-stroke"
                  onPointerDown={(event) =>
                    props.interaction.startRouteBend(handles().id, event)
                  }
                  onDblClick={(event) => {
                    event.stopPropagation();
                    straightenConnectors(props.editor, [handles().id]);
                  }}
                  role="button"
                  tabindex={0}
                  aria-label="Connector bend: double-click or press Delete to straighten"
                  onKeyDown={(event) => {
                    if (
                      !["Delete", "Backspace", "Enter", " "].includes(event.key)
                    )
                      return;
                    event.stopPropagation();
                    event.preventDefault();
                    straightenConnectors(props.editor, [handles().id]);
                  }}
                >
                  <title>Drag to move; double-click to straighten</title>
                </circle>
              )}
            </Show>
            <Index each={handles().waypoints ?? []}>
              {(waypoint, index) => (
                <circle
                  class="nodetto-handle"
                  cx={waypoint().x}
                  cy={waypoint().y}
                  r={5 / zoom()}
                  style={{ cursor: "move" }}
                  vector-effect="non-scaling-stroke"
                  onPointerDown={(event) =>
                    props.interaction.startRouteWaypoint(
                      handles().id,
                      index,
                      event,
                    )
                  }
                  onDblClick={(event) => {
                    event.stopPropagation();
                    removeConnectorWaypoint(props.editor, handles().id, index);
                  }}
                  role="button"
                  tabindex={0}
                  aria-label={`Connector bend ${index + 1}: double-click or press Delete to remove`}
                  onKeyDown={(event) => {
                    if (
                      !["Delete", "Backspace", "Enter", " "].includes(event.key)
                    )
                      return;
                    event.stopPropagation();
                    event.preventDefault();
                    removeConnectorWaypoint(props.editor, handles().id, index);
                  }}
                >
                  <title>
                    Drag to move; double-click to remove bend {index + 1}
                  </title>
                </circle>
              )}
            </Index>
          </>
        )}
      </Show>
    </>
  );
}
