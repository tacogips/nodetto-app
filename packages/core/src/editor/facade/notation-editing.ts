import type {
  BreadboardElementType,
  ConnectorPort,
  ConnectorPorts,
  ElementId,
  FractionalIndex,
  PageId,
  ParticipantKind,
  UmlComponentRelationshipKind,
  UseCaseRelationshipKind,
} from "@nodetto/ir";
import type { BpmnFlowType } from "../../bpmn/connection.ts";
import { planBreadboardAnnotation } from "../../breadboard/annotate.ts";
import { planBreadboardRotation } from "../../breadboard/rotate.ts";
import {
  bpmnFlowEndpointIssue,
  checkBpmnSemantic,
  planBpmnConnection,
  planBpmnLane,
  planBpmnReconnect,
} from "../../editor/bpmn.ts";
import {
  buildBreadboardPart,
  planBreadboardSemanticUpdate,
} from "../../editor/breadboard.ts";
import {
  connectByType,
  connectErdTables,
  connectUmlComponents,
  connectUseCases,
  placeUmlPort,
} from "../../editor/connections.ts";
import {
  buildSequenceParticipant,
  nextParticipantOrder,
  planSequenceActivation,
  planSequenceMove,
} from "../../editor/sequence.ts";
import {
  pcbViaSemantic,
  planPcbFootprintRotation,
} from "../../editor/transform.ts";
import type { ApplyOptions, BpmnEditResult } from "../../editor/types.ts";
import type { Vec } from "../../geometry.ts";
import {
  type PcbTrackInput,
  type PcbViaInput,
  pcbInsertIndex,
  roundPcbTrackInput,
} from "../../pcb-board/edit.ts";
import { PageEditing } from "./page-editing.ts";

export class NotationEditing extends PageEditing {
  // ------------------------------------------------------------ breadboard

  createBreadboardPart(
    type: BreadboardElementType,
    at: Vec,
    semantic?: Readonly<Record<string, unknown>>,
    applyOptions: ApplyOptions = {},
  ): ElementId | null {
    const element = buildBreadboardPart(this, this.rng, type, at, semantic);
    if (!element) return null;
    this.apply([{ type: "createElement", element }], applyOptions);
    return element.id;
  }

  rotateBreadboardParts(
    ids: readonly ElementId[],
    quarterTurns: 1 | -1,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const commands = planBreadboardRotation(this.store, ids, quarterTurns);
    if (commands.length === 0) return false;
    this.apply(commands, applyOptions);
    return true;
  }

  updateBreadboardSemantic(
    id: ElementId,
    patch: Readonly<Record<string, unknown>>,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const commands = planBreadboardSemanticUpdate(this.store, id, patch);
    if (!commands) return false;
    this.apply(commands, applyOptions);
    return true;
  }

  annotateBreadboard(pageId: PageId, applyOptions: ApplyOptions = {}): boolean {
    const commands = planBreadboardAnnotation(this.store, pageId);
    if (!commands.length) return false;
    this.apply(commands, applyOptions);
    return true;
  }

  /** Rotate selected PCB footprints without changing their local pad geometry. */
  rotatePcbFootprints(
    ids: readonly ElementId[],
    degrees: number,
    options: ApplyOptions = {},
  ): void {
    const commands = planPcbFootprintRotation(
      this.store,
      this.createShapeContext(),
      ids,
      degrees,
    );
    if (commands.length) this.apply(commands, options);
  }

  /** Add one PCB track; returns an empty id when the target page is not PCB. */
  addPcbTrack(pageId: PageId, input: PcbTrackInput): ElementId {
    if (this.store.getPage(pageId)?.kind !== "pcb") return "";
    const element = this.buildElement("pcb.track", {
      page: pageId,
      index: pcbInsertIndex(this.store, pageId, "pcb.track"),
      semantic: roundPcbTrackInput(input),
    });
    this.apply([
      { type: "createElement", element: { ...element, visual: {} } },
    ]);
    return element.id;
  }

  /** Add one PCB via; returns an empty id when the target page is not PCB. */
  addPcbVia(pageId: PageId, input: PcbViaInput): ElementId {
    if (this.store.getPage(pageId)?.kind !== "pcb") return "";
    const element = this.buildElement("pcb.via", {
      page: pageId,
      index: pcbInsertIndex(this.store, pageId, "pcb.via"),
      semantic: pcbViaSemantic(input),
    });
    this.apply([
      { type: "createElement", element: { ...element, visual: {} } },
    ]);
    return element.id;
  }

  // --------------------------------------------------------------- connect

  /** Move one sequence participant/message by one semantic timeline slot. */
  moveSequenceElement(
    id: ElementId,
    delta: -1 | 1,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const commands = planSequenceMove(this, this.rng, id, delta);
    if (!commands) return false;
    this.apply(commands, applyOptions);
    return true;
  }

