# Rubik's Cube – Architecture & Bug-Fix Guide

## 1. File Map

| File | Role |
|------|------|
| `CubeScene.tsx` | R3F `<Canvas>`, lights, OrbitControls, environment |
| `RubiksCube.tsx` | Renders 26 `<Cubie>` meshes; owns `cubiePositions` ref; computes face colors |
| `Cubie.tsx` | Single box mesh with 6 independent materials (one per face); handles highlight pulse |
| `MoveAnimator.tsx` | GSAP tween logic for buttons, keyboard, and queued tutorial moves |
| `cubeDrag.ts` | Direct-manipulation math, move parameters, live drag projection, and grid rotation |

---

## 2. Coordinate System

```
         +Y (Up)
          │
          │
          ●────── +X (Right)
         /
        /
      +Z (Front, toward viewer)
```

- **Grid positions** are integers `{-1, 0, +1}` on each axis.
- Cubie ID = index into `INITIAL_POSITIONS` (x-major, then y, then z, center skipped).
- Three.js `BoxGeometry` material slot order: `+X(0) -X(1) +Y(2) -Y(3) +Z(4) -Z(5)`.

---

## 3. cubejs Sticker Array (WCA order)

54-element array, 9 stickers per face:

| Offset | Face | Viewed from |
|--------|------|-------------|
| 0–8    | U    | Above |
| 9–17   | R    | Right |
| 18–26  | F    | Front |
| 27–35  | D    | Below |
| 36–44  | L    | Left |
| 45–53  | B    | Back |

Each face is row-major, left-to-right, top-to-bottom **as seen when looking directly at that face**.

---

## 4. Index Helper Functions (critical conventions)

Each helper maps a cubie's grid coordinates to a local 0–8 index within its face.

### U face (`uIdx`)
Viewed from above: front of cube (+Z) appears at **bottom** of the view → row 0 = z = −1.
```ts
function uIdx(x, z) { return (z + 1) * 3 + (x + 1); }
// row: z=-1→0, z=0→1, z=1→2 | col: x=-1→0, x=0→1, x=1→2
```

### D face (`dIdx`) ⚠️ OPPOSITE to U
Viewed from below: front of cube (+Z) appears at **top** of the view → row 0 = z = **+1**.  
**Bug fixed**: was `(z+1)*3+(x+1)` (same as uIdx), which inverted the rows.
```ts
function dIdx(x, z) { return (1 - z) * 3 + (x + 1); }
// row: z=+1→0, z=0→1, z=-1→2
```

### R face (`rIdx`)
Viewed from right: +Z (front) appears at **left** of view → col 0 = z = +1.
```ts
function rIdx(y, z) { return (1 - y) * 3 + (1 - z); }
```

### L face (`lIdx`)
Viewed from left: −Z (back) appears at **left** of view → col 0 = z = −1.
```ts
function lIdx(y, z) { return (1 - y) * 3 + (z + 1); }
```

### F face (`fIdx`)
Viewed from front: standard layout.
```ts
function fIdx(y, x) { return (1 - y) * 3 + (x + 1); }
```

### B face (`bIdx`)
Viewed from back: x is **reversed** (left of B view = x = +1).
```ts
function bIdx(y, x) { return (1 - y) * 3 + (1 - x); }
```

---

## 5. MOVE_PARAMS (verified directions)

Three.js right-hand rule: positive angle = CCW when looking down the **positive** axis.

| Move | Axis | Layer | Angle | WCA visual |
|------|------|-------|-------|------------|
| U    | Y    | +1    | −π/2  | top→back from above (CW) |
| D    | Y    | −1    | +π/2  | front→right from below (CW) |
| R    | X    | +1    | −π/2  | top→back from right (CW) |
| L    | X    | −1    | +π/2  | top→back from left (CW) |
| F    | Z    | +1    | −π/2  | top→right from front (CW) |
| B    | Z    | −1    | +π/2  | top→left from back (CW) |

**Key insight**: L and R both use `−π/2` for CW but on *opposite sides*, so L CW = `+π/2`
because looking at L from the left means you're looking in the `−X` direction (axis flipped).

