// Runs cubejs's Kociemba two-phase solver off the main thread.
// Table computation (Cube.initSolver) is a one-time, CPU-heavy BFS —
// keeping it here means dragging/animating the cube never stutters
// while it runs, and while an actual solve search is in progress.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Cube = require('cubejs') as {
  fromString: (s: string) => { solve: (maxDepth?: number) => string };
  initSolver: () => void;
};

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  Cube.initSolver();
  initialized = true;
}

interface SolveRequest {
  cmd: 'solve';
  id: number;
  stickers: string;
}

self.onmessage = (event: MessageEvent<SolveRequest>) => {
  const { cmd, id, stickers } = event.data;
  if (cmd !== 'solve') return;

  ensureInitialized();
  const cube = Cube.fromString(stickers);
  const solution = cube.solve();
  const moves = solution.length > 0 ? solution.split(' ') : [];
  (self as unknown as Worker).postMessage({ cmd: 'solution', id, moves });
};

export {};
