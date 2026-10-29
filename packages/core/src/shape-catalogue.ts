// The shape catalogue: every shape and connector a person can draw from the
// palette, under the same shape ID the CLI draws with. The palette, the
// `nodetto-cli shapes` listing and `nodetto-cli draw` all read it, so a shape
// added here can be found and drawn everywhere.

import { CONNECTOR_ENDPOINT_TYPES, type ElementId } from "@nodetto/ir";
import type { Editor } from "./editor.ts";
import { connectScreenTransition } from "./screen-transition.ts";
import {
  componentRelationshipFor,
  type CreationTool,
  creationFor,
  Tool,
  type ToolKind,
  typedConnectorFor,
  useCaseRelationshipFor,
} from "./tools.ts";

export const SHAPE_CATEGORIES = [
  { id: "general", label: "General" },
  { id: "flowchart", label: "Flowchart" },
  { id: "uml-class", label: "UML class" },
  { id: "uml-component", label: "UML component" },
  { id: "uml-use-case", label: "UML use case" },
  { id: "uml-sequence", label: "UML sequence" },
  { id: "uml-state", label: "UML state" },
  { id: "erd", label: "ERD" },
  { id: "bpmn", label: "BPMN" },
  { id: "breadboard", label: "Breadboard" },
  { id: "pcb", label: "PCB" },
  { id: "artboard", label: "Artboards" },
  { id: "ui-control", label: "UI controls" },
  { id: "screen", label: "Screens & transitions" },
] as const;

export type ShapeCategoryId = (typeof SHAPE_CATEGORIES)[number]["id"];

export interface ShapeCatalogueEntry {
  /** The shape ID: the palette tool that draws it. */
  readonly id: ToolKind;
  readonly label: string;
  readonly category: ShapeCategoryId;
  /** Connectors join two shapes; every other shape is placed on its own. */
  readonly connector: boolean;
  /** The element type the shape creates. */
  readonly type: string;
}

type Listing = readonly (readonly [ToolKind, string])[];

