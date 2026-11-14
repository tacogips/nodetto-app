import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";

export const TEXT_LAYOUT_PAGE_ID = "page-architecture";
export const TEXT_LAYOUT_EXPECTED = [
  { ruleId: "label-overflow", elementId: "node-clipped" },
  { ruleId: "label-overflow", elementId: "node-narrow" },
  { ruleId: "label-overflow", elementId: "node-narrow" },
  { ruleId: "label-overflow", elementId: "geo-spill" },
  { ruleId: "label-collision", elementId: "edge-grpc" },
  { ruleId: "label-collision", elementId: "edge-audit" },
  { ruleId: "note-overflow", elementId: "note-retry" },
  { ruleId: "note-overflow", elementId: "note-cache" },
] as const;
function editorFor(kind = "architecture") {
  const parsed = parseDocument(
    `${JSON.stringify({ kind: "document", schemaVersion: 1, id: "doc-text-layout", title: "Text layout" })}\n${JSON.stringify({ kind: "page", id: TEXT_LAYOUT_PAGE_ID, name: "Architecture", pageKind: kind })}\n`,
  );
  const editor = new Editor({ document: parsed, rng: () => 0.5 });
  editor.setCurrentPage(TEXT_LAYOUT_PAGE_ID);
  return editor;
}
function build(
  kind: string,
  specs: {
    id: string;
    type: string;
    visual?: Record<string, unknown>;
    semantic: Record<string, unknown>;
  }[],
) {
  const editor = editorFor(kind);
  const elements = specs.map(({ type, ...options }) =>
    editor.buildElement(type, options),
  );
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  return serializeDocument(editor.getSnapshot());
}
const node = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  type = "node.generic",
) => ({
  id,
  type,
  visual: { x, y, width, height },
  semantic: type === "shape.geo" ? { label, geo: "rect" } : { label },
});
const edge = (
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
) => ({
  id,
  type: "edge.generic",
  semantic: { fromPoint: { x: x1, y: y1 }, toPoint: { x: x2, y: y2 }, label },
});
const note = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
) => ({
  id,
  type: "text.note",
  visual: { x, y, width, height, textResize: "fixed" },
  semantic: { text },
});
export function textLayoutProblemDocument(kind = "architecture"): string {
  const label = "Payment gateway authorisation service";
  return build(kind, [
    node("node-wrapped", 0, 0, 140, 80, label),
    node("node-clipped", 200, 0, 140, 30, label),
    node("node-narrow", 400, 0, 24, 60, "Payment gateway"),
    node("geo-spill", 480, 0, 140, 30, label, "shape.geo"),
    edge("edge-https", 0, 400, 400, 400, "HTTPS"),
    edge("edge-grpc", 200, 250, 200, 550, "gRPC"),
    edge("edge-audit", 600, 400, 1000, 400, "Events"),
    node("node-audit", 740, 370, 120, 60, "Audit log"),
    node("zone-private", 1100, 250, 500, 300, "Private network", "shape.geo"),
    edge("edge-tls", 1150, 480, 1550, 480, "TLS"),
    note(
      "note-retry",
      0,
      800,
      200,
      30,
      "Retry policy: retry each failed request three times with exponential backoff, then move it to the dead letter queue.",
    ),
    note(
      "note-cache",
      400,
      800,
      200,
      60,
      "Cache invalidation runs after every deploy",
    ),
    node("node-queue", 400, 841, 200, 60, "Message queue"),
  ]);
}
export function textLayoutCleanDocument(kind = "architecture"): string {
  return build(kind, [
    node("node-gateway", 0, 0, 200, 60, "Payment gateway"),
    edge("edge-https", 0, 200, 300, 200, "HTTPS"),
    edge("edge-grpc", 0, 400, 300, 400, "gRPC"),
    note("note-first", 400, 0, 200, 48, "Retry three times"),
    note("note-second", 400, 48, 200, 48, "Then alert the on-call engineer"),
  ]);
}
export function textLayoutDenseDocument(count: number): string {
  const specs: ReturnType<typeof node>[] = [];
  for (let i = 0; i < count; i++) {
    const x = (i % 20) * 250;
    const y = Math.floor(i / 20) * 200;
    specs.push(node(`node-${i}`, x, y, 160, 60, `Service ${i}`));
  }
  const edges = Array.from({ length: count }, (_, i) => {
    const x = (i % 20) * 250;
    const y = Math.floor(i / 20) * 200;
    return edge(`edge-${i}`, x + 160, y + 30, x + 250, y + 30, `call ${i}`);
  });
  return build("architecture", [...specs, ...edges]);
}

export function textLayoutWideDocument(kind = "architecture"): string {
  const label = "在庫照会サービス（試験運用中）";
  return build(kind, [
    node("node-wide", 0, 0, 140, 60, label),
    node("node-ascii", 300, 0, 140, 60, "Payment gateway"),
    node("geo-wide", 600, 0, 140, 60, label, "shape.geo"),
    note("note-wide", 900, 0, 120, 44, "在庫照会サービスの再試行ポリシー"),
  ]);
}
export const TEXT_LAYOUT_WIDE_EXPECTED = [
  { ruleId: "label-overflow", elementId: "node-wide" },
  { ruleId: "label-overflow", elementId: "geo-wide" },
  { ruleId: "note-overflow", elementId: "note-wide" },
  { ruleId: "note-overflow", elementId: "note-wide" },
] as const;
