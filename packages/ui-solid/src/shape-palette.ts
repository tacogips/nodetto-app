import { Tool, type ToolKind } from "./tools.ts";
import { workspaceById, type WorkspaceId } from "./workspaces.ts";

export const PALETTE_ICONS = {
  view: "M2 16Q16 1 30 16Q16 31 2 16zM21 16a5 5 0 11-10 0 5 5 0 0110 0z",
  materializedView: "M3 6h20v17H3zM3 12h20M10 12v11M8 27h20V11M13 7v5",
  function:
    "M17 4h-3c-3 0-3 3-3 6v16c0 3-2 3-4 3M6 12h13M23 9c-4 5-4 11 0 16M29 9c4 5 4 11 0 16M23 14l6 6m0-6l-6 6",
  procedure:
    "M4 3h24v26H4zM9 9h10M9 16h10M9 23h10M23 7l3 2-3 2m0 3l3 2-3 2m0 3l3 2-3 2",
  relation: "M2 16h5m4 0h5m4 0h5M25 16l5-7m-5 7l5 7",
  foreignKey:
    "M2 16h18M20 16l4-7m-4 7l4 7M10 7a4 4 0 11-8 0 4 4 0 018 0zM10 7h11m-3 0v4m3-4v3",
  initial:
    "M16 6a10 10 0 110 20 10 10 0 010-20zM16 10a6 6 0 110 12 6 6 0 010-12z",
  final: "M16 3a13 13 0 110 26 13 13 0 010-26zM16 9a7 7 0 110 14 7 7 0 010-14z",
  draw: "M4 25l3-8L22 2l8 8-15 15-8 3zM19 5l8 8",
  component: "M7 5h22v23H7zM3 10h8v5H3zM3 20h8v5H3z",
  provided: "M2 16h10m16 0a8 8 0 11-16 0 8 8 0 0116 0z",
  required: "M2 16h12m12-9a9 9 0 000 18",
  port: "M3 4h22v24H3zM21 12h8v8h-8z",
  rect: "M4 7h24v18H4z",
  ellipse: "M29 16a13 9 0 11-26 0 13 9 0 0126 0z",
  diamond: "M16 3l13 13-13 13L3 16z",
  cylinder: "M5 8a11 4 0 0022 0v16a11 4 0 01-22 0zm0 0a11 4 0 1122 0",
  triangle: "M16 4l13 24H3z",
  hexagon: "M9 5h14l8 11-8 11H9L1 16z",
  parallelogram: "M10 6h20l-8 20H2z",
  star: "M16 2l4 9 10 1-8 7 3 11-9-6-9 6 3-11-8-7 10-1z",
  trapezoid: "M8 7h16l6 18H2z",
  pentagon: "M16 3l13 10-5 16H8L3 13z",
  octagon: "M11 3h10l8 8v10l-8 8H11l-8-8V11z",
  cross: "M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9z",
  blockArrow: "M2 11h17V4l11 12-11 12v-7H2z",
  chevron: "M2 6h20l8 10-8 10H2l8-10z",
  cloud: "M9 26a6 6 0 01-1-12 8 8 0 0115-3 6 6 0 012 15z",
  callout: "M3 4h26v17H15l-7 7v-7H3z",
  foldedNote: "M4 3h17l7 7v19H4zM21 3v7h7",
  cube: "M3 3h20l6 6v20H9l-6-6zM3 3l6 6h20M9 9v20",
  document: "M3 4h26v19c-5-3-9 0-13 2s-8 1-13-1z",
  manualInput: "M3 12l26-6v20H3z",
  delay: "M3 6h15a10 10 0 010 20H3z",
  predefinedProcess: "M3 7h26v18H3zM8 7v18M24 7v18",
  internalStorage: "M3 5h26v22H3zM9 5v22M3 11h26",
  offPage: "M5 3h22v17l-11 9-11-9z",
  card: "M10 4h19v24H3V11z",
  text: "M5 6h22M16 6v21M11 27h10",
  note: "M4 3h17l7 7v19H4zM21 3v7h7M9 16h14M9 22h10",
  node: "M7 6h18a4 4 0 014 4v12a4 4 0 01-4 4H7a4 4 0 01-4-4V10a4 4 0 014-4zM10 16h12",
  edge: "M3 25h9V8h16m-6-6l6 6-6 6",
  frame: "M3 10V3h7m12 0h7v7m0 12v7h-7m-12 0H3v-7M7 7h18v18H7z",
  table: "M3 4h26v24H3zM3 11h26M3 19h26M13 11v17",
  class: "M3 3h26v26H3zM3 11h26M3 20h26M9 7h14M8 16h9M8 25h12",
  actor: "M20 6a4 4 0 11-8 0 4 4 0 018 0zM16 10v12M7 15h18M16 22l-8 8m8-8l8 8",
  service: "M4 5h24v15H4zM16 20v10M11 25h10",
  board: "M3 4h26v24H3zM7 8h18M7 13h18M7 18h18M7 23h18",
  resistor: "M2 16h5l3-7 5 14 5-14 3 7h5",
  led: "M7 8l16 8-16 8zM25 8v16M24 6l4-4m-4 9l4-4",
  capacitor: "M3 16h10m0-10v20m5-20v20m0-10h11",
  transistor: "M9 7v18m0-9h8m-3-5l7-7m-7 17l7 7M18 11l-1-6 6 2m-6 11l-1 6 6-2",
  wire: "M3 25h9V8h14",
} as const;

