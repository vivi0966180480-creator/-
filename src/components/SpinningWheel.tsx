import React, { useEffect, useRef } from 'react';
import type { Student } from '../types';
import { soundEngine } from '../utils/soundEngine';

interface SpinningWheelProps {
  pool: Student[];
  spinTrigger: number;
  targetStudent: Student | null;
  onSpinComplete: (winner: Student) => void;
  size?: number;
}

const SLICE_PALETTE = [
  { bg: '#E0F2FE', text: '#0C4A6E' }, // Sky
  { bg: '#F1F5F9', text: '#1E293B' }, // Cool Slate
  { bg: '#ECFDF5', text: '#065F46' }, // Emerald
  { bg: '#FEF3C7', text: '#78350F' }, // Amber
  { bg: '#EEF2FF', text: '#312E81' }, // Indigo
  { bg: '#FFF1F2', text: '#881337' }, // Rose
];

export const SpinningWheel: React.FC<SpinningWheelProps> = ({
  pool,
  spinTrigger,
  targetStudent,
  onSpinComplete,
  size = 380,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  // Draw the wheel at a given rotation (in radians)
  const drawWheel = (rot: number, students: Student[], highlightId?: string | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 14;

    if (students.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#F1F5F9';
      ctx.fill();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '500 15px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('尚無可抽取學生', cx, cy);
      ctx.restore();
      return;
    }

    const sliceAngle = (Math.PI * 2) / students.length;

    // Outer ring shadow/border
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();

    // Draw slices
    students.forEach((student, i) => {
      const startAngle = rot + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const palette = SLICE_PALETTE[i % SLICE_PALETTE.length];
      const isWinner = highlightId && student.id === highlightId;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = isWinner ? '#0284C7' : palette.bg;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = students.length > 30 ? 1 : 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isWinner ? '#FFFFFF' : palette.text;

      const fontSize =
        students.length <= 10
          ? 16
          : students.length <= 20
            ? 13
            : students.length <= 32
              ? 11
              : 9.5;
      ctx.font = `600 ${fontSize}px "Noto Sans TC", sans-serif`;

      const maxLabelLen = students.length > 26 ? 4 : 6;
      const label =
        student.name.length > maxLabelLen
          ? student.name.slice(0, maxLabelLen - 1) + '…'
          : student.name;
      ctx.fillText(label, radius - 14, 0);
      ctx.restore();
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#0284C7';
    ctx.fill();

    ctx.restore();
  };

  // Redraw whenever pool changes (and not currently spinning)
  useEffect(() => {
    if (!isAnimatingRef.current) {
      drawWheel(rotationRef.current, pool, null);
    }
  }, [pool, size]);

  // Trigger spin animation when spinTrigger increments
  useEffect(() => {
    if (spinTrigger === 0 || !targetStudent || pool.length === 0) return;

    const targetIndex = pool.findIndex((s) => s.id === targetStudent.id);
    if (targetIndex === -1) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const sliceAngle = (Math.PI * 2) / pool.length;
    // Pointer is at top (-Math.PI / 2). We want targetIndex slice center to land at -Math.PI / 2.
    const targetSliceCenter = targetIndex * sliceAngle + sliceAngle / 2;
    // Small organic offset inside the slice (staying safely within 65% of slice width)
    const jitter = (Math.random() - 0.5) * sliceAngle * 0.55;
    const desiredMod = (-Math.PI / 2 - targetSliceCenter + jitter) % (Math.PI * 2);

    const currentRot = rotationRef.current;
    const currentMod = currentRot % (Math.PI * 2);
    let delta = desiredMod - currentMod;
    while (delta < 0) delta += Math.PI * 2;

    const extraTurns = prefersReduced ? 0 : (5 + Math.floor(Math.random() * 2)) * Math.PI * 2;
    const startRot = currentRot;
    const endRot = startRot + extraTurns + delta;

    if (prefersReduced) {
      rotationRef.current = endRot;
      drawWheel(endRot, pool, targetStudent.id);
      onSpinCompleteRef.current(targetStudent);
      return;
    }

    isAnimatingRef.current = true;
    const duration = 3600;
    const startTime = performance.now();
    let lastSliceCrossed = Math.floor((startRot + Math.PI / 2) / sliceAngle);
    let rafId = 0;
    const snapshotPool = [...pool];

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Quintic ease-out for crisp realistic wheel deceleration
      const eased = 1 - Math.pow(1 - t, 4.2);
      const current = startRot + (endRot - startRot) * eased;
      rotationRef.current = current;

      // Play tick whenever pointer crosses a slice boundary
      const currentSliceCrossed = Math.floor((current + Math.PI / 2) / sliceAngle);
      if (currentSliceCrossed !== lastSliceCrossed) {
        lastSliceCrossed = currentSliceCrossed;
        soundEngine.playTick(t);
      }

      drawWheel(current, snapshotPool, t >= 1 ? targetStudent.id : null);

      if (t < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        isAnimatingRef.current = false;
        onSpinCompleteRef.current(targetStudent);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafId);
      isAnimatingRef.current = false;
    };
  }, [spinTrigger]);

  return (
    <div className="relative inline-flex items-center justify-center select-none">
      {/* Top Pointer */}
      <div
        aria-hidden="true"
        className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center"
      >
        <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
          <path
            d="M14 30L3 6C2.3 4.5 3.4 2.8 5 2.8H23C24.6 2.8 25.7 4.5 25 6L14 30Z"
            fill="#0F172A"
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
        </svg>
      </div>

      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="max-w-full h-auto block"
      />
    </div>
  );
};
