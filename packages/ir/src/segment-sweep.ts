export interface AxisSegment {
  readonly id: number;
  readonly line: number;
  readonly from: number;
  readonly to: number;
}
export interface AxisQuery {
  readonly id: number;
  readonly line: number;
  readonly at: number;
}
export interface SweepStats {
  sweepWork: number;
}

export function sweepAxisContacts(
  segments: readonly AxisSegment[],
  queries: readonly AxisQuery[],
  onContact: (segmentId: number, queryId: number) => void,
  stats?: SweepStats,
): void {
  const lines = new Map<number, AxisSegment[]>();
  for (const segment of segments) {
    const line = lines.get(segment.line);
    if (line) line.push(segment);
    else lines.set(segment.line, [segment]);
  }
  const queriesByLine = new Map<number, AxisQuery[]>();
  for (const query of queries) {
    if (!lines.has(query.line)) continue;
    const line = queriesByLine.get(query.line);
    if (line) line.push(query);
    else queriesByLine.set(query.line, [query]);
  }
  for (const [line, lineQueries] of queriesByLine) {
    const lineSegments = lines.get(line);
    if (!lineSegments) continue;
    lineSegments.sort((a, b) => a.from - b.from);
    lineQueries.sort((a, b) => a.at - b.at);
    const heap: AxisSegment[] = [];
    let next = 0;
    for (const query of lineQueries) {
      let segment = lineSegments[next];
      while (segment && segment.from <= query.at) {
        let index = heap.length;
        heap.push(segment);
        while (index > 0) {
          const parent = Math.floor((index - 1) / 2);
          const parentSegment = heap[parent];
          if (!parentSegment || parentSegment.to <= segment.to) break;
          heap[index] = parentSegment;
          index = parent;
        }
        heap[index] = segment;
        if (stats) stats.sweepWork++;
        segment = lineSegments[++next];
      }
      while (heap[0] && heap[0].to < query.at) {
        const last = heap.pop();
        if (last && heap.length > 0) {
          let index = 0;
          while (true) {
            const left = 2 * index + 1;
            const right = left + 1;
            const leftSegment = heap[left];
            if (!leftSegment) break;
            const rightSegment = heap[right];
            const child =
              rightSegment && rightSegment.to < leftSegment.to ? right : left;
            const childSegment = heap[child];
            if (!childSegment || childSegment.to >= last.to) break;
            heap[index] = childSegment;
            index = child;
          }
          heap[index] = last;
        }
        if (stats) stats.sweepWork++;
      }
      for (const active of heap) {
        onContact(active.id, query.id);
        if (stats) stats.sweepWork++;
      }
    }
  }
}
