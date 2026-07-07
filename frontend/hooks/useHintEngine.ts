'use client';

import { useEffect, useRef } from 'react';
import { useCubeStore } from '@/store/cubeStore';
import { useSolverStore } from '@/store/solverStore';
import { solveCube } from '@/lib/solverClient';
import { MoveNotation } from '@/lib/cubeLogic';

// Keeps solverStore.hintMove pointed at "the next correct move" while the
// hint toggle is on.
//
// This does NOT re-run cubejs's solver from scratch after every move. Two
// independent solve() calls on closely-related states aren't guaranteed to
// agree on a consistent path — re-solving after each step was observed to
// occasionally orbit a small cycle of states forever (e.g. four states that
// each independently recommend "R", so applying it just cycles through them
// — R^4 is the identity — instead of ever converging on solved). Instead:
// solve once, cache the full plan, and step through it. That's a fixed,
// finite sequence, so it can't cycle. Only recompute when the user deviates
// from the cached plan (a different move, a scramble/reset, etc).
export function useHintEngine() {
  const hintEnabled = useSolverStore((s) => s.hintEnabled);
  const isSolving = useSolverStore((s) => s.isSolving);
  const setHintMove = useSolverStore((s) => s.setHintMove);
  const setThinking = useSolverStore((s) => s.setThinking);
  const stickers = useCubeStore((s) => s.stickers);
  const moveHistory = useCubeStore((s) => s.moveHistory);
  const isSolved = useCubeStore((s) => s.isSolved);
  const isAnimating = useCubeStore((s) => s.isAnimating);

  const planRef = useRef<MoveNotation[]>([]);
  const lastMoveCountRef = useRef(moveHistory.length);

  useEffect(() => {
    if (!hintEnabled || isSolving || isAnimating || isSolved) {
      if (!hintEnabled) planRef.current = [];
      setHintMove(null);
      return;
    }

    const appliedMove =
      moveHistory.length > lastMoveCountRef.current
        ? moveHistory[moveHistory.length - 1]
        : null;
    lastMoveCountRef.current = moveHistory.length;

    if (appliedMove !== null) {
      const head = planRef.current[0];

      // The user followed the cached plan's next move exactly — consume it
      // instead of re-solving, so the remaining plan is guaranteed valid.
      if (head === appliedMove) {
        planRef.current = planRef.current.slice(1);
        setHintMove(planRef.current[0] ?? null);
        return;
      }

      // A double-turn plan step (e.g. "R2") only ever pulses the single-turn
      // CW button in the UI (see hintTargets/MoveButtons — lighting both
      // directions caused its own bug), so following it applies one plain
      // turn ("R"), not "R2". Treat that as half-done instead of a deviation:
      // downgrade the plan's head to the one remaining turn (still "R" — two
      // same-direction quarter turns make the double turn) without touching
      // the solver at all.
      if (head && head.slice(1) === '2' && head[0] === appliedMove && appliedMove.length === 1) {
        planRef.current = [appliedMove, ...planRef.current.slice(1)];
        setHintMove(appliedMove);
        return;
      }
    }

    // First time enabling hint, or the user deviated from the plan (a
    // different move, drag, scramble, reset, undo, ...): solve fresh.
    let cancelled = false;
    setThinking(true);
    solveCube(stickers).then((moves) => {
      if (cancelled) return;
      setThinking(false);
      planRef.current = moves;
      setHintMove(moves[0] ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [hintEnabled, isSolving, isAnimating, isSolved, stickers, moveHistory, setHintMove, setThinking]);
}