const LISTINGS: Readonly<Record<ShapeCategoryId, Listing>> = {
  general: [
    [Tool.Rectangle, "Rectangle"],
    [Tool.Ellipse, "Ellipse"],
    [Tool.Diamond, "Diamond"],
    [Tool.Cylinder, "Cylinder"],
    [Tool.Triangle, "Triangle"],
    [Tool.Hexagon, "Hexagon"],
    [Tool.Parallelogram, "Parallelogram"],
    [Tool.Star, "Star"],
    [Tool.Trapezoid, "Trapezoid"],
    [Tool.Pentagon, "Pentagon"],
    [Tool.Octagon, "Octagon"],
    [Tool.Cross, "Cross"],
    [Tool.BlockArrow, "Block arrow"],
    [Tool.Chevron, "Chevron"],
    [Tool.Cloud, "Cloud"],
    [Tool.Callout, "Callout"],
    [Tool.FoldedNote, "Folded note"],
    [Tool.Cube, "Cube"],
    [Tool.DoubleArrow, "Double arrow"],
    [Tool.RightTriangle, "Right triangle"],
    [Tool.Person, "Person"],
    [Tool.Package, "Package"],
    [Tool.Text, "Text"],
    [Tool.Note, "Note"],
    [Tool.Node, "Node"],
    [Tool.Frame, "Frame"],
    [Tool.Connector, "Connector"],
  ],
  flowchart: [
    [Tool.FlowStart, "Start"],
    [Tool.FlowEnd, "End"],
    [Tool.FlowProcess, "Process"],
    [Tool.FlowDecision, "Decision"],
    [Tool.FlowInputOutput, "Input / Output"],
    [Tool.FlowDatabase, "Database"],
    [Tool.Document, "Document"],
    [Tool.ManualInput, "Manual input"],
    [Tool.Delay, "Delay"],
    [Tool.PredefinedProcess, "Predefined process"],
    [Tool.InternalStorage, "Internal storage"],
    [Tool.OffPage, "Off-page connector"],
    [Tool.Card, "Card"],
    [Tool.Tape, "Paper tape"],
    [Tool.StoredData, "Stored data"],
    [Tool.Display, "Display"],
    [Tool.LoopLimit, "Loop limit"],
    [Tool.Collate, "Collate"],
    [Tool.Sort, "Sort"],
    [Tool.SummingJunction, "Summing junction"],
    [Tool.OrJunction, "Or"],
    [Tool.MultiDocument, "Multi-document"],
    [Tool.DirectData, "Direct data"],
    [Tool.SequentialData, "Sequential data"],
  ],
  "uml-class": [
    [Tool.Class, "Class"],
    [Tool.Association, "Association"],
  ],
  "uml-component": [
    [Tool.Component, "Component"],
    [Tool.ProvidedInterface, "Provided interface"],
    [Tool.RequiredInterface, "Required interface"],
    [Tool.Port, "Port"],
    [Tool.Dependency, "Dependency"],
    [Tool.Realization, "Realization"],
    [Tool.ComponentConnector, "Component connector"],
  ],
  "uml-use-case": [
    [Tool.UseCaseActor, "Actor"],
    [Tool.UseCase, "Use case"],
    [Tool.UseCaseSystem, "System boundary"],
    [Tool.UseCaseAssociation, "Association"],
    [Tool.UseCaseInclude, "Include"],
    [Tool.UseCaseExtend, "Extend"],
    [Tool.UseCaseGeneralization, "Generalization"],
  ],
  "uml-sequence": [
    [Tool.Actor, "Actor"],
    [Tool.Service, "Service"],
    [Tool.Database, "Database"],
    [Tool.SequenceMessage, "Message"],
  ],
  "uml-state": [
    [Tool.State, "State"],
    [Tool.InitialState, "Initial"],
    [Tool.FinalState, "Final"],
    [Tool.ChoiceState, "Choice"],
    [Tool.StateTransition, "Transition"],
  ],
  erd: [
    [Tool.Table, "Table"],
    [Tool.View, "View"],
    [Tool.MaterializedView, "Materialized view"],
    [Tool.Function, "Function"],
    [Tool.Procedure, "Procedure"],
    [Tool.Relation, "Relation"],
    [Tool.ForeignKey, "Foreign key"],
  ],
  bpmn: [
    [Tool.BpmnPool, "Pool"],
    [Tool.BpmnPoolCollapsed, "Pool collapsed"],
    [Tool.BpmnLane, "Lane"],
    [Tool.BpmnTask, "Task"],
    [Tool.BpmnUserTask, "User task"],
    [Tool.BpmnServiceTask, "Service task"],
    [Tool.BpmnStartEvent, "Start event"],
    [Tool.BpmnMessageCatch, "Message catch"],
    [Tool.BpmnMessageThrow, "Message throw"],
    [Tool.BpmnTimerCatch, "Timer catch"],
    [Tool.BpmnEndEvent, "End event"],
    [Tool.BpmnExclusiveGateway, "Exclusive gateway"],
    [Tool.BpmnParallelGateway, "Parallel gateway"],
    [Tool.BpmnSubProcess, "Sub process"],
    [Tool.BpmnSubProcessExpanded, "Sub process expanded"],
    [Tool.BpmnCallActivity, "Call activity"],
    [Tool.BpmnDataObject, "Data object"],
    [Tool.BpmnDataStore, "Data store"],
    [Tool.BpmnTextAnnotation, "Text annotation"],
    [Tool.BpmnGroup, "Group"],
  ],
  breadboard: [
    [Tool.BreadboardFull, "Full board"],
    [Tool.BreadboardHalf, "Half board"],
    [Tool.BreadboardMini, "Mini board"],
    [Tool.BreadboardResistor, "Resistor"],
    [Tool.BreadboardLed, "LED"],
    [Tool.BreadboardCapacitorCeramic, "Ceramic capacitor"],
    [Tool.BreadboardCapacitorElectrolytic, "Electrolytic capacitor"],
    [Tool.BreadboardDiode, "Diode"],
    [Tool.BreadboardNpn, "NPN transistor"],
    [Tool.BreadboardPnp, "PNP transistor"],
    [Tool.BreadboardButton, "Push button"],
    [Tool.BreadboardPotentiometer, "Potentiometer"],
    [Tool.BreadboardIc, "DIP IC"],
    [Tool.BreadboardHeader, "Pin header"],
    [Tool.BreadboardBattery, "Battery"],
  ],
  pcb: [[Tool.PcbVia, "Via"]],
  artboard: [
    [Tool.WebFrame, "Web"],
    [Tool.IPhoneFrame, "iPhone"],
    [Tool.AndroidFrame, "Android"],
    [Tool.TabletFrame, "Tablet"],
    [Tool.PaperFrame, "Document"],
  ],
  "ui-control": [
    [Tool.Button, "Button"],
    [Tool.Input, "Input"],
    [Tool.Textarea, "Textarea"],
    [Tool.SelectControl, "Select"],
    [Tool.Checkbox, "Checkbox"],
    [Tool.Toggle, "Switch"],
    [Tool.Radio, "Radio button"],
    [Tool.Tabs, "Navigation tabs"],
    [Tool.Progress, "Progress"],
  ],
  screen: [
    [Tool.PopupFrame, "Popup / dialog"],
    [Tool.BottomSheetFrame, "Bottom sheet"],
    [Tool.PopoverFrame, "Popover"],
    [Tool.ScreenTransition, "Screen transition"],
  ],
};

