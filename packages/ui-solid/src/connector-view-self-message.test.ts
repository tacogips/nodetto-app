import { expect, test } from "bun:test";
import { Editor, endpointReaderFor, resolveConnector } from "@nodetto/core";
import { sameConnectorGeometry } from "./connector-geometry.ts";
import { connectorLabelTextAttrs } from "./shapes/ConnectorView.tsx";

test("self-message label attributes, geometry and picking", () => {
  const editor = new Editor();
  const participant = editor.createElement("sequence.participant", {
    visual: { x: 0, y: 0, width: 160, height: 300 },
  });
  const id = editor.connectSmart(participant, participant);
  if (!id) throw new Error("self-message missing");
  const message = editor.store.get(id)!;
  const route = resolveConnector(
    message,
    editor.createShapeContext(),
    endpointReaderFor(message.type),
  );
  if (!route) throw new Error("route missing");
  const y = route.start.y;
  expect(route.points).toEqual([
    { x: 80, y },
    { x: 120, y },
    { x: 120, y: y + 32 },
    { x: 80, y: y + 32 },
  ]);
  expect(editor.hitTest({ x: 120, y: y + 16 })).toBe(id);
  expect(connectorLabelTextAttrs({ ...route, labelStartX: 128 })).toEqual({
    x: 128,
    textAnchor: "start",
  });
  const { labelStartX: _unused, ...centred } = route;
  expect(connectorLabelTextAttrs(centred)).toEqual({
    x: route.labelPoint.x,
    textAnchor: "middle",
  });
  expect(sameConnectorGeometry(route, { ...route })).toBe(true);
  expect(sameConnectorGeometry(route, { ...route, labelStartX: 129 })).toBe(
    false,
  );
});
