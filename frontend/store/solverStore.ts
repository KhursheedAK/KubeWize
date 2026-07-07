import { create } from 'zustand';
import { MoveNotation } from '@/lib/cubeLogic';

interface SolverState {
  isSolving: boolean; // full auto-solve sequence is enqueued/animating
  isThinking: boolean; // worker request in flight (solve OR hint)
  hintEnabled: boolean;
  hintMove: MoveNotation | null;

  setSolving: (value: boolean) => void;
  setThinking: (value: boolean) => void;
  toggleHint: () => void;
  setHintMove: (move: MoveNotation | null) => void;
}

export const useSolverStore = create<SolverState>((set) => ({
  isSolving: false,
  isThinking: false,
  hintEnabled: false,
  hintMove: null,

  setSolving: (value) => set({ isSolving: value }),
  setThinking: (value) => set({ isThinking: value }),
  toggleHint: () =>
    set((s) => ({ hintEnabled: !s.hintEnabled, hintMove: s.hintEnabled ? null : s.hintMove })),
  setHintMove: (move) => set({ hintMove: move }),
}));
