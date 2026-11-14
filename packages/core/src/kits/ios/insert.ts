import type { ElementId, FrameSemantic, PageId } from "@nodetto/ir";
import type { Editor } from "../../editor.ts";
import { planAttachToFrame } from "../../insertion-parent.ts";
import { findKitComponent } from "./index.ts";
import { applyKitProps } from "./props.ts";

export function insertKitComponent(
  editor: Editor,
  kitId: string,
  options: {
    readonly page: PageId;
    readonly x?: number;
    readonly y?: number;
    readonly width?: number;
    readonly parentId?: ElementId;
    readonly props?: Readonly<Record<string, unknown>>;
  },
): ElementId {
  const kit = findKitComponent(kitId);
  if (!kit) throw new Error(`unknown kit component "${kitId}"`);
  const previousPage = editor.currentPageId;
  try {
    let definition = editor.store
      .listElements()
      .find(
        (element) =>
          element.type === "frame" &&
          (element.semantic as FrameSemantic).component &&
          (element.semantic as FrameSemantic).kit === `${kit.id}@1`,
      );
    if (!definition) {
      const page =
        editor.store.listPages().find((item) => item.name === "iOS kit")?.id ??
        editor.createPage({ name: "iOS kit", kind: "freeform", mode: "app" });
      editor.setCurrentPage(page);
      const frames = editor.store
        .getPageElements(page)
        .filter(
          (item) =>
            item.type === "frame" && (item.semantic as FrameSemantic).component,
        );
      const y = frames.length
        ? Math.max(
            ...frames.map(
              (item) => (item.visual.y ?? 0) + (item.visual.height ?? 0),
            ),
          ) + 40
        : 0;
      const built = kit.build(editor, { x: 0, y });
      editor.apply([
        { type: "createElement", element: built.frame },
        ...built.children.map((element) => ({
          type: "createElement" as const,
          element,
        })),
      ]);
      definition = built.frame;
    }
    editor.setCurrentPage(options.page);
    const parent = options.parentId
      ? editor.store.get(options.parentId)
      : undefined;
    const x =
      options.x ?? (kit.fullWidth && parent ? (parent.visual.x ?? 0) : 0);
    const y = options.y ?? parent?.visual.y ?? 0;
    const id = editor.createComponentInstance(definition.id, { x, y });
    if (!id) throw new Error(`cannot instantiate kit component "${kitId}"`);
    const instance = editor.store.get(id);
    const width =
      options.width ?? (kit.fullWidth ? parent?.visual.width : undefined);
    if (instance && width !== undefined)
      editor.apply([
        { type: "replaceVisual", id, visual: { ...instance.visual, width } },
      ]);
    if (options.parentId)
      editor.apply(planAttachToFrame(editor.store, options.parentId, id));
    let props = options.props;
    if (
      kitId === "ios:tab-bar" &&
      width !== undefined &&
      props?.["items"] === undefined &&
      props?.["count"] === undefined
    ) {
      const current = editor.store.get(id);
      const members =
        current && current.type === "frame"
          ? ((current.semantic as FrameSemantic).memberIds ?? [])
          : [];
      const count = members
        .map((memberId) => editor.store.get(memberId))
        .filter(
          (member) =>
            member?.type === "frame" &&
            /^item[1-5]$/.test(member.visual.componentKey ?? "") &&
            !member.visual.hidden,
        ).length;
      props = { ...props, count };
    }
    applyKitProps(editor, id, props);
    return id;
  } finally {
    editor.setCurrentPage(previousPage);
  }
}
