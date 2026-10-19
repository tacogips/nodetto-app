import type { Editor } from "./editor.ts";
import type { ElementId } from "@nodetto/ir";
import { auditAccessibility } from "./accessibility-audit.ts";
import { inspectDesign } from "./handoff.ts";
import { generateInterfaceCode } from "./interface-code.ts";
import { generateResponsiveInterfaceCode } from "./responsive-interface-code.ts";
import {
  generateMobileInterfaceCode,
  generateAdaptiveMobileInterfaceCode,
} from "./mobile-code.ts";

export const HANDOFF_FORMATS = [
  "css",
  "json",
  "linked",
  "palette",
  "typography",
  "layout",
  "html",
  "code-css",
  "code-linked",
  "manifest",
  "responsive-html",
  "responsive-css",
  "responsive-linked",
  "responsive-manifest",
  "adaptive-swiftui",
  "adaptive-compose",
  "adaptive-manifest",
  "swiftui",
  "compose",
  "mobile-assets",
  "accessibility-audit",
] as const;

export type HandoffFormat = (typeof HANDOFF_FORMATS)[number];

/** Text outputs shared by the Export Code panel and the CLI. */
export function exportHandoff(
  editor: Editor,
  id: ElementId,
  format: HandoffFormat,
): string {
  const artboardMessage = "Select an artboard to generate interface code.";
  const nativeMessage = "Select an artboard to generate native code.";
  const responsiveMessage =
    "Select an artboard to generate responsive interface code.";
  const adaptiveMessage =
    "Select an artboard to generate adaptive native code.";
  switch (format) {
    case "accessibility-audit":
      return JSON.stringify(auditAccessibility(editor, id), null, 2);
    case "adaptive-swiftui":
      return (
        generateAdaptiveMobileInterfaceCode(editor, id)?.swiftUi ??
        adaptiveMessage
      );
    case "adaptive-compose":
      return (
        generateAdaptiveMobileInterfaceCode(editor, id)?.jetpackCompose ??
        adaptiveMessage
      );
    case "adaptive-manifest":
      return (
        generateAdaptiveMobileInterfaceCode(editor, id)?.manifest ??
        adaptiveMessage
      );
    case "swiftui":
      return generateMobileInterfaceCode(editor, id)?.swiftUi ?? nativeMessage;
    case "compose":
      return (
        generateMobileInterfaceCode(editor, id)?.jetpackCompose ?? nativeMessage
      );
    case "mobile-assets": {
      const mobile = generateMobileInterfaceCode(editor, id);
      return JSON.stringify(
        { assets: mobile?.assets ?? [], notes: mobile?.notes ?? [] },
        null,
        2,
      );
    }
    case "responsive-html":
      return (
        generateResponsiveInterfaceCode(editor, id)?.html ?? responsiveMessage
      );
    case "responsive-css":
      return (
        generateResponsiveInterfaceCode(editor, id)?.css ?? responsiveMessage
      );
    case "responsive-linked":
      return (
        generateResponsiveInterfaceCode(editor, id)?.linkedCss ??
        responsiveMessage
      );
    case "responsive-manifest":
      return (
        generateResponsiveInterfaceCode(editor, id)?.manifest ??
        responsiveMessage
      );
    case "html":
      return generateInterfaceCode(editor, id)?.html ?? artboardMessage;
    case "code-css":
      return generateInterfaceCode(editor, id)?.css ?? artboardMessage;
    case "code-linked":
      return generateInterfaceCode(editor, id)?.linkedCss ?? artboardMessage;
    case "manifest":
      return generateInterfaceCode(editor, id)?.manifest ?? artboardMessage;
    default: {
      const report = inspectDesign(editor, id);
      switch (format) {
        case "layout":
          return (
            report?.layout?.css ??
            "Select an explicit auto-layout frame to inspect flex rules."
          );
        case "palette":
          return report?.palette.css ?? "";
        case "typography":
          return report?.typography.css ?? "";
        case "linked":
          return report?.linkedCss ?? "";
        case "css":
          return report?.css ?? "";
        case "json":
          return JSON.stringify(report, null, 2);
      }
    }
  }
}
