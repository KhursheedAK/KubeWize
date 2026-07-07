'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type FXKind = 'star' | 'comet' | 'ufo' | 'sparkle';

interface FXItem {
  id: number;
  kind: FXKind;
  top: number;       // % of container height
  left: number;      // % of container width
  angle: number;     // degrees (rotation for stars/comets)
  length: number;    // px trail length
  thickness: number; // px trail height
  duration: number;  // ms animation duration
  color: string;     // trail/body color
  glowColor: string; // glow shadow color
  scale: number;     // size multiplier (UFO / sparkle)
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

const rnd = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const STAR_COLORS = [
  'rgba(200,220,255,0.9)',
  'rgba(255,245,220,0.9)',
  'rgba(215,200,255,0.9)',
];
const SPARKLE_COLORS = ['#c4b5fd', '#93c5fd', '#fde68a', '#a7f3d0', '#fbcfe8'];

// ─── Hooks ────────────────────────────────────────────────────────────────────

// Returns true when the user prefers reduced motion.
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// Fires fn() after a random delay in [minMs, maxMs], then reschedules itself.
// Uses fnRef so fn is always the latest closure — no stale-closure bugs.
function useSchedule(fn: () => void, minMs: number, maxMs: number, enabled: boolean) {
  const fnRef = useRef(fn);
  fnRef.current = fn; // keep latest without re-running the effect
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const run = () => {
      fnRef.current();
      timer = setTimeout(run, rnd(minMs, maxMs));
    };
    timer = setTimeout(run, rnd(minMs, maxMs));
    return () => clearTimeout(timer);
  }, [enabled, minMs, maxMs]);
}

// ─── SVG UFO silhouette ───────────────────────────────────────────────────────

function UfoShape() {
  return (
    <svg viewBox="0 0 70 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Underside glow haze */}
      <ellipse cx="35" cy="29" rx="24" ry="6" fill="rgba(80,200,100,0.10)" />
      {/* Main saucer body */}
      <ellipse cx="35" cy="23" rx="28" ry="9"
        fill="rgba(110,150,210,0.72)"
        stroke="rgba(150,190,255,0.35)" strokeWidth="0.5" />
      {/* Dome */}
      <ellipse cx="35" cy="17" rx="13" ry="7.5"
        fill="rgba(155,195,245,0.52)"
        stroke="rgba(180,220,255,0.35)" strokeWidth="0.5" />
      {/* Dome reflection */}
      <ellipse cx="30" cy="14" rx="5" ry="2.8" fill="rgba(220,240,255,0.22)" />
      {/* Underbody running lights */}
      <circle cx="19" cy="27" r="2.2" fill="rgba(255,255,80,0.9)"  />
      <circle cx="27" cy="30" r="2.0" fill="rgba(80,255,120,0.9)"  />
      <circle cx="35" cy="31" r="2.2" fill="rgba(255,80,80,0.9)"   />
      <circle cx="43" cy="30" r="2.0" fill="rgba(80,255,120,0.9)"  />
      <circle cx="51" cy="27" r="2.2" fill="rgba(255,255,80,0.9)"  />
      {/* Antenna */}
      <line x1="35" y1="10" x2="35" y2="5"
        stroke="rgba(150,190,255,0.7)" strokeWidth="1" strokeLinecap="round" />
      <circle cx="35" cy="3.5" r="1.8" fill="rgba(255,210,50,0.92)" />
    </svg>
  );
}

// ─── Per-effect renderers ─────────────────────────────────────────────────────

// Shooting star: outer div sets position + angle; inner div runs bfx-star translateX.
function StarFX({ item }: { item: FXItem }) {
  return (
    <div style={{
      position: 'absolute',
      top: `${item.top}%`, left: `${item.left}%`,
      transform: `rotate(${item.angle}deg)`,
      pointerEvents: 'none',
    }}>
      <div style={{
        width: item.length, height: item.thickness,
        borderRadius: '50%',
        background: `linear-gradient(to right, transparent 0%, ${item.color} 30%, rgba(255,255,255,0.95) 60%, transparent 100%)`,
        filter: 'blur(0.5px)',
        animation: `bfx-star ${item.duration}ms ease-out forwards`,
      }} />
    </div>
  );
}

