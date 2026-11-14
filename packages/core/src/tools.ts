// One catalogue defines the supported tools, their named values, and ToolKind.
// String literal values preserve existing tool IDs, which double as the shape
// IDs the CLI draws with.

import {
  type GeoKind,
  type ParticipantKind,
  UmlComponentRelationship,
  type UmlComponentRelationshipKind,
  UmlComponentType,
  type UseCaseRelationshipKind,
  type Visual,
} from "@nodetto/ir";
import { FRAME_PRESETS } from "./shapes/frame.ts";
import { USECASE_NODE_SIZES } from "./shapes/usecase.ts";

export const Tool = {
  BpmnPool: "bpmn:pool",
  BpmnPoolCollapsed: "bpmn:pool-collapsed",
  BpmnLane: "bpmn:lane",
  BpmnTask: "bpmn:task",
  BpmnUserTask: "bpmn:user-task",
  BpmnServiceTask: "bpmn:service-task",
  BpmnStartEvent: "bpmn:start-event",
  BpmnMessageCatch: "bpmn:message-catch",
  BpmnMessageThrow: "bpmn:message-throw",
  BpmnTimerCatch: "bpmn:timer-catch",
  BpmnEndEvent: "bpmn:end-event",
  BpmnExclusiveGateway: "bpmn:exclusive-gateway",
  BpmnParallelGateway: "bpmn:parallel-gateway",
  BpmnSubProcess: "bpmn:sub-process",
  BpmnSubProcessExpanded: "bpmn:sub-process-expanded",
  BpmnCallActivity: "bpmn:call-activity",
  BpmnDataObject: "bpmn:data-object",
  BpmnDataStore: "bpmn:data-store",
  BpmnTextAnnotation: "bpmn:text-annotation",
  BpmnGroup: "bpmn:group",

  BreadboardFull: "breadboard:board-full",
  BreadboardHalf: "breadboard:board-half",
  BreadboardMini: "breadboard:board-mini",
  BreadboardResistor: "breadboard:resistor",
  BreadboardLed: "breadboard:led",
  BreadboardCapacitorCeramic: "breadboard:capacitor-ceramic",
  BreadboardCapacitorElectrolytic: "breadboard:capacitor-electrolytic",
  BreadboardDiode: "breadboard:diode",
  BreadboardNpn: "breadboard:npn",
  BreadboardPnp: "breadboard:pnp",
  BreadboardButton: "breadboard:button",
  BreadboardPotentiometer: "breadboard:potentiometer",
  BreadboardIc: "breadboard:ic",
  BreadboardHeader: "breadboard:header",
  BreadboardBattery: "breadboard:battery",
  BreadboardWire: "breadboard:wire",
  PcbTrack: "pcb:track",
  PcbVia: "pcb:via",

  Select: "select",
  Hand: "hand",
  Comment: "comment",
  Freehand: "draw.freehand",
  EditPoints: "edit.points",
  EditFill: "edit.paint",
  EditStroke: "edit.stroke-paint",
  Crop: "crop",
  Connector: "edge",
  ScreenTransition: "prototype:transition",
  PopupFrame: "frame:popup",
  BottomSheetFrame: "frame:bottom-sheet",
  PopoverFrame: "frame:popover",
  Relation: "erd.relation",
  ForeignKey: "erd.foreign-key",
  Association: "uml.association",
  SequenceMessage: "sequence.message",
  Button: "ui:button",
  Input: "ui:input",
  Textarea: "ui:textarea",
  SelectControl: "ui:select",
  Checkbox: "ui:checkbox",
  Toggle: "ui:switch",
  Radio: "ui:radio",
  Tabs: "ui:tabs",
  Progress: "ui:progress",
  Node: "node.generic",
  Text: "text.note",
  Note: "text.note:note",
  Table: "erd.table",
  View: "erd.view",
  MaterializedView: "erd.materialized-view",
  Function: "erd.function",
  Procedure: "erd.procedure",
  Class: "uml.class",
  FlowStart: "flowchart:start",
  FlowEnd: "flowchart:end",
  FlowProcess: "flowchart:process",
  FlowDecision: "flowchart:decision",
  FlowInputOutput: "flowchart:input-output",
  FlowDatabase: "flowchart:database",
  State: "state:state",
  InitialState: "state:initial",
  FinalState: "state:final",
  ChoiceState: "state:choice",
  StateTransition: "state.transition",
  Component: UmlComponentType.Component,
  ProvidedInterface: "uml.interface:provided",
  RequiredInterface: "uml.interface:required",
  Port: UmlComponentType.Port,
  Dependency: "uml.component:dependency",
  Realization: "uml.component:realization",
  ComponentConnector: "uml.component:connector",
  UseCaseActor: "usecase:actor",
  UseCase: "usecase:usecase",
  UseCaseSystem: "usecase:system",
  UseCaseAssociation: "usecase:association",
  UseCaseInclude: "usecase:include",
  UseCaseExtend: "usecase:extend",
  UseCaseGeneralization: "usecase:generalization",
  Actor: "sequence.actor",
  Service: "sequence.service",
  Database: "sequence.database",
  Frame: "frame",
  WebFrame: "frame:web",
  IPhoneFrame: "frame:iphone",
  AndroidFrame: "frame:android",
  TabletFrame: "frame:tablet",
  PaperFrame: "frame:paper",
  Rectangle: "geo:rect",
  Ellipse: "geo:ellipse",
  Diamond: "geo:diamond",
  Triangle: "geo:triangle",
  Hexagon: "geo:hexagon",
  Parallelogram: "geo:parallelogram",
  Cylinder: "geo:cylinder",
  Star: "geo:star",
  Trapezoid: "geo:trapezoid",
  Pentagon: "geo:pentagon",
  Octagon: "geo:octagon",
  Cross: "geo:cross",
  BlockArrow: "geo:arrow",
  Chevron: "geo:chevron",
  Cloud: "geo:cloud",
  Callout: "geo:callout",
  FoldedNote: "geo:note",
  Cube: "geo:cube",
  Document: "geo:document",
  ManualInput: "geo:manual-input",
  Delay: "geo:delay",
  PredefinedProcess: "geo:predefined-process",
  InternalStorage: "geo:internal-storage",
  OffPage: "geo:off-page",
  Card: "geo:card",
  Tape: "geo:tape",
  StoredData: "geo:stored-data",
  Display: "geo:display",
  LoopLimit: "geo:loop-limit",
  Collate: "geo:collate",
  Sort: "geo:sort",
  SummingJunction: "geo:summing-junction",
  OrJunction: "geo:or",
  MultiDocument: "geo:multi-document",
  DirectData: "geo:direct-data",
  SequentialData: "geo:sequential-data",
  DoubleArrow: "geo:double-arrow",
  RightTriangle: "geo:right-triangle",
  Person: "geo:person",
  StickFigure: "geo:actor",
  Package: "geo:package",
} as const;

