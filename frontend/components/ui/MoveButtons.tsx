'use client';

import { useEffect, useRef, useState } from 'react';
import { useCubeStore } from '@/store/cubeStore';
import { useSolverStore } from '@/store/solverStore';
import { solveCube } from '@/lib/solverClient';
import { MoveNotation } from '@/lib/cubeLogic';

interface MovePair {
  face: string;
  name: string;
  color: string;
  moves: [MoveNotation, MoveNotation];
  keys: [string, string];
}

const MOVE_PAIRS: MovePair[] = [
  { face: 'U', name: 'Up', color: '#F8FAFC', moves: ['U', "U'"], keys: ['U', 'I'] },
  { face: 'R', name: 'Right', color: '#FF7A2F', moves: ['R', "R'"], keys: ['R', 'E'] },
  { face: 'F', name: 'Front', color: '#34D678', moves: ['F', "F'"], keys: ['F', 'J'] },
  { face: 'D', name: 'Down', color: '#FFD84D', moves: ['D', "D'"], keys: ['D', 'C'] },
  { face: 'L', name: 'Left', color: '#F05252', moves: ['L', "L'"], keys: ['H', 'K'] },
  { face: 'B', name: 'Back', color: '#4B8DFF', moves: ['B', "B'"], keys: ['B', 'N'] },
];

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const SUFFIXES = ['', "'", '2'] as const;

function makeScramble(length = 20): MoveNotation[] {
  const moves: MoveNotation[] = [];
  let previous = '';
  while (moves.length < length) {
    const face = FACES[Math.floor(Math.random() * FACES.length)];
    if (face === previous) continue;
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    moves.push(`${face}${suffix}` as MoveNotation);
    previous = face;
  }
  return moves;
}

// Which single button (CW or CCW) the hint should pulse — never both at once.
// A '2' hint means "turn this face twice", so it points at one button (CW,
// by convention) rather than lighting up both directions: pulsing both looked
// like two different suggested moves, and pressing the "other" one to see
// what it did would cancel the first press (CW then CCW = no net turn),
// leaving the cube state — and therefore the hint — stuck in place.
function hintTargets(face: string, hintMove: MoveNotation | null): [boolean, boolean] {
  if (!hintMove || hintMove[0] !== face) return [false, false];
  const suffix = hintMove.slice(1);
  if (suffix === "'") return [false, true];
  return [true, false];
}

function isDoubleHint(face: string, hintMove: MoveNotation | null): boolean {
  return hintMove !== null && hintMove[0] === face && hintMove.slice(1) === '2';
}

function ShuffleIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5m-6-6 6 6M4 4l5 5" /></svg>;
}

function ResetIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>;
}

function SolveIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 1.6 3.9L18 8l-3.9 1.6L12 14l-1.6-4.4L6 8l4.4-1.1L12 3Z" /><path d="M5 16.5 5.9 19 8 19.5l-2.1.9L5 22l-.9-1.6L2 19.5l2.1-.5L5 16.5Z" /></svg>;
}

function HintIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3Z" /></svg>;
}

