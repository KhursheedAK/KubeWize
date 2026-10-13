'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { useCubeStore } from '@/store/cubeStore';
import { MoveNotation } from '@/lib/cubeLogic';
import { MOVE_PARAMS, rotateGridPos } from './cubeDrag';

interface MoveAnimatorProps {
  meshRefs: React.MutableRefObject<(THREE.Object3D | null)[]>;
  groupRef: React.MutableRefObject<THREE.Group | null>;
  cubiePositions: React.MutableRefObject<[number, number, number][]>;
}

export default function MoveAnimator({
  meshRefs,
  groupRef,
  cubiePositions,
}: MoveAnimatorProps) {
  const moveQueue = useCubeStore((s) => s.moveQueue);
  const commitMove = useCubeStore((s) => s.commitMove);
  const isProcessing = useRef(false);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  function animateMove(move: MoveNotation, onDone: () => void) {
    const group = groupRef.current;
    if (!group) {
      onDone();
      return;
    }

    const { axis, layer, angle } = MOVE_PARAMS[move];
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const affected: number[] = [];
    cubiePositions.current.forEach((position, id) => {
      if (position[axisIndex] === layer) affected.push(id);
    });

    const tempGroup = new THREE.Group();
    group.add(tempGroup);
    for (const id of affected) {
      const mesh = meshRefs.current[id];
      if (mesh) tempGroup.attach(mesh);
    }

    const scrambling = useCubeStore.getState().isScrambling;
    const target = { value: 0 };
    tweenRef.current = gsap.to(target, {
      value: angle,
      duration: scrambling ? 0.12 : 0.3,
      ease: scrambling ? 'power1.inOut' : 'power2.inOut',
      onUpdate() {
        tempGroup.rotation[axis] = target.value;
      },
      onComplete() {
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
        for (const id of affected) {
          cubiePositions.current[id] = rotateGridPos(
            cubiePositions.current[id],
            axis,
            angle,
          );
        }
        onDone();
      },
    });
  }

  useEffect(() => {
    if (moveQueue.length === 0 || isProcessing.current) return;
    isProcessing.current = true;
    const move = moveQueue[0];
    animateMove(move, () => {
      isProcessing.current = false;
      commitMove(move);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveQueue]);

  useEffect(() => () => {
    tweenRef.current?.kill();
  }, []);
  return null;
}
