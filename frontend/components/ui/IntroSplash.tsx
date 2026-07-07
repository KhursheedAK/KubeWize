'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import BackgroundFX from '@/components/cube/BackgroundFX';

const SESSION_KEY = 'kubewize-intro-seen';
const AUTO_DISMISS_MS = 2600;

// A one-time-per-session welcome screen. Shown once (sessionStorage, so it
// reappears on a fresh tab/browser session but not on every reload), skips
// itself entirely under prefers-reduced-motion, and can be dismissed early
// by tapping/clicking or pressing any key.
export default function IntroSplash() {
  const [visible, setVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const alreadySeen = sessionStorage.getItem(SESSION_KEY) === '1';
    if (reducedMotion || alreadySeen) return;

    // Mark as seen immediately (not on dismiss) so a Strict-Mode dev
    // double-effect or a quick remount can't show it twice in a row.
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(true);

    confetti({
      particleCount: 60,
      spread: 80,
      startVelocity: 32,
      gravity: 0.9,
      scalar: 0.85,
      ticks: 200,
      origin: { x: 0.5, y: 0.45 },
      colors: ['#22D3EE', '#8B5CF6', '#FDE047', '#4ADE80', '#F87171', '#FFFFFF'],
      zIndex: 210,
    });

    dismissTimer.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = () => setVisible(false);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-label="Welcome to KubeWize"
          initial={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 1.4, filter: 'blur(14px)' }}
          transition={{ duration: 0.75, ease: [0.5, 0, 0.9, 0.4] }}
          onClick={dismiss}
          className="fixed inset-0 z-[200] flex cursor-pointer select-none flex-col items-center justify-center overflow-hidden bg-[#06061a] px-6 text-center"
        >
          <BackgroundFX />

          <motion.div
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: -8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
            className="relative grid h-16 w-16 grid-cols-2 gap-1 rounded-2xl border border-white/15 bg-white/[0.06] p-2 shadow-[0_8px_28px_rgba(0,0,0,0.28),0_0_30px_rgba(34,211,238,0.18)]"
            aria-hidden="true"
          >
            <span className="rounded-[5px] bg-cyan-300" />
            <span className="rounded-[5px] bg-purple-400" />
            <span className="rounded-[5px] bg-yellow-300" />
            <span className="rounded-[5px] bg-emerald-400" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            className="relative mt-6 text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/70"
          >
            Envisioned by
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.5, type: 'spring', stiffness: 180, damping: 16 }}
            className="relative mt-2 font-display text-3xl font-bold text-white sm:text-4xl"
          >
            Khursheed Alam Khan
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.4 }}
            className="relative mt-3 text-sm text-white/60"
          >
            Welcome to Kube<span className="text-cyan-300">Wize</span> — let&apos;s twist some colors ✨
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.5 }}
            className="relative mt-10 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/35"
          >
            Tap anywhere to jump in
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
