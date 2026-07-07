'use client';

import { useRef, useEffect, useState } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { useCubeStore } from '@/store/cubeStore';
import { FaceColor } from '@/lib/cubeLogic';
import Cubie, { STICKER_COLORS, CubieColors, CubieFace } from './Cubie';
import MoveAnimator from './MoveAnimator';
import {
  createDragRotation,
  dragAngle,
  DragRotation,
  FACE_NORMALS,
  HALF_PI,
  moveForRotation,
  rotateGridPos,
} from './cubeDrag';

// ─── Index helpers (see architecture Section 5) ───────────────────────────────
// Each face is row-major, left-to-right top-to-bottom when looking directly at it.
// Grid coords: x right, y up, z toward viewer (+Z = front face).
//
//   U (y=1):  row 0 at z=-1(back), row 2 at z=+1(front);  col 0 at x=-1
//   D (y=-1): same row/col convention as U
//   R (x=+1): row 0 at y=+1(top),  row 2 at y=-1(bot);  col 0 at z=+1(front → left of R face)
//   L (x=-1): row 0 at y=+1(top),  row 2 at y=-1(bot);  col 0 at z=-1(back → left of L face)
//   F (z=+1): row 0 at y=+1(top),  row 2 at y=-1(bot);  col 0 at x=-1
//   B (z=-1): row 0 at y=+1(top),  row 2 at y=-1(bot);  col 0 at x=+1(reversed x)

function uIdx(x: number, z: number) {
  return (z + 1) * 3 + (x + 1);
}
function dIdx(x: number, z: number) {
  return (1 - z) * 3 + (x + 1);
}
function rIdx(y: number, z: number) {
  return (1 - y) * 3 + (1 - z);
}
function lIdx(y: number, z: number) {
  return (1 - y) * 3 + (z + 1);
}
function fIdx(y: number, x: number) {
  return (1 - y) * 3 + (x + 1);
}
function bIdx(y: number, x: number) {
  return (1 - y) * 3 + (1 - x);
}

function stickerColor(
  stickers: FaceColor[],
  faceBase: number,
  localIdx: number,
): string {
  return STICKER_COLORS[stickers[faceBase + localIdx]];
}

const INNER = STICKER_COLORS.inner;

function getCubieColors(
  stickers: FaceColor[],
  x: number,
  y: number,
  z: number,
): CubieColors {
  const colors = {
    px: x === 1 ? stickerColor(stickers, 9, rIdx(y, z)) : INNER,
    nx: x === -1 ? stickerColor(stickers, 36, lIdx(y, z)) : INNER,
    py: y === 1 ? stickerColor(stickers, 0, uIdx(x, z)) : INNER,
    ny: y === -1 ? stickerColor(stickers, 27, dIdx(x, z)) : INNER,
    pz: z === 1 ? stickerColor(stickers, 18, fIdx(y, x)) : INNER,
    nz: z === -1 ? stickerColor(stickers, 45, bIdx(y, x)) : INNER,
  };

  return colors;
}

// ─── Fixed cubie order: 26 positions, ID = index ─────────────────────────────
const INITIAL_POSITIONS: [number, number, number][] = [];
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      if (x === 0 && y === 0 && z === 0) continue;
      INITIAL_POSITIONS.push([x, y, z]);
    }
  }
}
const CUBIE_COUNT = INITIAL_POSITIONS.length; // 26

type InteractionState = 'idle' | 'hover' | 'dragging' | 'ready' | 'success';

interface RubiksCubeProps {
  onInteractionChange?: (state: InteractionState) => void;
}

const DIRECTION_LOCK_PX = 8;
const AMBIGUOUS_DRAG_PX = 22;
const MIN_DIRECTION_CONFIDENCE = 1.2;
const COMMIT_ANGLE = 0.18;

