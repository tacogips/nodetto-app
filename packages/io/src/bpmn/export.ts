import type { Document } from "@nodetto/ir";
import {
  parseXml,
  serializeXml,
  type XmlAttribute,
  type XmlElement,
} from "./xml.ts";
import { bpmnExportId } from "./ids.ts";
import {
  BPMNDI,
  type BpmnExportOptions,
  type BpmnExportReport,
  type BpmnExportWarning,
  DC,
  DI,
  element,
  MODEL,
  semantic,
  XSI,
} from "./export-common.ts";
import { collectExportScope } from "./export-scope.ts";
import { processElements } from "./export-process.ts";
import { diagramElement } from "./export-diagram.ts";

export type {
  BpmnExportOptions,
  BpmnExportReport,
  BpmnExportWarning,
} from "./export-common.ts";

export function exportBpmnXml(
  document: Document,
  pageId: string,
  options: BpmnExportOptions = {},
): BpmnExportReport {
  const warnings: BpmnExportWarning[] = [];
  const scope = collectExportScope(document, pageId, warnings);
  const { extension, participants, flows, idOf, processId } = scope;
  const attrNamespace = (prefix: string, uri: string): XmlAttribute => ({
    name: `xmlns:${prefix}`,
    prefix: "xmlns",
    local: prefix,
    ns: "http://www.w3.org/2000/xmlns/",
    value: uri,
  });
  const namespaces: XmlAttribute[] = [
    attrNamespace("bpmn", MODEL),
    attrNamespace("bpmndi", BPMNDI),
    attrNamespace("dc", DC),
    attrNamespace("di", DI),
    attrNamespace("xsi", XSI),
  ];
  const foreign = extension["namespaces"];
  if (foreign && typeof foreign === "object")
    for (const [prefix, uri] of Object.entries(
      foreign as Record<string, unknown>,
    ).sort(([a], [b]) => a.localeCompare(b)))
      if (
        typeof uri === "string" &&
        prefix &&
        !["bpmn", "bpmndi", "dc", "di", "xsi"].includes(prefix)
      )
        namespaces.push(attrNamespace(prefix, uri));
  const participantsXml = participants.map((item) => {
    const s = semantic(item);
    const id = bpmnExportId(item);
    const processRef = s["collapsed"] === true ? undefined : processId(item.id);
    return element("bpmn:participant", {
      id,
      name: typeof s["name"] === "string" ? s["name"] : undefined,
      processRef,
    });
  });
  const collaborationId =
    typeof extension["collaborationId"] === "string"
      ? extension["collaborationId"]
      : `Collaboration_${pageId}`;
  const collaborationXml = participants.length
    ? [
        element(
          "bpmn:collaboration",
          { id: collaborationId },
          participantsXml.concat(
            flows
              .filter((item) => item.type === "bpmn.messageFlow")
              .map((item) =>
                element("bpmn:messageFlow", {
                  id: bpmnExportId(item),
                  name:
                    typeof semantic(item)["name"] === "string"
                      ? (semantic(item)["name"] as string)
                      : undefined,
                  sourceRef: idOf(String(semantic(item)["from"])),
                  targetRef: idOf(String(semantic(item)["to"])),
                  messageRef: semantic(item)["messageRef"] as
                    | string
                    | undefined,
                }),
              ),
          ),
        ),
      ]
    : [];
  const processXml = processElements(scope);
  const rootExtras = Array.isArray(extension["rootElements"])
    ? (extension["rootElements"] as unknown[]).flatMap((item) =>
        typeof item === "string" ? [parseXml(item)] : [],
      )
    : [];
  const unsupported = Array.isArray(extension["unsupported"])
    ? (extension["unsupported"] as unknown[]).flatMap((item) =>
        typeof item === "string" ? [parseXml(item)] : [],
      )
    : [];
  const diagram = diagramElement(scope, collaborationId, options);
  const rootAttrs = namespaces.concat([
    {
      name: "id",
      local: "id",
      value:
        typeof extension["definitionsId"] === "string"
          ? (extension["definitionsId"] as string)
          : `Definitions_${pageId}`,
    },
    {
      name: "targetNamespace",
      local: "targetNamespace",
      value:
        typeof extension["targetNamespace"] === "string"
          ? (extension["targetNamespace"] as string)
          : "http://bpmn.io/schema/bpmn",
    },
  ]);
  const root: XmlElement = {
    name: "bpmn:definitions",
    prefix: "bpmn",
    local: "definitions",
    ns: MODEL,
    attributes: rootAttrs,
    children: [
      ...collaborationXml,
      ...processXml,
      ...rootExtras,
      ...unsupported,
      diagram,
    ],
  };
  return { xml: serializeXml(root), warnings };
}
