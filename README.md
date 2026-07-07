<div align="center">

# 🧩 KubeWize

**A real, playable 3D Rubik's Cube in your browser — drag the stickers like the real thing.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![React Three Fiber](https://img.shields.io/badge/React%20Three%20Fiber-3D-8B5CF6?logo=three.js&logoColor=white)](https://docs.pmnd.rs/react-three-fiber)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GSAP](https://img.shields.io/badge/GSAP-animation-88CE02?logo=greensock&logoColor=white)](https://gsap.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[Live Demo](https://kube-wize.vercel.app/) · [Demo Video](#) · [Architecture Deep-Dive](./ARCHITECTURE.md)

</div>

---

## What is this?

I've kept a physical Rubik's Cube on my desk for years — solving it is my go-to five-minute reset. This project started as a personal dream: what if that cube lived in the browser too, not as a flat puzzle grid, but as an actual 3D cube you grab and turn with your mouse or finger — and as a hands-on way to properly learn **Three.js** and **GSAP** on top of **Next.js**.

No backend, no database. Everything — the cube's state, scrambling, and even solving — runs entirely client-side in the browser.

## ✨ Features

- **Real 3D cube** — 26 individually rendered pieces, rounded plastic body, glowing WCA-standard sticker colors
- **Drag to turn** — click and drag any sticker directly; the cube figures out which slice you mean to turn from your drag direction, with momentum-based snapping
- **Buttons + keyboard** too, if you prefer notation-style turns (`U`, `R'`, `F2`, ...)
- **Scramble** / **Reset**
- **Auto-Solve** — a real Kociemba two-phase solving algorithm plays out the full solution move by move
- **Hint mode** — highlights just the next correct move, for anyone learning to solve by hand
- Fully responsive — works from a phone in portrait to an ultrawide monitor
- A small, kid-friendly welcome animation on first visit

## 🛠️ Tech Stack

| Layer               | Tool                                 | Used for                                                                                   |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Framework           | **Next.js 14** (App Router)          | App shell, dev/build tooling                                                               |
| 3D rendering        | **Three.js** + **React Three Fiber** | The cube, lighting, camera, particles                                                      |
| 3D helpers          | **@react-three/drei**                | Rounded geometry, orbit controls, stars/sparkles                                           |
| Turn animation      | **GSAP**                             | Smooth, physically-eased face-turn tweens                                                  |
| Cube logic & solver | **cubejs**                           | Move application + Kociemba two-phase solve, run in a Web Worker so it never blocks the UI |
| State               | **Zustand**                          | Cube state + solver/hint state                                                             |
| Styling             | **Tailwind CSS**                     | All UI styling                                                                             |
| 2D motion           | **Framer Motion**                    | HUD, buttons, celebration screen, intro splash                                             |
| Celebration         | **canvas-confetti**                  | Because solving deserves a little fanfare                                                  |

## 🚀 Getting Started

```bash
git clone https://github.com/KhursheedAK/kubewize.git
cd kubewize/frontend
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## 📁 Project Structure

```
Kubewize/
├── ARCHITECTURE.md        ← full technical deep-dive (coordinate system, bug history, why each library)
├── test-cube.js            manual cube-logic verification script
├── verify-cube.js           Playwright-driven visual QA script
└── frontend/
    ├── app/                the one route — layout, page, global styles
    ├── components/
    │   ├── cube/            the 3D cube itself: scene, cubies, drag math, move animation
    │   └── ui/              buttons, control dock, solve celebration, intro splash
    ├── store/               Zustand stores (cube state, solver/hint state)
    ├── lib/                 cube logic wrapper + the solver Web Worker
    └── hooks/               keyboard controls, hint engine
```

For the _why_ behind every decision here — the coordinate system, the face-index math, why two separate move-input pipelines exist, and the real bugs I ran into building this — see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## 🙋 About

Envisioned and built by **Khursheed Alam Khan** — as a personal project to learn Three.js, GSAP, and Next.js by building something I actually wanted to exist. Still a side project, still rough in places, and I'd genuinely love feedback if you're into front-end 3D, animation, or you're a fellow cuber.

## 📄 License

MIT — see [LICENSE](./LICENSE).
