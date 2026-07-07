import { create } from 'zustand';
import {
  FaceColor,
  MoveNotation,
  SOLVED_STATE,
  applyMove,
  applySequence,
  isSolved,
} from '@/lib/cubeLogic';

interface CubeState {
  stickers: FaceColor[];
  moveHistory: MoveNotation[];
  moveQueue: MoveNotation[];
  isAnimating: boolean;
  isSolved: boolean;
  // Increments on reset/scramble so RubiksCube knows to restore cubie positions
  resetVersion: number;

  // Queue a move for animation (called by buttons/keyboard)
  enqueueMove: (move: MoveNotation) => void;
  beginDirectMove: () => void;
  commitDirectMove: (move: MoveNotation) => void;
  cancelDirectMove: () => void;
  // Apply move to stickers and dequeue (called by MoveAnimator after tween)
  commitMove: (move: MoveNotation) => void;
  // Instant update, no animation (kept for internal use)
  applyMoveSequence: (moves: MoveNotation[]) => void;
  resetToSolved: () => void;
  loadScramble: (stickers: FaceColor[]) => void;
}

export const useCubeStore = create<CubeState>((set, get) => ({
  stickers: [...SOLVED_STATE],
  moveHistory: [],
  moveQueue: [],
  isAnimating: false,
  isSolved: true,
  resetVersion: 0,

  enqueueMove: (move) => {
    set((s) => ({
      moveQueue: [...s.moveQueue, move],
      isAnimating: true,
    }));
  },

  beginDirectMove: () => set({ isAnimating: true }),

  commitDirectMove: (move) => {
    const s = get();
    const nextStickers = applyMove(s.stickers, move);
    set({
      stickers: nextStickers,
      moveHistory: [...s.moveHistory, move],
      isAnimating: false,
      isSolved: isSolved(nextStickers),
    });
  },

  cancelDirectMove: () => set({ isAnimating: false }),

  commitMove: (move) => {
    const s = get();
    const nextStickers = applyMove(s.stickers, move);
    const nextQueue = s.moveQueue.slice(1);
    set({
      stickers: nextStickers,
      moveHistory: [...s.moveHistory, move],
      moveQueue: nextQueue,
      isAnimating: nextQueue.length > 0,
      isSolved: isSolved(nextStickers),
    });
  },

  applyMoveSequence: (moves) => {
    const s = get();
    const next = applySequence(s.stickers, moves);
    set({
      stickers: next,
      moveHistory: [...s.moveHistory, ...moves],
      isSolved: isSolved(next),
    });
  },

  resetToSolved: () => {
    set((s) => ({
      stickers: [...SOLVED_STATE],
      moveHistory: [],
      moveQueue: [],
      isAnimating: false,
      isSolved: true,
      resetVersion: s.resetVersion + 1,
    }));
  },

  loadScramble: (stickers) => {
    set((s) => ({
      stickers: [...stickers],
      moveHistory: [],
      moveQueue: [],
      isAnimating: false,
      isSolved: isSolved(stickers),
      resetVersion: s.resetVersion + 1,
    }));
  },
}));
