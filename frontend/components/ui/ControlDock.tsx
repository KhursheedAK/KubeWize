'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MoveButtons from './MoveButtons';

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-4 w-5" aria-hidden="true">
      <motion.span
        className="absolute left-0 top-0.5 h-px w-5 rounded-full bg-current"
        animate={{ y: open ? 5.5 : 0, rotate: open ? 45 : 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />
      <motion.span
        className="absolute left-0 top-[7px] h-px w-5 rounded-full bg-current"
        animate={{ opacity: open ? 0 : 1, scaleX: open ? 0.4 : 1 }}
        transition={{ duration: 0.16 }}
      />
      <motion.span
        className="absolute bottom-0.5 left-0 h-px w-5 rounded-full bg-current"
        animate={{ y: open ? -5.5 : 0, rotate: open ? -45 : 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />
    </span>
  );
}

export default function ControlDock() {
  const [open, setOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="relative h-10 w-full overflow-visible bg-transparent">
      <motion.div
        id="cube-control-menu"
        initial={false}
        animate={{ y: open ? 0 : 12, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-0 bottom-10 overflow-x-clip bg-transparent will-change-transform"
        style={{ pointerEvents: open ? 'auto' : 'none', transform: 'translateZ(0)' }}
        aria-hidden={!open}
      >
        <div className="bg-transparent px-2 pb-1.5 sm:px-4 sm:pb-2">
          <MoveButtons />
        </div>
      </motion.div>

      <AnimatePresence>
        {helpOpen && (
          <motion.aside
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`absolute right-3 z-20 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-[#12122b]/95 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.38)] sm:right-5 ${open ? 'bottom-[108px]' : 'bottom-11'}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby="control-help-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/65">Quick guide</p>
                <h2 id="control-help-title" className="mt-0.5 font-display text-lg font-semibold text-white">How to play</h2>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close controls guide"
              >
                ×
              </button>
            </div>

            <ol className="mt-3 space-y-2.5">
              {[
                ['1', 'Grab a color', 'Hold a square, then slide it left, right, up, or down.'],
                ['2', 'Turn the whole cube', 'Drag the empty space around the cube.'],
                ['3', 'Move closer or farther', 'Use the mouse wheel, or pinch with two fingers.'],
                ['4', 'Try quick keys', 'Use the letter shown below each turn button.'],
              ].map(([number, title, detail]) => (
                <li key={number} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-200/15 bg-cyan-300/10 font-mono text-xs font-bold text-cyan-100">
                    {number}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-white/85">{title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-3 rounded-xl border border-purple-300/10 bg-purple-400/[0.07] px-3 py-2 text-[10px] text-purple-100/60">
              Tip: let go and the row gently snaps into place.
            </p>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 z-10 flex h-10 items-center justify-end gap-2 bg-transparent pr-3 sm:pr-5">
        <motion.button
          type="button"
          onClick={() => setHelpOpen((current) => !current)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#111128]/90 font-display text-sm font-bold text-white/55 shadow-md transition-colors hover:border-purple-200/30 hover:text-purple-100"
          aria-expanded={helpOpen}
          aria-label={helpOpen ? 'Hide controls guide' : 'Show controls guide'}
        >
          ?
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setOpen((current) => !current)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2.5 rounded-full border border-white/10 bg-[#111128]/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65 shadow-md transition-colors hover:border-cyan-200/25 hover:text-cyan-100"
          aria-expanded={open}
          aria-controls="cube-control-menu"
          aria-label={open ? 'Hide cube controls' : 'Show cube controls'}
        >
          <MenuIcon open={open} />
          Controls
        </motion.button>
      </div>
    </div>
  );
}
