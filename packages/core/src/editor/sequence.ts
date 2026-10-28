// Sequence-diagram authoring: semantic timeline order for participants,
// messages and activations, and the commands that place or reorder them.

import type {
  Element,
  ElementId,
  FractionalIndex,
  PageId,
  ParticipantKind,
  SequenceActivationSemantic,
  SequenceMessageSemantic,
  SequenceParticipantSemantic,
} from "@nodetto/ir";
import type { Command } from "../commands.ts";
import type { Editor } from "../editor.ts";
import {
  compareFractional,
  keyAfter,
  keyBetween,
  type Rng,
} from "../fractional.ts";
import type { Vec } from "../geometry.ts";
import { sequenceMessageY } from "../sequence-layout.ts";
import type { Store } from "../store.ts";

/** An order key after every message and activation bound on `page`. */
export function nextSequenceOrder(
  store: Store,
  rng: Rng,
  page: PageId,
): FractionalIndex {
  let latest: string | null = null;
  for (const element of store.getPageElements(page)) {
    if (element.type === "sequence.message") {
      const order = (element.semantic as SequenceMessageSemantic).order;
      if (latest === null || compareFractional(order, latest) > 0)
        latest = order;
    } else if (element.type === "sequence.activation") {
      const semantic = element.semantic as SequenceActivationSemantic;
      for (const order of [semantic.fromOrder, semantic.toOrder]) {
        if (latest === null || compareFractional(order, latest) > 0)
          latest = order;
      }
    }
  }
  return keyAfter(latest, rng);
}

/** An order key after every participant on `page`. */
export function nextParticipantOrder(
  store: Store,
  rng: Rng,
  page: PageId,
): FractionalIndex {
  let latest: string | null = null;
  for (const element of store.getPageElements(page)) {
    if (element.type !== "sequence.participant") continue;
    const order = (element.semantic as SequenceParticipantSemantic).order;
    if (latest === null || compareFractional(order, latest) > 0) latest = order;
  }
  return keyAfter(latest, rng);
}

/**
 * Swap one sequence participant/message with its neighbour in timeline
 * order. `null` when there is no unlocked neighbour to swap with.
 */
export function planSequenceMove(
  editor: Editor,
  rng: Rng,
  id: ElementId,
  delta: -1 | 1,
): Command[] | null {
  const element = editor.store.get(id);
  if (
    !element ||
    (element.type !== "sequence.participant" &&
      element.type !== "sequence.message")
  )
    return null;
  const context = editor.createShapeContext();
  if (context.isLocked?.(id)) return null;
  const peers = editor.store
    .getPageElements(element.page)
    .filter((peer) => peer.type === element.type)
    .sort((left, right) => {
      const a = (left.semantic as { order: FractionalIndex }).order;
      const b = (right.semantic as { order: FractionalIndex }).order;
      return compareFractional(a, b) || compareFractional(left.id, right.id);
    });
  const index = peers.findIndex((peer) => peer.id === id);
  const targetIndex = index + delta;
  const target = peers[targetIndex];
  if (index < 0 || !target || context.isLocked?.(target.id)) return null;

  const remaining = peers.filter((peer) => peer.id !== id);
  const insertionIndex = targetIndex;
  const before = remaining[insertionIndex - 1];
  const after = remaining[insertionIndex];
  const beforeOrder = before
    ? (before.semantic as { order: FractionalIndex }).order
    : null;
  const afterOrder = after
    ? (after.semantic as { order: FractionalIndex }).order
    : null;
  // Duplicate imported keys still have a stable id tie-break, but there is
  // no fractional value strictly between equal bounds. Refuse cleanly.
  if (
    beforeOrder !== null &&
    afterOrder !== null &&
    compareFractional(beforeOrder, afterOrder) >= 0
  )
    return null;
  const order = keyBetween(beforeOrder, afterOrder, rng);
  const semantic = {
    ...(element.semantic as Record<string, unknown>),
    order,
  };
  const axis = element.type === "sequence.participant" ? "x" : "y";
  const position = (peer: Element) =>
    peer.type === "sequence.message"
      ? sequenceMessageY(peer, context)
      : context.boundsOf(peer.id)?.x;
  const currentPosition = position(element);
  const targetPosition = position(target);
  return [
    { type: "updateSemantic", id, semantic },
    ...(currentPosition !== undefined && targetPosition !== undefined
      ? [
          {
            type: "updateVisual" as const,
            id,
            visual: { [axis]: targetPosition },
          },
          {
            type: "updateVisual" as const,
            id: target.id,
            visual: { [axis]: currentPosition },
          },
        ]
      : []),
  ];
}

