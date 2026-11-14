import type {
  ElementId,
  FrameSemantic,
  GroupSemantic,
  ImageSemantic,
} from "@nodetto/ir";
import type { Editor } from "./editor.ts";
import { collectInterfaceTree } from "./interface-tree.ts";
import { generateInterfaceCode } from "./interface-code.ts";
import { richTextSegments, safeTextLinkHref } from "./rich-text.ts";
import { collectResponsiveFamily } from "./responsive-family.ts";
import {
  type AdaptiveMobileBreakpoint,
  type AdaptiveMobileInterfaceCode,
  type MobileCodeOptions,
  type MobileInterfaceCode,
  number,
  resourceName,
} from "./mobile-code/shared.ts";
import { swiftAdaptiveDispatcher, swiftCode } from "./mobile-code/swift.ts";
import {
  composeAdaptiveDispatcher,
  composeCode,
} from "./mobile-code/compose.ts";

export type {
  AdaptiveMobileBreakpoint,
  AdaptiveMobileInterfaceCode,
  MobileAssetReference,
  MobileCodeOptions,
  MobileInterfaceCode,
} from "./mobile-code/shared.ts";

/** Read-only native-code handoff for the same visible hierarchy as HTML. */
export function generateMobileInterfaceCode(
  editor: Editor,
  rootId: ElementId,
  options: MobileCodeOptions = {},
): MobileInterfaceCode | null {
  const tree = collectInterfaceTree(editor, rootId);
  if (!tree) return null;
  const rootSemantic = tree.root.semantic as FrameSemantic;
  const assetElements = new Map(
    tree.included.map((element) => [element.id, element]),
  );
  for (const group of tree.included) {
    if (group.type !== "group") continue;
    const maskId = (group.semantic as GroupSemantic).maskId;
    const mask = maskId ? editor.store.get(maskId) : undefined;
    if (mask?.type === "image.raster") assetElements.set(mask.id, mask);
  }
  const assets = [...assetElements.values()].flatMap((element) => {
    if (element.type !== "image.raster") return [];
    const semantic = element.semantic as ImageSemantic;
    const source = editor.assets.resolve(semantic.src) ?? semantic.src;
    const mediaType =
      /^data:([^;,]+)/.exec(source)?.[1] ??
      (source.endsWith(".jpg") || source.endsWith(".jpeg")
        ? "image/jpeg"
        : source.endsWith(".gif")
          ? "image/gif"
          : source.endsWith(".webp")
            ? "image/webp"
            : "image/png");
    return [
      {
        elementId: element.id,
        resourceName: resourceName(element),
        mediaType,
      },
    ];
  });
  const gradients = tree.included.flatMap((element) => [
    element.visual.style?.fillGradient,
    element.visual.style?.strokeGradient,
  ]);
  const richLinks = tree.included.flatMap((element) =>
    element.type === "text.note"
      ? richTextSegments(element.semantic).flatMap((segment) =>
          segment.marks.filter((mark) => mark.kind === "link"),
        )
      : [],
  );
  const notes = [
    "SwiftUI and Jetpack Compose output are implementation starting points generated from the same visible artboard hierarchy as HTML.",
    "Embedded image data stays in the semantic manifest; copy each listed asset into the platform asset catalog using its generated resource name.",
    ...(rootSemantic.safeArea
      ? [
          `Design safe area (${rootSemantic.platform ?? "unspecified"}): top ${number(rootSemantic.safeArea.top)}, right ${number(rootSemantic.safeArea.right)}, bottom ${number(rootSemantic.safeArea.bottom)}, left ${number(rootSemantic.safeArea.left)}. Preserve it with SwiftUI safe-area APIs or Compose WindowInsets rather than hard-coding device pixels.`,
        ]
      : []),
    ...(gradients.some((gradient) => gradient?.type === "diamond")
      ? ["Diamond gradients use their first stop as a native-code fallback."]
      : []),
    ...(gradients.some(
      (gradient) => gradient?.type === "angular" && gradient.angle !== 0,
    )
      ? [
          "Jetpack Compose sweep gradients preserve stops and center but require a custom shader to rotate the zero-stop angle.",
        ]
      : []),
    ...(tree.included.some((element) => {
      const style = element.visual.style;
      return Boolean(style?.effects?.length || style?.shadow);
    })
      ? [
          "Layer effects and shadows remain in the semantic manifest and need platform-specific finishing.",
        ]
      : []),
    ...(tree.included.some(
      (element) =>
        element.visual.style?.fontVariations?.length ||
        element.visual.style?.fontFeatures?.length,
    )
      ? [
          "Variable-font axes and OpenType feature settings remain in the semantic manifest and CSS/SVG handoff; map them through the chosen native font asset APIs.",
        ]
      : []),
    ...(tree.included.some(
      (element) =>
        element.type === "group" &&
        Boolean((element.semantic as GroupSemantic).booleanOperation),
    )
      ? [
          "Boolean groups resolve nested compound silhouettes to even-odd SwiftUI Canvas and Jetpack Compose clip paths; verify clipping on the target OS and GPU.",
        ]
      : []),
    ...(richLinks.length
      ? [
          "Rich links are visually identified in SwiftUI; Jetpack Compose includes URL annotations. Wire platform navigation and accessibility in the consuming app.",
        ]
      : []),
    ...(tree.included.some((element) => element.accessibility)
      ? [
          "Accessibility metadata is mapped to native semantics. Platform roles without a direct SwiftUI trait or Jetpack Compose Role remain in the semantic manifest for application-specific wiring.",
        ]
      : []),
    ...(tree.included.some((element) => {
      const style = element.visual.style;
      return Boolean(
        style?.strokeCap || style?.strokeJoin || style?.strokeMiterLimit,
      );
    })
      ? [
          "SwiftUI maps authored stroke caps, joins and miter limits. Jetpack Compose BorderStroke does not expose them; use Canvas Stroke for exact outline geometry.",
        ]
      : []),
    ...(richLinks.some((mark) => safeTextLinkHref(mark.href) === null)
      ? [
          "Unsafe rich-text link protocols are omitted from native URL annotations.",
        ]
      : []),
  ];
  return {
    rootId,
    swiftUi: swiftCode(editor, tree, options),
    jetpackCompose: composeCode(editor, tree, options),
    assets,
    notes,
  };
}

