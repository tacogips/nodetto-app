// SwiftUI source generation: view hierarchy, support types and the
// adaptive breakpoint dispatcher.

import type {
  Element,
  FrameSemantic,
  ImageSemantic,
  UiControlSemantic,
} from "@nodetto/ir";
import type { Editor } from "../editor.ts";
import type { InterfaceTree } from "../interface-tree.ts";
import { swiftString } from "../native-string.ts";
import {
  type AdaptiveMobileBreakpoint,
  editableText,
  identifier,
  indented,
  layoutOf,
  type MobileCodeOptions,
  number,
  resourceName,
} from "./shared.ts";
import {
  swiftColor,
  swiftCompoundPath,
  swiftModifiers,
  swiftShape,
  swiftTextExpression,
  swiftWeight,
} from "./swift-modifiers.ts";

export function swiftCode(
  editor: Editor,
  tree: InterfaceTree,
  options: MobileCodeOptions,
): string {
  const rootName = (tree.root.semantic as FrameSemantic).name;
  const structName =
    options.swiftViewName ?? `Nodetto${identifier(rootName, "Design")}View`;
  const render = (
    element: Element,
    parent: Element | null,
    isRoot: boolean,
  ): string[] => {
    const box = editor.getBounds(element.id) ?? {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    };
    const style = element.visual.style ?? {};
    const children = tree
      .childrenOf(element)
      .filter((child) => tree.includedIds.has(child.id));
    let lines: string[];
    const layout = layoutOf(element);
    const flowChildren = layout
      ? children.filter((child) => child.visual.layoutPosition !== "absolute")
      : children;
    const absoluteChildren = layout
      ? children.filter((child) => child.visual.layoutPosition === "absolute")
      : [];
    if (
      children.length ||
      element.type === "frame" ||
      element.type === "group"
    ) {
      const container = layout
        ? layout.wrap
          ? `NodettoFlowLayout(axis: .${layout.direction}, itemSpacing: ${number(layout.gap)}, lineSpacing: ${number(layout.crossGap ?? layout.gap)}, crossAlignment: ${layout.align === "start" ? "0" : layout.align === "end" ? "1" : "0.5"})`
          : layout.direction === "horizontal"
            ? `HStack(alignment: .${layout.align === "start" ? "top" : layout.align === "end" ? "bottom" : "center"}, spacing: ${number(layout.gap)})`
            : `VStack(alignment: .${layout.align === "start" ? "leading" : layout.align === "end" ? "trailing" : "center"}, spacing: ${number(layout.gap)})`
        : "ZStack(alignment: .topLeading)";
      lines = [`${container} {`];
      for (const child of flowChildren)
        lines.push(...indented(render(child, element, false)));
      lines.push("}");
      if (layout)
        lines.push(
          `.padding(EdgeInsets(top: ${number(layout.paddingTop ?? layout.padding)}, leading: ${number(layout.paddingLeft ?? layout.padding)}, bottom: ${number(layout.paddingBottom ?? layout.padding)}, trailing: ${number(layout.paddingRight ?? layout.padding)}))`,
        );
      if (absoluteChildren.length) {
        const flow = lines;
        lines = ["ZStack(alignment: .topLeading) {", ...indented(flow)];
        for (const child of absoluteChildren)
          lines.push(...indented(render(child, element, false)));
        lines.push("}");
      }
    } else if (element.type === "image.raster") {
      const semantic = element.semantic as ImageSemantic;
      const name = resourceName(element);
      if (semantic.crop) {
        const crop = semantic.crop;
        lines = [
          "ZStack(alignment: .topLeading) {",
          `    Image(${swiftString(name)})`,
          "        .resizable()",
          `        .frame(width: ${number(box.width / crop.width)}, height: ${number(box.height / crop.height)})`,
          `        .offset(x: ${number((-crop.x * box.width) / crop.width)}, y: ${number((-crop.y * box.height) / crop.height)})`,
          "}",
          ".clipped()",
          ...(element.accessibility
            ? []
            : [`.accessibilityLabel(${swiftString(semantic.alt)})`]),
        ];
      } else {
        lines = [
          `Image(${swiftString(name)})`,
          "    .resizable()",
          `    .aspectRatio(contentMode: .${semantic.fit === "cover" ? "fill" : "fit"})`,
          ...(element.accessibility
            ? []
            : [`    .accessibilityLabel(${swiftString(semantic.alt)})`]),
        ];
      }
    } else if (element.type === "ui.control") {
      const control = element.semantic as UiControlSemantic;
      const label = swiftString(control.label);
      const value = swiftString(control.value ?? "");
      switch (control.control) {
        case "button":
          lines = [`Button(${label}) { }`];
          break;
        case "input":
          lines = [
            `${control.inputType === "password" ? "SecureField" : "TextField"}(${swiftString(control.placeholder ?? control.label)}, text: .constant(${value}))`,
          ];
          break;
        case "textarea":
          lines = [`TextEditor(text: .constant(${value}))`];
          break;
        case "select":
          lines = [
            `Picker(${label}, selection: .constant(${value})) {`,
            ...(control.options ?? []).map(
              (option) =>
                `    Text(${swiftString(option)}).tag(${swiftString(option)})`,
            ),
            "}",
          ];
          break;
        case "progress":
          lines = [
            `ProgressView(value: ${control.progress ?? 0}, total: 100).accessibilityLabel(${label})`,
          ];
          break;
        case "tabs":
          lines = [
            `Picker(${label}, selection: .constant(${swiftString(control.value ?? control.options?.[0] ?? "")})) {`,
            ...(control.options ?? []).map(
              (option) =>
                `    Text(${swiftString(option)}).tag(${swiftString(option)})`,
            ),
            "}.pickerStyle(.segmented)",
          ];
          break;
        case "radio":
          lines = [
            `HStack { Image(systemName: ${swiftString(control.checked ? "largecircle.fill.circle" : "circle")}); Text(${label}) }`,
          ];
          break;
        case "checkbox":
        case "switch":
          lines = [
            `Toggle(${label}, isOn: .constant(${control.checked === true}))`,
          ];
          break;
      }
      if (control.disabled) lines.push(".disabled(true)");
    } else if (element.type === "draw.path") {
      lines = [swiftCompoundPath(element, style)];
    } else if (element.type === "shape.geo") {
      const text = editableText(editor, element);
      lines = text
        ? [
            "ZStack {",
            `    ${swiftShape(element, style, box)}`,
            `    ${swiftTextExpression(editor, element)}`,
            "}",
          ]
        : [swiftShape(element, style, box)];
    } else {
      lines = [swiftTextExpression(editor, element)];
      if (style.color)
        lines.push(`.foregroundStyle(${swiftColor(style.color)})`);
      if (style.fontSize)
        lines.push(`.font(.system(size: ${number(style.fontSize)}))`);
      if (style.fontWeight)
        lines.push(`.fontWeight(${swiftWeight(style.fontWeight)})`);
      if (style.fontStyle === "italic") lines.push(".italic()");
      if (style.textAlign)
        lines.push(
          `.multilineTextAlignment(.${style.textAlign === "middle" ? "center" : style.textAlign === "end" ? "trailing" : "leading"})`,
        );
      if (style.letterSpacing)
        lines.push(`.tracking(${number(style.letterSpacing)})`);
    }
    lines.push(...swiftModifiers(editor, element, parent, isRoot));
    return lines;
  };
  const body = indented(render(tree.root, null, true), 3);
  return [
    ...(options.includeSwiftImports === false ? [] : ["import SwiftUI", ""]),
    `struct ${structName}: View {`,
    "    var body: some View {",
    ...body,
    "    }",
    "}",
    ...(options.includeSwiftSupport === false
      ? []
      : [
          "",
          "private struct NodettoRasterMask: View {",
          "    let asset: String; let x: CGFloat; let y: CGFloat; let width: CGFloat; let height: CGFloat; let cropX: CGFloat; let cropY: CGFloat; let cropWidth: CGFloat; let cropHeight: CGFloat; let rotation: CGFloat; let luminance: Bool",
          "    var body: some View {",
          "        GeometryReader { proxy in",
          "            let viewportWidth = proxy.size.width * width",
          "            let viewportHeight = proxy.size.height * height",
          "            let image = Image(asset).resizable()",
          "                .frame(width: viewportWidth / cropWidth, height: viewportHeight / cropHeight)",
          "                .offset(x: -cropX * viewportWidth / cropWidth, y: -cropY * viewportHeight / cropHeight)",
          "                .frame(width: viewportWidth, height: viewportHeight, alignment: .topLeading)",
          "                .clipped()",
          "                .rotationEffect(.degrees(rotation))",
          "                .position(x: proxy.size.width * x + viewportWidth / 2, y: proxy.size.height * y + viewportHeight / 2)",
          "            if luminance { image.luminanceToAlpha() } else { image }",
          "        }",
          "    }",
          "}",
          "",
          "private struct NodettoBooleanMask: View {",
          "    let polygons: [[CGPoint]]",
          "    var body: some View {",
          "        Canvas { context, size in",
          "            var path = Path()",
          "            for polygon in polygons {",
          "                guard let first = polygon.first else { continue }",
          "                path.move(to: CGPoint(x: first.x * size.width, y: first.y * size.height))",
          "                for point in polygon.dropFirst() { path.addLine(to: CGPoint(x: point.x * size.width, y: point.y * size.height)) }",
          "                path.closeSubpath()",
          "            }",
          "            context.fill(path, with: .color(.white), style: FillStyle(eoFill: true))",
          "        }",
          "    }",
          "}",
          "",
          "private struct NodettoPolygon: Shape {",
          "    let points: [CGPoint]",
          "    func path(in rect: CGRect) -> Path {",
          "        var path = Path()",
          "        guard let first = points.first else { return path }",
          "        path.move(to: CGPoint(x: rect.minX + first.x * rect.width, y: rect.minY + first.y * rect.height))",
          "        for point in points.dropFirst() {",
          "            path.addLine(to: CGPoint(x: rect.minX + point.x * rect.width, y: rect.minY + point.y * rect.height))",
          "        }",
          "        path.closeSubpath()",
          "        return path",
          "    }",
          "}",
          "",
          "private struct NodettoFlowLayout: Layout {",
          "    let axis: Axis",
          "    let itemSpacing: CGFloat",
          "    let lineSpacing: CGFloat",
          "    let crossAlignment: CGFloat",
          "    private struct Line { var items: [Int] = []; var main: CGFloat = 0; var cross: CGFloat = 0 }",
          "    private func measured(_ proposal: ProposedViewSize, _ subviews: Subviews) -> ([CGSize], [Line]) {",
          "        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }",
          "        let limit = axis == .horizontal ? (proposal.width ?? .infinity) : (proposal.height ?? .infinity)",
          "        var lines: [Line] = []",
          "        for (index, size) in sizes.enumerated() {",
          "            let main = axis == .horizontal ? size.width : size.height",
          "            let cross = axis == .horizontal ? size.height : size.width",
          "            if lines.isEmpty || (!lines[lines.count - 1].items.isEmpty && lines[lines.count - 1].main + itemSpacing + main > limit) { lines.append(Line()) }",
          "            let line = lines.count - 1",
          "            if !lines[line].items.isEmpty { lines[line].main += itemSpacing }",
          "            lines[line].items.append(index); lines[line].main += main; lines[line].cross = max(lines[line].cross, cross)",
          "        }",
          "        return (sizes, lines)",
          "    }",
          "    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {",
          "        let (_, lines) = measured(proposal, subviews)",
          "        let main = lines.map(\\.main).max() ?? 0",
          "        let cross = lines.map(\\.cross).reduce(0, +) + CGFloat(max(0, lines.count - 1)) * lineSpacing",
          "        return axis == .horizontal ? CGSize(width: proposal.width ?? main, height: cross) : CGSize(width: cross, height: proposal.height ?? main)",
          "    }",
          "    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {",
          "        let (sizes, lines) = measured(ProposedViewSize(bounds.size), subviews)",
          "        var crossCursor: CGFloat = 0",
          "        for line in lines {",
          "            var mainCursor: CGFloat = 0",
          "            for index in line.items {",
          "                let size = sizes[index]",
          "                let childCross = axis == .horizontal ? size.height : size.width",
          "                let cross = crossCursor + (line.cross - childCross) * crossAlignment",
          "                let point = axis == .horizontal ? CGPoint(x: bounds.minX + mainCursor, y: bounds.minY + cross) : CGPoint(x: bounds.minX + cross, y: bounds.minY + mainCursor)",
          "                subviews[index].place(at: point, anchor: .topLeading, proposal: ProposedViewSize(size))",
          "                mainCursor += (axis == .horizontal ? size.width : size.height) + itemSpacing",
          "            }",
          "            crossCursor += line.cross + lineSpacing",
          "        }",
          "    }",
          "}",
        ]),
  ].join("\n");
}

export function swiftAdaptiveDispatcher(
  name: string,
  breakpoints: readonly AdaptiveMobileBreakpoint[],
): string {
  const descending = [...breakpoints].reverse();
  const choices = descending.flatMap((breakpoint, index) => {
    if (index === descending.length - 1)
      return descending.length === 1
        ? [`            ${breakpoint.swiftViewName}()`]
        : [
            "            } else {",
            `                ${breakpoint.swiftViewName}()`,
          ];
    return [
      `${index === 0 ? "            if" : "            } else if"} proxy.size.width >= ${number(breakpoint.width)} {`,
      `                ${breakpoint.swiftViewName}()`,
    ];
  });
  if (descending.length > 1) choices.push("            }");
  return [
    `struct ${name}: View {`,
    "    var body: some View {",
    "        GeometryReader { proxy in",
    ...choices,
    "        }",
    "    }",
    "}",
  ].join("\n");
}
