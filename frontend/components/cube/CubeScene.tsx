'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, ContactShadows, Sparkles } from '@react-three/drei';
import { motion } from 'framer-motion';
import RubiksCube from './RubiksCube';
import BackgroundFX from './BackgroundFX';

// The camera below (position [4.5,3.5,4.5], fov 38) was framed for landscape
// aspect ratios. A fixed vertical `fov` gives a *narrower* horizontal field of
// view as the viewport gets taller/narrower (portrait phones), which made the
// cube overflow past the left/right edges instead of shrinking to fit. This
// keeps the horizontal FOV constant below aspect 1:1 (portrait) by widening
// the vertical FOV to compensate, while leaving landscape/desktop — where the
// original framing already looks right — completely untouched.
const BASE_FOV_DEG = 38;

function ResponsiveCameraFov() {
  const { camera, size } = useThree();
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    if (aspect >= 1) {
      persp.fov = BASE_FOV_DEG;
    } else {
      const halfBaseFovRad = THREE.MathUtils.degToRad(BASE_FOV_DEG / 2);
      const halfFovRad = Math.atan(Math.tan(halfBaseFovRad) / aspect);
      persp.fov = THREE.MathUtils.radToDeg(halfFovRad) * 2;
    }
    persp.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function OrbitIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M6.34 17.66a8 8 0 1 1 11.31 0" />
      <polyline points="15 17 12 20 9 17" />
    </svg>
  );
}

export default function CubeScene() {
  const [autoRotate, setAutoRotate] = useState(false);
  const [interaction, setInteraction] = useState<'idle' | 'hover' | 'dragging' | 'ready' | 'success'>('idle');
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isGrabbing = interaction === 'dragging' || interaction === 'ready';

  useEffect(() => () => {
    if (successTimer.current) clearTimeout(successTimer.current);
  }, []);

  const handleInteraction = useCallback((next: typeof interaction) => {
    if (successTimer.current) clearTimeout(successTimer.current);
    setInteraction(next);
    if (next === 'dragging') setAutoRotate(false);
    if (next === 'success') {
      successTimer.current = setTimeout(() => setInteraction('idle'), 900);
    }
  }, []);

  return (
    <div className="relative w-full h-full" style={{ background: '#06061a' }}>
      {/* CSS sky effects — rendered BEFORE Canvas so they sit behind the 3-D scene */}
      <BackgroundFX />

      <Canvas
        camera={{ position: [4.5, 3.5, 4.5], fov: 38 }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 0.9; }}
        style={{ cursor: isGrabbing ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <ResponsiveCameraFov />
        {/* No <color> background — canvas clears to transparent so the CSS layer shows through */}

        {/* Tiles use the emissive trick so they are immune to all lighting.
            These lights ONLY affect the dark rounded plastic body, painting
            the cubie edges with vivid color. */}
        <ambientLight intensity={0.3} />
        <pointLight position={[-2.5,  2.0, -2.0]} intensity={10} color="#7C3AED" />
        <pointLight position={[ 2.5, -1.0,  2.5]} intensity={8}  color="#0EA5E9" />
        <pointLight position={[ 0.5,  3.5, -1.5]} intensity={6}  color="#F59E0B" />

        <Stars radius={100} depth={60} count={3000} factor={3.5} fade speed={0.35} />

        {/* Floating sparkle particles drifting around the cube */}
        <Sparkles
          count={45}
          scale={[5, 5, 5]}
          size={1.4}
          speed={0.25}
          opacity={0.65}
          color="#A78BFA"
        />

        <RubiksCube onInteractionChange={handleInteraction} />

        {/* Deep-purple glow shadow */}
        <ContactShadows
          position={[0, -1.65, 0]}
          opacity={0.7}
          scale={8}
          blur={3}
          far={4}
          color="#3B0764"
          frames={1}
        />

        <OrbitControls
          enabled={!isGrabbing}
          enablePan={false}
          enableZoom={true}
          enableDamping
          dampingFactor={0.065}
          rotateSpeed={0.45}
          minDistance={3}
          maxDistance={13}
          autoRotate={autoRotate}
          autoRotateSpeed={0.7}
          makeDefault
        />
      </Canvas>

      {/* Pushed below the logo/orbit-button row on phones so its text (which
          can run long, e.g. "Grab this square and slide") never has to share
          horizontal space with them; back on the same row from sm: up. */}
      <div className="pointer-events-none absolute left-1/2 top-14 sm:top-5 z-10 -translate-x-1/2 select-none px-2">
        <motion.div
          key={interaction}
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-full border border-white/15 bg-[#11112a]/80 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white/85 shadow-lg backdrop-blur-md"
        >
          <span className="text-base sm:text-lg" aria-hidden="true">
            {interaction === 'success'
              ? '✓'
              : interaction === 'ready' || interaction === 'dragging' || interaction === 'hover'
                ? '↔'
                : '☝'}
          </span>
          {interaction === 'success'
            ? 'Nice move!'
            : interaction === 'ready'
              ? 'Let go!'
              : interaction === 'dragging'
                ? 'Slide a little more…'
                : interaction === 'hover'
                  ? 'Grab this square and slide'
                  : 'Pick a square • slide it'}
        </motion.div>
      </div>

      {/* Orbit toggle button */}
      <div className="absolute right-3 top-3 sm:right-5 sm:top-5 z-10">
        <motion.button
          onClick={() => setAutoRotate((v) => !v)}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className={[
            'flex items-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-full text-[11px] sm:text-xs font-semibold',
            'tracking-widest uppercase border backdrop-blur-md select-none',
            'transition-colors duration-300 ease-out',
            autoRotate
              ? 'bg-indigo-500/20 border-indigo-400/45 text-indigo-200'
              : 'bg-white/5 border-white/15 text-white/50 hover:bg-white/10 hover:border-white/28 hover:text-white/80',
          ].join(' ')}
          style={
            autoRotate
              ? { boxShadow: '0 0 18px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.08)' }
              : {}
          }
        >
          <motion.span
            animate={{ rotate: autoRotate ? 360 : 0 }}
            transition={{ duration: 3, repeat: autoRotate ? Infinity : 0, ease: 'linear' }}
            style={{ display: 'flex' }}
          >
            <OrbitIcon size={15} />
          </motion.span>
          <span>{autoRotate ? 'Orbiting' : 'Auto-Orbit'}</span>
        </motion.button>
      </div>
    </div>
  );
}
