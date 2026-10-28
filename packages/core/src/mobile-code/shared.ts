// Public mobile-code types and platform-neutral helpers shared by the
// SwiftUI and Jetpack Compose generators.

import type {
  BlendMode,
  Element,
  ElementId,
  FrameLayout,
  FrameSemantic,
  GroupSemantic,
  ImageSemantic,
} from "@nodetto/ir";
import type { Editor } from "../editor.ts";
import { maskPolygon } from "../clipping.ts";
import {
  booleanGeometry,
  booleanResultGeometry,
} from "../boolean-operations.ts";

export interface MobileAssetReference {
  readonly elementId: ElementId;
  readonly resourceName: string;
  readonly mediaType: string;
}

export interface MobileInterfaceCode {
  readonly rootId: ElementId;
  readonly swiftUi: string;
  readonly jetpackCompose: string;
  readonly assets: readonly MobileAssetReference[];
  readonly notes: readonly string[];
}

export interface MobileCodeOptions {
  readonly swiftViewName?: string;
  readonly composeFunctionName?: string;
  readonly includeSwiftImports?: boolean;
  readonly includeSwiftSupport?: boolean;
  readonly includeComposeImports?: boolean;
}

export interface AdaptiveMobileBreakpoint {
  readonly rootId: ElementId;
  readonly name: string;
  readonly platform?: FrameSemantic["platform"];
  readonly width: number;
  readonly swiftViewName: string;
  readonly composeFunctionName: string;
}

export interface AdaptiveMobileInterfaceCode {
  readonly sourceRootId: ElementId;
  readonly breakpoints: readonly AdaptiveMobileBreakpoint[];
  readonly swiftUi: string;
  readonly jetpackCompose: string;
  readonly assets: readonly MobileAssetReference[];
  readonly manifest: string;
  readonly notes: readonly string[];
}

export function number(value: number): string {
  return String(Number(value.toFixed(4)));
}

export function identifier(value: string, fallback: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const joined = words
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join("");
  const safe = joined || fallback;
  return /^\d/.test(safe) ? `Design${safe}` : safe;
}

export function resourceName(element: Element): string {
  const safe = element.id
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `nodetto_${safe || "asset"}`;
}

export function hexColor(
  value: string | undefined,
  fallback = "#000000",
): string {
  return /^#[\da-f]{6}$/i.test(value ?? "") ? (value as string) : fallback;
}

export function channels(value: string): readonly [number, number, number] {
  const color = hexColor(value);
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}

const NATIVE_BLEND_NAMES: Readonly<Record<BlendMode, string>> = {
  normal: "normal",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  "color-dodge": "colorDodge",
  "color-burn": "colorBurn",
  "hard-light": "hardLight",
  "soft-light": "softLight",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
};

export function nativeBlendName(mode: BlendMode): string {
  return NATIVE_BLEND_NAMES[mode];
}

export function editableText(editor: Editor, element: Element): string {
  return editor.getText(element.id) ?? "";
}

export function layoutOf(element: Element | null): FrameLayout | undefined {
  return element?.type === "frame"
    ? (element.semantic as FrameSemantic).layout
    : undefined;
}

export function normalizedMaskPoints(
  editor: Editor,
  element: Element,
): readonly { readonly x: number; readonly y: number }[] | null {
  if (element.type !== "group") return null;
  const maskId = (element.semantic as GroupSemantic).maskId;
  const box = editor.getBounds(element.id);
  if (!maskId || !box || box.width <= 0 || box.height <= 0) return null;
  const context = editor.createShapeContext();
  const points = maskPolygon(editor.store.get(maskId), context);
  return (
    points?.map((point) => ({
      x: (point.x - box.x) / box.width,
      y: (point.y - box.y) / box.height,
    })) ?? null
  );
}

type RasterMaskPlacement = {
  readonly resource: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly cropX: number;
  readonly cropY: number;
  readonly cropWidth: number;
  readonly cropHeight: number;
  readonly rotation: number;
  readonly luminance: boolean;
};

export function rasterMaskPlacement(
  editor: Editor,
  element: Element,
): RasterMaskPlacement | null {
  if (element.type !== "group") return null;
  const semantic = element.semantic as GroupSemantic;
  const source = semantic.maskId
    ? editor.store.get(semantic.maskId)
    : undefined;
  const groupBox = editor.getBounds(element.id);
  const sourceBox = source ? editor.getBounds(source.id) : null;
  if (
    source?.type !== "image.raster" ||
    !groupBox ||
    !sourceBox ||
    groupBox.width <= 0 ||
    groupBox.height <= 0
  )
    return null;
  const crop = (source.semantic as ImageSemantic).crop;
  return {
    resource: resourceName(source),
    x: (sourceBox.x - groupBox.x) / groupBox.width,
    y: (sourceBox.y - groupBox.y) / groupBox.height,
    width: sourceBox.width / groupBox.width,
    height: sourceBox.height / groupBox.height,
    cropX: crop?.x ?? 0,
    cropY: crop?.y ?? 0,
    cropWidth: crop?.width ?? 1,
    cropHeight: crop?.height ?? 1,
    rotation: source.visual.rotation ?? 0,
    luminance: semantic.maskMode === "luminance",
  };
}

export function normalizedBooleanPolygons(
  editor: Editor,
  element: Element,
): readonly (readonly { readonly x: number; readonly y: number }[])[] | null {
  const box = editor.getBounds(element.id);
  if (!box || box.width <= 0 || box.height <= 0) return null;
  const geometry = booleanGeometry(element, editor.createShapeContext());
  if (!geometry) return null;
  return booleanResultGeometry(geometry)
    .flat()
    .map((polygon) =>
      polygon.map((point) => ({
        x: (point.x - box.x) / box.width,
        y: (point.y - box.y) / box.height,
      })),
    );
}

export function indented(lines: readonly string[], levels = 1): string[] {
  const prefix = "    ".repeat(levels);
  return lines.map((line) => `${prefix}${line}`);
}
