import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { importBpmnXml } from "./import.ts";
import { exportBpmnXml } from "./export.ts";
import { bpmnExportId } from "./ids.ts";
import { parseXml } from "./xml.ts";

test("exports a deterministic BPMN document with standard namespaces and diagram interchange", () => {
  const source = readFileSync(
    new URL("../__fixtures__/bpmn/purchase-request.bpmn", import.meta.url),
    "utf8",
  );
  const imported = importBpmnXml(source, { documentId: "purchase-request" });
  const first = exportBpmnXml(imported.document, imported.pageId).xml;
  expect(exportBpmnXml(imported.document, imported.pageId).xml).toBe(first);
  expect(first).toContain(
    'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"',
  );
  expect(first).toContain(
    'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"',
  );
  expect(first).toContain('xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"');
  expect(first).toContain('xmlns:di="http://www.omg.org/spec/DD/20100524/DI"');
  expect(first).toContain(
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
  );
  expect(first).toContain("<bpmn:incoming>");
  expect(first).toContain("<bpmn:outgoing>");
  expect(first).toContain(
    'id="Gateway_Approve_di" bpmnElement="Gateway_Approve" isMarkerVisible="true"',
  );
  expect(first).toContain('<dc:Bounds x="655" y="352" width="90" height="14"');
  expect(parseXml(first).local).toBe("definitions");
  expect(first).toContain("BPMNPlane");
});

test("exports pool-less processes and uses routeOf points rounded to two decimals", () => {
  const poolLess = importBpmnXml(
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="Process"><bpmn:task id="A"/><bpmn:task id="B"/><bpmn:sequenceFlow id="F" sourceRef="A" targetRef="B"/></bpmn:process></bpmn:definitions>',
  );
  const poolLessXml = exportBpmnXml(poolLess.document, poolLess.pageId).xml;
  expect((poolLessXml.match(/<bpmn:process\b/g) ?? []).length).toBe(1);
  expect(poolLessXml).not.toContain("bpmn:collaboration");

  const source = readFileSync(
    new URL("../__fixtures__/bpmn/purchase-request.bpmn", import.meta.url),
    "utf8",
  );
  const imported = importBpmnXml(source);
  const routed = exportBpmnXml(imported.document, imported.pageId, {
    routeOf: (edge) =>
      edge.id === "Flow_ToOrder"
        ? [
            { x: 1.234, y: 2 },
            { x: 3, y: 4.567 },
          ]
        : undefined,
  }).xml;
  const edge = routed.match(
    /<bpmndi:BPMNEdge id="Flow_ToOrder_di"[\s\S]*?<\/bpmndi:BPMNEdge>/,
  )?.[0];
  expect(edge).toContain('<di:waypoint x="1.23" y="2"');
  expect(edge).toContain('<di:waypoint x="3" y="4.57"');
});

test("maps invalid element ids to stable BPMN NCNames", () => {
  const id = bpmnExportId({ id: "01HXYZ-ABC", type: "bpmn.task" });
  expect(id).toBe("Activity_01HXYZ-ABC");
  expect(bpmnExportId({ id, type: "bpmn.task" })).toBe(id);
});

const definitions = (body: string, ids: string[]) =>
  `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC">${body}<bpmndi:BPMNDiagram id="Diagram"><bpmndi:BPMNPlane id="Plane" bpmnElement="C">${ids.map((id) => `<bpmndi:BPMNShape id="${id}_shape" bpmnElement="${id}"><dc:Bounds x="0" y="0" width="100" height="80"/></bpmndi:BPMNShape>`).join("")}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>`;
const collaboration =
  '<bpmn:collaboration id="C"><bpmn:participant id="Pool_Orders" processRef="P"/></bpmn:collaboration>';
const children = (node: ReturnType<typeof parseXml>, local: string) =>
  node.children.filter(
    (child): child is ReturnType<typeof parseXml> =>
      "local" in child && child.local === local,
  );