/** A closed union: only values declared in Tool are valid tools. */
export type ToolKind = (typeof Tool)[keyof typeof Tool];
export const TOOLS: readonly ToolKind[] = Object.values(Tool);
export const GEO_TOOLS = [
  Tool.Rectangle,
  Tool.Ellipse,
  Tool.Diamond,
  Tool.Triangle,
  Tool.Hexagon,
  Tool.Parallelogram,
  Tool.Cylinder,
  Tool.Star,
  Tool.Trapezoid,
  Tool.Pentagon,
  Tool.Octagon,
  Tool.Cross,
  Tool.BlockArrow,
  Tool.Chevron,
  Tool.Cloud,
  Tool.Callout,
  Tool.FoldedNote,
  Tool.Cube,
  Tool.Document,
  Tool.ManualInput,
  Tool.Delay,
  Tool.PredefinedProcess,
  Tool.InternalStorage,
  Tool.OffPage,
  Tool.Card,
  Tool.Tape,
  Tool.StoredData,
  Tool.Display,
  Tool.LoopLimit,
  Tool.Collate,
  Tool.Sort,
  Tool.SummingJunction,
  Tool.OrJunction,
  Tool.MultiDocument,
  Tool.DirectData,
  Tool.SequentialData,
  Tool.DoubleArrow,
  Tool.RightTriangle,
  Tool.Person,
  Tool.StickFigure,
  Tool.Package,
] as const;