export default function MoveButtons() {
  const enqueueMove = useCubeStore((s) => s.enqueueMove);
  const isAnimating = useCubeStore((s) => s.isAnimating);
  const isSolved = useCubeStore((s) => s.isSolved);
  const stickers = useCubeStore((s) => s.stickers);
  const moveQueue = useCubeStore((s) => s.moveQueue);
  const resetToSolved = useCubeStore((s) => s.resetToSolved);
  const startScramble = useCubeStore((s) => s.startScramble);
  const [lastScramble, setLastScramble] = useState('');

  const isSolving = useSolverStore((s) => s.isSolving);
  const isThinking = useSolverStore((s) => s.isThinking);
  const hintEnabled = useSolverStore((s) => s.hintEnabled);
  const hintMove = useSolverStore((s) => s.hintMove);
  const setSolving = useSolverStore((s) => s.setSolving);
  const setThinking = useSolverStore((s) => s.setThinking);
  const toggleHint = useSolverStore((s) => s.toggleHint);

  // Auto-solve plays out as ordinary queued moves; this just knows when the
  // queue we started has fully drained so the "Solving…" state can clear.
  const solvingStartedRef = useRef(false);
  useEffect(() => {
    if (!isSolving) {
      solvingStartedRef.current = false;
      return;
    }
    if (moveQueue.length > 0) solvingStartedRef.current = true;
    if (solvingStartedRef.current && moveQueue.length === 0 && !isAnimating) {
      setSolving(false);
      solvingStartedRef.current = false;
    }
  }, [isSolving, moveQueue.length, isAnimating, setSolving]);

  const busy = isAnimating || isSolving || isThinking;

  const scramble = () => {
    if (busy) return;
    const moves = makeScramble();
    startScramble(moves);
    setLastScramble(moves.join(' '));
  };

  const solve = async () => {
    if (busy || isSolved) return;
    setThinking(true);
    setSolving(true);
    const moves = await solveCube(stickers);
    setThinking(false);
    if (moves.length === 0) {
      setSolving(false);
      return;
    }
    moves.forEach((move) => enqueueMove(move));
  };

  const actionClass = 'flex h-9 sm:h-11 shrink-0 items-center gap-1.5 rounded-xl border px-2 sm:px-3 text-[11px] sm:text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35';

  return (
    <section className="mx-auto w-full max-w-6xl px-1" aria-label="Cube controls">
      {/* Action row: Scramble / Reset / Solve / Hint. Wraps instead of scrolling. */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button type="button" onClick={scramble} disabled={busy} className={`${actionClass} border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15`}>
          <ShuffleIcon /><span className="hidden xs:inline">Scramble</span>
        </button>
        <button type="button" onClick={resetToSolved} disabled={busy} className={`${actionClass} border-white/10 bg-[#15152b]/90 text-white/55 hover:border-rose-300/30 hover:text-rose-100`}>
          <ResetIcon /><span className="hidden xs:inline">Reset</span>
        </button>
        <button
          type="button"
          onClick={solve}
          disabled={busy || isSolved}
          className={`${actionClass} border-purple-300/25 bg-purple-400/10 text-purple-100 hover:bg-purple-400/15`}
        >
          <SolveIcon /><span className="hidden xs:inline">{isSolving ? 'Solving…' : 'Solve'}</span>
        </button>
        <button
          type="button"
          onClick={toggleHint}
          disabled={isSolving}
          aria-pressed={hintEnabled}
          className={`${actionClass} ${
            hintEnabled
              ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100'
              : 'border-white/10 bg-[#15152b]/90 text-white/55 hover:border-cyan-300/25 hover:text-cyan-100'
          }`}
        >
          <HintIcon /><span className="hidden xs:inline">Hint{hintEnabled && isThinking ? '…' : ''}</span>
        </button>
      </div>

      {/* Face-turn row: wraps onto multiple lines on narrow screens instead of requiring horizontal scroll. */}
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
        {MOVE_PAIRS.map(({ face, name, color, moves, keys }) => {
          const [hintCW, hintCCW] = hintTargets(face, hintMove);
          const hints = [hintCW, hintCCW];
          const doubleHint = isDoubleHint(face, hintMove);
          return (
            <div key={face} className="flex h-11 sm:h-[54px] shrink-0 items-center gap-1 sm:gap-1.5 rounded-xl border border-white/[0.08] bg-[#121228]/92 p-1 sm:p-1.5 shadow-sm">
              <span className="flex w-5 sm:w-7 flex-col items-center" title={name}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                <span className="mt-1 font-mono text-[10px] sm:text-xs font-bold text-white/75">{face}</span>
              </span>
              {moves.map((move, index) => (
                <button
                  key={move}
                  type="button"
                  onClick={() => enqueueMove(move)}
                  disabled={busy}
                  className={`group relative flex h-9 w-9 sm:h-11 sm:w-11 flex-col items-center justify-center rounded-lg border leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    hints[index]
                      ? 'hint-pulse border-cyan-300/60 bg-cyan-400/15 text-cyan-100'
                      : 'border-white/[0.08] bg-white/[0.035] text-white/70 hover:border-white/20 hover:bg-white/[0.075]'
                  }`}
                  aria-label={`${name} face ${index === 0 ? 'clockwise' : 'counter-clockwise'}${hints[index] ? (doubleHint ? ' — suggested next move, turn twice' : ' — suggested next move') : ''}`}
                >
                  {hints[index] && doubleHint && (
                    <span
                      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[9px] font-bold text-[#0a0a1a]"
                      aria-hidden="true"
                    >
                      2
                    </span>
                  )}
                  <span className="text-base sm:text-lg transition-colors group-hover:text-white">{index === 0 ? '↻' : '↺'}</span>
                  <kbd className="hidden sm:block mt-1 text-[9px] font-medium text-white/35">{keys[index]}</kbd>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">{lastScramble ? `Cube scrambled with ${lastScramble}` : ''}</p>
    </section>
  );
}