// Glowing comet: flex row (gradient tail + bright head) translates together.
function CometFX({ item }: { item: FXItem }) {
  const headPx = item.thickness * 2.8;
  return (
    <div style={{
      position: 'absolute',
      top: `${item.top}%`, left: `${item.left}%`,
      transform: `rotate(${item.angle}deg)`,
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        animation: `bfx-comet ${item.duration}ms ease-out forwards`,
      }}>
        {/* Gradient tail */}
        <div style={{
          width: item.length, height: item.thickness, borderRadius: '50%',
          background: `linear-gradient(to right, transparent 0%, ${item.color} 55%, rgba(210,235,255,0.75) 90%, transparent 100%)`,
        }} />
        {/* Glowing head at the leading edge */}
        <div style={{
          flexShrink: 0, marginLeft: -2,
          width: headPx, height: headPx, borderRadius: '50%',
          background: 'rgba(215,235,255,0.97)',
          boxShadow: `0 0 ${headPx}px ${headPx / 2}px ${item.glowColor}, 0 0 ${headPx * 2}px ${headPx}px rgba(140,190,255,0.3)`,
        }} />
      </div>
    </div>
  );
}

// UFO: outer div runs bfx-ufo (horizontal sweep); inner div runs bfx-ufo-bob (vertical wobble).
function UfoFX({ item }: { item: FXItem }) {
  const widthPx = Math.round(65 * item.scale);
  const bobMs   = Math.round(item.duration * 0.33);
  return (
    <div style={{
      position: 'absolute',
      top: `${item.top}%`, left: 0,
      width: widthPx,
      pointerEvents: 'none',
      opacity: 0.72,
      filter: 'drop-shadow(0 0 5px rgba(100,200,255,0.55))',
      animation: `bfx-ufo ${item.duration}ms linear forwards`,
    }}>
      <div style={{ animation: `bfx-ufo-bob ${bobMs}ms ease-in-out infinite` }}>
        <UfoShape />
      </div>
    </div>
  );
}

