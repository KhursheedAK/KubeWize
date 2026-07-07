'use client';

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { useCubeStore } from '@/store/cubeStore';

const COLORS = ['#22D3EE', '#8B5CF6', '#FDE047', '#4ADE80', '#F87171', '#FFFFFF'];

export default function SolveCelebration() {
  const isSolved = useCubeStore((s) => s.isSolved);
  const moveCount = useCubeStore((s) => s.moveHistory.length);
  const previousSolved = useRef(isSolved);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const genuinelySolved = isSolved && !previousSolved.current && moveCount > 0;
    previousSolved.current = isSolved;
    if (!genuinelySolved) return;

    timers.current.forEach(clearTimeout);
    timers.current = [];
    setVisible(true);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      const firework = (x: number, y: number, count: number) => {
        void confetti({
          particleCount: count,
          angle: x < 0.5 ? 58 : 122,
          spread: 72,
          startVelocity: 42,
          gravity: 0.85,
          scalar: 0.92,
          ticks: 220,
          origin: { x, y },
          colors: COLORS,
          zIndex: 100,
          disableForReducedMotion: true,
        });
      };

      firework(0.18, 0.78, 72);
      firework(0.82, 0.78, 72);
      timers.current.push(
        setTimeout(() => firework(0.5, 0.55, 100), 280),
        setTimeout(() => {
          firework(0.28, 0.7, 50);
          firework(0.72, 0.7, 50);
        }, 620),
      );
    }

    timers.current.push(setTimeout(() => setVisible(false), 4200));
  }, [isSolved, moveCount]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <AnimatePresence>
      {visible && (
        <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center px-4" role="status" aria-live="assertive">
          <motion.div
            initial={{ opacity: 0, scale: 0.72, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', stiffness: 230, damping: 18 }}
            className="pointer-events-auto relative overflow-hidden rounded-3xl border border-cyan-200/30 bg-[#10102a]/92 px-8 py-7 text-center shadow-[0_0_80px_rgba(34,211,238,0.24),0_0_120px_rgba(139,92,246,0.18)] backdrop-blur-xl"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_48%),radial-gradient(circle_at_bottom,rgba(139,92,246,0.2),transparent_55%)]" />
            <motion.div
              initial={{ rotate: -12, scale: 0 }}
              animate={{ rotate: [0, 8, -5, 0], scale: 1 }}
              transition={{ delay: 0.12, duration: 0.65 }}
              className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-yellow-200/30 bg-yellow-300/15 text-3xl shadow-[0_0_30px_rgba(253,224,71,0.25)]"
              aria-hidden="true"
            >
              ★
            </motion.div>
            <p className="relative text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/75">
              Cube solved
            </p>
            <h2 className="relative mt-1 font-display text-3xl font-bold text-white">
              Brilliant move!
            </h2>
            <p className="relative mt-2 text-sm text-white/60">
              You brought every color home.
            </p>
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="relative mt-5 rounded-full border border-white/15 bg-white/[0.07] px-5 py-2 text-xs font-semibold text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white"
            >
              Keep playing
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
