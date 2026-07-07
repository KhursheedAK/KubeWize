'use client';

import { useEffect } from 'react';
import { useCubeStore } from '@/store/cubeStore';
import { MoveNotation } from '@/lib/cubeLogic';

// Keyboard map from architecture Section 7.3
const KEY_MAP: Record<string, MoveNotation> = {
  u: 'U',
  i: "U'",
  h: 'L',
  k: "L'",
  f: 'F',
  j: "F'",
  r: 'R',
  e: "R'",
  d: 'D',
  c: "D'",
  b: 'B',
  n: "B'",
};

export function useKeyboardMoves() {
  const enqueueMove = useCubeStore((s) => s.enqueueMove);
  const isAnimating = useCubeStore((s) => s.isAnimating);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const move = KEY_MAP[e.key.toLowerCase()];
      if (move && !isAnimating) {
        e.preventDefault();
        enqueueMove(move);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enqueueMove, isAnimating]);
}