// Twinkling sparkle: ✦ glyph that scales + rotates in/out.
function SparkleFX({ item }: { item: FXItem }) {
  const sizePx = Math.round(item.scale * 14);
  return (
    <div style={{
      position: 'absolute',
      top: `${item.top}%`, left: `${item.left}%`,
      width: sizePx, height: sizePx,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      color: item.color,
      fontSize: Math.round(sizePx * 0.82),
      textShadow: `0 0 ${sizePx}px ${item.glowColor}, 0 0 ${sizePx * 2}px ${item.glowColor}`,
      animation: `bfx-sparkle ${item.duration}ms ease-in-out forwards`,
    }}>
      ✦
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BackgroundFX() {
  const reducedMotion = useReducedMotion();
  const [items, setItems] = useState<FXItem[]>([]);
  const idRef = useRef(0);

  const nextId = () => ++idRef.current;

  // Removes an item after its animation completes. Returns same array ref if id
  // wasn't present (avoids spurious re-renders when cap blocked the spawn).
  const removeAfter = (id: number, ms: number) =>
    setTimeout(() => setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      return next.length === prev.length ? prev : next;
    }), ms + 350);

  // ── Spawn functions ────────────────────────────────────────────────────────

  const spawnStar = () => {
    // Items are built outside setItems to avoid double-construction in React strict mode.
    const item: FXItem = {
      id: nextId(), kind: 'star',
      top: rnd(3, 62), left: rnd(5, 78),
      angle: rnd(15, 45),          // mostly horizontal, trending down-right
      length: rnd(80, 200), thickness: rnd(1, 2.5),
      duration: rnd(1800, 3500),
      color: pick(STAR_COLORS),
      glowColor: 'rgba(155,205,255,0.7)',
      scale: 1,
    };
    setItems((prev) => {
      if (prev.filter((i) => i.kind === 'star').length >= 4) return prev;
      return [...prev, item];
    });
    removeAfter(item.id, item.duration);
  };

  const spawnComet = () => {
    const item: FXItem = {
      id: nextId(), kind: 'comet',
      top: rnd(5, 50), left: rnd(5, 60),
      angle: rnd(20, 50),
      length: rnd(160, 300), thickness: rnd(2, 4),
      duration: rnd(3500, 6000),
      color: 'rgba(155,195,255,0.82)',
      glowColor: 'rgba(120,175,255,0.8)',
      scale: 1,
    };
    setItems((prev) => {
      if (prev.filter((i) => i.kind === 'comet').length >= 2) return prev;
      return [...prev, item];
    });
    removeAfter(item.id, item.duration);
  };

  const spawnUfo = () => {
    const item: FXItem = {
      id: nextId(), kind: 'ufo',
      top: rnd(8, 35), left: 0,
      angle: 0, length: 0, thickness: 0,
      duration: rnd(9000, 15000),
      color: '', glowColor: '',
      scale: rnd(0.6, 1.05),
    };
    setItems((prev) => {
      if (prev.some((i) => i.kind === 'ufo')) return prev; // one at a time
      return [...prev, item];
    });
    removeAfter(item.id, item.duration);
  };

  const spawnSparkle = () => {
    const item: FXItem = {
      id: nextId(), kind: 'sparkle',
      top: rnd(5, 90), left: rnd(3, 95),
      angle: 0, length: 0, thickness: 0,
      duration: rnd(3000, 5500),
      color: pick(SPARKLE_COLORS),
      glowColor: 'rgba(175,145,255,0.6)',
      scale: rnd(0.7, 1.4),
    };
    setItems((prev) => {
      if (prev.filter((i) => i.kind === 'sparkle').length >= 6) return prev;
      return [...prev, item];
    });
    removeAfter(item.id, item.duration);
  };

  // Keep a ref bag pointing to the latest spawn functions so the seed effect
  // (empty deps) and schedulers (fnRef pattern) always call current versions.
  const spawnRef = useRef({ spawnStar, spawnComet, spawnUfo, spawnSparkle });
  spawnRef.current = { spawnStar, spawnComet, spawnUfo, spawnSparkle };

  // ── Initial seed: show something immediately without waiting for first interval ──
  useEffect(() => {
    // Read matchMedia directly — state may not have updated yet on first render
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t1 = setTimeout(() => spawnRef.current.spawnSparkle(), 1500);
    const t2 = setTimeout(() => spawnRef.current.spawnStar(),    3000);
    const t3 = setTimeout(() => spawnRef.current.spawnSparkle(), 5500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // intentionally empty — seed fires once on mount

  // ── Periodic schedulers ────────────────────────────────────────────────────
  const enabled = !reducedMotion;
  useSchedule(() => spawnRef.current.spawnStar(),     6000, 14000, enabled);
  useSchedule(() => spawnRef.current.spawnComet(),   22000, 45000, enabled);
  useSchedule(() => spawnRef.current.spawnUfo(),     30000, 60000, enabled);
  useSchedule(() => spawnRef.current.spawnSparkle(),  8000, 18000, enabled);

  // Render nothing when no items or when reduced-motion is active
  if (reducedMotion || items.length === 0) return null;

  return (
    // aria-hidden: purely decorative, screen readers skip it
    <div
      className="bfx-root"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {items.map((item) => {
        switch (item.kind) {
          case 'star':    return <StarFX    key={item.id} item={item} />;
          case 'comet':   return <CometFX   key={item.id} item={item} />;
          case 'ufo':     return <UfoFX     key={item.id} item={item} />;
          case 'sparkle': return <SparkleFX key={item.id} item={item} />;
        }
      })}
    </div>
  );
}
