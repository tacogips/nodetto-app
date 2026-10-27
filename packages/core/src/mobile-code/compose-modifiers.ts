// Jetpack Compose expressions for paints, text, shapes, masks and modifiers.

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
import { richTextSegments, safeTextLinkHref } from "../rich-text.ts";
import { kotlinString as quoted } from "../native-string.ts";
import { compoundPathGeometry } from "../shapes/compound-path.ts";
import { resolvedStrokeDashArray } from "../stroke-dash.ts";
import {
  channels,
  editableText,
  hexColor,
  identifier,
  layoutOf,
  nativeBlendName,
  normalizedBooleanPolygons,
  normalizedMaskPoints,
  number,
  rasterMaskPlacement,
} from "./shared.ts";

export function composeColor(value: string, opacity = 1): string {
  const [red, green, blue] = channels(value);
  const alpha = Math.round(opacity * 255);
  const argb = [alpha, red, green, blue]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `Color(0x${argb})`;
}

function composeStops(gradient: FillGradient): string {
  return gradient.stops
    .map(
      (stop) =>
        `${number(stop.offset)}f to ${composeColor(stop.color, stop.opacity)}`,
    )
    .join(", ");
}

function composePaint(
  gradient: FillGradient | undefined,
  fallback: string | undefined,
  box: Box,
): string {
  if (!gradient) return composeColor(hexColor(fallback, "#ffffff"));
  const stops = `arrayOf(${composeStops(gradient)})`;
  if (gradient.type === "linear") {
    const vector = linearGradientVector(gradient.angle, box.width, box.height);
    return `Brush.linearGradient(colorStops = ${stops}, start = Offset(${number(vector.x1 * box.width)}f, ${number(vector.y1 * box.height)}f), end = Offset(${number(vector.x2 * box.width)}f, ${number(vector.y2 * box.height)}f))`;
  }
  if (gradient.type === "radial")
    return `Brush.radialGradient(colorStops = ${stops}, center = Offset(${number(gradient.centerX * box.width)}f, ${number(gradient.centerY * box.height)}f), radius = ${number(gradient.radius * Math.max(box.width, box.height, 1))}f)`;
  if (gradient.type === "angular")
    return `Brush.sweepGradient(colorStops = ${stops}, center = Offset(${number(gradient.centerX * box.width)}f, ${number(gradient.centerY * box.height)}f))`;
  return composeColor(
    gradient.stops[0]?.color ?? hexColor(fallback, "#ffffff"),
  );
}

export function composeTextExpression(
  editor: Editor,
  element: Element,
): string {
  const text = editableText(editor, element);
  if (element.type !== "text.note") return quoted(text);
  const segments = richTextSegments(element.semantic);
  if (!segments.some((segment) => segment.marks.length > 0))
    return quoted(text);
  const lines = ["buildAnnotatedString {"];
  for (const segment of segments) {
    const kinds = new Set(segment.marks.map((mark) => mark.kind));
    const styles = [
      ...(kinds.has("bold") ? ["fontWeight = FontWeight.Bold"] : []),
      ...(kinds.has("italic") ? ["fontStyle = FontStyle.Italic"] : []),
      ...(kinds.has("code") ? ["fontFamily = FontFamily.Monospace"] : []),
      ...(kinds.has("strike") || kinds.has("underline") || kinds.has("link")
        ? [
            `textDecoration = ${kinds.has("strike") && (kinds.has("underline") || kinds.has("link")) ? "TextDecoration.combine(listOf(TextDecoration.LineThrough, TextDecoration.Underline))" : kinds.has("strike") ? "TextDecoration.LineThrough" : "TextDecoration.Underline"}`,
          ]
        : []),
      ...(kinds.has("link") ? ["color = Color.Blue"] : []),
    ];
    if (styles.length) {
      lines.push(
        `    withStyle(style = SpanStyle(${styles.join(", ")})) { append(${quoted(segment.text)}) }`,
      );
    } else {
      lines.push(`    append(${quoted(segment.text)})`);
    }
  }
  for (const segment of segments) {
    const link = segment.marks.find(
      (mark) => mark.kind === "link" && safeTextLinkHref(mark.href),
    );
    const href = safeTextLinkHref(link?.href);
    if (href)
      lines.push(
        `    addStringAnnotation(tag = "URL", annotation = ${quoted(href)}, start = ${segment.start}, end = ${segment.end})`,
      );
  }
  lines.push("}");
  return lines.join("\n");
}

function composeRasterMaskModifier(
  editor: Editor,
  element: Element,
): string | null {
  const mask = rasterMaskPlacement(editor, element);
  if (!mask) return null;
  return `.nodettoRasterMask(resource = R.drawable.${mask.resource}, x = ${number(mask.x)}f, y = ${number(mask.y)}f, width = ${number(mask.width)}f, height = ${number(mask.height)}f, cropX = ${number(mask.cropX)}f, cropY = ${number(mask.cropY)}f, cropWidth = ${number(mask.cropWidth)}f, cropHeight = ${number(mask.cropHeight)}f, rotation = ${number(mask.rotation)}f, luminance = ${mask.luminance})`;
}