---

## 6. `rotateGridPos` – Grid Position Update After Move

Updates a cubie's integer `[x, y, z]` grid position after a quarter-turn. No floating point; pure integer arithmetic.

```ts
function rotateGridPos([x, y, z], axis, angle) {
  const steps = Math.round(angle / HALF_PI); // ±1 or ±2

  function rot(a, b, s): [number, number] {
    // CW quarter-turn in (a→b) plane: (a,b)→(b,−a)
    switch (((s % 4) + 4) % 4) {
      case 1: return [b, -a];
      case 2: return [-a, -b];
      case 3: return [-b, a];
      default: return [a, b];
    }
  }

  if (axis === 'y') { const [nx, nz] = rot(x, z,  steps); return [nx, y, nz]; }
  if (axis === 'x') { const [ny, nz] = rot(y, z, -steps); return [x, ny, nz]; }
  /* z */           { const [nx, ny] = rot(x, y, -steps); return [nx, ny, z]; }
}
```

The `−steps` for X and Z axes compensates for the right-hand vs left-hand viewing direction difference.

---

## 7. Animation Flow

1. **`cubeStore.moveQueue`** gains an entry (e.g., `"F"`).
2. `MoveAnimator.useEffect` fires, picks first move.
3. Affected cubies (matching the layer coordinate) are reparented into `tempGroup`.
4. GSAP tweens `tempGroup.rotation[axis]` from 0 to `angle` over 0.3 s.
5. `onComplete`: cubies reparented back to main group; positions snapped to integers; `rotateGridPos` updates `cubiePositions.current`; `commitMove` removes the move from the queue.
6. React re-render triggered by `commitMove`; `getCubieColors` recomputes with new positions.

---

## 8. Reset Bug & Fix

**Problem**: After scrambling + Reset, some faces showed pitch black (inner color) on first click; second click fixed it.

**Root cause**: React render/effect timing:
1. `resetVersion` increments → React re-renders.
2. During render: `stickers` is already SOLVED_STATE but `cubiePositions.current` still holds scrambled positions.
3. `getCubieColors` maps solved stickers to *scrambled positions* → some cubies show `INNER` for faces that should be colored.
4. `useEffect([resetVersion])` fires *after* commit → too late to fix already-committed colors.

**Fix** – synchronously reset `cubiePositions.current` during the render body, before `cubieColors` is computed:
```ts
const lastSeenResetRef = useRef(resetVersion);
if (lastSeenResetRef.current !== resetVersion) {
  lastSeenResetRef.current = resetVersion;
  INITIAL_POSITIONS.forEach(([x, y, z], id) => {
    cubiePositions.current[id] = [x, y, z];
  });
}
// cubieColors is computed AFTER this block, so positions are correct
const cubieColors = INITIAL_POSITIONS.map((_, id) => { ... });
```

The `useEffect` is still needed for Three.js mesh snapping (`mesh.position.set(...)` and `mesh.quaternion.identity()`).

---

## 9. Bug Fix History

| Bug | Root cause | Fix |
|-----|-----------|-----|
| U CW wrong direction | angle was `+π/2` | Changed to `−π/2` |
| D CW wrong direction | angle was `−π/2` | Changed to `+π/2` |
| R CW wrong direction | angle was `+π/2` | Changed to `−π/2` |
| L CW wrong direction | angle was `−π/2` | Changed to `+π/2` |
| D face stickers swapped (appeared on wrong row) | `dIdx` used same formula as `uIdx` — D face has opposite z-row convention when viewed from below | Fixed `dIdx`: `(1−z)*3+(x+1)` |
| Reset shows black faces on first click | `cubiePositions.current` stale during render (useEffect updates it post-commit) | Added synchronous `lastSeenResetRef` guard in render body |

---

## 10. Adding New Moves

To add a new move `X`:
1. Add `X` to `MoveNotation` type in `cubeLogic.ts`.
2. Add entry in `MOVE_PARAMS` with correct axis, layer, and angle.
3. Verify with the 9-cubie grid table (trace each affected cubie's position before and after).
