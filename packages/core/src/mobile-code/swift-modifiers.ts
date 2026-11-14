// SwiftUI expressions for paints, text, shapes, masks and view modifiers.

import type {
  AccessibilityRole,
  Element,
  FillGradient,
  FrameSemantic,
  GeoShapeSemantic,
  PathSemantic,
  VisualStyle,
} from "@nodetto/ir";
import type { Editor } from "../editor.ts";
import type { Box } from "../geometry.ts";
import { linearGradientVector } from "../gradient.ts";
import { resolvedCornerRadii } from "../corner-radii.ts";
import { richTextSegments } from "../rich-text.ts";
import { swiftString } from "../native-string.ts";
import { compoundPathGeometry } from "../shapes/compound-path.ts";
import { resolvedStrokeDashArray } from "../stroke-dash.ts";
import {
  channels,
  editableText,
  hexColor,
  layoutOf,
  nativeBlendName,
  normalizedBooleanPolygons,
  normalizedMaskPoints,
  number,
  rasterMaskPlacement,
} from "./shared.ts";

export function swiftColor(value: string, opacity = 1): string {
  const [red, green, blue] = channels(value);
  const base = `Color(red: ${number(red / 255)}, green: ${number(green / 255)}, blue: ${number(blue / 255)})`;
  return opacity === 1 ? base : `${base}.opacity(${number(opacity)})`;
}

function swiftStops(gradient: FillGradient): string {
  return gradient.stops
    .map(
      (stop) =>
        `.init(color: ${swiftColor(stop.color, stop.opacity)}, location: ${number(stop.offset)})`,
    )
    .join(", ");
}

function swiftPaint(
  gradient: FillGradient | undefined,
  fallback: string | undefined,
  box: Box,
): string {
  if (!gradient) return swiftColor(hexColor(fallback, "#ffffff"));
  const stops = `Gradient(stops: [${swiftStops(gradient)}])`;
  if (gradient.type === "linear") {
    const vector = linearGradientVector(gradient.angle, box.width, box.height);
    return `LinearGradient(gradient: ${stops}, startPoint: UnitPoint(x: ${number(vector.x1)}, y: ${number(vector.y1)}), endPoint: UnitPoint(x: ${number(vector.x2)}, y: ${number(vector.y2)}))`;
  }
  if (gradient.type === "radial")
    return `RadialGradient(gradient: ${stops}, center: UnitPoint(x: ${number(gradient.centerX)}, y: ${number(gradient.centerY)}), startRadius: 0, endRadius: ${number(gradient.radius * Math.max(box.width, box.height, 1))})`;
  if (gradient.type === "angular")
    return `AngularGradient(gradient: ${stops}, center: UnitPoint(x: ${number(gradient.centerX)}, y: ${number(gradient.centerY)}), startAngle: .degrees(${number(gradient.angle)}), endAngle: .degrees(${number(gradient.angle + 360)}))`;
  return swiftColor(gradient.stops[0]?.color ?? hexColor(fallback, "#ffffff"));
}

export function swiftTextExpression(editor: Editor, element: Element): string {
  const text = editableText(editor, element);
  if (element.type !== "text.note") return `Text(${swiftString(text)})`;
  const segments = richTextSegments(element.semantic);
  if (!segments.some((segment) => segment.marks.length > 0))
    return `Text(${swiftString(text)})`;
  return `(${segments
    .map((segment) => {
      const kinds = new Set(segment.marks.map((mark) => mark.kind));
      return [
        `Text(${swiftString(segment.text)})`,
        ...(kinds.has("bold") ? [".bold()"] : []),
        ...(kinds.has("italic") ? [".italic()"] : []),
        ...(kinds.has("code") ? [".monospaced()"] : []),
        ...(kinds.has("strike") ? [".strikethrough()"] : []),
        ...(kinds.has("underline") && !kinds.has("link")
          ? [".underline()"]
          : []),
        ...(kinds.has("link")
          ? [".foregroundStyle(.blue)", ".underline()"]
          : []),
      ].join("");
    })
    .join(" + ")})`;
}