function composeMaskModifier(editor: Editor, element: Element): string | null {
  const raster = composeRasterMaskModifier(editor, element);
  if (raster) return raster;
  const points = normalizedMaskPoints(editor, element);
  if (!points?.length) return null;
  const commands = points
    .map((point, index) => {
      const command = index === 0 ? "moveTo" : "lineTo";
      return `${command}(size.width * ${number(point.x)}f, size.height * ${number(point.y)}f)`;
    })
    .join("; ");
  return `.clip(GenericShape { size, _ -> ${commands}; close() })`;
}

function composeBooleanModifier(
  editor: Editor,
  element: Element,
): string | null {
  const polygons = normalizedBooleanPolygons(editor, element);
  if (!polygons?.length) return null;
  const commands = polygons
    .map(
      (polygon) =>
        `${polygon
          .map(
            (point, index) =>
              `${index ? "lineTo" : "moveTo"}(size.width * ${number(point.x)}f, size.height * ${number(point.y)}f)`,
          )
          .join("; ")}; close()`,
    )
    .join("; ");
  return `.clip(GenericShape { size, _ -> fillType = PathFillType.EvenOdd; ${commands} })`;
}

function composeShape(element: Element, style: VisualStyle): string {
  const geo =
    element.type === "shape.geo"
      ? (element.semantic as GeoShapeSemantic).geo
      : "rect";
  if (geo === "ellipse") return "CircleShape";
  if (geo === "diamond")
    return "GenericShape { size, _ -> moveTo(size.width / 2, 0f); lineTo(size.width, size.height / 2); lineTo(size.width / 2, size.height); lineTo(0f, size.height / 2); close() }";
  if (geo === "triangle")
    return "GenericShape { size, _ -> moveTo(size.width / 2, 0f); lineTo(size.width, size.height); lineTo(0f, size.height); close() }";
  if (style.cornerRadii) {
    const corners = resolvedCornerRadii(style);
    return `RoundedCornerShape(topStart = ${number(corners.topLeft)}.dp, topEnd = ${number(corners.topRight)}.dp, bottomEnd = ${number(corners.bottomRight)}.dp, bottomStart = ${number(corners.bottomLeft)}.dp)`;
  }
  return `RoundedCornerShape(${number(style.cornerRadius ?? 0)}.dp)`;
}

export function composeCompoundPath(
  element: Element,
  style: VisualStyle,
): string {
  const geometry = compoundPathGeometry(element);
  if (!geometry) return "Spacer(modifier = Modifier)";
  const x = (value: number) =>
    `size.width * ${number(value / geometry.box.width)}f`;
  const y = (value: number) =>
    `size.height * ${number(value / geometry.box.height)}f`;
  const commands = geometry.contours
    .flatMap((contour) => {
      const first = contour[0];
      if (!first) return [];
      const lines = [`moveTo(${x(first.x)}, ${y(first.y)})`];
      for (let index = 1; index <= contour.length; index++) {
        const previous = contour[(index - 1) % contour.length];
        const point = contour[index % contour.length];
        if (!previous || !point) continue;
        if (previous.controlOut || point.controlIn) {
          const firstControl = previous.controlOut ?? previous;
          const secondControl = point.controlIn ?? point;
          lines.push(
            `cubicTo(${x(firstControl.x)}, ${y(firstControl.y)}, ${x(secondControl.x)}, ${y(secondControl.y)}, ${x(point.x)}, ${y(point.y)})`,
          );
        } else if (index < contour.length)
          lines.push(`lineTo(${x(point.x)}, ${y(point.y)})`);
      }
      lines.push("close()");
      return lines;
    })
    .join("; ");
  const path = `val path = Path().apply { fillType = PathFillType.${(element.semantic as PathSemantic).fillRule === "evenodd" ? "EvenOdd" : "NonZero"}; ${commands} }`;
  const fillPaint = composePaint(style.fillGradient, style.fill, geometry.box);
  const draws = [
    `drawPath(path, ${style.fillGradient ? `brush = ${fillPaint}` : `color = ${fillPaint}`})`,
  ];
  if (style.stroke || style.strokeGradient) {
    const strokePaint = composePaint(
      style.strokeGradient,
      style.stroke,
      geometry.box,
    );
    const dash = resolvedStrokeDashArray(style);
    const stroke = [
      `width = ${number(style.strokeWidth ?? 1)}.dp.toPx()`,
      ...(dash.length
        ? [
            `pathEffect = PathEffect.dashPathEffect(floatArrayOf(${dash.map((value) => `${number(value)}f`).join(", ")}), ${number(style.strokeDashOffset ?? 0)}f)`,
          ]
        : []),
    ].join(", ");
    draws.push(
      `drawPath(path, ${style.strokeGradient ? `brush = ${strokePaint}` : `color = ${strokePaint}`}, style = Stroke(${stroke}))`,
    );
  }
  return `Canvas(modifier = Modifier.matchParentSize()) { ${path}; ${draws.join("; ")} }`;
}

