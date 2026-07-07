# KubeWize — Architecture Document

> An interactive 3D Rubik's Cube you manipulate by dragging stickers directly with the mouse/touch — like a real cube.
> **This document describes the code as it is actually implemented today**, not a plan. Anything aspirational has been removed.

---

## Table of Contents

1. [What This App Actually Is](#1-what-this-app-actually-is)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Component Tree & Render Path](#4-component-tree--render-path)
5. [State Management (Zustand)](#5-state-management-zustand)
6. [Cube Logic Engine (`cubejs`)](#6-cube-logic-engine-cubejs)
7. [3D Cube Representation](#7-3d-cube-representation)
8. [The Two Move Pipelines](#8-the-two-move-pipelines)
9. [Direct-Manipulation Drag Math](#9-direct-manipulation-drag-math)
10. [Visual Feedback & Decoration](#10-visual-feedback--decoration)
11. [Removed Dead Code](#11-removed-dead-code)
12. [Styling System](#12-styling-system)
13. [Testing / Verification Scripts](#13-testing--verification-scripts)
14. [Key Libraries & Why They're There](#14-key-libraries--why-theyre-there)
15. [Known Sharp Edges (good interview material)](#15-known-sharp-edges-good-interview-material)
16. [Solve & Hint: the Kociemba Solver in Anger](#16-solve--hint-the-kociemba-solver-in-anger)

---

## 1. What This App Actually Is

There is **no backend**. There is no NestJS, no database, no API routes, no `/learn` `/practice` `/solve` route split. It is a **single-page Next.js 14 App Router client app** — one route (`/`) that renders a full-viewport 3D cube plus a bottom control dock.

Everything — scrambling, move logic, solved-state detection, cube state — runs **in the browser**, in memory, using the `cubejs` npm package as the pure move-application engine. There is nothing to deploy except a static/edge-renderable Next.js frontend.

Modes that exist right now:
- **Free play / practice** — drag stickers or use buttons/keyboard to turn faces, scramble, reset, watch confetti when solved.
- **Auto-solve** — a "Solve" button runs `cubejs`'s actual Kociemba two-phase solver (in a Web Worker) against the current state and animates the returned solution move-by-move.
- **Hint** — a toggle that keeps a "Hint" button pulsing over the next correct move, recomputed from the live cube state after every move. See [Section 16](#16-solve--hint-the-kociemba-solver-in-anger).

Scaffolded in code but not reachable in the UI: nothing currently — the one previous case (a tutorial system) was removed as dead code; see [Section 11](#11-removed-dead-code).

There is no `/scramble` or `/solve` HTTP API — the solver runs entirely client-side in a Web Worker, not on a server.

---

## 2. Tech Stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| Framework | Next.js (App Router) | 14.2.35 | `dynamic(..., { ssr: false })` used to keep the R3F Canvas out of SSR (WebGL can't render server-side) |
| UI | React | 18 | required by React Three Fiber v8 |
| 3D engine | Three.js | ^0.162 | underlying WebGL scene graph |
| 3D↔React bridge | `@react-three/fiber` | ^8.18 | lets the cube be written as JSX components (`<mesh>`, `<group>`) instead of imperative Three.js |
| 3D helpers | `@react-three/drei` | ^9.122 | `OrbitControls`, `RoundedBox`, `Stars`, `Sparkles`, `ContactShadows` |
| Move animation | GSAP | ^3.15 | tweens a plain numeric proxy value (not a Three.js object directly) each frame, driving group rotation with `power2.inOut`/`power2.out` easing |
| Cube move logic | `cubejs` | ^1.3.2 | Kociemba two-phase cube library. `fromString(...).move(...)` for move application ([Section 6](#6-cube-logic-engine-cubejs)); `Cube.initSolver()` + `cube.solve()` for the actual solver, run inside a Web Worker ([Section 16](#16-solve--hint-the-kociemba-solver-in-anger)) |
| State | Zustand | ^4.5.7 | two stores: `cubeStore` (cube truth) and `solverStore` (solve/hint UI state), no middleware, no persistence |
| Styling | Tailwind CSS | ^3.4.1 | utility classes throughout; two CSS custom properties + hand-written `@keyframes` in `globals.css` for the background FX |
| UI motion | Framer Motion | ^11.18 | panel/button micro-interactions (`ControlDock`, `CubeScene` HUD, `SolveCelebration`) — **not** used for cube-turning animation, that's GSAP |
| Celebration | `canvas-confetti` | ^1.9 | fired from `SolveCelebration.tsx` |
| Fonts | `next/font/google` | — | Space Grotesk / Inter / JetBrains Mono, loaded in `app/layout.tsx` as CSS variables. |

Path alias: `@/*` → project root (`frontend/`), configured in `tsconfig.json`.

Root-level `package.json` (one directory above `frontend/`) contains only `playwright`, used by the two ad-hoc scripts described in [Section 13](#13-testing--verification-scripts). It is not a monorepo/workspace config — just a place for manual QA tooling.

---

## 3. Repository Structure

```
Kubewize/
├── ARCHITECTURE.md                 # this file
├── package.json                    # root: playwright only, for manual QA scripts
├── test-cube.js                    # node script: pure cubejs algebra self-checks
├── verify-cube.js                  # playwright script: drives the real browser UI
│
└── frontend/                       # the actual Next.js app
    ├── app/
    │   ├── layout.tsx               # root layout, Google fonts as CSS vars, <html>/<body>
    │   ├── page.tsx                 # the ONLY route — mounts the whole app
    │   └── globals.css              # Tailwind directives + CSS vars + BackgroundFX @keyframes
    │
    ├── components/
    │   ├── cube/
    │   │   ├── CubeScene.tsx        # R3F <Canvas>, lights, OrbitControls, HUD overlay
    │   │   ├── RubiksCube.tsx       # 26 <Cubie>s, cubiePositions ref, drag-to-turn input handling
    │   │   ├── Cubie.tsx            # one cubie: RoundedBox body + per-face tile meshes + hit-planes
    │   │   ├── MoveAnimator.tsx     # GSAP tween for queued (button/keyboard) moves
    │   │   ├── cubeDrag.ts          # MOVE_PARAMS, rotateGridPos, drag-rotation math
    │   │   ├── BackgroundFX.tsx     # decorative CSS-animated stars/comets/UFO/sparkles
    │   │   └── CUBE_ARCHITECTURE.md # deep-dive notes on face-index math & bug history
    │   ├── layout/
    │   │   └── PracticeShell.tsx    # thin wrapper that calls useKeyboardMoves()
    │   └── ui/
    │       ├── ControlDock.tsx      # collapsible bottom dock + "how to play" help panel
    │       ├── MoveButtons.tsx      # U/R/F/D/L/B buttons, Scramble, Reset, Solve, Hint
    │       └── SolveCelebration.tsx # confetti + modal on solve
    │
    ├── store/
    │   ├── cubeStore.ts             # sticker state, move queue, history, isSolved
    │   └── solverStore.ts           # isSolving, isThinking, hintEnabled, hintMove
    │
    ├── lib/
    │   ├── cubeLogic.ts             # cubejs wrapper: applyMove, applySequence, isSolved
    │   ├── solver.worker.ts         # Web Worker: Cube.initSolver() + cube.solve()
    │   └── solverClient.ts          # main-thread API: solveCube() — owns the worker + request/response correlation
    │
    ├── hooks/
    │   ├── useKeyboardMoves.ts      # keydown → enqueueMove(...)
    │   └── useHintEngine.ts         # recomputes solverStore.hintMove after every committed move
    │
    ├── package.json / tsconfig.json / tailwind.config.ts / next.config.mjs
    └── ...
```

---

## 4. Component Tree & Render Path

`app/page.tsx` is the entire app:

```
PracticeShell                              (calls useKeyboardMoves())
└── div (fullscreen dark flex column)
    ├── CubeScene                          (dynamic import, ssr:false)
    │   ├── BackgroundFX                   (plain CSS div layer, behind the canvas)
    │   ├── <Canvas>                       (R3F)
    │   │   ├── lights (ambient + 3 colored point lights)
    │   │   ├── <Stars> / <Sparkles>       (drei)
    │   │   ├── RubiksCube
    │   │   │   ├── floatRef <group>       (idle vertical bob, via useFrame)
    │   │   │   │   └── groupRef <group>   (reparenting target for turns)
    │   │   │   │       ├── 26 × <Cubie>
    │   │   │   │       └── MoveAnimator   (renders null — pure side-effect component)
    │   │   ├── <ContactShadows>
    │   │   └── <OrbitControls>
    │   ├── status pill (top-center HUD, framer-motion)
    │   └── Auto-Orbit toggle button (top-right)
    ├── KubeWize logo/wordmark (top-left, absolutely positioned)
    └── ControlDock (bottom)
        └── MoveButtons
└── SolveCelebration                        (fixed overlay, always mounted, animates via isSolved)
```

Why `dynamic(..., { ssr: false })`: `CubeScene` touches `window`/WebGL through R3F's `Canvas`, which cannot run during Next.js server-side rendering.

---

## 5. State Management (Zustand)

### `cubeStore.ts` — the single source of truth for cube state

```ts
interface CubeState {
  stickers: FaceColor[];        // 54-length array, current cube state
  moveHistory: MoveNotation[];  // every move ever committed
  moveQueue: MoveNotation[];    // pending button/keyboard moves, FIFO
  isAnimating: boolean;         // true while ANY animation (queued or drag) is in flight
  isSolved: boolean;
  resetVersion: number;         // bumped on reset/scramble; RubiksCube watches this to snap meshes
}
```

Two distinct write paths into this store, because there are two distinct input mechanisms (see [Section 8](#8-the-two-move-pipelines)):

- **Queued path**: `enqueueMove(move)` → `MoveAnimator` (a `useEffect` watching `moveQueue`) animates it → `commitMove(move)` applies it to `stickers` and pops the queue.
- **Direct-drag path**: `beginDirectMove()` (locks input) → user drags → `commitDirectMove(move)` or `cancelDirectMove()`.

`resetToSolved()` and `loadScramble(stickers)` both bump `resetVersion` — this is the signal `RubiksCube.tsx` uses to snap the Three.js meshes and the internal `cubiePositions` ref back to a known grid (see the reset-bug fix in [Section 15](#15-known-sharp-edges-good-interview-material)).

This is the only store in the app — an earlier `tutorialStore` plus its slide-in panel UI was removed as unreachable dead code (nothing ever mounted it); see [Section 11](#11-removed-dead-code) for what was cut and why.

---

## 6. Cube Logic Engine (`cubejs`)

`lib/cubeLogic.ts` is a thin wrapper around the third-party `cubejs` package:

```ts
const cube = Cube.fromString(stickers.join(''));  // parse 54-char sticker string
cube.move('R');                                    // mutate via WCA notation
cube.asString();                                    // serialize back to 54-char string
```

- **Sticker string format**: 54 characters, face order `U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53)`, each face read row-major left-to-right/top-to-bottom as viewed head-on. `cubejs` and this app agree on this layout — no conversion step needed.
- `applyMove` / `applySequence` are the functions the move-pipeline code calls (both pure — return a new array, never mutate the input) for turning a face. `isSolved` just does an element-wise compare against `SOLVED_STATE`.
- `M`/`E`/`S` (middle-slice) notation is defined in the `MoveNotation` type and in `MOVE_PARAMS` (`cubeDrag.ts`) but nothing in the UI currently emits M/E/S moves via button/keyboard — they exist because `cubejs` supports them and the drag system is layer-generic (see below), not because there's a slice-move button. The solver ([Section 16](#16-solve--hint-the-kociemba-solver-in-anger)) never produces M/E/S either — Kociemba solutions are always expressed in plain face turns.
- **`cubejs`'s actual Kociemba solver is used** — but not from this file. `lib/cubeLogic.ts` only ever calls `.move()`; the solver (`Cube.initSolver()` / `cube.solve()`) is called exclusively from `lib/solver.worker.ts`, inside a Web Worker, so a from-scratch solve search never blocks the main thread. See [Section 16](#16-solve--hint-the-kociemba-solver-in-anger).

---

## 7. 3D Cube Representation

### Coordinate system
- `x` = right, `y` = up, `z` = toward the viewer (+Z is the front face).
- Grid positions are integers `{-1, 0, +1}` on each axis.
- 26 cubies (3×3×3 minus the invisible center) are generated once as `INITIAL_POSITIONS`, iterating `x` → `y` → `z`; **array index = cubie ID for the whole app's lifetime** — IDs never change, only the grid position each ID currently occupies.

### Per-cubie geometry (`Cubie.tsx`)
This is **not** a single `BoxGeometry` with 6 materials (that was an earlier design; see `CUBE_ARCHITECTURE.md` for that history). The current implementation, per cubie, is:

1. One dark `RoundedBox` (0.90³, radius 0.06) — the plastic body, `meshPhysicalMaterial` with clearcoat, always rendered.
2. Up to 6 small raised `RoundedBox` **tiles** (0.72×0.72×0.08), one per outward-facing side, positioned just proud of the body surface. Faces pointing into the cube interior render **no tile at all** (skipped, not colored black) — the dark body shows through instead. Each tile uses `meshStandardMaterial` with `color: '#000000'` and `emissive: <WCA color>` — the **emissive trick**: since diffuse color is black, scene lighting can't wash the color out or tint it; only the emissive channel shows, so every sticker reads as a pure, consistent WCA color regardless of the (deliberately dramatic, colored) point lights in the scene.
3. Up to 6 invisible hit-plane meshes (`PlaneGeometry`, fully transparent, `depthWrite`/`colorWrite` off), one per visible face, sized slightly larger than the tile to make dragging forgiving. These carry the `onPointerDown`/`onPointerOver`/`onPointerOut` handlers — the actual drag-to-turn input surface.
4. A `useFrame` hook pulses `emissiveIntensity` sinusoidally while the cubie is `selected` (mid-drag), and an effect resets intensity to a steady hover/idle value once selection ends — avoiding a `traverse()` on all 26 cubies every frame when nothing is selected.

### Face-index math (`RubiksCube.tsx`)
Given a cubie's grid position, `getCubieColors` picks the right sticker out of the 54-element array for each outward face. Six small helper functions do this, and they're **not symmetric** — this is the single most error-prone part of the codebase (see [Section 15](#15-known-sharp-edges-good-interview-material)):

```ts
uIdx(x, z) = (z + 1) * 3 + (x + 1)   // viewed from above: front(+Z) at BOTTOM of view
dIdx(x, z) = (1 - z) * 3 + (x + 1)   // viewed from below: front(+Z) at TOP of view (inverted!)
rIdx(y, z) = (1 - y) * 3 + (1 - z)
lIdx(y, z) = (1 - y) * 3 + (z + 1)
fIdx(y, x) = (1 - y) * 3 + (x + 1)
bIdx(y, x) = (1 - y) * 3 + (1 - x)   // back view: x is mirrored
```

Each formula encodes "what row/column does this grid coordinate map to, **as seen by someone looking directly at that face from outside the cube**" — which is why U and D (a mirror pair through the horizontal plane) don't share a formula, and why B mirrors x but F doesn't.

---

## 8. The Two Move Pipelines

There are two independent ways a face turn can happen, and they intentionally share as little code as possible beyond `MOVE_PARAMS`/`rotateGridPos`:

### A. Queued moves (buttons, keyboard)
1. Something calls `enqueueMove('R')` → pushed onto `cubeStore.moveQueue`, `isAnimating = true`.
2. `MoveAnimator`'s `useEffect` (watching `moveQueue`) picks `moveQueue[0]`, looks up `{ axis, layer, angle }` from `MOVE_PARAMS`, finds every cubie ID whose current grid position matches `layer` on that `axis`.
3. Those cubies are `tempGroup.attach(mesh)`-ed out of the main group into a throwaway `THREE.Group` (Three's `attach` preserves world transform across the reparent).
4. GSAP tweens a plain `{ value: 0 }` proxy object from 0 to `angle` over 0.3s (`power2.inOut`); `onUpdate` writes `tempGroup.rotation[axis] = target.value` every tick.
5. `onComplete`: cubies are `group.attach()`-ed back, positions rounded to the nearest integer (kills float drift), quaternion reset to identity (the group rotation already baked the visual result into each child's own transform via `attach`), `cubiePositions.current[id]` updated via `rotateGridPos`, then `commitMove(move)` applies the move to `stickers` in the store and dequeues.
6. If more moves are queued, the effect re-fires immediately for the next one.

### B. Direct-manipulation drag (click/tap a sticker and slide)
This is the primary, "feels like a real cube" interaction, implemented entirely in `RubiksCube.tsx` + `cubeDrag.ts`:
1. `pointerdown` on a hit-plane calls `handleStickerDown`: captures the pointer, records which face was grabbed, the cubie's current grid position, and a `THREE.Plane` through the click point aligned to that face's normal (so subsequent drag deltas are measured in the plane of the face, not the screen).
2. On `pointermove`, once the raw screen delta exceeds `DIRECTION_LOCK_PX` (8px), `createDragRotation` (see [Section 9](#9-direct-manipulation-drag-math)) decides *which slice* the user most likely means to turn, and locks in an axis + layer for the rest of the gesture.
3. The affected cubies are reparented into a `tempGroup` exactly as in path A, but the rotation angle now tracks the pointer directly via `dragAngle` every move event — this is a **live, interruptible, user-driven tween**, not a fixed-duration animation.
4. On `pointerup`/`pointercancel`/window `blur`, `settleDrag` computes a target angle: it blends in recent angular velocity as "throw" momentum, rounds to the nearest multiple of 90° (clamped to ±2 quarter turns), and — if the user let go with a very small drag but past the `COMMIT_ANGLE` (0.18 rad) threshold — still commits a single quarter turn rather than snapping back to 0. GSAP eases from the live angle to that target; on completion the same position-rounding / `commitDirectMove` logic as path A applies.
5. Releasing with a tiny drag below both thresholds snaps back to 0 and calls `cancelDirectMove()` — no move is recorded.

Both paths converge on the same `rotateGridPos` for bookkeeping and the same `MOVE_PARAMS`-shaped `{axis, layer, angle}` semantics, so a queued move and a completed drag are indistinguishable to the store once committed.

---

## 9. Direct-Manipulation Drag Math

`cubeDrag.ts` is the geometry/math module shared by both pipelines.

- **`MOVE_PARAMS`**: for every `MoveNotation` (including `M`/`E`/`S`), a fixed `{ axis, layer, angle }`. Signs were empirically verified per-face (documented in `CUBE_ARCHITECTURE.md`) because Three.js's right-hand-rule convention doesn't map onto "clockwise as a human looking at that face would call it" the same way for every axis — e.g. `L` uses `+π/2` for the same visual clockwise turn that `R` achieves with `-π/2`, because a viewer looking at the L face is looking in the **−X** direction, flipping the handedness.
- **`createDragRotation`**: given the grabbed face and the accumulated world-space drag vector, it tests the (at most two) candidate tangent directions that are perpendicular to that face's normal, picks whichever one the drag more closely aligns with, and derives the rotation axis as `faceNormal × tangent`. It also computes a `directionConfidence` ratio (best candidate's dot product vs. the runner-up) — if the drag is too diagonal/ambiguous *and* still short, the caller (`RubiksCube.tsx`) simply waits for more movement rather than committing to a possibly-wrong axis.
- **`dragAngle`**: projects the pixel drag onto the chosen screen-space tangent direction and scales it by `pixelsPerQuarterTurn` (itself adaptive to camera zoom via `screen.length`, clamped to a 150–270px range so the turn feels similarly "sized" whether zoomed in or out).
- **`moveForRotation`**: converts a settled `{axis, layer, angle}` back into WCA notation (`R`, `R'`, `R2`, ...) purely from sign and magnitude, so the committed move can go through the exact same `applyMove`/history/`isSolved` path as a button press.
- **`rotateGridPos`**: pure integer arithmetic — no trig at runtime — rotating a `[x,y,z]` grid coordinate by `±1` or `±2` quarter turns using a small case-switch on `steps % 4`. The X and Z axis branches negate `steps` before rotating relative to Three.js's Y-axis convention, compensating for the same handedness flip mentioned above.

---

## 10. Visual Feedback & Decoration

- **`CubeScene.tsx`**: owns an `interaction` state machine (`idle → hover → dragging → ready → success`) purely for the HUD status pill text/icon ("Pick a square • slide it" → "Grab this square and slide" → "Slide a little more…" → "Let go!" → "Nice move!"). `RubiksCube` reports into it via the `onInteractionChange` callback prop; it doesn't touch cube state.
- **Lighting is deliberately theatrical, not realistic**: an ambient fill plus three strong colored point lights (purple/cyan/amber) exist *only* to light the dark plastic bodies — they can't wash out sticker colors because sticker tiles use the emissive-only material trick from Section 7.
- **`BackgroundFX.tsx`**: a self-contained decorative layer (shooting stars, comets, a drifting UFO, twinkling sparkles) rendered as plain positioned `<div>`s with hand-written CSS `@keyframes` (defined in `globals.css`), sitting behind the WebGL canvas. Spawn timing is randomized per-effect-type via a `useSchedule` hook (random interval, re-arming itself); an initial "seed" effect fires shortly after mount so the sky isn't empty while waiting for the first random interval. Fully respects `prefers-reduced-motion` (bails out and renders nothing).
- **`SolveCelebration.tsx`**: watches `isSolved` transition from `false → true` (guarding against firing on initial mount or on a no-op reset) and fires three staggered `canvas-confetti` bursts plus a spring-animated modal via Framer Motion. Respects `prefers-reduced-motion` by passing `disableForReducedMotion: true` to confetti.
- **Idle float**: a separate outer `<group ref={floatRef}>` (wrapping the reparenting `groupRef` group) gently bobs the whole cube on a sine wave via `useFrame` — isolated from the turn-animation reparenting so it can't interfere with in-flight moves.

---

## 11. Removed Dead Code

A prior version of this app had a tutorial system that was fully built but never reachable in the UI: `data/tutorial.ts` (a complete 5-stage/15-step beginner layer-by-layer method), `store/tutorialStore.ts` (`openTutorial`/`closeTutorial`/`nextStep`/`prevStep`/`highlightFaces`), and `components/tutorial/{TutorialPanel,TutorialButton}.tsx`. None of it was imported by `app/page.tsx`, so a user could never open it, and `RubiksCube.tsx`'s `highlightFaces`-driven cubie highlighting could never actually fire. All of it — plus the `highlighted` prop and its pulsing-glow branch in `Cubie.tsx`, and the `isHighlighted()` helper in `RubiksCube.tsx` — was deleted as unreachable dead code. `selected` (the drag-in-progress highlight, which is real and live) was kept.

Also removed as dead at the same time:
- `toKociembaString` / `fromKociembaString` in `lib/cubeLogic.ts` — exported but never called anywhere.
- The `@fontsource/inter`, `@fontsource/jetbrains-mono`, `@fontsource/space-grotesk` packages — installed but unimported; fonts actually load via `next/font/google`.
- Unused Tailwind color tokens (`bg-primary`, `bg-surface`, `bg-elevated`, `accent-cyan`, `accent-purple`, `text-primary`, `text-secondary`, `border`) in `tailwind.config.ts`, and the matching unused CSS custom properties in `globals.css` (`--bg-surface`, `--accent-cyan`, `--sticker-*`, etc.) — none were referenced by any class name or `var(...)` call. Only `--bg-primary` and `--text-primary` (used by the `html`/`body` base rule) were kept.

If a tutorial/onboarding feature is wanted again, it should be rebuilt with an actual mount point in `page.tsx` from the start, rather than resurrected from git history — the data model (`TutorialStage`/`TutorialStep`) was sound, but building UI that's never linked in is how it went dead the first time.

---

## 12. Styling System

- Tailwind CSS utility classes are used directly in JSX almost everywhere (no CSS modules).
- `tailwind.config.ts` only extends `fontFamily` (three tokens pointing at the CSS variables set by `next/font/google` in `layout.tsx`); no custom color palette is defined there — colors are written as literal Tailwind classes (e.g. `bg-[#09090F]`) or inline hex directly in components.
- `globals.css` declares exactly two CSS custom properties (`--bg-primary`, `--text-primary`) consumed by the `html`/`body` base rule, plus the hand-written `@keyframes` used by `BackgroundFX`.
- Dark theme only — there is no light theme or theme toggle anywhere in the app.

---

## 13. Testing / Verification Scripts

Two standalone Node scripts at the repo root, run manually (no test runner/CI wiring):

- **`test-cube.js`** — pure algebra sanity checks against `cubejs` directly (no browser, no React). Verifies group-theory identities that must hold regardless of indexing convention: each face-move applied 4× is identity, a move followed by its inverse is identity, a 20-move scramble followed by its exact reverse is identity, and that an `F` move only touches the sticker indices it's supposed to (nothing on the opposite `B` face changes, etc).
- **`verify-cube.js`** — a Playwright script that launches real Chrome, loads `localhost:3000`, clicks the actual move buttons, and screenshots each state (`initial`, `after-F`, `after-F'`, `after-scramble`, `after-reset`, plus a rapid-fire double-click probe) to `C:\Temp\cube-*.png`, while collecting any browser console/page errors. This is a manual visual-QA aid, not an automated pass/fail suite — a human is expected to look at the screenshots.

Neither script is referenced by any `package.json` `scripts` entry or CI config; they're run directly with `node`.

---

## 14. Key Libraries & Why They're There

| Package | Used for | Notably NOT used for |
|---|---|---|
| `three` / `@react-three/fiber` / `@react-three/drei` | The entire 3D scene: cube geometry, camera, lights, orbit controls, particles, contact shadow | — |
| `gsap` | Tweening the *numeric rotation value* during a face turn (both queued and drag-settle paths) | Not used for any 2D/DOM animation — that's Framer Motion |
| `framer-motion` | 2D UI chrome: HUD status pill, orbit-toggle button, control dock open/close, help panel, solve-celebration modal | Never touches the 3D scene |
| `zustand` | `cubeStore` (cube truth) and `solverStore` (solve/hint UI state) | No persistence middleware, no devtools middleware — plain `create()` |
| `cubejs` | `.fromString().move().asString()` for move application (main thread); `Cube.initSolver()` + `.solve()` for the actual Kociemba search (Web Worker only) | The solver is never run on the main thread |
| `canvas-confetti` | One-shot celebration burst in `SolveCelebration` | — |

---

## 15. Known Sharp Edges (good interview material)

These are real bugs that were found and fixed during development — understanding *why* they happened is more valuable than memorizing the fix:

1. **Per-axis clockwise sign is not uniform.** Three.js rotation angles follow the right-hand rule around each axis's *positive* direction, but "clockwise" is defined by a human standing on a specific side of the cube looking inward. For `U`/`R`/`F` the natural CW turn is `-π/2`; for `D`/`L`/`B` (the "opposite" faces) it's `+π/2`, because looking at those faces means looking in the *negative* axis direction, which flips the handedness. Every one of the six had to be verified empirically rather than derived by pattern-matching the others.

2. **`dIdx` is not `uIdx` mirrored the "obvious" way.** U and D are opposite faces, but because you view U from above and D from below, the front of the cube (+Z) lands at the *bottom* of the U-face view and the *top* of the D-face view. The original bug used the same row formula for both, which silently placed D-face stickers on the wrong rows — visually subtle because it only shows up once the D face actually has mixed colors (post-scramble), not on a solved cube.

3. **Reset showed one frame of black stickers.** `cubiePositions` lives in a `ref` (not state) for performance — mutating it doesn't trigger a re-render, and a `useEffect` was originally the only thing snapping it back after `resetVersion` changed. But React commits the *render* (which recomputes sticker colors from `cubiePositions`) before running effects, so for one paint, freshly-solved `stickers` were being mapped against stale, still-scrambled `cubiePositions` — producing spurious inner-face-black on cubies that should have been colored. Fixed by also snapping `cubiePositions.current` synchronously in the render body itself (guarded by a `lastSeenResetRef` to only do it once per `resetVersion` change), so the color computation that follows in the same render already sees correct positions. The `useEffect` version is still needed too, to snap the actual Three.js mesh transforms (positions/quaternions), which can't be touched during render.

4. **Two independent move-commit code paths must stay in sync.** Queued moves and drag-settled moves duplicate the reparent → tween → round-position → `rotateGridPos` → commit sequence almost line for line (`MoveAnimator.tsx` vs. the `settleDrag` function in `RubiksCube.tsx`). This is intentional given how differently they're driven (fixed-duration queue vs. live pointer-tracked gesture with momentum), but it means a change to one (e.g., adjusting how position-rounding works) must be mirrored in the other or the two input methods will drift apart in subtle ways.

---

## 16. Solve & Hint: the Kociemba Solver in Anger

Two features, `Solve` and `Hint`, both sit on top of `cubejs`'s real solver — until this feature was added, the solver was present in the dependency but completely unused (see git history / the removed-dead-code note in Section 11's spirit; this is the opposite case: previously-dormant capability that's now wired up).

### Why a Web Worker

`Cube.initSolver()` computes move tables and pruning tables via BFS over hundreds of thousands of cube-coordinate states — a real, synchronous, CPU-bound cost (single-digit seconds on a cold start, one-time per page session). Running that on the main thread would freeze drag input and animation while it happens. Instead:

- **`lib/solver.worker.ts`** is a dedicated Web Worker entry point. It `require('cubejs')`s its own copy of the library (workers don't share module scope with the main thread), lazily calls `Cube.initSolver()` on the *first* `solve` message it receives (an `initialized` flag guards against repeating the BFS), then runs `Cube.fromString(stickers).solve()` and posts the resulting move list back.
- **`lib/solverClient.ts`** is the main-thread-side API: `solveCube(stickers): Promise<MoveNotation[]>`. It lazily constructs the worker via `new Worker(new URL('./solver.worker.ts', import.meta.url))` — Next.js's webpack config splits this into its own chunk automatically (verified by inspecting the production build output: a small worker chunk that does `self.onmessage = ...` and `importScripts`-loads a second chunk containing `cubejs`'s solver internals). Multiple in-flight requests are correlated by an incrementing `id` in a `Map<id, resolve>`, since both the Hint engine and a manual Solve click can each call `solveCube` independently.
- The worker is created lazily (first call), not at app startup — a user who never touches Solve/Hint never pays the `cubejs` worker-bundle download or the table-computation cost.

### Auto-Solve (`MoveButtons.tsx`)

Clicking **Solve** doesn't introduce any new animation system — it reuses the existing queued-move pipeline verbatim:
1. `solveCube(stickers)` is awaited (this is where the first-ever call pays the `initSolver` cost — the button shows "Solving…" the whole time via `solverStore.isSolving`/`isThinking`).
2. The returned move list is fed through the ordinary `enqueueMove(move)` one at a time — from here it's indistinguishable from a human clicking 20 buttons in a row; `MoveAnimator` animates each in turn exactly as described in [Section 8](#8-the-two-move-pipelines).
3. Since there's no promise for "the whole queue finished," a small `solvingStartedRef` guard in `MoveButtons.tsx` watches `moveQueue.length` drop back to `0` (after having confirmed it was actually populated, to avoid a false-positive on the split second between "await resolved" and "moves enqueued") to flip `isSolving` back off and re-enable other controls.

### Hint (`useHintEngine.ts` + `MoveButtons.tsx`)

Hint is deliberately *not* "cache the solution once and step through it" — it recomputes from whatever the current sticker state actually is, so it stays correct even if the user makes a move that isn't the suggested one:
1. `useHintEngine()` (mounted once, in `PracticeShell.tsx`) watches `cubeStore.stickers` and `solverStore.hintEnabled`. Whenever the toggle is on and the cube isn't mid-animation/already solved/being auto-solved, it calls `solveCube(stickers)` and stores `solution[0]` as `hintMove`.
2. Because `stickers` only actually changes once per *committed* move (not per drag-frame), this fires once per move while the toggle is on — not continuously.
3. `MoveButtons.tsx` renders the hint by pulsing the on-screen button(s) that match `hintMove` (`hintTargets()` maps a move like `"R'"` to the CCW button on the `R` row; a `2` suffix pulses both CW and CCW, since either direction gets you to the same 180° result). The hint only ever points at a UI control the user can click themselves — it never auto-applies the move.

Both features share the one worker instance and the one `solveCube` entry point; nothing about the solver integration knows or cares which feature triggered it.