export function swiftWeight(value: number): string {
  if (value >= 900) return ".black";
  if (value >= 800) return ".heavy";
  if (value >= 700) return ".bold";
  if (value >= 600) return ".semibold";
  if (value >= 500) return ".medium";
  if (value >= 400) return ".regular";
  if (value >= 300) return ".light";
  if (value >= 200) return ".thin";
  return ".ultraLight";
}

function swiftRasterMaskModifier(
  editor: Editor,
  element: Element,
): string | null {
  const mask = rasterMaskPlacement(editor, element);
  if (!mask) return null;
  return `.mask(NodettoRasterMask(asset: ${swiftString(mask.resource)}, x: ${number(mask.x)}, y: ${number(mask.y)}, width: ${number(mask.width)}, height: ${number(mask.height)}, cropX: ${number(mask.cropX)}, cropY: ${number(mask.cropY)}, cropWidth: ${number(mask.cropWidth)}, cropHeight: ${number(mask.cropHeight)}, rotation: ${number(mask.rotation)}, luminance: ${mask.luminance}))`;
}

function swiftMaskModifier(editor: Editor, element: Element): string | null {
  const raster = swiftRasterMaskModifier(editor, element);
  if (raster) return raster;
  const points = normalizedMaskPoints(editor, element);
  if (!points?.length) return null;
  return `.mask(NodettoPolygon(points: [${points
    .map((point) => `.init(x: ${number(point.x)}, y: ${number(point.y)})`)
    .join(", ")}]))`;
}

function swiftBooleanModifier(editor: Editor, element: Element): string | null {
  const polygons = normalizedBooleanPolygons(editor, element);
  if (!polygons?.length) return null;
  const value = polygons
    .map(
      (polygon) =>
        `[${polygon
          .map((point) => `.init(x: ${number(point.x)}, y: ${number(point.y)})`)
          .join(", ")}]`,
    )
    .join(", ");
  return `.mask(NodettoBooleanMask(polygons: [${value}]))`;
}

function swiftShapeName(element: Element, style: VisualStyle): string {
  const geo =
    element.type === "shape.geo"
      ? (element.semantic as GeoShapeSemantic).geo
      : "rect";
  const corners = resolvedCornerRadii(style);
  return geo === "ellipse"
    ? "Ellipse()"
    : geo === "diamond"
      ? "NodettoPolygon(points: [.init(x: 0.5, y: 0), .init(x: 1, y: 0.5), .init(x: 0.5, y: 1), .init(x: 0, y: 0.5)])"
      : geo === "triangle"
        ? "NodettoPolygon(points: [.init(x: 0.5, y: 0), .init(x: 1, y: 1), .init(x: 0, y: 1)])"
        : style.cornerRadii
          ? `UnevenRoundedRectangle(topLeadingRadius: ${number(corners.topLeft)}, bottomLeadingRadius: ${number(corners.bottomLeft)}, bottomTrailingRadius: ${number(corners.bottomRight)}, topTrailingRadius: ${number(corners.topRight)})`
          : `RoundedRectangle(cornerRadius: ${number(style.cornerRadius ?? 0)})`;
}

export function swiftShape(
  element: Element,
  style: VisualStyle,
  box: Box,
): string {
  const fill = swiftPaint(style.fillGradient, style.fill, box);
  const shape = swiftShapeName(element, style);
  return `${shape}.fill(${fill})`;
}

