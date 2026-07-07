// Sticker array: 54 elements, face order U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53)
// Each face is read left-to-right, top-to-bottom when looking directly at it.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Cube = require('cubejs') as {
  fromString: (s: string) => { move: (m: string) => void; asString: () => string };
};

export type FaceColor = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type MoveNotation =
  | 'U' | "U'" | 'U2'
  | 'R' | "R'" | 'R2'
  | 'F' | "F'" | 'F2'
  | 'D' | "D'" | 'D2'
  | 'L' | "L'" | 'L2'
  | 'B' | "B'" | 'B2'
  | 'M' | "M'" | 'M2'
  | 'E' | "E'" | 'E2'
  | 'S' | "S'" | 'S2';

export const SOLVED_STATE: FaceColor[] =
  'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'.split('') as FaceColor[];

export function cubejsToStickerArray(cube: { asString: () => string }): FaceColor[] {
  return cube.asString().split('') as FaceColor[];
}

export function applyMove(stickers: FaceColor[], move: MoveNotation): FaceColor[] {
  const cube = Cube.fromString(stickers.join(''));
  cube.move(move);
  return cubejsToStickerArray(cube);
}

export function applySequence(stickers: FaceColor[], moves: MoveNotation[]): FaceColor[] {
  if (moves.length === 0) return [...stickers];
  const cube = Cube.fromString(stickers.join(''));
  cube.move(moves.join(' '));
  return cubejsToStickerArray(cube);
}

export function isSolved(stickers: FaceColor[]): boolean {
  return SOLVED_STATE.every((c, i) => c === stickers[i]);
}
