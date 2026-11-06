// Resolve omitted geometry without rewriting semantic-only imported documents.
import type {
  Element,
  SequenceActivationSemantic,
  SequenceMessageSemantic,
  SequenceParticipantSemantic,
} from "@nodetto/ir";
import type { ShapeContext } from "./shape-util.ts";
import { compareFractional } from "./fractional.ts";

export const SEQUENCE_SELF_LOOP_WIDTH = 40;
export const SEQUENCE_SELF_LOOP_HEIGHT = 32;
export const SEQUENCE_SELF_LABEL_GAP = 8;
export const SEQUENCE_SELF_LABEL_BOUNDS_GLYPH_WIDTH = 1.15;

export function isSequenceSelfMessage(element: Element): boolean {
  if (element.type !== "sequence.message") return false;
  const semantic = element.semantic as SequenceMessageSemantic;
  return typeof semantic.from === "string" && semantic.from === semantic.to;
}

export function sequenceMessageExtent(element: Element): number {
  return isSequenceSelfMessage(element) ? SEQUENCE_SELF_LOOP_HEIGHT : 0;
}

export function sequenceOrderBottomY(
  element: Element,
  order: string,
  context: ShapeContext,
): number {
  const elements = context.elementsOnPage?.(element.page) ?? [element];
  return (
    sequenceOrderY(element, order, context) +
    (elements.some(
      (candidate) =>
        isSequenceSelfMessage(candidate) &&
        (candidate.semantic as SequenceMessageSemantic).order === order,
    )
      ? SEQUENCE_SELF_LOOP_HEIGHT
      : 0)
  );
}

export function sequenceParticipants(
  element: Element,
  context: ShapeContext,
): readonly Element[] {
  return (context.elementsOnPage?.(element.page) ?? [element])
    .filter((candidate) => candidate.type === "sequence.participant")
    .sort(
      (a, b) =>
        compareFractional(
          (a.semantic as SequenceParticipantSemantic).order,
          (b.semantic as SequenceParticipantSemantic).order,
        ) || compareFractional(a.id, b.id),
    );
}

export function sequenceOrderY(
  element: Element,
  order: string,
  context: ShapeContext,
): number {
  const elements = context.elementsOnPage?.(element.page) ?? [element];
  const messages = elements.filter(
    (candidate) => candidate.type === "sequence.message",
  );
  const explicit = messages.find(
    (candidate) =>
      (candidate.semantic as SequenceMessageSemantic).order === order &&
      candidate.visual.y !== undefined,
  );
  if (explicit?.visual.y !== undefined) return explicit.visual.y;
  const orders = new Set<string>([order]);
  let priorSelfMessages = 0;
  for (const candidate of elements) {
    if (candidate.type === "sequence.message") {
      const candidateOrder = (candidate.semantic as SequenceMessageSemantic)
        .order;
      orders.add(candidateOrder);
      if (
        isSequenceSelfMessage(candidate) &&
        compareFractional(candidateOrder, order) < 0
      )
        priorSelfMessages += 1;
    }
    if (candidate.type === "sequence.activation") {
      const semantic = candidate.semantic as SequenceActivationSemantic;
      orders.add(semantic.fromOrder);
      orders.add(semantic.toOrder);
    }
  }
  const slot = [...orders].sort(compareFractional).indexOf(order);
  const headerY = Math.max(
    0,
    ...sequenceParticipants(element, context).map(
      (participant) => participant.visual.y ?? 0,
    ),
  );
  return (
    headerY + 164 + slot * 52 + priorSelfMessages * SEQUENCE_SELF_LOOP_HEIGHT
  );
}

export function sequenceMessageY(
  element: Element,
  context: ShapeContext,
): number {
  return (
    element.visual.y ??
    sequenceOrderY(
      element,
      (element.semantic as SequenceMessageSemantic).order,
      context,
    )
  );
}