const attr = (node: ReturnType<typeof parseXml>, name: string) =>
  node.attributes.find((item) => item.local === name)?.value;
const stripParent = (
  imported: ReturnType<typeof importBpmnXml>,
  ...ids: string[]
) => {
  for (const id of ids) {
    const record = imported.document.elements.find((item) => item.id === id);
    if (!record) throw new Error(`Missing ${id}`);
    // biome-ignore lint/performance/noDelete: reproduce editor records without a parent key.
    delete (record.semantic as Record<string, unknown>)["parent"];
  }
};

test("exports a parentless boundary event with its host's process and lane", () => {
  const imported = importBpmnXml(
    definitions(
      `${collaboration}<bpmn:process id="P"><bpmn:laneSet id="LS"><bpmn:lane id="Lane_Review"><bpmn:flowNodeRef>Task_Review</bpmn:flowNodeRef><bpmn:flowNodeRef>Task_Escalate</bpmn:flowNodeRef></bpmn:lane></bpmn:laneSet><bpmn:task id="Task_Review" name="Review order"/><bpmn:task id="Task_Escalate" name="Escalate order"/><bpmn:boundaryEvent id="Event_Timeout" name="Timeout" attachedToRef="Task_Review"><bpmn:timerEventDefinition/></bpmn:boundaryEvent><bpmn:sequenceFlow id="Flow_Timeout" sourceRef="Event_Timeout" targetRef="Task_Escalate"/><bpmn:group id="Group_Notes"/></bpmn:process>`,
      [
        "Pool_Orders",
        "Lane_Review",
        "Task_Review",
        "Task_Escalate",
        "Event_Timeout",
        "Group_Notes",
      ],
    ),
  );
  stripParent(imported, "Event_Timeout", "Group_Notes");
  const result = exportBpmnXml(imported.document, imported.pageId);
  const root = parseXml(result.xml);
  const process = children(root, "process")[0]!;
  const lane = children(children(process, "laneSet")[0]!, "lane")[0]!;
  expect(result.warnings).toEqual([]);
  expect(children(root, "process")).toHaveLength(1);
  expect(result.xml).not.toContain("Process_orphan_");
  expect(attr(children(process, "boundaryEvent")[0]!, "attachedToRef")).toBe(
    "Task_Review",
  );
  expect(
    children(lane, "flowNodeRef").some((node) =>
      node.children.some(
        (child) => "text" in child && child.text === "Event_Timeout",
      ),
    ),
  ).toBe(true);
  expect(result.xml.match(/id="Flow_Timeout"/g) ?? []).toHaveLength(1);
  expect(
    attr(children(children(root, "collaboration")[0]!, "group")[0]!, "id"),
  ).toBe("Group_Notes");
  expect(result.xml).toContain('bpmnElement="Group_Notes"');
  const ids = [...result.xml.matchAll(/\sid="([^"]+)"/g)].map(
    (match) => match[1],
  );
  expect(new Set(ids).size).toBe(ids.length);
});

test("emits a parentless boundary event inside its host's sub-process", () => {
  const imported = importBpmnXml(
    definitions(
      `${collaboration}<bpmn:process id="P"><bpmn:subProcess id="Sub_Check"><bpmn:task id="Task_Inner"/><bpmn:task id="Task_After"/><bpmn:boundaryEvent id="Event_Inner_Timeout" attachedToRef="Task_Inner"/><bpmn:sequenceFlow id="Flow_Inner" sourceRef="Event_Inner_Timeout" targetRef="Task_After"/></bpmn:subProcess></bpmn:process>`,
      [
        "Pool_Orders",
        "Sub_Check",
        "Task_Inner",
        "Task_After",
        "Event_Inner_Timeout",
      ],
    ),
  );
  stripParent(imported, "Event_Inner_Timeout");
  const xml = exportBpmnXml(imported.document, imported.pageId).xml;
  const sub = children(
    children(parseXml(xml), "process")[0]!,
    "subProcess",
  )[0]!;
  expect(attr(children(sub, "boundaryEvent")[0]!, "id")).toBe(
    "Event_Inner_Timeout",
  );
  expect(attr(children(sub, "sequenceFlow")[0]!, "id")).toBe("Flow_Inner");
  expect(xml.match(/id="Flow_Inner"/g) ?? []).toHaveLength(1);
  expect(xml).not.toContain("Process_orphan_");
});