/** A participant on the current page with its header centred on `centre`. */
export function buildSequenceParticipant(
  editor: Editor,
  rng: Rng,
  kind: ParticipantKind,
  centre: Vec,
): Element {
  const page = editor.currentPageId;
  const count = editor.store
    .getPageElements(page)
    .filter(
      (element) =>
        element.type === "sequence.participant" &&
        (element.semantic as SequenceParticipantSemantic).kind === kind,
    ).length;
  const label: Readonly<Record<ParticipantKind, string>> = {
    actor: "Actor",
    service: "Service",
    db: "Database",
  };
  let bottom = centre.y + 110;
  const context = editor.createShapeContext();
  for (const element of editor.store.getPageElements(page)) {
    if (element.type === "sequence.message")
      bottom = Math.max(bottom, sequenceMessageY(element, context) + 60);
  }
  return editor.buildElement("sequence.participant", {
    page,
    semantic: {
      name: `${label[kind]} ${count + 1}`,
      kind,
      order: nextParticipantOrder(editor.store, rng, page),
    },
    visual: {
      x: centre.x - 80,
      y: centre.y - 28,
      width: 160,
      height: Math.max(220, bottom - (centre.y - 28)),
    },
  });
}

/**
 * An activation bar spanning the participant's current messages, growing
 * the participant's lifeline when it is too short. `null` for a missing or
 * locked participant.
 */
export function planSequenceActivation(
  editor: Editor,
  rng: Rng,
  participantId: ElementId,
): { readonly id: ElementId; readonly commands: Command[] } | null {
  const participant = editor.store.get(participantId);
  if (
    !participant ||
    participant.type !== "sequence.participant" ||
    editor.createShapeContext().isLocked?.(participantId)
  )
    return null;
  const messages = editor.store
    .getPageElements(participant.page)
    .filter((element) => {
      if (element.type !== "sequence.message") return false;
      const semantic = element.semantic as SequenceMessageSemantic;
      return semantic.from === participantId || semantic.to === participantId;
    })
    .sort((left, right) => {
      const a = (left.semantic as SequenceMessageSemantic).order;
      const b = (right.semantic as SequenceMessageSemantic).order;
      return compareFractional(a, b) || compareFractional(left.id, right.id);
    });
  const first = messages[0];
  const last = messages.at(-1);
  const fromOrder = first
    ? (first.semantic as SequenceMessageSemantic).order
    : nextSequenceOrder(editor.store, rng, participant.page);
  const toOrder =
    last && last !== first
      ? (last.semantic as SequenceMessageSemantic).order
      : keyAfter(fromOrder, rng);
  const context = editor.createShapeContext();
  const startY = first
    ? sequenceMessageY(first, context)
    : (participant.visual.y ?? 0) + 104;
  const endY = last ? sequenceMessageY(last, context) : startY + 52;
  const activation = editor.buildElement("sequence.activation", {
    page: participant.page,
    semantic: { participant: participantId, fromOrder, toOrder },
    visual: {
      y: startY,
      width: 10,
      height: Math.max(24, endY - startY + 24),
    },
  });
  const requiredHeight = endY - (participant.visual.y ?? 0) + 60;
  const commands: Command[] = [];
  if ((participant.visual.height ?? 220) < requiredHeight)
    commands.push({
      type: "replaceVisual",
      id: participant.id,
      visual: { ...participant.visual, height: requiredHeight },
    });
  commands.push({ type: "createElement", element: activation });
  return { id: activation.id, commands };
}

/**
 * A timeline message between two participants below every existing one,
 * growing lifelines that would end above it. `null` when either end is
 * locked.
 */
export function planSequenceMessage(
  editor: Editor,
  rng: Rng,
  source: Element,
  target: Element,
): { readonly id: ElementId; readonly commands: Command[] } | null {
  const from = source.id;
  const to = target.id;
  const context = editor.createShapeContext();
  if (context.isLocked?.(from) || context.isLocked?.(to)) return null;
  const existingY = editor.store
    .getPageElements(source.page)
    .filter((element) => element.type === "sequence.message")
    .reduce(
      (bottom, element) => Math.max(bottom, sequenceMessageY(element, context)),
      Math.max((source.visual.y ?? 0) + 112, (target.visual.y ?? 0) + 112),
    );
  const y = existingY + 52;
  const message = editor.buildElement("sequence.message", {
    page: source.page,
    semantic: {
      from,
      to,
      order: nextSequenceOrder(editor.store, rng, source.page),
      kind: "sync",
      label: "Message",
    },
    visual: { y },
  });
  const commands: Command[] = [];
  for (const participant of editor.store
    .getPageElements(source.page)
    .filter((element) => element.type === "sequence.participant")) {
    if (context.isLocked?.(participant.id)) continue;
    const requiredHeight = y - (participant.visual.y ?? 0) + 60;
    if ((participant.visual.height ?? 220) < requiredHeight)
      commands.push({
        type: "replaceVisual",
        id: participant.id,
        visual: { ...participant.visual, height: requiredHeight },
      });
  }
  commands.push({ type: "createElement", element: message });
  return { id: message.id, commands };
}