export const BPMN_TOOLS = [
  Tool.BpmnPool,
  Tool.BpmnPoolCollapsed,
  Tool.BpmnLane,
  Tool.BpmnTask,
  Tool.BpmnUserTask,
  Tool.BpmnServiceTask,
  Tool.BpmnStartEvent,
  Tool.BpmnMessageCatch,
  Tool.BpmnMessageThrow,
  Tool.BpmnTimerCatch,
  Tool.BpmnEndEvent,
  Tool.BpmnExclusiveGateway,
  Tool.BpmnParallelGateway,
  Tool.BpmnSubProcess,
  Tool.BpmnSubProcessExpanded,
  Tool.BpmnCallActivity,
  Tool.BpmnDataObject,
  Tool.BpmnDataStore,
  Tool.BpmnTextAnnotation,
  Tool.BpmnGroup,
] as const;
export type BpmnToolKind = (typeof BPMN_TOOLS)[number];

export const BREADBOARD_TOOLS = [
  Tool.BreadboardFull,
  Tool.BreadboardHalf,
  Tool.BreadboardMini,
  Tool.BreadboardResistor,
  Tool.BreadboardLed,
  Tool.BreadboardCapacitorCeramic,
  Tool.BreadboardCapacitorElectrolytic,
  Tool.BreadboardDiode,
  Tool.BreadboardNpn,
  Tool.BreadboardPnp,
  Tool.BreadboardButton,
  Tool.BreadboardPotentiometer,
  Tool.BreadboardIc,
  Tool.BreadboardHeader,
  Tool.BreadboardBattery,
  Tool.BreadboardWire,
] as const;
export type BreadboardToolKind = (typeof BREADBOARD_TOOLS)[number];

export const PCB_TOOLS = [Tool.PcbTrack, Tool.PcbVia] as const;
export type PcbToolKind = (typeof PCB_TOOLS)[number];
export const PCB_CREATIONS: Readonly<Record<PcbToolKind, CreationTool>> = {
  [Tool.PcbTrack]: { type: "pcb.track" },
  [Tool.PcbVia]: { type: "pcb.via" },
};

const BREADBOARD_CREATIONS: Readonly<Record<BreadboardToolKind, CreationTool>> =
  {
    [Tool.BreadboardFull]: {
      type: "breadboard.board",
      semantic: { size: "full" },
    },
    [Tool.BreadboardHalf]: {
      type: "breadboard.board",
      semantic: { size: "half" },
    },
    [Tool.BreadboardMini]: {
      type: "breadboard.board",
      semantic: { size: "mini" },
    },
    [Tool.BreadboardResistor]: { type: "breadboard.resistor" },
    [Tool.BreadboardLed]: { type: "breadboard.led" },
    [Tool.BreadboardCapacitorCeramic]: {
      type: "breadboard.capacitor",
      semantic: { style: "ceramic" },
    },
    [Tool.BreadboardCapacitorElectrolytic]: {
      type: "breadboard.capacitor",
      semantic: { style: "electrolytic" },
    },
    [Tool.BreadboardDiode]: { type: "breadboard.diode" },
    [Tool.BreadboardNpn]: {
      type: "breadboard.transistor",
      semantic: { polarity: "NPN" },
    },
    [Tool.BreadboardPnp]: {
      type: "breadboard.transistor",
      semantic: { polarity: "PNP" },
    },
    [Tool.BreadboardButton]: { type: "breadboard.button" },
    [Tool.BreadboardPotentiometer]: { type: "breadboard.potentiometer" },
    [Tool.BreadboardIc]: { type: "breadboard.ic" },
    [Tool.BreadboardHeader]: { type: "breadboard.header" },
    [Tool.BreadboardBattery]: { type: "breadboard.battery" },
    [Tool.BreadboardWire]: { type: "breadboard.wire" },
  };