export function composeModifiers(
  editor: Editor,
  element: Element,
  parent: Element | null,
  isRoot: boolean,
): string {
  const box = editor.getBounds(element.id);
  if (!box) return "Modifier";
  const style = element.visual.style ?? {};
  const parentLayout = layoutOf(parent);
  const inFlow =
    element.visual.layoutPosition !== "absolute" ? parentLayout : undefined;
  const shape = composeShape(element, style);
  const parts = ["Modifier"];
  if (!isRoot && parent && !inFlow) {
    const parentBox = editor.getBounds(parent.id);
    parts.push(
      `.offset(x = ${number(box.x - (parentBox?.x ?? 0))}.dp, y = ${number(box.y - (parentBox?.y ?? 0))}.dp)`,
    );
  }
  if (inFlow && (element.visual.layoutGrow ?? 0) > 0)
    parts.push(`.weight(${number(element.visual.layoutGrow ?? 0)}f)`);
  if (element.visual.aspectRatio !== undefined)
    parts.push(`.aspectRatio(${number(element.visual.aspectRatio)}f)`);
  if (
    element.visual.minWidth !== undefined ||
    element.visual.maxWidth !== undefined
  )
    parts.push(
      `.widthIn(${[
        element.visual.minWidth === undefined
          ? null
          : `min = ${number(element.visual.minWidth)}.dp`,
        element.visual.maxWidth === undefined
          ? null
          : `max = ${number(element.visual.maxWidth)}.dp`,
      ]
        .filter(Boolean)
        .join(", ")})`,
    );
  if (
    element.visual.minHeight !== undefined ||
    element.visual.maxHeight !== undefined
  )
    parts.push(
      `.heightIn(${[
        element.visual.minHeight === undefined
          ? null
          : `min = ${number(element.visual.minHeight)}.dp`,
        element.visual.maxHeight === undefined
          ? null
          : `max = ${number(element.visual.maxHeight)}.dp`,
      ]
        .filter(Boolean)
        .join(", ")})`,
    );
  parts.push(`.size(${number(box.width)}.dp, ${number(box.height)}.dp)`);
  if (
    (style.cornerRadius || style.cornerRadii) &&
    element.type !== "shape.geo" &&
    element.type !== "draw.path"
  )
    parts.push(`.clip(${shape})`);
  if (element.type !== "draw.path" && (style.fill || style.fillGradient))
    parts.push(
      `.background(${composePaint(style.fillGradient, style.fill, box)}, ${shape})`,
    );
  if (
    element.type !== "draw.path" &&
    style.strokeWidth &&
    (style.stroke || style.strokeGradient)
  )
    parts.push(
      `.border(BorderStroke(${number(style.strokeWidth)}.dp, ${composePaint(style.strokeGradient, style.stroke, box)}), ${shape})`,
    );
  if (style.opacity !== undefined)
    parts.push(`.alpha(${number(style.opacity)}f)`);
  if (style.blendMode)
    parts.push(
      `.graphicsLayer { blendMode = BlendMode.${identifier(nativeBlendName(style.blendMode), "Normal")} }`,
    );
  if (element.visual.rotation)
    parts.push(`.rotate(${number(element.visual.rotation)}f)`);
  if (
    element.type === "image.raster" ||
    (element.type === "frame" &&
      (element.semantic as FrameSemantic).clipContent)
  )
    parts.push(".clipToBounds()");
  const mask = composeMaskModifier(editor, element);
  if (mask) parts.push(mask);
  const boolean = composeBooleanModifier(editor, element);
  if (boolean) parts.push(boolean);
  const accessibility = element.accessibility;
  if (accessibility) {
    const semantics: string[] = [];
    if (accessibility.decorative) {
      semantics.push("invisibleToUser()");
    } else {
      if (accessibility.label)
        semantics.push(`contentDescription = ${quoted(accessibility.label)}`);
      if (accessibility.value)
        semantics.push(`stateDescription = ${quoted(accessibility.value)}`);
      else if (accessibility.hint)
        semantics.push(`stateDescription = ${quoted(accessibility.hint)}`);
      const role: Partial<Record<AccessibilityRole, string>> = {
        button: "Button",
        image: "Image",
        checkbox: "Checkbox",
        switch: "Switch",
      };
      const nativeRole = accessibility.role
        ? role[accessibility.role]
        : undefined;
      if (nativeRole) semantics.push(`role = Role.${nativeRole}`);
      if (accessibility.role === "heading") semantics.push("heading()");
      if (accessibility.disabled) semantics.push("disabled()");
    }
    if (semantics.length) parts.push(`.semantics { ${semantics.join("; ")} }`);
  }
  return parts.join("");
}