export interface ShapePaletteItem {
  readonly tool: ToolKind;
  readonly label: string;
  readonly icon: keyof typeof PALETTE_ICONS;
}

export const UI_CONTROL_SHAPES: readonly ShapePaletteItem[] = [
  { tool: Tool.Radio, label: "Radio button", icon: "ellipse" },
  { tool: Tool.Tabs, label: "Navigation tabs", icon: "table" },
  { tool: Tool.Progress, label: "Progress", icon: "node" },
  { tool: Tool.Button, label: "Button", icon: "node" },
  { tool: Tool.Input, label: "Input", icon: "rect" },
  { tool: Tool.Textarea, label: "Textarea", icon: "note" },
  { tool: Tool.SelectControl, label: "Select", icon: "rect" },
  { tool: Tool.Checkbox, label: "Checkbox", icon: "rect" },
  { tool: Tool.Toggle, label: "Switch", icon: "node" },
];

export const COMMON_SHAPES: readonly ShapePaletteItem[] = [
  { tool: Tool.Rectangle, label: "Rectangle", icon: "rect" },
  { tool: Tool.Ellipse, label: "Ellipse", icon: "ellipse" },
  { tool: Tool.Diamond, label: "Diamond", icon: "diamond" },
  { tool: Tool.Cylinder, label: "Cylinder", icon: "cylinder" },
  { tool: Tool.Triangle, label: "Triangle", icon: "triangle" },
  { tool: Tool.Hexagon, label: "Hexagon", icon: "hexagon" },
  { tool: Tool.Parallelogram, label: "Parallelogram", icon: "parallelogram" },
  { tool: Tool.Star, label: "Star", icon: "star" },
  { tool: Tool.Trapezoid, label: "Trapezoid", icon: "trapezoid" },
  { tool: Tool.Pentagon, label: "Pentagon", icon: "pentagon" },
  { tool: Tool.Octagon, label: "Octagon", icon: "octagon" },
  { tool: Tool.Cross, label: "Cross", icon: "cross" },
  { tool: Tool.BlockArrow, label: "Block arrow", icon: "blockArrow" },
  { tool: Tool.Chevron, label: "Chevron", icon: "chevron" },
  { tool: Tool.Cloud, label: "Cloud", icon: "cloud" },
  { tool: Tool.Callout, label: "Callout", icon: "callout" },
  { tool: Tool.FoldedNote, label: "Folded note", icon: "foldedNote" },
  { tool: Tool.Cube, label: "Cube", icon: "cube" },
  { tool: Tool.Text, label: "Text", icon: "text" },
  { tool: Tool.Note, label: "Note", icon: "note" },
  { tool: Tool.Node, label: "Node", icon: "node" },
  { tool: Tool.Connector, label: "Connector", icon: "edge" },
  { tool: Tool.Frame, label: "Frame", icon: "frame" },
];

export const FLOWCHART_SHAPES: readonly ShapePaletteItem[] = [
  { tool: Tool.FlowStart, label: "Start", icon: "ellipse" },
  { tool: Tool.FlowEnd, label: "End", icon: "ellipse" },
  { tool: Tool.FlowProcess, label: "Process", icon: "rect" },
  { tool: Tool.FlowDecision, label: "Decision", icon: "diamond" },
  {
    tool: Tool.FlowInputOutput,
    label: "Input / Output",
    icon: "parallelogram",
  },
  { tool: Tool.FlowDatabase, label: "Database", icon: "cylinder" },
  { tool: Tool.Document, label: "Document", icon: "document" },
  { tool: Tool.ManualInput, label: "Manual input", icon: "manualInput" },
  { tool: Tool.Delay, label: "Delay", icon: "delay" },
  {
    tool: Tool.PredefinedProcess,
    label: "Predefined process",
    icon: "predefinedProcess",
  },
  {
    tool: Tool.InternalStorage,
    label: "Internal storage",
    icon: "internalStorage",
  },
  { tool: Tool.OffPage, label: "Off-page connector", icon: "offPage" },
  { tool: Tool.Card, label: "Card", icon: "card" },
];

