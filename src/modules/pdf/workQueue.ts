/** Renderer-local scheduling: reading precedes background extraction/thumbnails. */
type Work = { priority: number; run: () => Promise<void> };
const waiting: Work[] = [];
let active = 0;
let background = 0;
const CONCURRENCY = 2;
function pump() {
  while (active < CONCURRENCY && waiting.length) {
    waiting.sort((a, b) => a.priority - b.priority);
    // Reserve a lane for reading even while a long background task runs.
    if (waiting[0].priority >= 3 && background >= 1) return;
    const work = waiting.shift()!;
    const lowPriority = work.priority >= 3;
    active++;
    if (lowPriority) background++;
    void work.run().finally(() => { active--; if (lowPriority) background--; pump(); });
  }
}
export function pdfWork<T>(priority: number, run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    waiting.push({ priority, run: async () => {
      try { resolve(await run()); } catch (error) { reject(error); }
    } });
    pump();
  });
}
