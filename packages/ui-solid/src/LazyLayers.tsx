import type { Editor, ViewportSize } from "@nodetto/core";
import { type JSX, lazy, Suspense } from "solid-js";

const LayersPanel = lazy(() =>
  import("./Layers.tsx").then((module) => ({ default: module.Layers })),
);

/** Keep design-system libraries and layer-tree controls out of initial JS. */
export function Layers(props: {
  readonly editor: Editor;
  readonly simple?: boolean;
  readonly viewport?: ViewportSize;
  readonly commentAuthor?: string;
  readonly commentRequest?: number;
  readonly commentPlacementActive?: boolean;
  readonly onPlaceComment?: (
    input: {
      readonly author: string;
      readonly body: string;
    },
    onPlaced: () => void,
  ) => void;
  readonly onCancelCommentPlacement?: () => void;
  readonly layersOpen?: boolean;
  readonly onLayersOpenChange?: (open: boolean) => void;
}): JSX.Element {
  return (
    <Suspense
      fallback={
        <nav class="nodetto-layers" aria-label="Layers">
          <details
            class="nodetto-navigation-group"
            open={props.layersOpen ?? true}
          >
            <summary>Layers</summary>
          </details>
        </nav>
      }
    >
      <LayersPanel {...props} />
    </Suspense>
  );
}
