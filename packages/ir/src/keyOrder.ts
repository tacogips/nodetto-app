// Declared key orders for deterministic serialization.
//
// The IR declares the order; `@nodetto/io` applies it. Keys listed in `keys`
// are emitted first in that order; any remaining key (including fields this
// build does not model) is emitted afterwards sorted lexicographically, so
// unknown fields are preserved and still land in a stable position.

export interface KeyOrder {
  readonly keys: readonly string[];
  /**
   * Key orders for nested values. For an array value the order applies to
   * each item; for an object value it applies to the object itself.
   */
  readonly children?: Readonly<Record<string, KeyOrder>>;
  /**
   * Keys holding page-space coordinates. Writers round these to
   * {@link COORDINATE_PRECISION} so floating-point noise never reaches a
   * git diff. Only declared keys are rounded: other numbers (text offsets,
   * pen pressure, opacity) keep full precision.
   */
  readonly coordinates?: readonly string[];
}

/** Coordinates are serialized to 0.01 units. Design section 6. */
export const COORDINATE_PRECISION = 0.01;

/**
 * Round to {@link COORDINATE_PRECISION}, half away from zero, normalizing
 * `-0` to `0` so it never shows up as `-0` in a diff.
 *
 * ONE INVARIANT: rounding is TOTAL over the finite doubles. A finite input
 * always yields a finite output. This matters because the only JSON spelling
 * of a non-finite number is `null`, and `null` fails validation on reload —
 * so any finite-to-non-finite transition here would hand the user a file
 * this build had just certified and can no longer open. The guard below is
 * on the rounded *result*, not on the intermediate, so it holds no matter
 * which step of the arithmetic overflows.
 *
 * `Math.round` alone rounds halves towards +Infinity, which would make
 * `-1.005` and `1.005` disagree; taking the magnitude first keeps rounding
 * symmetric about zero. Exact .005 inputs are unrepresentable in binary
 * anyway, so which way they land is decided by the stored double — the
 * guarantee here is determinism, not decimal half-up semantics.
 */
export function roundCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const scale = 1 / COORDINATE_PRECISION;
  const magnitude = Math.round(Math.abs(value) * scale) / scale;
  if (!Number.isFinite(magnitude)) {
    // |value| > MAX_VALUE / scale, so scaling overflowed. Nothing is lost by
    // skipping the rounding: at this magnitude the gap between adjacent
    // doubles is vastly larger than 0.01, so the value is already an exact
    // multiple of the precision we round to.
    return value;
  }
  const result = value < 0 ? -magnitude : magnitude;
  return result === 0 ? 0 : result;
}

export function coordinateKey(value: number): number {
  return Math.round(roundCoordinate(value) / COORDINATE_PRECISION);
}

export const VISUAL_STYLE_KEY_ORDER: KeyOrder = {
  keys: [
    "fill",
    "fillGradient",
    "stroke",
    "strokeGradient",
    "strokeWidth",
    "strokeAlign",
    "strokeSides",
    "strokeCap",
    "strokeJoin",
    "strokeMiterLimit",
    "strokeDashArray",
    "strokeDashOffset",
    "cornerRadius",
    "cornerRadii",
    "dash",
    "lineJumps",
    "opacity",
    "blendMode",
    "color",
    "accentColor",
    "selectedColor",
    "fontSize",
    "fontFamily",
    "fontWeight",
    "fontStyle",
    "fontVariations",
    "fontFeatures",
    "lineHeight",
    "letterSpacing",
    "textAlign",
    "textDecoration",
    "verticalAlign",
    "boxLabelAlign",
    "effects",
    "shadow",
  ],
  children: {
    cornerRadii: {
      keys: ["topLeft", "topRight", "bottomRight", "bottomLeft"],
    },
    fillGradient: {
      keys: ["type", "angle", "centerX", "centerY", "radius", "stops"],
      children: { stops: { keys: ["offset", "color", "opacity"] } },
    },
    strokeGradient: {
      keys: ["type", "angle", "centerX", "centerY", "radius", "stops"],
      children: { stops: { keys: ["offset", "color", "opacity"] } },
    },
    effects: {
      keys: ["type", "x", "y", "blur", "color", "opacity", "enabled"],
    },
    fontVariations: { keys: ["tag", "value"] },
    fontFeatures: { keys: ["tag", "value"] },
    shadow: { keys: ["x", "y", "blur", "color", "opacity"] },
  },
};

// `rotation` is quantized alongside the geometry: it is in degrees (see
// `Visual.rotation`), so 0.01 units is 0.01 degrees - below anything a
// renderer can show, and it keeps rotated elements out of noisy diffs.
export const VISUAL_KEY_ORDER: KeyOrder = {
  keys: [
    "x",
    "y",
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "aspectRatio",
    "textResize",
    "textPadding",
    "textMeasure",
    "textTruncate",
    "rotation",
    "flipX",
    "flipY",
    "hidden",
    "locked",
    "prototypeFixed",
    "horizontalConstraint",
    "verticalConstraint",
    "componentKey",
    "linkId",
    "animation",
    "layerName",
    "layoutGrow",
    "layoutPosition",
    "strokeBounds",
    "labelBounds",
    "colorTokens",
    "numberTokens",
    "textStyle",
    "style",
  ],
  children: {
    animation: {
      keys: [
        "enter",
        "enterFrom",
        "exit",
        "exitTo",
        "linked",
        "delayMs",
        "durationMs",
        "order",
        "slide",
      ],
      children: { slide: { keys: ["mode", "durationMs", "stagger"] } },
    },
    labelBounds: {
      keys: ["x", "y", "width", "height"],
      coordinates: ["x", "y", "width", "height"],
    },
    style: VISUAL_STYLE_KEY_ORDER,
  },
  coordinates: [
    "x",
    "y",
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "rotation",
  ],
};