export const DIAGRAM_SHAPES: readonly ShapePaletteItem[] = [
  ...FLOWCHART_SHAPES,
  { tool: Tool.State, label: "State", icon: "node" },
  { tool: Tool.InitialState, label: "Initial", icon: "initial" },
  { tool: Tool.FinalState, label: "Final", icon: "final" },
  { tool: Tool.ChoiceState, label: "Choice", icon: "diamond" },
  { tool: Tool.StateTransition, label: "Transition", icon: "edge" },
  { tool: Tool.Component, label: "Component", icon: "component" },
  {
    tool: Tool.ProvidedInterface,
    label: "Provided interface",
    icon: "provided",
  },
  {
    tool: Tool.RequiredInterface,
    label: "Required interface",
    icon: "required",
  },
  { tool: Tool.Port, label: "Port", icon: "port" },
  { tool: Tool.Dependency, label: "Dependency", icon: "edge" },
  { tool: Tool.Realization, label: "Realization", icon: "edge" },
  { tool: Tool.ComponentConnector, label: "Component connector", icon: "edge" },
  { tool: Tool.Table, label: "Table", icon: "table" },
  { tool: Tool.View, label: "View", icon: "view" },
  {
    tool: Tool.MaterializedView,
    label: "Materialized view",
    icon: "materializedView",
  },
  { tool: Tool.Function, label: "Function", icon: "function" },
  { tool: Tool.Procedure, label: "Procedure", icon: "procedure" },
  { tool: Tool.Relation, label: "Relation", icon: "relation" },
  { tool: Tool.ForeignKey, label: "Foreign key", icon: "foreignKey" },
  { tool: Tool.Class, label: "Class", icon: "class" },
  { tool: Tool.Association, label: "Association", icon: "edge" },
  { tool: Tool.Actor, label: "Actor", icon: "actor" },
  { tool: Tool.Service, label: "Service", icon: "service" },
  { tool: Tool.Database, label: "Database", icon: "cylinder" },
  { tool: Tool.SequenceMessage, label: "Message", icon: "edge" },
];

export const BPMN_SHAPES: readonly ShapePaletteItem[] = [
  { tool: Tool.BpmnPool, label: "Pool", icon: "frame" },
  { tool: Tool.BpmnPoolCollapsed, label: "Pool collapsed", icon: "frame" },
  { tool: Tool.BpmnLane, label: "Lane", icon: "frame" },
  { tool: Tool.BpmnTask, label: "Task", icon: "rect" },
  { tool: Tool.BpmnUserTask, label: "User task", icon: "rect" },
  { tool: Tool.BpmnServiceTask, label: "Service task", icon: "rect" },
  { tool: Tool.BpmnStartEvent, label: "Start event", icon: "ellipse" },
  { tool: Tool.BpmnMessageCatch, label: "Message catch", icon: "ellipse" },
  { tool: Tool.BpmnMessageThrow, label: "Message throw", icon: "ellipse" },
  { tool: Tool.BpmnTimerCatch, label: "Timer catch", icon: "ellipse" },
  { tool: Tool.BpmnEndEvent, label: "End event", icon: "ellipse" },
  {
    tool: Tool.BpmnExclusiveGateway,
    label: "Exclusive gateway",
    icon: "diamond",
  },
  {
    tool: Tool.BpmnParallelGateway,
    label: "Parallel gateway",
    icon: "diamond",
  },
  { tool: Tool.BpmnSubProcess, label: "Sub process", icon: "frame" },
  {
    tool: Tool.BpmnSubProcessExpanded,
    label: "Sub process expanded",
    icon: "frame",
  },
  { tool: Tool.BpmnCallActivity, label: "Call activity", icon: "rect" },
  { tool: Tool.BpmnDataObject, label: "Data object", icon: "rect" },
  { tool: Tool.BpmnDataStore, label: "Data store", icon: "cylinder" },
  { tool: Tool.BpmnTextAnnotation, label: "Text annotation", icon: "text" },
  { tool: Tool.BpmnGroup, label: "Group", icon: "frame" },
];

