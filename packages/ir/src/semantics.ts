import type { UiControlSemantic } from "./ui-controls.ts";
import type { DatabaseObjectSemantic } from "./database-objects.ts";
import type {
  PcbBoardSemantic,
  PcbFootprintSemantic,
  PcbGraphicSemantic,
  PcbTrackSemantic,
  PcbViaSemantic,
  PcbZoneSemantic,
} from "./pcb.ts";
// Semantic payloads for the v1 element type registry.
// See the product design (nodetto-cloud repo), section 5.2.
//
// Payloads are grouped per element family under `semantics/`; this module
// re-exports them and maps each element type to its payload.

import type {
  GenericNodeSemantic,
  GenericEdgeSemantic,
} from "./semantics/connectors.ts";
import type { ErdTableSemantic, ErdRelationSemantic } from "./semantics/erd.ts";
import type {
  UmlClassSemantic,
  UmlComponentSemantic,
  UmlInterfaceSemantic,
  UmlPortSemantic,
  UmlComponentRelationshipSemantic,
  UmlAssociationSemantic,
  SequenceParticipantSemantic,
  SequenceMessageSemantic,
  SequenceActivationSemantic,
  StateNodeSemantic,
  StateTransitionSemantic,
} from "./semantics/uml.ts";
import type {
  FreehandSemantic,
  PathSemantic,
  GeoShapeSemantic,
  TextNoteSemantic,
  ReviewCommentSemantic,
  TextStyleSemantic,
} from "./semantics/drawing.ts";
import type {
  PageGuideSemantic,
  FrameSemantic,
  GroupSemantic,
  ImageSemantic,
  DesignTokenSemantic,
} from "./semantics/design.ts";
import type {
  BpmnParticipantSemantic,
  BpmnLaneSemantic,
  BpmnTaskSemantic,
  BpmnSubProcessSemantic,
  BpmnCallActivitySemantic,
  BpmnEventSemantic,
  BpmnBoundaryEventSemantic,
  BpmnGatewaySemantic,
  BpmnDataObjectSemantic,
  BpmnDataStoreSemantic,
  BpmnTextAnnotationSemantic,
  BpmnGroupSemantic,
  BpmnSequenceFlowSemantic,
  BpmnMessageFlowSemantic,
  BpmnAssociationSemantic,
  BpmnDataAssociationSemantic,
} from "./semantics/bpmn.ts";
import type {
  BreadboardBoardSemantic,
  BreadboardWireSemantic,
  BreadboardResistorSemantic,
  BreadboardLedSemantic,
  BreadboardCapacitorSemantic,
  BreadboardDiodeSemantic,
  BreadboardTransistorSemantic,
  BreadboardButtonSemantic,
  BreadboardPotentiometerSemantic,
  BreadboardIcSemantic,
  BreadboardHeaderSemantic,
  BreadboardBatterySemantic,
  BreadboardNetlistSemantic,
} from "./semantics/breadboard.ts";

export * from "./semantics/connectors.ts";
export * from "./semantics/erd.ts";
export * from "./semantics/uml.ts";
export * from "./semantics/drawing.ts";
export * from "./semantics/design.ts";
export * from "./semantics/bpmn.ts";
export * from "./semantics/breadboard.ts";

/** Maps every registered element type to its semantic payload type. */
export interface SemanticByType {
  "state.node": StateNodeSemantic;
  "state.transition": StateTransitionSemantic;
  readonly "ui.control": UiControlSemantic;
  "design.token": DesignTokenSemantic;
  "design.guide": PageGuideSemantic;
  "image.raster": ImageSemantic;
  "node.generic": GenericNodeSemantic;
  "edge.generic": GenericEdgeSemantic;
  "erd.table": ErdTableSemantic;
  "erd.view": DatabaseObjectSemantic;
  "erd.materialized-view": DatabaseObjectSemantic;
  "erd.function": DatabaseObjectSemantic;
  "erd.procedure": DatabaseObjectSemantic;
  "erd.relation": ErdRelationSemantic;
  "uml.class": UmlClassSemantic;
  "uml.component": UmlComponentSemantic;
  "uml.interface": UmlInterfaceSemantic;
  "uml.port": UmlPortSemantic;
  "uml.component-relationship": UmlComponentRelationshipSemantic;
  "uml.association": UmlAssociationSemantic;
  "sequence.participant": SequenceParticipantSemantic;
  "sequence.message": SequenceMessageSemantic;
  "sequence.activation": SequenceActivationSemantic;
  "draw.freehand": FreehandSemantic;
  "draw.path": PathSemantic;
  "shape.geo": GeoShapeSemantic;
  "text.note": TextNoteSemantic;
  "review.comment": ReviewCommentSemantic;
  "design.text-style": TextStyleSemantic;
  frame: FrameSemantic;
  group: GroupSemantic;
  "bpmn.participant": BpmnParticipantSemantic;
  "bpmn.lane": BpmnLaneSemantic;
  "bpmn.task": BpmnTaskSemantic;
  "bpmn.subProcess": BpmnSubProcessSemantic;
  "bpmn.callActivity": BpmnCallActivitySemantic;
  "bpmn.event": BpmnEventSemantic;
  "bpmn.boundaryEvent": BpmnBoundaryEventSemantic;
  "bpmn.gateway": BpmnGatewaySemantic;
  "bpmn.dataObject": BpmnDataObjectSemantic;
  "bpmn.dataStore": BpmnDataStoreSemantic;
  "bpmn.textAnnotation": BpmnTextAnnotationSemantic;
  "bpmn.group": BpmnGroupSemantic;
  "bpmn.sequenceFlow": BpmnSequenceFlowSemantic;
  "bpmn.messageFlow": BpmnMessageFlowSemantic;
  "bpmn.association": BpmnAssociationSemantic;
  "bpmn.dataAssociation": BpmnDataAssociationSemantic;
  "breadboard.board": BreadboardBoardSemantic;
  "breadboard.wire": BreadboardWireSemantic;
  "breadboard.resistor": BreadboardResistorSemantic;
  "breadboard.led": BreadboardLedSemantic;
  "breadboard.capacitor": BreadboardCapacitorSemantic;
  "breadboard.diode": BreadboardDiodeSemantic;
  "breadboard.transistor": BreadboardTransistorSemantic;
  "breadboard.button": BreadboardButtonSemantic;
  "breadboard.potentiometer": BreadboardPotentiometerSemantic;
  "breadboard.ic": BreadboardIcSemantic;
  "breadboard.header": BreadboardHeaderSemantic;
  "breadboard.battery": BreadboardBatterySemantic;
  "breadboard.netlist": BreadboardNetlistSemantic;
  "pcb.board": PcbBoardSemantic;
  "pcb.footprint": PcbFootprintSemantic;
  "pcb.track": PcbTrackSemantic;
  "pcb.via": PcbViaSemantic;
  "pcb.zone": PcbZoneSemantic;
  "pcb.graphic": PcbGraphicSemantic;
}

export type ElementType = keyof SemanticByType;