function swiftStroke(style: VisualStyle, paint: string): string {
  const width = number(style.strokeWidth ?? 1);
  const dash = resolvedStrokeDashArray(style);
  if (
    style.strokeCap === undefined &&
    style.strokeJoin === undefined &&
    style.strokeMiterLimit === undefined &&
    !dash.length &&
    style.strokeDashOffset === undefined
  )
    return `.stroke(${paint}, lineWidth: ${width})`;
  const arguments_: string[] = [`lineWidth: ${width}`];
  if (style.strokeCap) arguments_.push(`lineCap: .${style.strokeCap}`);
  if (style.strokeJoin) arguments_.push(`lineJoin: .${style.strokeJoin}`);
  if (style.strokeMiterLimit !== undefined)
    arguments_.push(`miterLimit: ${number(style.strokeMiterLimit)}`);
  if (dash.length) arguments_.push(`dash: [${dash.map(number).join(", ")}]`);
  if (style.strokeDashOffset !== undefined)
    arguments_.push(`dashPhase: ${number(style.strokeDashOffset)}`);
  return `.stroke(${paint}, style: StrokeStyle(${arguments_.join(", ")}))`;
}

export function swiftCompoundPath(
  element: Element,
  style: VisualStyle,
): string {
  const geometry = compoundPathGeometry(element);
  if (!geometry) return "EmptyView()";
  const commands = geometry.contours
    .flatMap((contour) => {
      const first = contour[0];
      if (!first) return [];
      const lines = [
        `path.move(to: CGPoint(x: ${number(first.x)}, y: ${number(first.y)}))`,
      ];
      for (let index = 1; index <= contour.length; index++) {
        const previous = contour[(index - 1) % contour.length];
        const point = contour[index % contour.length];
        if (!previous || !point) continue;
        if (previous.controlOut || point.controlIn) {
          const firstControl = previous.controlOut ?? previous;
          const secondControl = point.controlIn ?? point;
          lines.push(
            `path.addCurve(to: CGPoint(x: ${number(point.x)}, y: ${number(point.y)}), control1: CGPoint(x: ${number(firstControl.x)}, y: ${number(firstControl.y)}), control2: CGPoint(x: ${number(secondControl.x)}, y: ${number(secondControl.y)}))`,
          );
        } else if (index < contour.length)
          lines.push(
            `path.addLine(to: CGPoint(x: ${number(point.x)}, y: ${number(point.y)}))`,
          );
      }
      lines.push("path.closeSubpath()");
      return lines;
    })
    .join("; ");
  const path = `Path { path in ${commands} }`;
  const fill = `${path}.fill(${swiftPaint(style.fillGradient, style.fill, geometry.box)}, style: FillStyle(eoFill: ${(element.semantic as PathSemantic).fillRule === "evenodd"}))`;
  if (!style.stroke && !style.strokeGradient) return fill;
  return `ZStack { ${fill}; ${path}${swiftStroke(
    style,
    swiftPaint(style.strokeGradient, style.stroke, geometry.box),
  )} }`;
}