export const BREADBOARD_SHAPES: readonly ShapePaletteItem[] = [
  { tool: Tool.BreadboardFull, label: "Full board", icon: "board" },
  { tool: Tool.BreadboardHalf, label: "Half board", icon: "board" },
  { tool: Tool.BreadboardMini, label: "Mini board", icon: "board" },
  { tool: Tool.BreadboardResistor, label: "Resistor", icon: "resistor" },
  { tool: Tool.BreadboardLed, label: "LED", icon: "led" },
  {
    tool: Tool.BreadboardCapacitorCeramic,
    label: "Ceramic capacitor",
    icon: "capacitor",
  },
  {
    tool: Tool.BreadboardCapacitorElectrolytic,
    label: "Electrolytic capacitor",
    icon: "capacitor",
  },
  { tool: Tool.BreadboardDiode, label: "Diode", icon: "led" },
  { tool: Tool.BreadboardNpn, label: "NPN transistor", icon: "transistor" },
  { tool: Tool.BreadboardPnp, label: "PNP transistor", icon: "transistor" },
  { tool: Tool.BreadboardButton, label: "Push button", icon: "node" },
  {
    tool: Tool.BreadboardPotentiometer,
    label: "Potentiometer",
    icon: "resistor",
  },
  { tool: Tool.BreadboardIc, label: "DIP IC", icon: "node" },
  { tool: Tool.BreadboardHeader, label: "Pin header", icon: "node" },
  { tool: Tool.BreadboardBattery, label: "Battery", icon: "node" },
  { tool: Tool.BreadboardWire, label: "Wire", icon: "wire" },
];

export const INTERACTION_SHAPES: readonly ShapePaletteItem[] = [
  { tool: Tool.ScreenTransition, label: "Screen transition", icon: "edge" },
  { tool: Tool.PopupFrame, label: "Popup / dialog", icon: "frame" },
  { tool: Tool.BottomSheetFrame, label: "Bottom sheet", icon: "frame" },
  { tool: Tool.PopoverFrame, label: "Popover", icon: "frame" },
];

export const ARTBOARD_SHAPES: readonly ShapePaletteItem[] = [
  { tool: Tool.WebFrame, label: "Web", icon: "frame" },
  { tool: Tool.IPhoneFrame, label: "iPhone", icon: "frame" },
  { tool: Tool.AndroidFrame, label: "Android", icon: "frame" },
  { tool: Tool.TabletFrame, label: "Tablet", icon: "frame" },
  { tool: Tool.PaperFrame, label: "Document", icon: "frame" },
];

/** Ordered authoring priorities; every workspace must make an explicit choice. */
const PRIMARY_TOOLS = {
  bpmn: [
    Tool.BpmnStartEvent,
    Tool.BpmnTask,
    Tool.BpmnExclusiveGateway,
    Tool.BpmnEndEvent,
    Tool.BpmnPool,
    Tool.BpmnLane,
    Tool.Connector,
    Tool.Text,
    Tool.Frame,
  ],
  breadboard: [
    Tool.BreadboardHalf,
    Tool.BreadboardResistor,
    Tool.BreadboardLed,
    Tool.BreadboardButton,
    Tool.BreadboardWire,
  ],
  component: [
    Tool.Component,
    Tool.ProvidedInterface,
    Tool.RequiredInterface,
    Tool.Port,
    Tool.Dependency,
    Tool.Realization,
    Tool.ComponentConnector,
    Tool.Text,
    Tool.Frame,
  ],
  erd: [
    Tool.Table,
    Tool.View,
    Tool.MaterializedView,
    Tool.Function,
    Tool.Procedure,
    Tool.Relation,
    Tool.ForeignKey,
    Tool.Text,
    Tool.Frame,
  ],
  flowchart: [
    ...FLOWCHART_SHAPES.map((item) => item.tool),
    Tool.Connector,
    Tool.Text,
  ],
  state: [
    Tool.State,
    Tool.InitialState,
    Tool.FinalState,
    Tool.ChoiceState,
    Tool.StateTransition,
    Tool.Text,
  ],
  class: [Tool.Class, Tool.Association, Tool.Text, Tool.Frame],
  sequence: [
    Tool.Actor,
    Tool.Service,
    Tool.Database,
    Tool.SequenceMessage,
    Tool.Text,
    Tool.Frame,
  ],
  flow: [...COMMON_SHAPES, ...DIAGRAM_SHAPES].map((item) => item.tool),
  app: [
    Tool.IPhoneFrame,
    Tool.AndroidFrame,
    Tool.TabletFrame,
    Tool.Rectangle,
    Tool.Text,
    Tool.Ellipse,
    Tool.Frame,
  ],
  web: [Tool.WebFrame, Tool.Rectangle, Tool.Text, Tool.Ellipse, Tool.Frame],
  all: [...COMMON_SHAPES, ...DIAGRAM_SHAPES].map((item) => item.tool),
} as const satisfies Record<WorkspaceId, readonly ToolKind[]>;