  /** Place one ordered sequence participant with its header at a page point. */
  createSequenceParticipant(
    kind: ParticipantKind,
    centre: Vec,
    applyOptions: ApplyOptions = {},
  ): ElementId {
    const element = buildSequenceParticipant(this, this.rng, kind, centre);
    this.apply([{ type: "createElement", element }], applyOptions);
    return element.id;
  }

  /** Create an activation bar spanning this participant's current messages. */
  createSequenceActivation(
    participantId: ElementId,
    applyOptions: ApplyOptions = {},
  ): ElementId | null {
    const plan = planSequenceActivation(this, this.rng, participantId);
    if (!plan) return null;
    this.apply(plan.commands, applyOptions);
    return plan.id;
  }

  /**
   * Connect two elements with the connector their types call for: two ERD
   * tables get a relation, two UML classes an association, two sequence
   * participants a timeline message, and anything else a generic edge.
   * `null` for the same cases `connect` refuses.
   */
  connectSmart(
    from: ElementId,
    to: ElementId,
    applyOptions: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): ElementId | null {
    return connectByType(this, this.rng, from, to, applyOptions, ports);
  }

  /** Logical relations and enforced foreign keys share endpoint mappings. */
  connectErdRelation(
    from: ElementId,
    to: ElementId,
    logical: boolean,
    options: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): ElementId | null {
    return connectErdTables(this, from, to, logical, options, ports);
  }

  /** Component relationships never borrow class-association semantics. */
  connectComponent(
    from: ElementId,
    to: ElementId,
    kind: UmlComponentRelationshipKind,
    options: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): ElementId | null {
    return connectUmlComponents(this, from, to, kind, options, ports);
  }

  /** Use-case relationships connect actors, use cases and systems only. */
  connectUseCase(
    from: ElementId,
    to: ElementId,
    kind: UseCaseRelationshipKind,
    options: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): ElementId | null {
    return connectUseCases(this, from, to, kind, options, ports);
  }

  /** Click a component to attach a port to its nearest boundary. */
  createUmlPort(ownerId: ElementId, point: Vec): ElementId | null {
    return placeUmlPort(this, ownerId, point);
  }

  // ------------------------------------------------------------------ bpmn

  connectBpmn(
    from: ElementId,
    to: ElementId,
    requested?: BpmnFlowType,
    applyOptions: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): BpmnEditResult {
    const plan = planBpmnConnection(
      this.store,
      this.createShapeContext(),
      from,
      to,
      requested,
      ports,
    );
    if (!plan.ok) return this.rejectBpmn(plan);
    const id = this.createElement(
      plan.type,
      { page: plan.page, semantic: plan.semantic },
      applyOptions,
    );
    return { ok: true, id, type: plan.type };
  }

  nextParticipantOrderOn(page: PageId): FractionalIndex {
    return nextParticipantOrder(this.store, this.rng, page);
  }

  bpmnFlowIssue(
    flowType: string,
    from: ElementId,
    to: ElementId,
    overlay?: { readonly id: ElementId; readonly type: string },
  ): string | null {
    const snapshot = this.store.getSnapshot();
    const document = overlay
      ? {
          ...snapshot,
          elements: snapshot.elements.map((element) =>
            element.id === overlay.id
              ? { ...element, type: overlay.type }
              : element,
          ),
        }
      : snapshot;
    return bpmnFlowEndpointIssue(document, flowType, from, to);
  }

  reconnectBpmnFlow(
    id: ElementId,
    end: "from" | "to",
    target: ElementId,
    applyOptions: ApplyOptions = {},
    port?: ConnectorPort,
  ): BpmnEditResult {
    const plan = planBpmnReconnect(this.store, id, end, target, port);
    if (!plan.ok) return this.rejectBpmn(plan);
    this.apply(plan.commands, applyOptions);
    return { ok: true, id, type: plan.type };
  }

  updateBpmnSemantic(
    id: ElementId,
    semantic: unknown,
    applyOptions: ApplyOptions = {},
  ): BpmnEditResult {
    const check = checkBpmnSemantic(this.store, id, semantic);
    if (!check.ok) return this.rejectBpmn(check);
    this.apply([{ type: "updateSemantic", id, semantic }], applyOptions);
    return { ok: true, id, type: check.type };
  }

  addBpmnLane(
    parentId: ElementId,
    applyOptions: ApplyOptions = {},
  ): BpmnEditResult {
    const plan = planBpmnLane(this, this.rng, this.idSource, parentId);
    if (!plan.ok) return this.rejectBpmn(plan);
    this.apply(plan.commands, applyOptions);
    return { ok: true, id: plan.id, type: "bpmn.lane" };
  }
}
