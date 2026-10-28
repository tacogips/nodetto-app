// Semantic BPMN process content: flow nodes, data, artifacts, lanes and
// sequence flows of every exported process.

import type { Element } from "@nodetto/ir";
import {
  parseXml,
  type XmlAttribute,
  type XmlElement,
  type XmlNode,
} from "./xml.ts";
import { bpmnExportId } from "./ids.ts";
import { element, semantic, text } from "./export-common.ts";
import type { BpmnExportScope } from "./export-scope.ts";

function nodeTag(elementRecord: Element): string {
  const s = semantic(elementRecord);
  switch (elementRecord.type) {
    case "bpmn.task":
      return (
        (
          {
            none: "task",
            user: "userTask",
            service: "serviceTask",
            manual: "manualTask",
            send: "sendTask",
            receive: "receiveTask",
            script: "scriptTask",
            businessRule: "businessRuleTask",
          } as Record<string, string>
        )[String(s["taskType"])] ?? "task"
      );
    case "bpmn.subProcess":
      return s["adHoc"] ? "adHocSubProcess" : "subProcess";
    case "bpmn.callActivity":
      return "callActivity";
    case "bpmn.event":
      return (
        (
          {
            start: "startEvent",
            intermediateCatch: "intermediateCatchEvent",
            intermediateThrow: "intermediateThrowEvent",
            end: "endEvent",
          } as Record<string, string>
        )[String(s["position"])] ?? "startEvent"
      );
    case "bpmn.boundaryEvent":
      return "boundaryEvent";
    case "bpmn.gateway":
      return `${String(s["gatewayType"])}Gateway`;
    case "bpmn.dataObject":
      return s["role"] === "input"
        ? "dataInput"
        : s["role"] === "output"
          ? "dataOutput"
          : "dataObjectReference";
    case "bpmn.dataStore":
      return "dataStoreReference";
    case "bpmn.textAnnotation":
      return "textAnnotation";
    case "bpmn.group":
      return "group";
    default:
      return "task";
  }
}

