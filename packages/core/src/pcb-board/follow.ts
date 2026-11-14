import type {
  Element,
  ElementId,
  PcbBoardSemantic,
  PcbFootprintSemantic,
  PcbTrackSemantic,
  PcbXY,
} from "@nodetto/ir";
import { roundNm } from "@nodetto/ir";
import type { Command } from "../commands.ts";
import type { Store } from "../store.ts";
import {
  PcbGrid,
  boardToFootprint,
  footprintBounds,
  footprintToBoard,
  outlineContains,
  padCopperOutline,
  padHasCopperLayer,
  pageCopperLayers,
} from "./geometry.ts";

interface ChangedFootprint {
  readonly id: ElementId;
  readonly before: PcbFootprintSemantic;
  readonly after: PcbFootprintSemantic;
}
interface IndexedTrack {
  readonly element: Element;
  readonly semantic: PcbTrackSemantic;
}
interface FollowedEnd {
  readonly footprint: ChangedFootprint;
}

const sameSemantic = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
const samePoint = (a: PcbXY, b: PcbXY): boolean =>
  a[0] === b[0] && a[1] === b[1];

function trackBounds(track: PcbTrackSemantic) {
  const points = track.mid ? [...track.points, track.mid] : track.points;
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function followedEnd(
  point: PcbXY,
  layer: string,
  footprint: ChangedFootprint,
  copper: readonly string[],
): PcbXY | undefined {
  for (const pad of footprint.before.pads) {
    if (
      padHasCopperLayer(pad, layer, copper) &&
      outlineContains(padCopperOutline(footprint.before, pad), point)
    ) {
      const local = boardToFootprint(footprint.before, point);
      const next = footprintToBoard(footprint.after, local);
      return [roundNm(next[0]), roundNm(next[1])];
    }
  }
  return undefined;
}

function rotateSagitta(
  sagitta: PcbXY,
  oldStart: PcbXY,
  oldEnd: PcbXY,
  newStart: PcbXY,
  newEnd: PcbXY,
): PcbXY | undefined {
  const oldX = oldEnd[0] - oldStart[0];
  const oldY = oldEnd[1] - oldStart[1];
  const newX = newEnd[0] - newStart[0];
  const newY = newEnd[1] - newStart[1];
  const oldLength = Math.sqrt(oldX * oldX + oldY * oldY);
  const newLength = Math.sqrt(newX * newX + newY * newY);
  if (oldLength === 0) return undefined;
  if (newLength === 0) return [0, 0];
  const cosine = (oldX * newX + oldY * newY) / (oldLength * newLength);
  const sine = (oldX * newY - oldY * newX) / (oldLength * newLength);
  const scale = newLength / oldLength;
  return [
    (sagitta[0] * cosine - sagitta[1] * sine) * scale,
    (sagitta[0] * sine + sagitta[1] * cosine) * scale,
  ];
}

function arcMid(
  old: PcbTrackSemantic,
  points: readonly PcbXY[],
  ends: readonly [FollowedEnd | undefined, FollowedEnd | undefined],
): PcbXY {
  const oldStart = old.points[0] as PcbXY;
  const oldEnd = old.points[old.points.length - 1] as PcbXY;
  const newStart = points[0] as PcbXY;
  const newEnd = points[points.length - 1] as PcbXY;
  const [first, last] = ends;
  if (first && last && first.footprint.id === last.footprint.id) {
    const localMid = boardToFootprint(first.footprint.before, old.mid as PcbXY);
    const mapped = footprintToBoard(first.footprint.after, localMid);
    return [roundNm(mapped[0]), roundNm(mapped[1])];
  }
  if (Boolean(first) === Boolean(last)) return old.mid as PcbXY;
  const oldMid = old.mid as PcbXY;
  const sagitta: PcbXY = [
    oldMid[0] - (oldStart[0] + oldEnd[0]) / 2,
    oldMid[1] - (oldStart[1] + oldEnd[1]) / 2,
  ];
  const rotated = rotateSagitta(sagitta, oldStart, oldEnd, newStart, newEnd);
  if (!rotated) return old.mid as PcbXY;
  return [
    roundNm((newStart[0] + newEnd[0]) / 2 + rotated[0]),
    roundNm((newStart[1] + newEnd[1]) / 2 + rotated[1]),
  ];
}

export function planPcbTrackFollow(before: Store, draft: Store): Command[] {
  const footprints: ChangedFootprint[] = [];
  for (const element of before.listElements()) {
    if (element.type !== "pcb.footprint") continue;
    const next = draft.get(element.id);
    if (next?.type !== "pcb.footprint") continue;
    const priorSemantic = element.semantic as PcbFootprintSemantic;
    const nextSemantic = next.semantic as PcbFootprintSemantic;
    if (
      samePoint(priorSemantic.at, nextSemantic.at) &&
      priorSemantic.rotation === nextSemantic.rotation
    )
      continue;
    footprints.push({
      id: element.id,
      before: priorSemantic,
      after: nextSemantic,
    });
  }
  if (footprints.length === 0) return [];

  const grid = new PcbGrid<IndexedTrack>();
  for (const element of before.listElements()) {
    if (element.type !== "pcb.track") continue;
    const next = draft.get(element.id);
    if (
      next?.type !== "pcb.track" ||
      !sameSemantic(element.semantic, next.semantic)
    )
      continue;
    const track = element.semantic as PcbTrackSemantic;
    grid.insert({ element, semantic: track }, trackBounds(track));
  }

  const followed = new Map<
    ElementId,
    {
      readonly element: Element;
      readonly track: PcbTrackSemantic;
      readonly points: PcbXY[];
      readonly ends: [FollowedEnd | undefined, FollowedEnd | undefined];
    }
  >();
  for (const footprint of footprints) {
    const oldFootprint = before.get(footprint.id);
    if (!oldFootprint) continue;
    const board = before
      .getPageElements(oldFootprint.page)
      .find((element) => element.type === "pcb.board");
    const copper = pageCopperLayers(
      board?.semantic as PcbBoardSemantic | undefined,
    );
    for (const candidate of grid.query(footprintBounds(footprint.before))) {
      if (candidate.element.page !== oldFootprint.page) continue;
      const { semantic: track, element } = candidate;
      const state = followed.get(element.id) ?? {
        element,
        track,
        points: [...track.points],
        ends: [undefined, undefined] as [
          FollowedEnd | undefined,
          FollowedEnd | undefined,
        ],
      };
      const endpointIndexes = [0, state.points.length - 1] as const;
      for (let end = 0; end < endpointIndexes.length; end++) {
        const index = endpointIndexes[end] as number;
        if (state.ends[end]) continue;
        const priorPoint = track.points[index] as PcbXY;
        const mapped = followedEnd(priorPoint, track.layer, footprint, copper);
        if (!mapped) continue;
        state.points[index] = mapped;
        state.ends[end] = { footprint };
      }
      if (!state.ends[0] && !state.ends[1]) continue;
      followed.set(element.id, state);
    }
  }

  const commands: Command[] = [];
  for (const { element, track, points, ends } of followed.values()) {
    const nextSemantic: PcbTrackSemantic = {
      ...track,
      points,
      ...(track.mid ? { mid: arcMid(track, points, ends) } : {}),
    };
    commands.push({
      type: "updateSemantic",
      id: element.id,
      semantic: nextSemantic,
    });
  }
  return commands;
}
