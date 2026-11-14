// Tool-specific editing handles for the one selected element: freehand and
// path points, image crop, and gradient stops.

import type { Editor } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { type Accessor, type JSX, Show } from "solid-js";
import { CompoundPathHandles } from "../CompoundPathHandles.tsx";
import { GradientHandles } from "../GradientHandles.tsx";
import { ImageCropHandles } from "../ImageCropHandles.tsx";
import { StrokeHandles } from "../StrokeHandles.tsx";
import type { ToolKind } from "../tools.ts";
import { clientToPage } from "./geometry.ts";
import type { CropTarget, GradientTarget } from "./overlay-targets.ts";

export interface EditHandlesProps {
  readonly editor: Editor;
  readonly tool: ToolKind;
  readonly single: Accessor<Element | null>;
  readonly cropTarget: Accessor<CropTarget | null>;
  readonly gradientTarget: Accessor<GradientTarget | null>;
  readonly zoom: Accessor<number>;
  readonly container: () => HTMLElement | undefined;
}

export function EditHandles(props: EditHandlesProps): JSX.Element {
  const toPage = (event: PointerEvent) =>
    clientToPage(props.editor, props.container(), event);
  return (
    <>
      <Show
        when={
          props.tool === "edit.points" &&
          props.single()?.type === "draw.freehand"
            ? props.single()
            : null
        }
      >
        {(element) => (
          <StrokeHandles
            editor={props.editor}
            element={element()}
            zoom={props.zoom()}
            toPage={toPage}
          />
        )}
      </Show>
      <Show
        when={
          props.tool === "edit.points" && props.single()?.type === "draw.path"
            ? props.single()
            : null
        }
      >
        {(element) => (
          <CompoundPathHandles
            editor={props.editor}
            element={element()}
            zoom={props.zoom()}
            toPage={toPage}
          />
        )}
      </Show>
      <Show when={props.cropTarget()}>
        {(target) => (
          <ImageCropHandles
            editor={props.editor}
            element={target().element}
            box={target().box}
            zoom={props.zoom()}
            toPage={toPage}
          />
        )}
      </Show>
      <Show when={props.gradientTarget()}>
        {(target) => (
          <GradientHandles
            editor={props.editor}
            element={target().element}
            box={target().box}
            zoom={props.zoom()}
            paint={target().paint}
            toPage={toPage}
          />
        )}
      </Show>
    </>
  );
}