export function processElements(scope: BpmnExportScope): XmlElement[] {
  const {
    pageId,
    records,
    byId,
    idOf,
    lanes,
    flows,
    flowNodes,
    data,
    artifacts,
    hasParticipants,
    parentOf,
    ownerParticipant,
    subprocessScope,
    belongsToProcess,
    processNodes,
    processId,
  } = scope;
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const flow of flows.filter(
    (item) => item.type === "bpmn.sequenceFlow",
  )) {
    const s = semantic(flow);
    const from = String(s["from"]);
    const to = String(s["to"]);
    outgoing.set(from, [...(outgoing.get(from) ?? []), bpmnExportId(flow)]);
    incoming.set(to, [...(incoming.get(to) ?? []), bpmnExportId(flow)]);
  }
  const definitionXml = (node: Element): XmlNode[] => {
    const s = semantic(node);
    const definitions = s["definitions"];
    if (!Array.isArray(definitions)) return [];
    return definitions.map((value) => {
      if (!value || typeof value !== "object")
        return element("bpmn:messageEventDefinition");
      const def = value as Record<string, unknown>;
      const kind = String(def["kind"]);
      const tag =
        (
          {
            message: "messageEventDefinition",
            timer: "timerEventDefinition",
            error: "errorEventDefinition",
            escalation: "escalationEventDefinition",
            cancel: "cancelEventDefinition",
            compensation: "compensateEventDefinition",
            conditional: "conditionalEventDefinition",
            link: "linkEventDefinition",
            signal: "signalEventDefinition",
            terminate: "terminateEventDefinition",
          } as Record<string, string>
        )[kind] ?? "messageEventDefinition";
      const attrs: Record<string, string | undefined> = {
        id: typeof def["id"] === "string" ? String(def["id"]) : undefined,
        messageRef:
          kind === "message" ? (def["ref"] as string | undefined) : undefined,
        signalRef:
          kind === "signal" ? (def["ref"] as string | undefined) : undefined,
        errorRef:
          kind === "error" ? (def["ref"] as string | undefined) : undefined,
        escalationRef:
          kind === "escalation"
            ? (def["ref"] as string | undefined)
            : undefined,
        name:
          kind === "link" ? (def["linkName"] as string | undefined) : undefined,
      };
      let content: XmlNode[] = [];
      if (
        kind === "timer" &&
        def["timer"] &&
        typeof def["timer"] === "object"
      ) {
        const timer = def["timer"] as Record<string, unknown>;
        const childTag =
          timer["type"] === "date"
            ? "timeDate"
            : timer["type"] === "cycle"
              ? "timeCycle"
              : "timeDuration";
        content = [
          element(
            `bpmn:${childTag}`,
            { "xsi:type": "bpmn:tFormalExpression" },
            [text(String(timer["value"] ?? ""))],
          ),
        ];
      }
      if (kind === "conditional" && typeof def["condition"] === "string")
        content = [
          element("bpmn:condition", {}, [text(def["condition"] as string)]),
        ];
      return element(`bpmn:${tag}`, attrs, content);
    });
  };
  const sequenceFlowXml = (item: Element): XmlElement =>
    element(
      "bpmn:sequenceFlow",
      {
        id: bpmnExportId(item),
        name: semantic(item)["name"] as string | undefined,
        sourceRef: idOf(String(semantic(item)["from"])),
        targetRef: idOf(String(semantic(item)["to"])),
      },
      typeof semantic(item)["condition"] === "string"
        ? [
            element("bpmn:conditionExpression", {}, [
              text(String(semantic(item)["condition"])),
            ]),
          ]
        : [],
    );
  const dataXmlElement = (item: Element): XmlNode[] => {
    const itemSemantic = semantic(item);
    const extensions = item.extensions?.["bpmnXml"];
    const dataObjectId =
      extensions && typeof extensions === "object"
        ? (extensions as Record<string, unknown>)["dataObjectId"]
        : undefined;
    const reference = element(`bpmn:${nodeTag(item)}`, {
      id: bpmnExportId(item),
      name: itemSemantic["name"] as string | undefined,
      dataObjectRef:
        itemSemantic["role"] === "reference" && typeof dataObjectId === "string"
          ? dataObjectId
          : undefined,
      isCollection: itemSemantic["collection"] === true ? "true" : undefined,
    });
    if (
      itemSemantic["role"] !== "reference" ||
      typeof dataObjectId !== "string"
    )
      return [reference];
    return [
      element("bpmn:dataObject", {
        id: dataObjectId,
        isCollection: itemSemantic["collection"] === true ? "true" : "false",
      }),
      reference,
    ];
  };
  const artifactXmlElement = (item: Element): XmlElement =>
    item.type === "bpmn.textAnnotation"
      ? element("bpmn:textAnnotation", { id: bpmnExportId(item) }, [
          element("bpmn:text", {}, [
            text(String(semantic(item)["text"] ?? "")),
          ]),
        ])
      : element("bpmn:group", { id: bpmnExportId(item) });
  const nodeXml = (item: Element): XmlElement => {
    const s = semantic(item);
    const id = bpmnExportId(item);
    const tag = nodeTag(item);
    const attrs: Record<string, string | undefined> = {
      id,
      name: typeof s["name"] === "string" ? s["name"] : undefined,
    };
    if (
      item.type === "bpmn.task" ||
      item.type === "bpmn.subProcess" ||
      item.type === "bpmn.callActivity"
    )
      attrs["isForCompensation"] =
        s["forCompensation"] === true ? "true" : undefined;
    if (item.type === "bpmn.subProcess")
      attrs["triggeredByEvent"] =
        s["triggeredByEvent"] === true ? "true" : undefined;
    if (item.type === "bpmn.boundaryEvent") {
      attrs["attachedToRef"] = idOf(String(s["attachedTo"]));
      attrs["cancelActivity"] =
        s["cancelActivity"] === false ? "false" : "true";
    }
    if (item.type === "bpmn.event" && s["position"] === "start")
      attrs["isInterrupting"] =
        s["interrupting"] === false ? "false" : undefined;
    const childrenXml: XmlNode[] = [];
    for (const flow of incoming.get(item.id) ?? [])
      childrenXml.push(element("bpmn:incoming", {}, [text(flow)]));
    for (const flow of outgoing.get(item.id) ?? [])
      childrenXml.push(element("bpmn:outgoing", {}, [text(flow)]));
    const taskData = data.filter(
      (record) =>
        parentOf(record) === item.id &&
        (semantic(record)["role"] === "input" ||
          semantic(record)["role"] === "output"),
    );
    if (
      taskData.length &&
      ["bpmn.task", "bpmn.subProcess", "bpmn.callActivity"].includes(item.type)
    ) {
      const inputs = taskData.filter(
        (record) => semantic(record)["role"] === "input",
      );
      const outputs = taskData.filter(
        (record) => semantic(record)["role"] === "output",
      );
      const ioElements: XmlNode[] = [
        ...inputs.map((record) =>
          element("bpmn:dataInput", {
            id: bpmnExportId(record),
            name: semantic(record)["name"] as string | undefined,
            isCollection:
              semantic(record)["collection"] === true ? "true" : undefined,
          }),
        ),
        ...outputs.map((record) =>
          element("bpmn:dataOutput", {
            id: bpmnExportId(record),
            name: semantic(record)["name"] as string | undefined,
            isCollection:
              semantic(record)["collection"] === true ? "true" : undefined,
          }),
        ),
        element(
          "bpmn:inputSet",
          {},
          inputs.map((record) =>
            element("bpmn:dataInputRefs", {}, [text(bpmnExportId(record))]),
          ),
        ),
        element(
          "bpmn:outputSet",
          {},
          outputs.map((record) =>
            element("bpmn:dataOutputRefs", {}, [text(bpmnExportId(record))]),
          ),
        ),
      ];
      childrenXml.push(element("bpmn:ioSpecification", {}, ioElements));
    }
    const dataAssociations = flows.filter(
      (flow) =>
        flow.type === "bpmn.dataAssociation" &&
        (semantic(flow)["to"] === item.id ||
          semantic(flow)["from"] === item.id),
    );
    for (const flow of dataAssociations) {
      const isInput = semantic(flow)["to"] === item.id;
      childrenXml.push(
        element(
          isInput ? "bpmn:dataInputAssociation" : "bpmn:dataOutputAssociation",
          {
            id: bpmnExportId(flow),
          },
          [
            element("bpmn:sourceRef", {}, [
              text(idOf(String(semantic(flow)["from"]))),
            ]),
            element("bpmn:targetRef", {}, [
              text(idOf(String(semantic(flow)["to"]))),
            ]),
          ],
        ),
      );
    }
    if (
      item.type === "bpmn.task" ||
      item.type === "bpmn.subProcess" ||
      item.type === "bpmn.callActivity"
    ) {
      const loop = s["loop"];
      if (loop === "standard")
        childrenXml.push(element("bpmn:standardLoopCharacteristics"));
      if (
        loop === "parallelMultiInstance" ||
        loop === "sequentialMultiInstance"
      )
        childrenXml.push(
          element("bpmn:multiInstanceLoopCharacteristics", {
            isSequential: loop === "sequentialMultiInstance" ? "true" : "false",
          }),
        );
    }
    childrenXml.push(...definitionXml(item));
    if (item.type === "bpmn.textAnnotation")
      childrenXml.push(
        element("bpmn:text", {}, [text(String(s["text"] ?? ""))]),
      );
    if (item.type === "bpmn.subProcess") {
      const children = flowNodes.filter((child) => parentOf(child) === item.id);
      childrenXml.push(...children.map(nodeXml));
      const nestedFlows = flows.filter((flow) => {
        if (flow.type !== "bpmn.sequenceFlow") return false;
        const from = byId.get(String(semantic(flow)["from"]));
        const to = byId.get(String(semantic(flow)["to"]));
        return (
          !!from &&
          !!to &&
          subprocessScope(from) === item.id &&
          subprocessScope(to) === item.id
        );
      });
      childrenXml.push(...nestedFlows.map(sequenceFlowXml));
      childrenXml.push(
        ...data
          .filter(
            (record) =>
              parentOf(record) === item.id &&
              semantic(record)["role"] !== "input" &&
              semantic(record)["role"] !== "output",
          )
          .flatMap(dataXmlElement),
      );
      childrenXml.push(
        ...artifacts
          .filter((record) => parentOf(record) === item.id)
          .map(artifactXmlElement),
      );
    }
    const result = element(`bpmn:${tag}`, attrs, childrenXml);
    const stored = item.extensions?.["bpmnXml"];
    if (stored && typeof stored === "object") {
      const foreign = stored as Record<string, unknown>;
      const attributes = foreign["attributes"];
      if (Array.isArray(attributes))
        for (const value of attributes) {
          if (!value || typeof value !== "object") continue;
          const attribute = value as Record<string, unknown>;
          if (
            typeof attribute["name"] !== "string" ||
            typeof attribute["value"] !== "string"
          )
            continue;
          if (
            !result.attributes.some(
              (existing) => existing.name === attribute["name"],
            )
          )
            (result.attributes as XmlAttribute[]).push({
              name: attribute["name"],
              prefix: String(attribute["name"]).includes(":")
                ? String(attribute["name"]).split(":")[0]
                : undefined,
              local:
                String(attribute["name"]).split(":").at(-1) ??
                String(attribute["name"]),
              value: attribute["value"],
            });
        }
      const children = foreign["children"];
      if (Array.isArray(children))
        for (const value of children)
          if (typeof value === "string")
            (result.children as XmlNode[]).push(parseXml(value));
    }
    return result;
  };
  const laneXml = (lane: Element): XmlElement => {
    const s = semantic(lane);
    const members = records.filter(
      (item) =>
        semantic(item)["parent"] === lane.id &&
        [
          "bpmn.task",
          "bpmn.subProcess",
          "bpmn.callActivity",
          "bpmn.event",
          "bpmn.boundaryEvent",
          "bpmn.gateway",
        ].includes(item.type),
    );
    const nested = lanes.filter((item) => semantic(item)["parent"] === lane.id);
    return element(
      "bpmn:lane",
      {
        id: bpmnExportId(lane),
        name: typeof s["name"] === "string" ? s["name"] : undefined,
      },
      [
        ...members.map((item) =>
          element("bpmn:flowNodeRef", {}, [text(bpmnExportId(item))]),
        ),
        ...(nested.length
          ? [
              element(
                "bpmn:childLaneSet",
                { id: `LaneSet_${bpmnExportId(lane)}` },
                nested.map(laneXml),
              ),
            ]
          : []),
      ],
    );
  };
  const processXml: XmlElement[] = [];
  for (const [participantId, nodes] of processNodes) {
    const participant = byId.get(participantId);
    if (participant && semantic(participant)["collapsed"] === true) continue;
    const pid = processId(participantId);
    const laneSet = lanes.filter(
      (item) =>
        semantic(item)["parent"] === participantId ||
        (!hasParticipants && semantic(item)["parent"] === undefined),
    );
    const members = nodes.slice();
    const semanticContents = members.map(nodeXml);
    const dataXml = data
      .filter((item) => belongsToProcess(item, participantId))
      .filter(
        (item) => !["input", "output"].includes(String(semantic(item)["role"])),
      )
      .filter((item) => subprocessScope(item) === undefined)
      .flatMap(dataXmlElement);
    const flowXml = flows
      .filter(
        (item) =>
          item.type === "bpmn.sequenceFlow" &&
          (() => {
            const from = byId.get(String(semantic(item)["from"]));
            const to = byId.get(String(semantic(item)["to"]));
            return (
              !!from &&
              !!to &&
              subprocessScope(from) === undefined &&
              subprocessScope(to) === undefined
            );
          })() &&
          (members.some((node) => node.id === semantic(item)["from"]) ||
            members.some((node) => node.id === semantic(item)["to"])),
      )
      .map((item) =>
        element(
          "bpmn:sequenceFlow",
          {
            id: bpmnExportId(item),
            name: semantic(item)["name"] as string | undefined,
            sourceRef: idOf(String(semantic(item)["from"])),
            targetRef: idOf(String(semantic(item)["to"])),
            ...(semantic(item)["isDefault"] === true ? {} : {}),
          },
          typeof semantic(item)["condition"] === "string"
            ? [
                element("bpmn:conditionExpression", {}, [
                  text(String(semantic(item)["condition"])),
                ]),
              ]
            : [],
        ),
      );
    for (const flow of flows.filter(
      (item) =>
        item.type === "bpmn.sequenceFlow" &&
        semantic(item)["isDefault"] === true,
    )) {
      const source = members.find((item) => item.id === semantic(flow)["from"]);
      if (source) {
        const sourceXml = semanticContents.find((item) =>
          item.attributes.some(
            (attribute) =>
              attribute.local === "id" &&
              attribute.value === bpmnExportId(source),
          ),
        );
        if (sourceXml)
          (sourceXml.attributes as XmlAttribute[]).push({
            name: "default",
            local: "default",
            value: bpmnExportId(flow),
          });
      }
    }
    const artifactXml = artifacts
      .filter((item) => belongsToProcess(item, participantId))
      .filter((item) => subprocessScope(item) === undefined)
      .map(artifactXmlElement);
    const associationXml = flows
      .filter((item) => item.type === "bpmn.association")
      .filter((item) => {
        const from = byId.get(String(semantic(item)["from"]));
        const to = byId.get(String(semantic(item)["to"]));
        const owner =
          (from && ownerParticipant(from)) || (to && ownerParticipant(to));
        return !hasParticipants || participantId === "orphan"
          ? owner === undefined
          : owner === participantId;
      })
      .map((item) =>
        element("bpmn:association", {
          id: bpmnExportId(item),
          sourceRef: idOf(String(semantic(item)["from"])),
          targetRef: idOf(String(semantic(item)["to"])),
          associationDirection:
            semantic(item)["direction"] === "one"
              ? "One"
              : semantic(item)["direction"] === "both"
                ? "Both"
                : undefined,
        }),
      );
    processXml.push(
      element("bpmn:process", { id: pid, isExecutable: "false" }, [
        ...(laneSet.length
          ? [
              element(
                "bpmn:laneSet",
                { id: `LaneSet_${participantId || pageId}` },
                laneSet.map(laneXml),
              ),
            ]
          : []),
        ...semanticContents,
        ...dataXml,
        ...flowXml,
        ...associationXml,
        ...artifactXml,
      ]),
    );
  }
  return processXml;
}