test("keeps the orphan process for pool-less flow nodes but not for artifacts", () => {
  const imported = importBpmnXml(
    definitions(
      `${collaboration}<bpmn:process id="P"><bpmn:task id="Task_Review"/><bpmn:task id="Task_Loose"/><bpmn:textAnnotation id="Note_Loose"><bpmn:text>Note</bpmn:text></bpmn:textAnnotation></bpmn:process>`,
      ["Pool_Orders", "Task_Review", "Task_Loose", "Note_Loose"],
    ),
  );
  stripParent(imported, "Task_Loose", "Note_Loose");
  const result = exportBpmnXml(imported.document, imported.pageId);
  const root = parseXml(result.xml);
  const orphan = children(root, "process").find(
    (node) => attr(node, "id") === `Process_orphan_${imported.pageId}`,
  )!;
  expect(attr(children(orphan, "task")[0]!, "id")).toBe("Task_Loose");
  expect(result.warnings.map((warning) => warning.message)).toContain(
    "Pool-less elements were exported in an extra unreferenced process.",
  );
  expect(children(orphan, "textAnnotation")).toHaveLength(0);
  expect(
    attr(
      children(children(root, "collaboration")[0]!, "textAnnotation")[0]!,
      "id",
    ),
  ).toBe("Note_Loose");
});

test("places associations with their owning process or the collaboration", () => {
  const imported = importBpmnXml(
    definitions(
      `${collaboration}<bpmn:process id="P"><bpmn:task id="Task_Review"/><bpmn:textAnnotation id="Note_A"><bpmn:text>Note</bpmn:text></bpmn:textAnnotation><bpmn:association id="Assoc_Task" sourceRef="Note_A" targetRef="Task_Review"/><bpmn:association id="Assoc_Pool" sourceRef="Note_A" targetRef="Pool_Orders"/></bpmn:process>`,
      ["Pool_Orders", "Task_Review", "Note_A"],
    ),
  );
  stripParent(imported, "Note_A");
  const xml = exportBpmnXml(imported.document, imported.pageId).xml;
  const root = parseXml(xml);
  expect(
    attr(children(children(root, "process")[0]!, "association")[0]!, "id"),
  ).toBe("Assoc_Task");
  expect(
    attr(
      children(children(root, "collaboration")[0]!, "association")[0]!,
      "id",
    ),
  ).toBe("Assoc_Pool");
  for (const id of ["Assoc_Task", "Assoc_Pool"])
    expect(xml.match(new RegExp(`id="${id}"`, "g")) ?? []).toHaveLength(1);
});

test("terminates on a parent cycle", () => {
  const imported = importBpmnXml(
    definitions(
      `${collaboration}<bpmn:process id="P"><bpmn:laneSet id="LS"><bpmn:lane id="L1"/><bpmn:lane id="L2"/></bpmn:laneSet><bpmn:task id="T"/></bpmn:process>`,
      ["L1", "L2", "T"],
    ),
  );
  (
    imported.document.elements as Array<
      (typeof imported.document.elements)[number]
    >
  ).splice(
    imported.document.elements.findIndex((item) => item.id === "Pool_Orders"),
    1,
  );
  for (const [id, parent] of [
    ["L1", "L2"],
    ["L2", "L1"],
    ["T", "L1"],
  ]) {
    const record = imported.document.elements.find((item) => item.id === id)!;
    (record.semantic as Record<string, unknown>)["parent"] = parent;
  }
  expect(exportBpmnXml(imported.document, imported.pageId).xml).toContain(
    "bpmn:definitions",
  );
});
