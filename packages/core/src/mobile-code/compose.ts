// Jetpack Compose source generation: composable hierarchy, raster mask
// support and the adaptive breakpoint dispatcher.

import type {
  Element,
  FrameSemantic,
  ImageSemantic,
  UiControlSemantic,
} from "@nodetto/ir";
import type { Editor } from "../editor.ts";
import type { InterfaceTree } from "../interface-tree.ts";
import { kotlinString as quoted } from "../native-string.ts";
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
  composeColor,
  composeCompoundPath,
  composeModifiers,
  composeTextExpression,
} from "./compose-modifiers.ts";

export function composeCode(
  editor: Editor,
  tree: InterfaceTree,
  options: MobileCodeOptions,
): string {
  const rootName = (tree.root.semantic as FrameSemantic).name;
  const functionName =
    options.composeFunctionName ??
    `Nodetto${identifier(rootName, "Design")}Screen`;
  const usesFlowLayout = tree.included.some(
    (element) => layoutOf(element)?.wrap === true,
  );
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
    const modifier = composeModifiers(editor, element, parent, isRoot);
    const children = tree
      .childrenOf(element)
      .filter((child) => tree.includedIds.has(child.id));
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
          ? layout.direction === "horizontal"
            ? "FlowRow"
            : "FlowColumn"
          : layout.direction === "horizontal"
            ? "Row"
            : "Column"
        : "Box";
      const arrangement = layout
        ? layout.justify === "space-between"
          ? "Arrangement.SpaceBetween"
          : layout.justify === "center"
            ? "Arrangement.Center"
            : layout.justify === "end"
              ? "Arrangement.End"
              : `Arrangement.spacedBy(${number(layout.gap)}.dp)`
        : null;
      const alignment = layout
        ? layout.direction === "horizontal"
          ? `${layout.wrap ? "itemVerticalAlignment" : "verticalAlignment"} = Alignment.${layout.align === "start" ? "Top" : layout.align === "end" ? "Bottom" : "CenterVertically"}`
          : `${layout.wrap ? "itemHorizontalAlignment" : "horizontalAlignment"} = Alignment.${layout.align === "start" ? "Start" : layout.align === "end" ? "End" : "CenterHorizontally"}`
        : null;
      const padding = layout
        ? `.padding(start = ${number(layout.paddingLeft ?? layout.padding)}.dp, top = ${number(layout.paddingTop ?? layout.padding)}.dp, end = ${number(layout.paddingRight ?? layout.padding)}.dp, bottom = ${number(layout.paddingBottom ?? layout.padding)}.dp)`
        : "";
      const args = [
        `modifier = ${absoluteChildren.length ? "Modifier.matchParentSize()" : modifier}${padding}`,
        ...(arrangement
          ? [
              `${layout?.direction === "horizontal" ? "horizontal" : "vertical"}Arrangement = ${arrangement}`,
            ]
          : []),
        ...(layout?.wrap
          ? [
              `${layout.direction === "horizontal" ? "vertical" : "horizontal"}Arrangement = Arrangement.spacedBy(${number(layout.crossGap ?? layout.gap)}.dp)`,
            ]
          : []),
        ...(alignment ? [alignment] : []),
      ];
      const lines = [`${container}(${args.join(", ")}) {`];
      for (const child of flowChildren)
        lines.push(...indented(render(child, element, false)));
      lines.push("}");
      if (absoluteChildren.length) {
        const overlay = [`Box(modifier = ${modifier}) {`, ...indented(lines)];
        for (const child of absoluteChildren)
          overlay.push(...indented(render(child, element, false)));
        overlay.push("}");
        return overlay;
      }
      return lines;
    }
    if (element.type === "image.raster") {
      const semantic = element.semantic as ImageSemantic;
      if (semantic.crop) {
        const crop = semantic.crop;
        return [
          `Box(modifier = ${modifier}) {`,
          "    Image(",
          `        painter = painterResource(R.drawable.${resourceName(element)}),`,
          `        contentDescription = ${element.accessibility ? "null" : quoted(semantic.alt)},`,
          "        contentScale = ContentScale.FillBounds,",
          `        modifier = Modifier.offset(x = ${number((-crop.x * box.width) / crop.width)}.dp, y = ${number((-crop.y * box.height) / crop.height)}.dp).size(${number(box.width / crop.width)}.dp, ${number(box.height / crop.height)}.dp)`,
          "    )",
          "}",
        ];
      }
      return [
        "Image(",
        `    painter = painterResource(R.drawable.${resourceName(element)}),`,
        `    contentDescription = ${element.accessibility ? "null" : quoted(semantic.alt)},`,
        `    contentScale = ContentScale.${semantic.fit === "cover" ? "Crop" : semantic.fit === "fill" ? "FillBounds" : "Fit"},`,
        `    modifier = ${modifier}`,
        ")",
      ];
    }
    const text = editableText(editor, element);
    if (element.type === "ui.control") {
      const control = element.semantic as UiControlSemantic;
      const enabled = control.disabled !== true;
      const label = quoted(control.label);
      const value = quoted(control.value ?? "");
      switch (control.control) {
        case "button":
          return [
            `Button(onClick = {}, enabled = ${enabled}, modifier = ${modifier}) { Text(${label}) }`,
          ];
        case "input":
        case "textarea":
          return [
            `OutlinedTextField(value = ${value}, onValueChange = {}, label = { Text(${label}) }, enabled = ${enabled}, singleLine = ${control.control === "input"}, visualTransformation = ${control.inputType === "password" ? "PasswordVisualTransformation()" : "VisualTransformation.None"}, modifier = ${modifier})`,
          ];
        case "progress":
          return [
            `LinearProgressIndicator(progress = { ${(control.progress ?? 0) / 100}f }, modifier = ${modifier})`,
          ];
        case "tabs":
          return [
            `Row(modifier = ${modifier}) {`,
            ...(control.options ?? []).map(
              (option) =>
                `    Tab(selected = ${option === (control.value ?? control.options?.[0])}, onClick = {}, enabled = ${enabled}, text = { Text(${quoted(option)}) })`,
            ),
            "}",
          ];
        case "radio":
        case "checkbox":
        case "switch":
          return [
            `Row(modifier = ${modifier}, verticalAlignment = Alignment.CenterVertically) {`,
            `    ${control.control === "switch" ? "Switch" : control.control === "radio" ? "RadioButton" : "Checkbox"}(${control.control === "radio" ? "selected" : "checked"} = ${control.checked === true}, ${control.control === "radio" ? "onClick" : "onCheckedChange"} = {}, enabled = ${enabled})`,
            `    Text(${label})`,
            "}",
          ];
        case "select":
          return [
            `Column(modifier = ${modifier}) {`,
            `    Text(${label})`,
            ...(control.options ?? []).map(
              (option) =>
                `    Row { RadioButton(selected = ${option === control.value}, onClick = {}, enabled = ${enabled}); Text(${quoted(option)}) }`,
            ),
            "}",
          ];
      }
    }
    if (element.type === "draw.path") {
      return [
        `Box(modifier = ${modifier}) {`,
        `    ${composeCompoundPath(element, style)}`,
        "}",
      ];
    }
    if (element.type === "shape.geo") {
      return [
        `Box(modifier = ${modifier}, contentAlignment = Alignment.Center) {`,
        ...(text
          ? [`    Text(text = ${composeTextExpression(editor, element)})`]
          : []),
        "}",
      ];
    }
    const textArgs = [
      `text = ${composeTextExpression(editor, element)}`,
      `modifier = ${modifier}`,
      ...(style.color ? [`color = ${composeColor(style.color)}`] : []),
      ...(style.fontSize ? [`fontSize = ${number(style.fontSize)}.sp`] : []),
      ...(style.fontWeight
        ? [`fontWeight = FontWeight(${Math.round(style.fontWeight)})`]
        : []),
      ...(style.fontStyle === "italic" ? ["fontStyle = FontStyle.Italic"] : []),
      ...(style.textAlign
        ? [
            `textAlign = TextAlign.${style.textAlign === "middle" ? "Center" : style.textAlign === "end" ? "End" : "Start"}`,
          ]
        : []),
      ...(style.letterSpacing
        ? [`letterSpacing = ${number(style.letterSpacing)}.sp`]
        : []),
    ];
    return [`Text(${textArgs.join(", ")})`];
  };
  const body = indented(render(tree.root, null, true));
  return [
    ...(options.includeComposeImports === false
      ? []
      : [
          "import androidx.compose.foundation.BorderStroke",
          "import androidx.compose.foundation.Canvas",
          "import androidx.compose.foundation.Image",
          "import androidx.compose.foundation.background",
          "import androidx.compose.foundation.border",
          "import androidx.compose.foundation.layout.*",
          "import androidx.compose.foundation.shape.CircleShape",
          "import androidx.compose.foundation.shape.GenericShape",
          "import androidx.compose.foundation.shape.RoundedCornerShape",
          "import androidx.compose.material3.*",
          "import androidx.compose.runtime.Composable",
          "import androidx.compose.ui.Alignment",
          "import androidx.compose.ui.Modifier",
          "import androidx.compose.ui.draw.alpha",
          "import androidx.compose.ui.draw.clip",
          "import androidx.compose.ui.draw.clipToBounds",
          "import androidx.compose.ui.draw.drawWithContent",
          "import androidx.compose.ui.draw.rotate",
          "import androidx.compose.ui.geometry.Offset",
          "import androidx.compose.ui.geometry.Size",
          "import androidx.compose.ui.graphics.Brush",
          "import androidx.compose.ui.graphics.BlendMode",
          "import androidx.compose.ui.graphics.Color",
          "import androidx.compose.ui.graphics.ColorFilter",
          "import androidx.compose.ui.graphics.ColorMatrix",
          "import androidx.compose.ui.graphics.graphicsLayer",
          "import androidx.compose.ui.graphics.Path",
          "import androidx.compose.ui.graphics.PathFillType",
          "import androidx.compose.ui.graphics.PathEffect",
          "import androidx.compose.ui.graphics.drawscope.Stroke",
          "import androidx.compose.ui.graphics.drawscope.withTransform",
          "import androidx.compose.ui.layout.ContentScale",
          "import androidx.compose.ui.res.painterResource",
          "import androidx.compose.ui.semantics.*",
          "import androidx.compose.ui.text.input.PasswordVisualTransformation",
          "import androidx.compose.ui.text.input.VisualTransformation",
          "import androidx.compose.ui.text.font.FontStyle",
          "import androidx.compose.ui.text.font.FontFamily",
          "import androidx.compose.ui.text.font.FontWeight",
          "import androidx.compose.ui.text.SpanStyle",
          "import androidx.compose.ui.text.buildAnnotatedString",
          "import androidx.compose.ui.text.style.TextAlign",
          "import androidx.compose.ui.text.style.TextDecoration",
          "import androidx.compose.ui.unit.dp",
          "import androidx.compose.ui.unit.sp",
          "",
        ]),
    ...(usesFlowLayout ? ["@OptIn(ExperimentalLayoutApi::class)"] : []),
    "@Composable",
    `fun ${functionName}() {`,
    ...body,
    "}",
    "",
    "@Composable",
    "private fun Modifier.nodettoRasterMask(resource: Int, x: Float, y: Float, width: Float, height: Float, cropX: Float, cropY: Float, cropWidth: Float, cropHeight: Float, rotation: Float, luminance: Boolean): Modifier {",
    "    val painter = painterResource(resource)",
    "    val filter = if (luminance) ColorFilter.colorMatrix(ColorMatrix(floatArrayOf(0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, .2126f, .7152f, .0722f, 0f, 0f))) else null",
    "    return drawWithContent {",
    "        drawContent()",
    "        val fullWidth = size.width * width / cropWidth; val fullHeight = size.height * height / cropHeight",
    "        val origin = Offset(size.width * (x - cropX * width / cropWidth), size.height * (y - cropY * height / cropHeight))",
    "        val pivot = Offset(size.width * (x + width / 2f), size.height * (y + height / 2f))",
    "        withTransform({ rotate(rotation, pivot) }) { with(painter) { draw(size = Size(fullWidth, fullHeight), topLeft = origin, colorFilter = filter, blendMode = BlendMode.DstIn) } }",
    "    }",
    "}",
  ].join("\n");
}

export function composeAdaptiveDispatcher(
  name: string,
  breakpoints: readonly AdaptiveMobileBreakpoint[],
): string {
  const descending = [...breakpoints].reverse();
  return [
    "@Composable",
    `fun ${name}() {`,
    "    BoxWithConstraints {",
    ...(descending.length === 1
      ? [`        ${descending[0]?.composeFunctionName}()`]
      : [
          "        when {",
          ...descending.map((breakpoint, index) =>
            index === descending.length - 1
              ? `            else -> ${breakpoint.composeFunctionName}()`
              : `            maxWidth >= ${number(breakpoint.width)}.dp -> ${breakpoint.composeFunctionName}()`,
          ),
          "        }",
        ]),
    "    }",
    "}",
  ].join("\n");
}
