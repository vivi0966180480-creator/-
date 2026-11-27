import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Disc3,
  Layers,
  Undo2,
  Users,
  Sparkles,
} from 'lucide-react';
import type { DrawRecord, DrawVisualMode, SoundTheme, Student } from '../types';
import { soundEngine } from '../utils/soundEngine';
import { ConfettiCanvas } from './ConfettiCanvas';
import { SlotReelStage } from './SlotReelStage';
import { SpinningWheel } from './SpinningWheel';

interface RandomPickerProps {
  students: Student[];
  allowRepeat: boolean;
  onAllowRepeatChange: (allow: boolean) => void;
  history: DrawRecord[];
  onRecordDraw: (student: Student) => void;
  onRemoveHistoryRecord: (recordId: string) => void;
  onResetHistory: () => void;
  soundTheme: SoundTheme;
  onSoundThemeChange: (theme: SoundTheme) => void;
  soundVolume: number;
  onSoundVolumeChange: (volume: number) => void;
  isPresentationMode: boolean;
  onNavigateToRoster: () => void;
  onLoadSimulatedRoster: () => void;
}

export const RandomPicker: React.FC<RandomPickerProps> = ({
  students,
  allowRepeat,
  onAllowRepeatChange,
  history,
  onRecordDraw,
  onRemoveHistoryRecord,
  onResetHistory,
  soundTheme,
  onSoundThemeChange,
  soundVolume,
  onSoundVolumeChange,
  isPresentationMode,
  onNavigateToRoster,
  onLoadSimulatedRoster,
}) => {
  const [visualMode, setVisualMode] = useState<DrawVisualMode>('reel');
  const [isDrawing, setIsDrawing] = useState(false);
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [pendingTarget, setPendingTarget] = useState<Student | null>(null);
  const [spinPoolSnapshot, setSpinPoolSnapshot] = useState<Student[] | null>(null);
  const [latestWinner, setLatestWinner] = useState<Student | null>(
    history.length > 0 ? history[0].student : null
  );
  const [confettiKey, setConfettiKey] = useState(0);

  // Sync audio engine preferences
  useEffect(() => {
    soundEngine.setTheme(soundTheme);
    soundEngine.setVolume(soundVolume);
  }, [soundTheme, soundVolume]);

  // Clear latestWinner if history is reset
  useEffect(() => {
    if (history.length === 0) {
      setLatestWinner(null);
    }
  }, [history.length]);

  const drawnIds = useMemo(() => new Set(history.map((h) => h.student.id)), [history]);

  const eligiblePool = useMemo(() => {
    if (allowRepeat) return students;
    return students.filter((s) => !drawnIds.has(s.id));
  }, [students, allowRepeat, drawnIds]);

  const activeStagePool = isDrawing && spinPoolSnapshot ? spinPoolSnapshot : eligiblePool;

  const isPoolExhausted = students.length > 0 && !allowRepeat && eligiblePool.length === 0;

  const startDraw = useCallback(() => {
    if (isDrawing || eligiblePool.length === 0) return;

    const chosen = eligiblePool[Math.floor(Math.random() * eligiblePool.length)];
    setSpinPoolSnapshot([...eligiblePool]);
    setPendingTarget(chosen);
    setIsDrawing(true);
    setSpinTrigger((prev) => prev + 1);
  }, [isDrawing, eligiblePool]);

  const handleSpinComplete = useCallback(
    (winner: Student) => {
      setIsDrawing(false);
      setSpinPoolSnapshot(null);
      setLatestWinner(winner);
      onRecordDraw(winner);
      soundEngine.playWinnerFanfare();
      setConfettiKey((prev) => prev + 1);
    },
    [onRecordDraw]
  );

  // Keyboard shortcut: Spacebar to draw
  const startDrawRef = useRef(startDraw);
  startDrawRef.current = startDraw;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') {
        return;
      }
      e.preventDefault();
      startDrawRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (students.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-20 px-6 text-center">
        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">尚未建立學生名單</h2>
        <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
          請先前往「名單管理」上傳 CSV 檔案或貼上學生姓名，或一鍵載入模擬名單立即體驗抽籤功能。
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onNavigateToRoster}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap"
          >
            前往匯入名單
          </button>
          <button
            type="button"
            onClick={onLoadSimulatedRoster}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-[#0284C7]" />
            載入 24 人模擬名單
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Row (hidden in presentation mode for max stage visibility) */}
      {!isPresentationMode && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-balance">
              課堂隨機抽籤
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 tabular-nums">
              <span>全班 {students.length} 人</span>
              <span aria-hidden="true">·</span>
              <span>
                {allowRepeat
                  ? '允許重複抽取'
                  : `剩餘未抽 ${eligiblePool.length} / ${students.length} 人`}
              </span>
              <span aria-hidden="true">·</span>
              <span>累計已抽 {history.length} 次</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onNavigateToRoster}
                className="font-medium text-[#0284C7] hover:text-[#0369A1] hover:underline"
              >
                上傳 CSV / 編輯名單
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two-Zone Sandbox Layout */}
      <div
        className={`grid grid-cols-1 gap-6 items-start ${
          isPresentationMode ? 'lg:grid-cols-12' : 'lg:grid-cols-12'
        }`}
      >
        {/* Left Zone: Interactive Draw Stage */}
        <section
          className={`relative bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between overflow-hidden ${
            isPresentationMode ? 'lg:col-span-9 min-h-[560px]' : 'lg:col-span-8 min-h-[520px]'
          }`}
        >
          <ConfettiCanvas burstKey={confettiKey} />

          {/* Stage Toolbar */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
              role="tablist"
              aria-label="抽籤動畫樣式"
            >
              <button
                type="button"
                role="tab"
                aria-selected={visualMode === 'reel'}
                disabled={isDrawing}
                onClick={() => setVisualMode('reel')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${
                  visualMode === 'reel'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                高速滾輪
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={visualMode === 'wheel'}
                disabled={isDrawing}
                onClick={() => setVisualMode('wheel')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${
                  visualMode === 'wheel'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Disc3 className="w-3.5 h-3.5" />
                幸運轉盤
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
              <span>
                模式：{allowRepeat ? '可重複抽取' : '不重複抽取'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                候選池 {eligiblePool.length} 人
              </span>
            </div>
          </div>

          {/* Stage Center Canvas / Reel */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-6">
            {isPoolExhausted && !isDrawing ? (
              <div className="text-center max-w-md py-8 space-y-4">
                <p className="text-xs font-medium text-amber-700">
                  不重複模式 · 全班皆已抽出
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  所有 {students.length} 位同學都已輪流抽過了
                </h2>
                <p className="text-sm text-slate-600">
                  您可以重新放回全部名單開始新一輪，或切換為「允許重複抽取」。
                </p>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onResetHistory}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-4 h-4" />
                    重新放回全部名單
                  </button>
                </div>
              </div>
            ) : visualMode === 'reel' ? (
              <SlotReelStage
                pool={activeStagePool}
                spinTrigger={spinTrigger}
                targetStudent={pendingTarget}
                latestWinner={latestWinner}
                isDrawing={isDrawing}
                onSpinComplete={handleSpinComplete}
                isPresentationMode={isPresentationMode}
              />
            ) : (
              <div className="flex flex-col items-center gap-5 w-full">
                <SpinningWheel
                  pool={activeStagePool}
                  spinTrigger={spinTrigger}
                  targetStudent={pendingTarget}
                  onSpinComplete={handleSpinComplete}
                  size={isPresentationMode ? 430 : 350}
                />
                {!isDrawing && latestWinner && (
                  <div className="text-center">
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      本次抽出 · 座號 {String(latestWinner.seatNo).padStart(2, '0')}
                    </p>
                    <p className="mt-0.5 text-3xl font-bold text-[#0284C7]">
                      {latestWinner.name}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Primary Draw Action Bar */}
          <div className="relative z-10 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              小技巧：按鍵盤空白鍵（Space）也能快速抽出下一位同學
            </span>

            <div className="flex items-center gap-2.5 shrink-0">
              {history.length > 0 && !isDrawing && (
                <button
                  type="button"
                  onClick={onResetHistory}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置池子
                </button>
              )}

              <button
                type="button"
                onClick={startDraw}
                disabled={isDrawing || isPoolExhausted}
                className="inline-flex items-center justify-center gap-2 min-w-[164px] px-6 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                {isDrawing ? '抽籤中...' : '開始隨機抽籤'}
              </button>
            </div>
          </div>
        </section>

        {/* Right Zone: Control & History Deck */}
        <aside
          className={`space-y-5 ${
            isPresentationMode ? 'lg:col-span-3' : 'lg:col-span-4'
          }`}
        >
          {/* Settings Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">抽籤規則</h2>
              <div
                className="mt-2.5 grid grid-cols-2 p-1 bg-slate-100 rounded-lg"
                role="radiogroup"
                aria-label="重複抽取設定"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={!allowRepeat}
                  disabled={isDrawing}
                  onClick={() => onAllowRepeatChange(false)}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap disabled:opacity-60 ${
                    !allowRepeat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  不可重複抽取
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={allowRepeat}
                  disabled={isDrawing}
                  onClick={() => onAllowRepeatChange(true)}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap disabled:opacity-60 ${
                    allowRepeat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  允許重複抽取
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                {allowRepeat
                  ? '每次皆從全班名單中隨機抽取，同一位同學可能再次被抽中。'
                  : '抽中的同學將暫時移出候選池，確保全班每位同學都有機會被抽到。'}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">音效設定</h2>
                <button
                  type="button"
                  onClick={() => soundEngine.playWinnerFanfare()}
                  disabled={soundTheme === 'mute'}
                  className="text-xs font-medium text-[#0284C7] hover:text-[#0369A1] disabled:text-slate-400 whitespace-nowrap"
                >
                  試聽音效
                </button>
              </div>

              <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'marimba', label: '清脆木琴' },
                    { id: 'chime', label: '柔和鈴聲' },
                    { id: 'mute', label: '靜音' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSoundThemeChange(item.id)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      soundTheme === item.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    {soundTheme === 'mute' || soundVolume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    音量大小
                  </span>
                  <span className="font-mono tabular-nums text-slate-800">
                    {soundTheme === 'mute' ? '0%' : `${Math.round(soundVolume * 100)}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  disabled={soundTheme === 'mute'}
                  value={Math.round(soundVolume * 100)}
                  onChange={(e) => onSoundVolumeChange(Number(e.target.value) / 100)}
                  aria-label="音效音量"
                  className="w-full accent-[#0284C7] disabled:opacity-40"
                />
              </div>
            </div>
          </div>

          {/* Draw History Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">抽出紀錄</h2>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  ({history.length})
                </span>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={onResetHistory}
                  disabled={isDrawing}
                  className="text-xs text-slate-500 hover:text-slate-800 disabled:opacity-40 whitespace-nowrap"
                >
                  清除紀錄
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                尚未有抽籤紀錄，點擊「開始隨機抽籤」後結果將顯示於此。
              </p>
            ) : (
              <ol className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto pr-1">
                {history.map((record) => (
                  <li
                    key={record.id}
                    className="py-2.5 flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs text-slate-400 tabular-nums w-7 shrink-0">
                        #{String(record.drawNumber).padStart(2, '0')}
                      </span>
                      <span className="font-medium text-slate-900 truncate">
                        {record.student.name}
                      </span>
                      <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                        {String(record.student.seatNo).padStart(2, '0')}號
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-xs text-slate-400 tabular-nums">
                        {record.timestamp}
                      </span>
                      {!allowRepeat && (
                        <button
                          type="button"
                          onClick={() => onRemoveHistoryRecord(record.id)}
                          disabled={isDrawing}
                          title="將此學生放回候選池"
                          aria-label={`將 ${record.student.name} 放回候選池`}
                          className="p-1 text-slate-400 hover:text-[#0284C7] rounded transition-colors disabled:opacity-40"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