function stableNativeSuffix(value: string): string {
  return Array.from(value, (character) =>
    character.codePointAt(0)?.toString(16).padStart(6, "0"),
  ).join("");
}

/** Generate adaptive SwiftUI and Compose source for one responsive family. */
export function generateAdaptiveMobileInterfaceCode(
  editor: Editor,
  rootId: ElementId,
): AdaptiveMobileInterfaceCode | null {
  const family = collectResponsiveFamily(editor, rootId);
  if (!family) return null;
  const breakpoints: AdaptiveMobileBreakpoint[] = family.members.map(
    (member) => {
      const suffix = stableNativeSuffix(member.rootId);
      return {
        rootId: member.rootId,
        name: member.name,
        ...(member.platform ? { platform: member.platform } : {}),
        width: member.width,
        swiftViewName: `NodettoBreakpoint${suffix}View`,
        composeFunctionName: `NodettoBreakpoint${suffix}Screen`,
      };
    },
  );
  const reports = breakpoints.map((breakpoint, index) => {
    const report = generateMobileInterfaceCode(editor, breakpoint.rootId, {
      swiftViewName: breakpoint.swiftViewName,
      composeFunctionName: breakpoint.composeFunctionName,
      includeSwiftImports: index === 0,
      includeSwiftSupport: index === breakpoints.length - 1,
      includeComposeImports: index === 0,
    });
    if (!report)
      throw new Error(`responsive artboard ${breakpoint.rootId} disappeared`);
    return report;
  });
  const familySuffix = stableNativeSuffix(family.sourceRootId);
  const swiftDispatcherName = `NodettoAdaptive${familySuffix}View`;
  const composeDispatcherName = `NodettoAdaptive${familySuffix}Screen`;
  const notes = [
    "Adaptive native output preserves every designer-authored artboard as a separate view and chooses one from the available container width.",
    ...family.notes,
    ...reports.flatMap((report, index) =>
      report.notes.map(
        (note) =>
          `${breakpoints[index]?.name} (${breakpoints[index]?.width}px): ${note}`,
      ),
    ),
  ];
  const assets = reports.flatMap((report) => report.assets);
  const semanticManifests = breakpoints.map((breakpoint) => {
    const generated = generateInterfaceCode(editor, breakpoint.rootId);
    return generated ? (JSON.parse(generated.manifest) as unknown) : null;
  });
  const manifestValue = {
    sourceRoot: family.sourceRootId,
    swiftDispatcher: swiftDispatcherName,
    composeDispatcher: composeDispatcherName,
    breakpoints: breakpoints.map((breakpoint, index) => ({
      ...breakpoint,
      manifest: semanticManifests[index],
    })),
    assets,
    notes,
  };
  return {
    sourceRootId: family.sourceRootId,
    breakpoints,
    swiftUi: [
      ...reports.map((report) => report.swiftUi),
      swiftAdaptiveDispatcher(swiftDispatcherName, breakpoints),
    ].join("\n\n"),
    jetpackCompose: [
      ...reports.map((report) => report.jetpackCompose),
      composeAdaptiveDispatcher(composeDispatcherName, breakpoints),
    ].join("\n\n"),
    assets,
    manifest: JSON.stringify(manifestValue, null, 2),
    notes,
  };
}
