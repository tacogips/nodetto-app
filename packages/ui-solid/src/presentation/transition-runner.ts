import type { SlideNodeLookup } from "./transition-dom.ts";

export class SlideTransitionRunner {
  private generation = 0;
  private active: { animations: Animation[]; cancel: () => void } | undefined;

  cancel(): void {
    this.generation += 1;
    const active = this.active;
    this.active = undefined;
    if (!active) return;
    active.cancel();
    for (const animation of active.animations) animation.cancel();
  }

  async play(jobs: SlideNodeLookup): Promise<"finished" | "cancelled"> {
    this.cancel();
    const generation = this.generation;
    const animations: Animation[] = [];
    let cancelPlay = () => {};
    const cancelled = new Promise<"cancelled">((resolve) => {
      cancelPlay = () => resolve("cancelled");
    });
    this.active = { animations, cancel: cancelPlay };
    try {
      for (const job of jobs) {
        animations.push(job.target.animate(job.keyframes, job.options));
      }
      const finished = Promise.all(
        animations.map((animation) => animation.finished),
      ).then(
        () => "finished" as const,
        () => "cancelled" as const,
      );
      const result = await Promise.race([finished, cancelled]);
      return generation === this.generation ? result : "cancelled";
    } finally {
      if (generation === this.generation) this.active = undefined;
      for (const job of jobs) job.onFinish?.();
    }
  }
}
