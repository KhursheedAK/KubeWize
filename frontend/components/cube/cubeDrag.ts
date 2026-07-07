import * as THREE from 'three';
import { MoveNotation } from '@/lib/cubeLogic';
import type { CubieFace } from './Cubie';

export type Axis = 'x' | 'y' | 'z';
export type GridPosition = [number, number, number];

export interface MoveParams {
  axis: Axis;
  layer: -1 | 0 | 1;
  angle: number;
}

export interface DragRotation {
  axis: Axis;
  layer: -1 | 0 | 1;
  axisSign: number;
  screenX: number;
  screenY: number;
  pixelsPerQuarterTurn: number;
  directionConfidence: number;
}

export const HALF_PI = Math.PI / 2;

export const MOVE_PARAMS: Record<MoveNotation, MoveParams> = {
  U: { axis: 'y', layer: 1, angle: -HALF_PI },
  "U'": { axis: 'y', layer: 1, angle: HALF_PI },
  U2: { axis: 'y', layer: 1, angle: Math.PI },
  R: { axis: 'x', layer: 1, angle: -HALF_PI },
  "R'": { axis: 'x', layer: 1, angle: HALF_PI },
  R2: { axis: 'x', layer: 1, angle: Math.PI },
  F: { axis: 'z', layer: 1, angle: -HALF_PI },
  "F'": { axis: 'z', layer: 1, angle: HALF_PI },
  F2: { axis: 'z', layer: 1, angle: -Math.PI },
  D: { axis: 'y', layer: -1, angle: HALF_PI },
  "D'": { axis: 'y', layer: -1, angle: -HALF_PI },
  D2: { axis: 'y', layer: -1, angle: -Math.PI },
  L: { axis: 'x', layer: -1, angle: HALF_PI },
  "L'": { axis: 'x', layer: -1, angle: -HALF_PI },
  L2: { axis: 'x', layer: -1, angle: -Math.PI },
  B: { axis: 'z', layer: -1, angle: HALF_PI },
  "B'": { axis: 'z', layer: -1, angle: -HALF_PI },
  B2: { axis: 'z', layer: -1, angle: Math.PI },
  M: { axis: 'x', layer: 0, angle: HALF_PI },
  "M'": { axis: 'x', layer: 0, angle: -HALF_PI },
  M2: { axis: 'x', layer: 0, angle: Math.PI },
  E: { axis: 'y', layer: 0, angle: HALF_PI },
  "E'": { axis: 'y', layer: 0, angle: -HALF_PI },
  E2: { axis: 'y', layer: 0, angle: Math.PI },
  S: { axis: 'z', layer: 0, angle: -HALF_PI },
  "S'": { axis: 'z', layer: 0, angle: HALF_PI },
  S2: { axis: 'z', layer: 0, angle: Math.PI },
};

export const FACE_NORMALS: Record<CubieFace, THREE.Vector3> = {
  px: new THREE.Vector3(1, 0, 0), nx: new THREE.Vector3(-1, 0, 0),
  py: new THREE.Vector3(0, 1, 0), ny: new THREE.Vector3(0, -1, 0),
  pz: new THREE.Vector3(0, 0, 1), nz: new THREE.Vector3(0, 0, -1),
};

const AXIS_INDEX: Record<Axis, number> = { x: 0, y: 1, z: 2 };

function dominantAxis(vector: THREE.Vector3): { axis: Axis; sign: number } {
  const entries: [Axis, number][] = [['x', vector.x], ['y', vector.y], ['z', vector.z]];
  const [axis, value] = entries.reduce((best, entry) =>
    Math.abs(entry[1]) > Math.abs(best[1]) ? entry : best,
  );
  return { axis, sign: value < 0 ? -1 : 1 };
}

function projectDirection(
  direction: THREE.Vector3,
  originPoint: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
) {
  const origin = originPoint.clone().project(camera);
  const projected = originPoint.clone().add(direction).project(camera);
  const x = (projected.x - origin.x) * width * 0.5;
  const y = -(projected.y - origin.y) * height * 0.5;
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length, length };
}