const PALETTE_SHAPES = [
  ...INTERACTION_SHAPES,
  ...UI_CONTROL_SHAPES,
  ...COMMON_SHAPES,
  ...DIAGRAM_SHAPES,
  ...ARTBOARD_SHAPES,
  ...BPMN_SHAPES,
  ...BREADBOARD_SHAPES,
];

/** Preserve semantic workspace labels, such as Relationship or Message. */
export function workspaceShapes(id: WorkspaceId): readonly ShapePaletteItem[] {
  const workspace = workspaceById(id);
  return PRIMARY_TOOLS[id].map((tool) => {
    const item = PALETTE_SHAPES.find((candidate) => candidate.tool === tool);
    if (!item) throw new Error(`Missing palette shape for ${tool}`);
    const label = workspace.tools.find((entry) => entry.tool === tool)?.label;
    return label ? { ...item, label } : item;
  });
}

/** Secondary sections never repeat a tool already shown in the primary grid. */
export function additionalShapes(id: WorkspaceId): readonly ShapePaletteItem[] {
  const primary = new Set<ToolKind>(PRIMARY_TOOLS[id]);
  return (
    id === "bpmn"
      ? [...BPMN_SHAPES, ...COMMON_SHAPES]
      : id === "breadboard"
        ? [...BREADBOARD_SHAPES, ...COMMON_SHAPES]
        : COMMON_SHAPES
  ).filter((item) => !primary.has(item.tool));
}

export function artboardShapes(id: WorkspaceId): readonly ShapePaletteItem[] {
  if (!workspaceById(id).design) return [];
  const primary = new Set<ToolKind>(PRIMARY_TOOLS[id]);
  return ARTBOARD_SHAPES.filter((item) => !primary.has(item.tool));
}

export interface ShapePaletteGroup {
  readonly label: string;
  readonly items: readonly ShapePaletteItem[];
}

/** Group available tools by notation, keeping the active mode's category first. */
export function shapePaletteGroups(
  id: WorkspaceId,
): readonly ShapePaletteGroup[] {
  const items = [
    ...workspaceShapes(id),
    ...additionalShapes(id),
    ...artboardShapes(id),
    ...(workspaceById(id).design ? UI_CONTROL_SHAPES : []),
    ...(["web", "app", "all", "flow"].includes(id) ? INTERACTION_SHAPES : []),
    ...(workspaceById(id).design
      ? [{ tool: Tool.Freehand, label: "Freehand", icon: "draw" } as const]
      : []),
  ];
  const category = (tool: ToolKind): string => {
    if (INTERACTION_SHAPES.some((item) => item.tool === tool))
      return "Screens & transitions";
    if (UI_CONTROL_SHAPES.some((item) => item.tool === tool))
      return "UI controls";
    if (tool === Tool.Connector && id === "bpmn") return "BPMN";
    if (
      [
        Tool.Table,
        Tool.View,
        Tool.MaterializedView,
        Tool.Function,
        Tool.Procedure,
        Tool.Relation,
        Tool.ForeignKey,
      ].some((candidate) => candidate === tool)
    )
      return "ERD";
    if (
      tool === Tool.Actor ||
      tool === Tool.Service ||
      tool === Tool.Database ||
      tool === Tool.SequenceMessage
    )
      return "Sequence";
    if (
      FLOWCHART_SHAPES.some((item) => item.tool === tool) ||
      (id === "flowchart" && tool === Tool.Connector)
    )
      return "Flowchart";
    if (tool.startsWith("state")) return "State transition";
    if (DIAGRAM_SHAPES.some((item) => item.tool === tool)) return "UML";
    if (BPMN_SHAPES.some((item) => item.tool === tool)) return "BPMN";
    if (BREADBOARD_SHAPES.some((item) => item.tool === tool))
      return "Breadboard";
    if (ARTBOARD_SHAPES.some((item) => item.tool === tool)) return "Artboards";
    return "General";
  };
  const groups = new Map<string, ShapePaletteItem[]>();
  for (const item of items) {
    const label = category(item.tool);
    const group = groups.get(label) ?? [];
    group.push(item);
    groups.set(label, group);
  }
  return [...groups].map(([label, items]) => ({ label, items }));
}