const BPMN_CREATIONS: Readonly<Record<BpmnToolKind, CreationTool>> = {
  [Tool.BpmnPool]: {
    type: "bpmn.participant",
    semantic: { name: "Pool", collapsed: false },
    visual: { width: 600, height: 250 },
  },
  [Tool.BpmnPoolCollapsed]: {
    type: "bpmn.participant",
    semantic: { name: "Pool", collapsed: true },
    visual: { width: 600, height: 60 },
  },
  [Tool.BpmnLane]: { type: "bpmn.lane" },
  [Tool.BpmnTask]: {
    type: "bpmn.task",
    semantic: { name: "Task", taskType: "none", loop: "none" },
  },
  [Tool.BpmnUserTask]: {
    type: "bpmn.task",
    semantic: { name: "Task", taskType: "user", loop: "none" },
  },
  [Tool.BpmnServiceTask]: {
    type: "bpmn.task",
    semantic: { name: "Task", taskType: "service", loop: "none" },
  },
  [Tool.BpmnStartEvent]: {
    type: "bpmn.event",
    semantic: { name: "", position: "start", definitions: [] },
  },
  [Tool.BpmnMessageCatch]: {
    type: "bpmn.event",
    semantic: {
      name: "",
      position: "intermediateCatch",
      definitions: [{ id: "def-1", kind: "message" }],
    },
  },
  [Tool.BpmnMessageThrow]: {
    type: "bpmn.event",
    semantic: {
      name: "",
      position: "intermediateThrow",
      definitions: [{ id: "def-1", kind: "message" }],
    },
  },
  [Tool.BpmnTimerCatch]: {
    type: "bpmn.event",
    semantic: {
      name: "",
      position: "intermediateCatch",
      definitions: [
        {
          id: "def-1",
          kind: "timer",
          timer: { type: "duration", value: "PT1H" },
        },
      ],
    },
  },
  [Tool.BpmnEndEvent]: {
    type: "bpmn.event",
    semantic: { name: "", position: "end", definitions: [] },
  },
  [Tool.BpmnExclusiveGateway]: {
    type: "bpmn.gateway",
    semantic: { name: "", gatewayType: "exclusive" },
  },
  [Tool.BpmnParallelGateway]: {
    type: "bpmn.gateway",
    semantic: { name: "", gatewayType: "parallel" },
  },
  [Tool.BpmnSubProcess]: {
    type: "bpmn.subProcess",
    semantic: {
      name: "Sub-process",
      expanded: false,
      triggeredByEvent: false,
      adHoc: false,
      loop: "none",
    },
  },
  [Tool.BpmnSubProcessExpanded]: {
    type: "bpmn.subProcess",
    semantic: {
      name: "Sub-process",
      expanded: true,
      triggeredByEvent: false,
      adHoc: false,
      loop: "none",
    },
    visual: { width: 350, height: 200 },
  },
  [Tool.BpmnCallActivity]: {
    type: "bpmn.callActivity",
    semantic: { name: "Call activity", loop: "none" },
  },
  [Tool.BpmnDataObject]: {
    type: "bpmn.dataObject",
    semantic: { name: "Data object", role: "reference", collection: false },
  },
  [Tool.BpmnDataStore]: {
    type: "bpmn.dataStore",
    semantic: { name: "Data store" },
  },
  [Tool.BpmnTextAnnotation]: {
    type: "bpmn.textAnnotation",
    semantic: { text: "" },
  },
  [Tool.BpmnGroup]: { type: "bpmn.group", semantic: { name: "" } },
};

const GEO_KINDS = {
  [Tool.Rectangle]: "rect",
  [Tool.Ellipse]: "ellipse",
  [Tool.Diamond]: "diamond",
  [Tool.Triangle]: "triangle",
  [Tool.Hexagon]: "hexagon",
  [Tool.Parallelogram]: "parallelogram",
  [Tool.Cylinder]: "cylinder",
  [Tool.Star]: "star",
  [Tool.Trapezoid]: "trapezoid",
  [Tool.Pentagon]: "pentagon",
  [Tool.Octagon]: "octagon",
  [Tool.Cross]: "cross",
  [Tool.BlockArrow]: "arrow",
  [Tool.Chevron]: "chevron",
  [Tool.Cloud]: "cloud",
  [Tool.Callout]: "callout",
  [Tool.FoldedNote]: "note",
  [Tool.Cube]: "cube",
  [Tool.Document]: "document",
  [Tool.ManualInput]: "manual-input",
  [Tool.Delay]: "delay",
  [Tool.PredefinedProcess]: "predefined-process",
  [Tool.InternalStorage]: "internal-storage",
  [Tool.OffPage]: "off-page",
  [Tool.Card]: "card",
  [Tool.Tape]: "tape",
  [Tool.StoredData]: "stored-data",
  [Tool.Display]: "display",
  [Tool.LoopLimit]: "loop-limit",
  [Tool.Collate]: "collate",
  [Tool.Sort]: "sort",
  [Tool.SummingJunction]: "summing-junction",
  [Tool.OrJunction]: "or",
  [Tool.MultiDocument]: "multi-document",
  [Tool.DirectData]: "direct-data",
  [Tool.SequentialData]: "sequential-data",
  [Tool.DoubleArrow]: "double-arrow",
  [Tool.RightTriangle]: "right-triangle",
  [Tool.Person]: "person",
  [Tool.StickFigure]: "actor",
  [Tool.Package]: "package",
} as const satisfies Record<(typeof GEO_TOOLS)[number], GeoKind>;