/** The element type a connector tool creates. */
function connectorTypeFor(tool: ToolKind): string | undefined {
  if (tool === Tool.Connector || tool === Tool.ScreenTransition)
    return "edge.generic";
  if (componentRelationshipFor(tool)) return "uml.component-relationship";
  return typedConnectorFor(tool);
}

function entry(
  category: ShapeCategoryId,
  [id, label]: readonly [ToolKind, string],
): ShapeCatalogueEntry {
  const connectorType = connectorTypeFor(id);
  const type = connectorType ?? creationFor(id)?.type;
  if (!type) throw new Error(`Shape ${id} creates nothing`);
  return { id, label, category, connector: connectorType !== undefined, type };
}

export const SHAPE_CATALOGUE: readonly ShapeCatalogueEntry[] =
  SHAPE_CATEGORIES.flatMap((category) =>
    LISTINGS[category.id].map((listing) => entry(category.id, listing)),
  );

export function shapeCategoryLabel(id: ShapeCategoryId): string {
  return SHAPE_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

export function findShape(id: string): ShapeCatalogueEntry | undefined {
  return SHAPE_CATALOGUE.find((shape) => shape.id === id);
}

export interface ShapeSearch {
  /** Words that must all appear in the ID, label, category or element type. */
  readonly query?: string;
  /**
   * A category ID or label; a prefix ending at a hyphen also matches, so
   * "uml" finds every UML category.
   */
  readonly category?: string;
  readonly connector?: boolean;
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export function categoryMatches(id: ShapeCategoryId, query: string): boolean {
  const wanted = normalized(query);
  return (
    !wanted ||
    id === wanted ||
    id.startsWith(`${wanted}-`) ||
    normalized(shapeCategoryLabel(id)) === wanted
  );
}

/** Shapes matching every given criterion, in catalogue order. */
export function searchShapes(
  search: ShapeSearch = {},
  shapes: readonly ShapeCatalogueEntry[] = SHAPE_CATALOGUE,
): readonly ShapeCatalogueEntry[] {
  const words = normalized(search.query ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return shapes.filter((shape) => {
    if (search.connector !== undefined && shape.connector !== search.connector)
      return false;
    if (
      search.category !== undefined &&
      !categoryMatches(shape.category, search.category)
    )
      return false;
    const haystack = normalized(
      `${shape.id} ${shape.label} ${shape.category} ${shapeCategoryLabel(shape.category)} ${shape.type}`,
    );
    return words.every((word) => haystack.includes(word));
  });
}

/** What placing a (non-connector) shape creates, or null for connectors. */
export function shapeCreation(id: ToolKind): CreationTool | null {
  return connectorTypeFor(id) ? null : creationFor(id);
}

/**
 * Join two elements with a connector shape, as dragging with that palette
 * tool does. Null when the shape is not a connector or its notation does not
 * allow these endpoints.
 */
export function connectShape(
  editor: Editor,
  id: ToolKind,
  from: ElementId,
  to: ElementId,
): ElementId | null {
  const kind = componentRelationshipFor(id);
  if (kind) return editor.connectComponent(from, to, kind);
  const useCaseKind = useCaseRelationshipFor(id);
  if (useCaseKind) return editor.connectUseCase(from, to, useCaseKind);
  if (id === Tool.Relation || id === Tool.ForeignKey)
    return editor.connectErdRelation(from, to, id === Tool.Relation);
  if (id === Tool.ScreenTransition)
    return connectScreenTransition(editor, from, to);
  if (id === Tool.Connector) {
    const source = editor.store.get(from);
    const target = editor.store.get(to);
    if (!source || !target || source.page !== target.page) return null;
    return editor.createElement("edge.generic", {
      page: source.page,
      semantic: { from, to, arrowheads: { end: "arrow" } },
    });
  }
  const expected = typedConnectorFor(id);
  const ends = expected ? CONNECTOR_ENDPOINT_TYPES[expected] : undefined;
  const fits = (end: ElementId) => {
    const type = editor.store.get(end)?.type;
    return type !== undefined && ends?.includes(type) === true;
  };
  // Typed connectors are what connecting their own notation creates.
  return fits(from) && fits(to) ? editor.connectSmart(from, to) : null;
}
