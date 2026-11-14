// The editor facade keeps component and responsive-variant operations here.
// State and the core API live in editor/facade/core.ts; other responsibilities
// live in editor/facade/*.ts.

import type { Element, ElementId, FrameSemantic } from "@nodetto/ir";
import type { Command } from "./commands.ts";
import { planResetComponentOverride } from "./component-overrides.ts";
import { planComponentRefresh } from "./component-refresh.ts";
import { componentVariants } from "./component-variants.ts";
import {
  planComponentInstance,
  planRebuildComponentInstance,
  planRebuildResponsiveVariant,
  planResponsiveVariant,
} from "./editor/components.ts";
import type { ApplyOptions } from "./editor/types.ts";
import { planReorderMember } from "./frame-membership.ts";
import type { Vec } from "./geometry.ts";
import type { FramePresetKey } from "./shapes/frame.ts";
import { NotationEditing } from "./editor/facade/notation-editing.ts";

export type {
  ApplyOptions,
  BpmnEditResult,
  CreateElementOptions,
  CreatePageOptions,
  EditableField,
  EditorListener,
  EditorOptions,
  StylePatch,
} from "./editor/types.ts";

export class Editor extends NotationEditing {
  // ------------------------------------------------------------ components

  private unlockedFrame(id: ElementId): Element | null {
    const element = this.store.get(id);
    if (
      !element ||
      element.type !== "frame" ||
      this.createShapeContext().isLocked?.(id)
    )
      return null;
    return element;
  }

  private frameSemantic(id: ElementId): FrameSemantic | undefined {
    const element = this.store.get(id);
    return element?.type === "frame"
      ? (element.semantic as FrameSemantic)
      : undefined;
  }

  makeComponent(id: ElementId): boolean {
    const element = this.unlockedFrame(id);
    if (!element) return false;
    const {
      instanceOf: _instanceOf,
      autoRefresh: _autoRefresh,
      instanceBindings: _bindings,
      ...semantic
    } = element.semantic as FrameSemantic;
    this.apply([
      {
        type: "updateSemantic",
        id,
        semantic: { ...semantic, component: true },
      },
    ]);
    return true;
  }

  createComponentInstance(id: ElementId, at?: Vec): ElementId | null {
    const plan = planComponentInstance(this, this.idSource, id, at);
    if (!plan) return null;
    this.apply(plan.commands);
    this.selection.set([plan.instanceId]);
    return plan.instanceId;
  }

  detachComponentInstance(id: ElementId): boolean {
    const element = this.unlockedFrame(id);
    if (!element) return false;
    const {
      instanceOf,
      autoRefresh: _autoRefresh,
      instanceBindings: _bindings,
      ...semantic
    } = element.semantic as FrameSemantic;
    if (!instanceOf) return false;
    this.apply([{ type: "updateSemantic", id, semantic }]);
    return true;
  }

  resetComponentInstance(id: ElementId): boolean {
    const sourceId = this.frameSemantic(id)?.instanceOf;
    return sourceId ? this.rebuildComponentInstance(id, sourceId) : false;
  }

  switchComponentVariant(id: ElementId, sourceId: ElementId): boolean {
    const current = this.frameSemantic(id)?.instanceOf;
    if (
      !current ||
      !componentVariants(this, current).some(
        (variant) => variant.id === sourceId,
      )
    )
      return false;
    if (current === sourceId) return true;
    return this.rebuildComponentInstance(id, sourceId, true);
  }

  updateComponentStructure(id: ElementId): boolean {
    const semantic = this.frameSemantic(id);
    if (!semantic) return false;
    if (!semantic.instanceOf || !semantic.instanceBindings?.length)
      return false;
    return this.rebuildComponentInstance(id, semantic.instanceOf, true, true);
  }

  /** Pure command plan used by dependency-ordered automatic refresh. */
  planComponentStructureUpdate(id: ElementId): Command[] | null {
    const semantic = this.frameSemantic(id);
    return semantic?.instanceOf
      ? planRebuildComponentInstance(
          this,
          this.idSource,
          id,
          semantic.instanceOf,
          true,
          true,
        )
      : null;
  }

  /** Reconcile source membership without replacing breakpoint-owned geometry. */
  updateResponsiveStructure(id: ElementId): boolean {
    const semantic = this.frameSemantic(id);
    if (!semantic) return false;
    if (
      !semantic.responsiveSource ||
      semantic.instanceOf ||
      !semantic.instanceBindings?.length
    )
      return false;
    return this.rebuildResponsiveVariant(id, semantic.responsiveSource);
  }

  private rebuildComponentInstance(
    id: ElementId,
    sourceId: ElementId,
    preserveOverrides = false,
    preserveLocal = false,
  ): boolean {
    const commands = planRebuildComponentInstance(
      this,
      this.idSource,
      id,
      sourceId,
      preserveOverrides,
      preserveLocal,
    );
    if (!commands) return false;
    this.apply(commands);
    this.selection.set([id]);
    return true;
  }

  private rebuildResponsiveVariant(
    id: ElementId,
    sourceId: ElementId,
  ): boolean {
    const commands = planRebuildResponsiveVariant(
      this,
      this.idSource,
      (document) =>
        new Editor({
          document,
          registry: this.registry,
          idSource: () => "responsive-stage-unused",
        }),
      id,
      sourceId,
    );
    if (!commands) return false;
    this.apply(commands);
    this.selection.set([id]);
    return true;
  }

  reorderFrameMember(id: ElementId, direction: -1 | 1): boolean {
    const commands = planReorderMember(
      this.store,
      this.createShapeContext(),
      id,
      direction,
    );
    if (!commands.length) return false;
    this.apply(commands);
    return true;
  }

  refreshComponentInstance(id: ElementId): boolean {
    const commands = planComponentRefresh(this, id);
    if (!commands) return false;
    if (commands.length) this.apply(commands);
    return true;
  }

  /** Pull inherited content/style changes into a responsive copy. */
  refreshResponsiveVariant(id: ElementId): boolean {
    const semantic = this.frameSemantic(id);
    if (!semantic?.responsiveSource || semantic.instanceOf) return false;
    const commands = planComponentRefresh(this, id);
    if (!commands) return false;
    if (commands.length) this.apply(commands);
    return true;
  }

  /** Keep current responsive content but stop future source refreshes. */
  detachResponsiveVariant(id: ElementId): boolean {
    const element = this.unlockedFrame(id);
    if (!element) return false;
    const {
      responsiveSource,
      instanceBindings: _bindings,
      ...semantic
    } = element.semantic as FrameSemantic;
    if (!responsiveSource) return false;
    this.apply([{ type: "updateSemantic", id, semantic }]);
    return true;
  }

  resetComponentOverride(
    instanceId: ElementId,
    targetId: ElementId,
    field: string,
  ): boolean {
    const commands = planResetComponentOverride(
      this,
      instanceId,
      targetId,
      field,
    );
    if (!commands) return false;
    this.apply(commands);
    return true;
  }

  /**
   * Clone one complete artboard beside its source and resize the clone through
   * the normal constraint/layout pipeline. Shared design resources remain
   * linked because this is an in-document responsive variant, not a portable
   * clipboard fragment. The create and derived reflow form one undo step.
   */
  createResponsiveVariant(
    id: ElementId,
    presetKey: FramePresetKey,
    applyOptions: ApplyOptions = {},
  ): ElementId | null {
    const plan = planResponsiveVariant(this, this.idSource, id, presetKey);
    if (!plan) return null;
    this.apply(plan.commands, applyOptions);
    this.selection.set([plan.createdId]);
    return plan.createdId;
  }
}