export function swiftModifiers(
  editor: Editor,
  element: Element,
  parent: Element | null,
  isRoot: boolean,
): string[] {
  const box = editor.getBounds(element.id);
  if (!box) return [];
  const style = element.visual.style ?? {};
  const parentLayout = layoutOf(parent);
  const inFlow =
    element.visual.layoutPosition !== "absolute" ? parentLayout : undefined;
  const modifiers = [
    `.frame(width: ${number(box.width)}, height: ${number(box.height)})`,
  ];
  if (element.visual.aspectRatio !== undefined)
    modifiers.push(
      `.aspectRatio(${number(element.visual.aspectRatio)}, contentMode: .fit)`,
    );
  if (
    element.visual.minWidth !== undefined ||
    element.visual.maxWidth !== undefined
  )
    modifiers.push(
      `.frame(${[
        element.visual.minWidth === undefined
          ? null
          : `minWidth: ${number(element.visual.minWidth)}`,
        element.visual.maxWidth === undefined
          ? null
          : `maxWidth: ${number(element.visual.maxWidth)}`,
      ]
        .filter(Boolean)
        .join(", ")})`,
    );
  if (
    element.visual.minHeight !== undefined ||
    element.visual.maxHeight !== undefined
  )
    modifiers.push(
      `.frame(${[
        element.visual.minHeight === undefined
          ? null
          : `minHeight: ${number(element.visual.minHeight)}`,
        element.visual.maxHeight === undefined
          ? null
          : `maxHeight: ${number(element.visual.maxHeight)}`,
      ]
        .filter(Boolean)
        .join(", ")})`,
    );
  if (
    inFlow &&
    (element.visual.layoutGrow ?? 0) > 0 &&
    element.type !== "group"
  )
    modifiers.push(
      inFlow.direction === "horizontal"
        ? ".frame(maxWidth: .infinity)"
        : ".frame(maxHeight: .infinity)",
    );
  if (inFlow?.align === "stretch" && element.type !== "group")
    modifiers.push(
      inFlow.direction === "horizontal"
        ? ".frame(maxHeight: .infinity)"
        : ".frame(maxWidth: .infinity)",
    );
  if (
    element.type !== "shape.geo" &&
    element.type !== "draw.path" &&
    style.fill
  )
    modifiers.push(
      `.background(${swiftPaint(style.fillGradient, style.fill, box)})`,
    );
  else if (
    element.type !== "shape.geo" &&
    element.type !== "draw.path" &&
    style.fillGradient
  )
    modifiers.push(
      `.background(${swiftPaint(style.fillGradient, style.fill, box)})`,
    );
  if (
    element.type !== "draw.path" &&
    style.strokeWidth &&
    (style.stroke || style.strokeGradient)
  ) {
    const outline = swiftShapeName(element, style);
    modifiers.push(
      `.overlay(${outline}${swiftStroke(style, swiftPaint(style.strokeGradient, style.stroke, box))})`,
    );
  }
  if (
    (style.cornerRadius || style.cornerRadii) &&
    element.type !== "shape.geo" &&
    element.type !== "draw.path"
  )
    modifiers.push(`.clipShape(${swiftShapeName(element, style)})`);
  if (style.opacity !== undefined)
    modifiers.push(`.opacity(${number(style.opacity)})`);
  if (style.blendMode)
    modifiers.push(`.blendMode(.${nativeBlendName(style.blendMode)})`);
  if (element.visual.rotation)
    modifiers.push(
      `.rotationEffect(.degrees(${number(element.visual.rotation)}))`,
    );
  if (
    element.type === "frame" &&
    (element.semantic as FrameSemantic).clipContent
  )
    modifiers.push(".clipped()");
  const mask = swiftMaskModifier(editor, element);
  if (mask) modifiers.push(mask);
  const boolean = swiftBooleanModifier(editor, element);
  if (boolean) modifiers.push(boolean);
  const accessibility = element.accessibility;
  if (accessibility?.decorative) {
    modifiers.push(".accessibilityHidden(true)");
  } else if (accessibility) {
    if (accessibility.label)
      modifiers.push(
        `.accessibilityLabel(${swiftString(accessibility.label)})`,
      );
    if (accessibility.hint)
      modifiers.push(`.accessibilityHint(${swiftString(accessibility.hint)})`);
    if (accessibility.value)
      modifiers.push(
        `.accessibilityValue(${swiftString(accessibility.value)})`,
      );
    const trait: Partial<Record<AccessibilityRole, string>> = {
      button: "isButton",
      link: "isLink",
      image: "isImage",
      heading: "isHeader",
      text: "isStaticText",
      switch: "isToggle",
    };
    const nativeTrait = accessibility.role
      ? trait[accessibility.role]
      : undefined;
    if (nativeTrait) modifiers.push(`.accessibilityAddTraits(.${nativeTrait})`);
    if (accessibility.headingLevel)
      modifiers.push(`.accessibilityHeading(.h${accessibility.headingLevel})`);
    if (accessibility.disabled)
      modifiers.push(".accessibilityRespondsToUserInteraction(false)");
  }
  if (!isRoot && parent && !inFlow) {
    const parentBox = editor.getBounds(parent.id);
    modifiers.push(
      `.position(x: ${number(box.x - (parentBox?.x ?? 0) + box.width / 2)}, y: ${number(box.y - (parentBox?.y ?? 0) + box.height / 2)})`,
    );
  }
  return modifiers;
}
