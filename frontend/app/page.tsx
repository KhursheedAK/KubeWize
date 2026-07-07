import dynamic from 'next/dynamic';
import ControlDock from '@/components/ui/ControlDock';
import PracticeShell from '@/components/layout/PracticeShell';
import SolveCelebration from '@/components/ui/SolveCelebration';
import IntroSplash from '@/components/ui/IntroSplash';

// R3F Canvas must be client-only
const CubeScene = dynamic(() => import('@/components/cube/CubeScene'), {
  ssr: false,
});

export default function Home() {
  return (
    <PracticeShell>
      <div className="flex h-screen flex-col overflow-hidden bg-[#09090F] text-[#F0F0FF]">
        <div className="relative flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 min-h-0">
            <CubeScene />
          </div>
          <div className="pointer-events-none absolute left-3 top-3 sm:left-5 sm:top-5 z-30 flex select-none items-center gap-1.5 sm:gap-2.5" aria-label="KubeWize">
            <div className="grid h-7 w-7 sm:h-9 sm:w-9 rotate-[-8deg] grid-cols-2 gap-0.5 rounded-lg sm:rounded-xl border border-white/15 bg-white/[0.06] p-1 sm:p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.28),0_0_22px_rgba(34,211,238,0.1)]" aria-hidden="true">
              <span className="rounded-[3px] bg-cyan-300" />
              <span className="rounded-[3px] bg-purple-400" />
              <span className="rounded-[3px] bg-yellow-300" />
              <span className="rounded-[3px] bg-emerald-400" />
            </div>
            <span className="font-display text-base sm:text-xl font-bold tracking-[-0.035em] text-white/90">
              Kube<span className="text-cyan-300">Wize</span>
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20">
            <ControlDock />
          </div>
        </div>
      </div>

      {/* Fixed overlay — always in DOM so CSS transition works */}
      <SolveCelebration />
      <IntroSplash />
    </PracticeShell>
  );
}