const FRAME_KINDS = {
  [Tool.WebFrame]: "web",
  [Tool.IPhoneFrame]: "iphone",
  [Tool.AndroidFrame]: "android",
  [Tool.TabletFrame]: "tablet",
  [Tool.PaperFrame]: "paper",
} as const satisfies Record<
  Exclude<
    Extract<ToolKind, `frame:${string}`>,
    "frame:popup" | "frame:bottom-sheet" | "frame:popover"
  >,
  keyof typeof FRAME_PRESETS
>;

const PARTICIPANT_KINDS = {
  [Tool.Actor]: "actor",
  [Tool.Service]: "service",
  [Tool.Database]: "db",
} as const satisfies Record<
  Exclude<Extract<ToolKind, `sequence.${string}`>, typeof Tool.SequenceMessage>,
  ParticipantKind
>;

export function canUseTool(tool: ToolKind, readOnly: boolean): boolean {
  return !readOnly || tool === Tool.Select || tool === Tool.Hand;
}

export interface CreationTool {
  readonly type: string;
  /** Semantic overrides; `undefined` means "use the ShapeUtil default". */
  readonly semantic?: unknown;
  readonly visual?: Visual;
}

/** Exhaustive so adding a tool requires deciding its placement behavior. */
export function creationFor(tool: ToolKind): CreationTool | null {
  switch (tool) {
    case Tool.StickFigure:
      return {
        type: "shape.geo",
        semantic: { geo: "actor", label: "" },
        visual: { width: 60, height: 110 },
      };
    case Tool.BreadboardFull:
    case Tool.BreadboardHalf:
    case Tool.BreadboardMini:
    case Tool.BreadboardResistor:
    case Tool.BreadboardLed:
    case Tool.BreadboardCapacitorCeramic:
    case Tool.BreadboardCapacitorElectrolytic:
    case Tool.BreadboardDiode:
    case Tool.BreadboardNpn:
    case Tool.BreadboardPnp:
    case Tool.BreadboardButton:
    case Tool.BreadboardPotentiometer:
    case Tool.BreadboardIc:
    case Tool.BreadboardHeader:
    case Tool.BreadboardBattery:
    case Tool.BreadboardWire:
      return BREADBOARD_CREATIONS[tool];
    case Tool.PcbTrack:
    case Tool.PcbVia:
      return PCB_CREATIONS[tool];
    case Tool.BpmnPool:
    case Tool.BpmnPoolCollapsed:
    case Tool.BpmnLane:
    case Tool.BpmnTask:
    case Tool.BpmnUserTask:
    case Tool.BpmnServiceTask:
    case Tool.BpmnStartEvent:
    case Tool.BpmnMessageCatch:
    case Tool.BpmnMessageThrow:
    case Tool.BpmnTimerCatch:
    case Tool.BpmnEndEvent:
    case Tool.BpmnExclusiveGateway:
    case Tool.BpmnParallelGateway:
    case Tool.BpmnSubProcess:
    case Tool.BpmnSubProcessExpanded:
    case Tool.BpmnCallActivity:
    case Tool.BpmnDataObject:
    case Tool.BpmnDataStore:
    case Tool.BpmnTextAnnotation:
    case Tool.BpmnGroup:
      return BPMN_CREATIONS[tool];

    case Tool.FlowStart:
    case Tool.FlowEnd:
      return {
        type: "shape.geo",
        semantic: {
          geo: "ellipse",
          label: tool === Tool.FlowStart ? "Start" : "End",
        },
        visual: { width: 128, height: 56 },
      };
    case Tool.FlowProcess:
      return {
        type: "shape.geo",
        semantic: { geo: "rect", label: "Process" },
        visual: { width: 180, height: 80 },
      };
    case Tool.FlowDecision:
      return {
        type: "shape.geo",
        semantic: { geo: "diamond", label: "Condition?" },
        visual: { width: 160, height: 120 },
      };
    case Tool.FlowInputOutput:
      return {
        type: "shape.geo",
        semantic: { geo: "parallelogram", label: "Input / Output" },
        visual: { width: 180, height: 80 },
      };
    case Tool.FlowDatabase:
      return {
        type: "shape.geo",
        semantic: { geo: "cylinder", label: "Database" },
        visual: { width: 144, height: 96 },
      };
    case Tool.State:
    case Tool.InitialState:
    case Tool.FinalState:
    case Tool.ChoiceState: {
      const kind = tool.slice(6);
      return {
        type: "state.node",
        semantic: { kind, name: kind === "state" ? "State" : "" },
        visual: {
          width: kind === "state" ? 160 : 32,
          height: kind === "state" ? 72 : 32,
        },
      };
    }
    case Tool.UseCaseActor:
    case Tool.UseCase:
    case Tool.UseCaseSystem: {
      const kind =
        tool === Tool.UseCaseActor
          ? "actor"
          : tool === Tool.UseCaseSystem
            ? "system"
            : "usecase";
      return {
        type: "usecase.node",
        semantic: {
          name:
            kind === "actor"
              ? "Actor"
              : kind === "system"
                ? "System"
                : "Use case",
          kind,
        },
        visual: { ...USECASE_NODE_SIZES[kind] },
      };
    }
    case Tool.Component:
      return { type: UmlComponentType.Component };
    case Tool.ProvidedInterface:
    case Tool.RequiredInterface:
      return {
        type: UmlComponentType.Interface,
        semantic: {
          name: "Interface",
          kind: tool === Tool.ProvidedInterface ? "provided" : "required",
        },
      };
    case Tool.Port:
      return { type: UmlComponentType.Port };
    case Tool.Frame:
      return {
        type: "frame",
        semantic: { name: "Frame" },
        visual: {
          width: 320,
          height: 220,
          style: { fill: "none", stroke: "#64748b", strokeWidth: 1.5 },
        },
      };
    case Tool.PopupFrame:
    case Tool.BottomSheetFrame:
    case Tool.PopoverFrame: {
      const screenKind = tool.slice(6);
      return {
        type: "frame",
        semantic: {
          name:
            screenKind === "popup"
              ? "Popup"
              : screenKind === "bottom-sheet"
                ? "Bottom sheet"
                : "Popover",
          screenKind,
          showTitle: false,
        },
        visual: {
          width: screenKind === "bottom-sheet" ? 390 : 320,
          height: screenKind === "popover" ? 180 : 300,
          style: { fill: "#ffffff", stroke: "#cbd5e1", cornerRadius: 16 },
        },
      };
    }
    case Tool.WebFrame:
    case Tool.IPhoneFrame:
    case Tool.AndroidFrame:
    case Tool.TabletFrame:
    case Tool.PaperFrame: {
      const preset = FRAME_PRESETS[FRAME_KINDS[tool]];
      const safeArea = "safeArea" in preset ? preset.safeArea : undefined;
      return {
        type: "frame",
        semantic: {
          name: preset.name,
          screenKind: "screen",
          platform: preset.platform,
          ...(safeArea ? { safeArea } : {}),
        },
        visual: { width: preset.width, height: preset.height },
      };
    }
    case Tool.Rectangle:
    case Tool.Ellipse:
    case Tool.Diamond:
    case Tool.Triangle:
    case Tool.Hexagon:
    case Tool.Parallelogram:
    case Tool.Cylinder:
    case Tool.Star:
    case Tool.Trapezoid:
    case Tool.Pentagon:
    case Tool.Octagon:
    case Tool.Cross:
    case Tool.BlockArrow:
    case Tool.Chevron:
    case Tool.Cloud:
    case Tool.Callout:
    case Tool.FoldedNote:
    case Tool.Cube:
    case Tool.Document:
    case Tool.ManualInput:
    case Tool.Delay:
    case Tool.PredefinedProcess:
    case Tool.InternalStorage:
    case Tool.OffPage:
    case Tool.Card:
    case Tool.Tape:
    case Tool.StoredData:
    case Tool.Display:
    case Tool.LoopLimit:
    case Tool.Collate:
    case Tool.Sort:
    case Tool.SummingJunction:
    case Tool.OrJunction:
    case Tool.MultiDocument:
    case Tool.DirectData:
    case Tool.SequentialData:
    case Tool.DoubleArrow:
    case Tool.RightTriangle:
    case Tool.Person:
    case Tool.Package:
      return {
        type: "shape.geo",
        semantic: { geo: GEO_KINDS[tool], label: "" },
      };
    case Tool.Actor:
    case Tool.Service:
    case Tool.Database:
      return {
        type: "sequence.participant",
        // Sequence-aware creation supplies the participant's order and name.
        semantic: { kind: PARTICIPANT_KINDS[tool] },
      };
    case Tool.Button:
    case Tool.Input:
    case Tool.Textarea:
    case Tool.SelectControl:
    case Tool.Checkbox:
    case Tool.Radio:
    case Tool.Tabs:
    case Tool.Progress:
    case Tool.Toggle: {
      const control = tool.slice(3);
      return {
        type: "ui.control",
        semantic: {
          control,
          label:
            control === "button"
              ? "Button"
              : control === "checkbox" || control === "switch"
                ? "Label"
                : control,
          ...(control === "progress" ? { progress: 60 } : {}),
          ...(control === "select" || control === "tabs"
            ? { options: ["Option 1", "Option 2"], value: "Option 1" }
            : {}),
          ...(control === "input" || control === "textarea"
            ? { placeholder: "Enter text" }
            : {}),
        },
        visual: {
          width: control === "tabs" ? 320 : control === "textarea" ? 240 : 180,
          height:
            control === "progress" ? 12 : control === "textarea" ? 110 : 44,
        },
      };
    }
    case Tool.Note:
      return {
        type: "text.note",
        semantic: { text: "Note" },
        visual: { width: 200, height: 140, style: { fill: "#fff1c9" } },
      };
    case Tool.Node:
    case Tool.Text:
    case Tool.Table:
    case Tool.View:
    case Tool.MaterializedView:
    case Tool.Function:
    case Tool.Procedure:
    case Tool.Class:
      return { type: tool };
    case Tool.Select:
    case Tool.Hand:
    case Tool.Comment:
    case Tool.Connector:
    case Tool.ScreenTransition:
    case Tool.Relation:
    case Tool.ForeignKey:
    case Tool.Association:
    case Tool.StateTransition:
    case Tool.SequenceMessage:
    case Tool.Dependency:
    case Tool.Realization:
    case Tool.ComponentConnector:
    case Tool.UseCaseAssociation:
    case Tool.UseCaseInclude:
    case Tool.UseCaseExtend:
    case Tool.UseCaseGeneralization:
    case Tool.Freehand:
    case Tool.EditPoints:
    case Tool.EditFill:
    case Tool.EditStroke:
    case Tool.Crop:
      return null;
    default: {
      const unsupported: never = tool;
      throw new Error(`Unsupported tool: ${unsupported}`);
    }
  }
}