/** Lock a free screen drag to the most natural cube slice. */
export function createDragRotation(
  face: CubieFace,
  position: GridPosition,
  worldDelta: THREE.Vector3,
  originPoint: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
): DragRotation {
  const normal = FACE_NORMALS[face];
  const candidates = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ].filter((candidate) => Math.abs(candidate.dot(normal)) < 0.5);

  let tangent = candidates[0];
  let screen = projectDirection(tangent, originPoint, camera, width, height);
  let bestDot = Math.abs(worldDelta.dot(tangent));
  let secondDot = 0;
  for (const candidate of candidates.slice(1)) {
    const candidateScreen = projectDirection(candidate, originPoint, camera, width, height);
    const dot = Math.abs(worldDelta.dot(candidate));
    if (dot > bestDot) {
      secondDot = bestDot;
      tangent = candidate;
      screen = candidateScreen;
      bestDot = dot;
    } else {
      secondDot = Math.max(secondDot, dot);
    }
  }

  const rotationAxis = normal.clone().cross(tangent);
  const { axis, sign } = dominantAxis(rotationAxis);
  return {
    axis,
    layer: position[AXIS_INDEX[axis]] as -1 | 0 | 1,
    axisSign: sign,
    screenX: screen.x,
    screenY: screen.y,
    // Adaptive to zoom, with forgiving bounds on both phones and desktops.
    // Deliberately slower than a 1:1 swipe to reduce visual intensity.
    pixelsPerQuarterTurn: THREE.MathUtils.clamp(screen.length * 2.25, 150, 270),
    directionConfidence: bestDot / Math.max(secondDot, 0.0001),
  };
}

export function dragAngle(rotation: DragRotation, dragX: number, dragY: number) {
  const projectedPixels = dragX * rotation.screenX + dragY * rotation.screenY;
  return THREE.MathUtils.clamp(
    (projectedPixels / rotation.pixelsPerQuarterTurn) * HALF_PI * rotation.axisSign,
    -Math.PI,
    Math.PI,
  );
}

export function moveForRotation(axis: Axis, layer: -1 | 0 | 1, angle: number): MoveNotation {
  const positive = angle > 0;
  const double = Math.abs(angle) > HALF_PI * 1.5;
  if (axis === 'x' && layer === 1) return double ? 'R2' : positive ? "R'" : 'R';
  if (axis === 'x' && layer === -1) return double ? 'L2' : positive ? 'L' : "L'";
  if (axis === 'y' && layer === 1) return double ? 'U2' : positive ? "U'" : 'U';
  if (axis === 'y' && layer === -1) return double ? 'D2' : positive ? 'D' : "D'";
  if (axis === 'z' && layer === 1) return double ? 'F2' : positive ? "F'" : 'F';
  if (axis === 'z' && layer === -1) return double ? 'B2' : positive ? 'B' : "B'";
  if (axis === 'x') return double ? 'M2' : positive ? 'M' : "M'";
  if (axis === 'y') return double ? 'E2' : positive ? 'E' : "E'";
  return double ? 'S2' : positive ? "S'" : 'S';
}

export function rotateGridPos(
  [x, y, z]: GridPosition,
  axis: Axis,
  angle: number,
): GridPosition {
  const steps = Math.round(angle / HALF_PI);
  const rot = (a: number, b: number): [number, number] => {
    switch (((steps % 4) + 4) % 4) {
      case 1: return [b, -a];
      case 2: return [-a, -b];
      case 3: return [-b, a];
      default: return [a, b];
    }
  };
  if (axis === 'y') { const [nx, nz] = rot(x, z); return [nx, y, nz]; }
  if (axis === 'x') { const [nz, ny] = rot(z, y); return [x, ny, nz]; }
  const [ny, nx] = rot(y, x); return [nx, ny, z];
}
