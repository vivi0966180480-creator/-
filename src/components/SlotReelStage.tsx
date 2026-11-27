import React, { useEffect, useRef, useState } from 'react';
import type { Student } from '../types';
import { soundEngine } from '../utils/soundEngine';

interface SlotReelStageProps {
  pool: Student[];
  spinTrigger: number;
  targetStudent: Student | null;
  latestWinner: Student | null;
  isDrawing: boolean;
  onSpinComplete: (winner: Student) => void;
  isPresentationMode?: boolean;
}

export const SlotReelStage: React.FC<SlotReelStageProps> = ({
  pool,
  spinTrigger,
  targetStudent,
  latestWinner,
  isDrawing,
  onSpinComplete,
  isPresentationMode = false,
}) => {
  const [displayIndex, setDisplayIndex] = useState(0);
  const [activeSnapshot, setActiveSnapshot] = useState<Student[]>(pool);
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  useEffect(() => {
    if (!isDrawing) {
      setActiveSnapshot(pool);
      if (latestWinner) {
        const idx = pool.findIndex((s) => s.id === latestWinner.id);
        if (idx !== -1) setDisplayIndex(idx);
      } else {
        setDisplayIndex(0);
      }
    }
  }, [pool, isDrawing, latestWinner]);

  useEffect(() => {
    if (spinTrigger === 0 || !targetStudent || pool.length === 0) return;

    const snapshot = [...pool];
    setActiveSnapshot(snapshot);
    const targetIdx = snapshot.findIndex((s) => s.id === targetStudent.id);
    if (targetIdx === -1) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setDisplayIndex(targetIdx);
      onSpinCompleteRef.current(targetStudent);
      return;
    }

    // Build a deterministic step sequence ending cleanly on targetIdx
    const totalSteps = Math.max(26, Math.min(38, snapshot.length * 2 + 12));
    const startOffset =
      ((targetIdx - totalSteps) % snapshot.length + snapshot.length) % snapshot.length;

    let step = 0;
    let timerId = 0;

    const tickNext = () => {
      step++;
      const progress = step / totalSteps;
      const currentIdx = (startOffset + step) % snapshot.length;
      setDisplayIndex(currentIdx);
      soundEngine.playTick(progress);

      if (step < totalSteps) {
        // Exponential deceleration from ~42ms to ~340ms
        const delay = Math.round(42 + Math.pow(progress, 3.1) * 310);
        timerId = window.setTimeout(tickNext, delay);
      } else {
        timerId = window.setTimeout(() => {
          onSpinCompleteRef.current(targetStudent);
        }, 120);
      }
    };

    timerId = window.setTimeout(tickNext, 45);
    return () => window.clearTimeout(timerId);
  }, [spinTrigger]);

  const list = activeSnapshot.length > 0 ? activeSnapshot : pool;

  const getNeighbor = (offset: number): Student | null => {
    if (list.length === 0) return null;
    if (list.length === 1 && offset !== 0) return null;
    const idx = ((displayIndex + offset) % list.length + list.length) % list.length;
    return list[idx];
  };

  const centerStudent = isDrawing
    ? getNeighbor(0)
    : latestWinner ?? (list.length > 0 ? list[0] : null);
  const prevStudent = isDrawing ? getNeighbor(-1) : null;
  const nextStudent = isDrawing ? getNeighbor(1) : null;

  const isRevealed = !isDrawing && Boolean(latestWinner);

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center py-4 select-none">
      {/* Reel Window */}
      <div
        className={`relative w-full rounded-2xl border transition-colors duration-200 overflow-hidden ${
          isRevealed
            ? 'bg-sky-50/60 border-[#0284C7]/40'
            : 'bg-slate-50 border-slate-200'
        } ${isPresentationMode ? 'py-14 px-8' : 'py-10 px-6'}`}
      >
        {/* Top Ghost Neighbor */}
        <div
          aria-hidden="true"
          className="h-9 flex items-center justify-center text-slate-400/75 text-lg font-medium transition-opacity duration-150"
        >
          {prevStudent ? (
            <span className="truncate max-w-xs">{prevStudent.name}</span>
          ) : (
            <span className="text-xs text-slate-400">
              {isRevealed ? '本次抽出同學' : list.length > 0 ? '點擊下方按鈕或按空白鍵開始' : '名單已抽完'}
            </span>
          )}
        </div>

        {/* Center Spotlight Row */}
        <div className="my-2 py-5 px-4 rounded-xl bg-white border border-slate-200/90 flex flex-col items-center justify-center min-h-[124px]">
          {centerStudent ? (
            <>
              <span className="font-mono text-xs text-slate-400 tabular-nums mb-1">
                座號 {String(centerStudent.seatNo).padStart(2, '0')}
              </span>
              <span
                className={`font-bold tracking-tight text-center transition-transform duration-150 ${
                  isPresentationMode ? 'text-6xl sm:text-7xl' : 'text-5xl sm:text-6xl'
                } ${isRevealed ? 'text-[#0284C7] scale-[1.03]' : 'text-slate-900'}`}
              >
                {centerStudent.name}
              </span>
            </>
          ) : (
            <span className="text-xl font-medium text-slate-400">尚無可抽取學生</span>
          )}
        </div>

        {/* Bottom Ghost Neighbor */}
        <div
          aria-hidden="true"
          className="h-9 flex items-center justify-center text-slate-400/75 text-lg font-medium transition-opacity duration-150"
        >
          {nextStudent ? (
            <span className="truncate max-w-xs">{nextStudent.name}</span>
          ) : isRevealed ? (
            <span className="text-xs font-medium text-emerald-700">
              已完成隨機抽取
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