export function componentRelationshipFor(
  tool: ToolKind,
): UmlComponentRelationshipKind | undefined {
  switch (tool) {
    case Tool.Dependency:
      return UmlComponentRelationship.Dependency;
    case Tool.Realization:
      return UmlComponentRelationship.Realization;
    case Tool.ComponentConnector:
      return UmlComponentRelationship.Connector;
    default:
      return undefined;
  }
}
/** The use-case relationship kind a connector tool draws, if any. */
export function useCaseRelationshipFor(
  tool: ToolKind,
): UseCaseRelationshipKind | undefined {
  switch (tool) {
    case Tool.UseCaseAssociation:
      return "association";
    case Tool.UseCaseInclude:
      return "include";
    case Tool.UseCaseExtend:
      return "extend";
    case Tool.UseCaseGeneralization:
      return "generalization";
    default:
      return undefined;
  }
}
export function isConnectorTool(tool: ToolKind): boolean {
  return (
    tool === Tool.Connector ||
    tool === Tool.ScreenTransition ||
    typedConnectorFor(tool) !== undefined ||
    componentRelationshipFor(tool) !== undefined ||
    useCaseRelationshipFor(tool) !== undefined
  );
}

export function typedConnectorFor(tool: ToolKind): string | undefined {
  if (tool === Tool.StateTransition) return "state.transition";
  if (tool === Tool.Relation || tool === Tool.ForeignKey) return "erd.relation";
  if (tool === Tool.Association) return "uml.association";
  if (tool === Tool.SequenceMessage) return "sequence.message";
  if (useCaseRelationshipFor(tool)) return "usecase.relationship";
  return undefined;
}
