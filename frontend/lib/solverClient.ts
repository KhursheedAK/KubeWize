import { FaceColor, MoveNotation } from './cubeLogic';

// Lazily-created singleton worker — nothing here runs until solveCube()
// is first called from client code (button click / hint effect), so it
// never touches `Worker` during SSR.
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, (moves: MoveNotation[]) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./solver.worker.ts', import.meta.url));
    worker.onmessage = (event: MessageEvent) => {
      const { cmd, id, moves } = event.data;
      if (cmd !== 'solution') return;
      const resolve = pending.get(id);
      pending.delete(id);
      resolve?.(moves as MoveNotation[]);
    };
  }
  return worker;
}

/** Solves the given cube state in the background worker. Resolves to an
 *  empty array if the cube is already solved. */
export function solveCube(stickers: FaceColor[]): Promise<MoveNotation[]> {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    w.postMessage({ cmd: 'solve', id, stickers: stickers.join('') });
  });
}