export default function RubiksCube({ onInteractionChange }: RubiksCubeProps) {
  const stickers = useCubeStore((s) => s.stickers);
  const resetVersion = useCubeStore((s) => s.resetVersion);
  const isAnimating = useCubeStore((s) => s.isAnimating);
  const beginDirectMove = useCubeStore((s) => s.beginDirectMove);
  const commitDirectMove = useCubeStore((s) => s.commitDirectMove);
  const cancelDirectMove = useCubeStore((s) => s.cancelDirectMove);
  const { camera, size, gl } = useThree();
  const dragRef = useRef<{
    pointerId: number;
    pointerType: string;
    face: CubieFace;
    cubiePosition: [number, number, number];
    startX: number;
    startY: number;
    startPoint: THREE.Vector3;
    dragPlane: THREE.Plane;
    rotation: DragRotation | null;
    tempGroup: THREE.Group | null;
    affected: number[];
    angle: number;
    angularVelocity: number;
    lastTime: number;
    ready: boolean;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Object3D refs indexed by cubie ID (cubies are THREE.Group since redesign)
  const meshRefs = useRef<(THREE.Object3D | null)[]>(
    new Array(CUBIE_COUNT).fill(null),
  );

  // Current world-grid position for each cubie (updated by MoveAnimator after each tween)
  const cubiePositions = useRef<[number, number, number][]>(
    INITIAL_POSITIONS.map(([x, y, z]) => [x, y, z] as [number, number, number]),
  );

  // Parent group ref (cubies reparented in/out of this during animation)
  const groupRef = useRef<THREE.Group>(null);

  // Outer group for the gentle idle float — isolated from the animation reparenting system
  const floatRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (floatRef.current) {
      floatRef.current.position.y = Math.sin(clock.elapsedTime * 0.75) * 0.07;
    }
  });

  // On reset/scramble restore logical positions and snap meshes back to grid
  useEffect(() => {
    INITIAL_POSITIONS.forEach(([x, y, z], id) => {
      cubiePositions.current[id] = [x, y, z];
      const mesh = meshRefs.current[id];
      if (mesh) {
        mesh.position.set(x, y, z);
        mesh.quaternion.identity();
      }
    });
  }, [resetVersion]);

  // When resetVersion changes, sync cubiePositions.current back to initial
  // synchronously during render so cubieColors reads the correct positions.
  // (useEffect runs too late — after React has already committed the colors.)
  const lastSeenResetRef = useRef(resetVersion);
  if (lastSeenResetRef.current !== resetVersion) {
    lastSeenResetRef.current = resetVersion;
    INITIAL_POSITIONS.forEach(([x, y, z], id) => {
      cubiePositions.current[id] = [x, y, z];
    });
  }

  const cubieColors = INITIAL_POSITIONS.map((_, id) => {
    const [cx, cy, cz] = cubiePositions.current[id];
    return getCubieColors(stickers, cx, cy, cz);
  });

  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const planePoint = new THREE.Vector3();

    const settleDrag = (drag: NonNullable<typeof dragRef.current>, cancelled: boolean) => {
      const group = groupRef.current;
      const tempGroup = drag.tempGroup;
      const rotation = drag.rotation;
      if (!group || !tempGroup || !rotation) {
        setSelectedIds(new Set());
        cancelDirectMove();
        onInteractionChange?.('hover');
        return;
      }

      const recentVelocity = performance.now() - drag.lastTime < 80
        ? drag.angularVelocity
        : 0;
      const momentumAngle = cancelled ? 0 : drag.angle + recentVelocity * 18;
      let steps = cancelled ? 0 : Math.round(momentumAngle / HALF_PI);
      steps = THREE.MathUtils.clamp(steps, -2, 2);
      if (!cancelled && steps === 0 && Math.abs(drag.angle) >= COMMIT_ANGLE) {
        steps = Math.sign(drag.angle);
      }
      const targetAngle = steps * HALF_PI;
      const proxy = { angle: drag.angle };

      gsap.to(proxy, {
        angle: targetAngle,
        duration: THREE.MathUtils.clamp(Math.abs(targetAngle - drag.angle) * 0.2, 0.2, 0.4),
        ease: 'power2.out',
        onUpdate: () => {
          tempGroup.rotation[rotation.axis] = proxy.angle;
        },
        onComplete: () => {
          setSelectedIds(new Set());
          for (const child of [...tempGroup.children]) {
            group.attach(child);
            child.position.set(
              Math.round(child.position.x),
              Math.round(child.position.y),
              Math.round(child.position.z),
            );
            child.quaternion.identity();
          }
          group.remove(tempGroup);

          if (steps === 0) {
            cancelDirectMove();
            onInteractionChange?.('hover');
            return;
          }
          for (const id of drag.affected) {
            cubiePositions.current[id] = rotateGridPos(
              cubiePositions.current[id],
              rotation.axis,
              targetAngle,
            );
          }
          commitDirectMove(moveForRotation(rotation.axis, rotation.layer, targetAngle));
          onInteractionChange?.('success');
        },
      });
    };

    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const bounds = gl.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(drag.dragPlane, planePoint)) return;
      const worldDelta = planePoint.clone().sub(drag.startPoint);

      if (!drag.rotation && Math.hypot(dx, dy) >= DIRECTION_LOCK_PX) {
        const group = groupRef.current;
        if (!group) return;
        const proposedRotation = createDragRotation(
          drag.face,
          drag.cubiePosition,
          worldDelta,
          drag.startPoint,
          camera,
          size.width,
          size.height,
        );
        if (
          proposedRotation.directionConfidence < MIN_DIRECTION_CONFIDENCE &&
          Math.hypot(dx, dy) < AMBIGUOUS_DRAG_PX
        ) {
          return;
        }
        drag.rotation = proposedRotation;
        const axisIndex = drag.rotation.axis === 'x' ? 0 : drag.rotation.axis === 'y' ? 1 : 2;
        drag.affected = cubiePositions.current.reduce<number[]>((ids, position, id) => {
          if (position[axisIndex] === drag.rotation?.layer) ids.push(id);
          return ids;
        }, []);
        setSelectedIds(new Set(drag.affected));
        if (drag.pointerType !== 'mouse') navigator.vibrate?.(8);
        drag.tempGroup = new THREE.Group();
        group.add(drag.tempGroup);
        for (const id of drag.affected) {
          const mesh = meshRefs.current[id];
          if (mesh) drag.tempGroup.attach(mesh);
        }
      }

      if (!drag.rotation || !drag.tempGroup) return;
      const now = performance.now();
      const nextAngle = dragAngle(drag.rotation, dx, dy);
      const elapsed = Math.max(now - drag.lastTime, 1);
      const instantVelocity = (nextAngle - drag.angle) / elapsed;
      drag.angularVelocity = drag.angularVelocity * 0.65 + instantVelocity * 0.35;
      drag.angle = nextAngle;
      drag.lastTime = now;
      drag.tempGroup.rotation[drag.rotation.axis] = nextAngle;

      const ready = Math.abs(nextAngle) >= COMMIT_ANGLE;
      if (ready !== drag.ready) {
        drag.ready = ready;
        onInteractionChange?.(ready ? 'ready' : 'dragging');
      }
    };

    const handleEnd = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      dragRef.current = null;
      if (gl.domElement.hasPointerCapture(event.pointerId)) {
        gl.domElement.releasePointerCapture(event.pointerId);
      }
      onInteractionChange?.('hover');
      settleDrag(drag, event.type === 'pointercancel');
    };

    const handleBlur = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      settleDrag(drag, true);
    };

    window.addEventListener('pointermove', handleMove, { passive: false, capture: true });
    window.addEventListener('pointerup', handleEnd, { passive: false, capture: true });
    window.addEventListener('pointercancel', handleEnd, { passive: false, capture: true });
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('pointermove', handleMove, true);
      window.removeEventListener('pointerup', handleEnd, true);
      window.removeEventListener('pointercancel', handleEnd, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [camera, cancelDirectMove, commitDirectMove, gl, onInteractionChange, size.height, size.width]);

  const handleStickerDown = (
    id: number,
    face: CubieFace,
    event: ThreeEvent<PointerEvent>,
  ) => {
    if (event.button !== 0 || isAnimating) return;
    event.stopPropagation();
    event.nativeEvent.preventDefault();
    gl.domElement.setPointerCapture(event.pointerId);
    beginDirectMove();
    setHoveredId(null);
    dragRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      face,
      cubiePosition: [...cubiePositions.current[id]],
      startX: event.clientX,
      startY: event.clientY,
      startPoint: event.point.clone(),
      dragPlane: new THREE.Plane().setFromNormalAndCoplanarPoint(
        FACE_NORMALS[face],
        event.point,
      ),
      rotation: null,
      tempGroup: null,
      affected: [],
      angle: 0,
      angularVelocity: 0,
      lastTime: performance.now(),
      ready: false,
    };
    setSelectedIds(new Set([id]));
    onInteractionChange?.('dragging');
  };


  return (
    <group ref={floatRef}>
    <group ref={groupRef}>
      {INITIAL_POSITIONS.map((_, id) => {
        const [px, py, pz] = cubiePositions.current[id];
        return (
          <Cubie
            key={id}
            ref={(el: THREE.Group | null) => {
              meshRefs.current[id] = el;
            }}
            position={[px, py, pz]}
            colors={cubieColors[id]}
            selected={selectedIds.has(id)}
            hovered={hoveredId === id}
            onStickerPointerDown={(face, event) =>
              handleStickerDown(id, face, event)
            }
            onStickerPointerOver={(event) => {
              event.stopPropagation();
              if (!dragRef.current && !isAnimating) {
                setHoveredId(id);
                onInteractionChange?.('hover');
              }
              gl.domElement.style.cursor = dragRef.current ? 'grabbing' : 'grab';
            }}
            onStickerPointerOut={(event) => {
              event.stopPropagation();
              if (!dragRef.current) {
                setHoveredId(null);
                onInteractionChange?.('idle');
                gl.domElement.style.cursor = 'grab';
              }
            }}
          />
        );
      })}
      <MoveAnimator
        meshRefs={meshRefs}
        groupRef={groupRef}
        cubiePositions={cubiePositions}
      />
    </group>
    </group>
  );
}
