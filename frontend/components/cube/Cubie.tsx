'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { FaceColor } from '@/lib/cubeLogic';

// WCA-standard sticker colors
export const STICKER_COLORS: Record<FaceColor | 'inner', string> = {
  U: '#FFFFFF',
  R: '#FF5800',
  F: '#009B48',
  D: '#FFD500',
  L: '#C41E3A',
  B: '#0046AD',
  inner: '#111111',
};

export interface CubieColors {
  // BoxGeometry material indices: +X(0), -X(1), +Y(2), -Y(3), +Z(4), -Z(5)
  px: string; // +X = Right face
  nx: string; // -X = Left face
  py: string; // +Y = Up face
  ny: string; // -Y = Down face
  pz: string; // +Z = Front face
  nz: string; // -Z = Back face
}

interface CubieProps {
  position: [number, number, number];
  colors: CubieColors;
  selected?: boolean;
  hovered?: boolean;
  onStickerPointerDown?: (face: CubieFace, event: ThreeEvent<PointerEvent>) => void;
  onStickerPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onStickerPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
}

export type CubieFace = keyof CubieColors;

const INNER = STICKER_COLORS.inner;

// Body: RoundedBox 0.90, face surface at ±0.45.
// Tile: 0.08 deep, center at 0.45 + 0.04 = 0.49. Tile face at 0.53.
// Visible tile area: 0.72 × 0.72 (fits within the 0.78 flat zone of the rounded body).
const TILES: { face: keyof CubieColors; pos: [number, number, number]; args: [number, number, number] }[] = [
  { face: 'px', pos: [ 0.49,  0,     0   ], args: [0.08, 0.72, 0.72] },
  { face: 'nx', pos: [-0.49,  0,     0   ], args: [0.08, 0.72, 0.72] },
  { face: 'py', pos: [ 0,     0.49,  0   ], args: [0.72, 0.08, 0.72] },
  { face: 'ny', pos: [ 0,    -0.49,  0   ], args: [0.72, 0.08, 0.72] },
  { face: 'pz', pos: [ 0,     0,     0.49], args: [0.72, 0.72, 0.08] },
  { face: 'nz', pos: [ 0,     0,    -0.49], args: [0.72, 0.72, 0.08] },
];

// Generous invisible targets cover the entire cubie face, including dark gaps.
const HIT_AREAS: { face: CubieFace; pos: [number, number, number]; rotation: [number, number, number] }[] = [
  { face: 'px', pos: [ 0.55, 0, 0], rotation: [0, Math.PI / 2, 0] },
  { face: 'nx', pos: [-0.55, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  { face: 'py', pos: [0,  0.55, 0], rotation: [-Math.PI / 2, 0, 0] },
  { face: 'ny', pos: [0, -0.55, 0], rotation: [Math.PI / 2, 0, 0] },
  { face: 'pz', pos: [0, 0,  0.55], rotation: [0, 0, 0] },
  { face: 'nz', pos: [0, 0, -0.55], rotation: [0, Math.PI, 0] },
];

const HIT_GEOMETRY = new THREE.PlaneGeometry(0.96, 0.96);
const HIT_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
});

const Cubie = forwardRef<THREE.Group, CubieProps>(function Cubie(
  {
    position,
    colors,
    selected,
    hovered,
    onStickerPointerDown,
    onStickerPointerOver,
    onStickerPointerOut,
  },
  forwardedRef,
) {
  const localRef = useRef<THREE.Group | null>(null);

  // Merge forwarded ref with our local ref so useFrame can access the group.
  // Object.assign sidesteps TypeScript's readonly typing on ForwardedRef.current.
  const mergedRef = (el: THREE.Group | null) => {
    localRef.current = el;
    if (!forwardedRef) return;
    if (typeof forwardedRef === 'function') forwardedRef(el);
    else Object.assign(forwardedRef, { current: el });
  };

  useFrame(({ clock }) => {
    const group = localRef.current;
    if (!group || !selected) return;
    // Pulse the emissive intensity on tile materials (non-zero emissive = tile, not body).
    const intensity = 1.42 + 0.08 * Math.sin(clock.elapsedTime * 5);
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (mat instanceof THREE.MeshStandardMaterial && mat.emissive.getHex() !== 0) {
          mat.emissiveIntensity = intensity;
        }
      }
    });
  });

  // Reset once when selection ends instead of traversing every cubie every frame.
  useEffect(() => {
    if (selected || !localRef.current) return;
    const intensity = hovered ? 1.28 : 1;
    localRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material;
        if (material instanceof THREE.MeshStandardMaterial && material.emissive.getHex() !== 0) {
          material.emissiveIntensity = intensity;
        }
      }
    });
  }, [hovered, selected]);

  return (
    <group ref={mergedRef} position={position}>
      {/* Dark rounded-edge plastic body */}
      <RoundedBox args={[0.90, 0.90, 0.90]} radius={0.06} smoothness={4}>
        <meshPhysicalMaterial
          color="#0d0d0d"
          roughness={0.4}
          metalness={0.45}
          clearcoat={0.8}
          clearcoatRoughness={0.15}
        />
      </RoundedBox>

      {/* Raised colored tiles — only rendered on visible (non-inner) faces */}
      {TILES.map((tile) => {
        const color = colors[tile.face];
        if (color === INNER) return null;
        return (
          <RoundedBox
            key={tile.face}
            args={tile.args}
            radius={0.03}
            smoothness={4}
            position={tile.pos}
          >
            {/* Emissive trick: diffuse is black so lights add nothing; only emissive shows,
                which is the pure WCA color unaffected by scene lighting. */}
            <meshStandardMaterial
              color="#000000"
              emissive={color}
              emissiveIntensity={1.2}
              roughness={1}
              metalness={0}
            />
          </RoundedBox>
        );
      })}

      {HIT_AREAS.map((area) => {
        if (colors[area.face] === INNER) return null;
        return (
          <mesh
            key={`hit-${area.face}`}
            geometry={HIT_GEOMETRY}
            material={HIT_MATERIAL}
            dispose={null}
            position={area.pos}
            rotation={area.rotation}
            onPointerDown={(event) => onStickerPointerDown?.(area.face, event)}
            onPointerOver={onStickerPointerOver}
            onPointerOut={onStickerPointerOut}
          >
          </mesh>
        );
      })}
    </group>
  );
});

export default Cubie;
