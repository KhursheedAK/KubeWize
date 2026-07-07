'use client';

import { useKeyboardMoves } from '@/hooks/useKeyboardMoves';
import { useHintEngine } from '@/hooks/useHintEngine';

export default function PracticeShell({ children }: { children: React.ReactNode }) {
  useKeyboardMoves();
  useHintEngine();
  return <>{children}</>;
}
