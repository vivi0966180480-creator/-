import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Shuffle,
  Download,
  Copy,
  Check,
  Minus,
  Plus,
  LayoutGrid,
  CircleDot,
  Users,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react';
import type {
  GroupVisualMode,
  RemainderStrategy,
  Student,
  StudentGroup,
} from '../types';
import { exportGroupsToCsv } from '../utils/csvParser';
import { soundEngine } from '../utils/soundEngine';

interface VisualGroupingProps {
  students: Student[];
  groups: StudentGroup[];
  onGroupsChange: (groups: StudentGroup[]) => void;
  groupSize: number;
  onGroupSizeChange: (size: number) => void;
  remainderStrategy: RemainderStrategy;
  onRemainderStrategyChange: (strategy: RemainderStrategy) => void;
  isPresentationMode: boolean;
  onNavigateToRoster: () => void;
  onLoadSimulatedRoster: () => void;
}

const GROUP_THEMES = [
  {
    surface: 'bg-sky-50/75',
    border: 'border-sky-200',
    tableBg: 'bg-sky-600',
    tableRing: 'ring-sky-100',
    titleText: 'text-sky-950',
    seatHover: 'hover:border-sky-400',
  },
  {
    surface: 'bg-emerald-50/75',
    border: 'border-emerald-200',
    tableBg: 'bg-emerald-600',
    tableRing: 'ring-emerald-100',
    titleText: 'text-emerald-950',
    seatHover: 'hover:border-emerald-400',
  },
  {
    surface: 'bg-amber-50/75',
    border: 'border-amber-200',
    tableBg: 'bg-amber-600',
    tableRing: 'ring-amber-100',
    titleText: 'text-amber-950',
    seatHover: 'hover:border-amber-400',
  },
  {
    surface: 'bg-indigo-50/75',
    border: 'border-indigo-200',
    tableBg: 'bg-indigo-600',
    tableRing: 'ring-indigo-100',
    titleText: 'text-indigo-950',
    seatHover: 'hover:border-indigo-400',
  },
  {
    surface: 'bg-rose-50/75',
    border: 'border-rose-200',
    tableBg: 'bg-rose-600',
    tableRing: 'ring-rose-100',
    titleText: 'text-rose-950',
    seatHover: 'hover:border-rose-400',
  },
  {
    surface: 'bg-teal-50/75',
    border: 'border-teal-200',
    tableBg: 'bg-teal-600',
    tableRing: 'ring-teal-100',
    titleText: 'text-teal-950',
    seatHover: 'hover:border-teal-400',
  },
  {
    surface: 'bg-violet-50/75',
    border: 'border-violet-200',
    tableBg: 'bg-violet-600',
    tableRing: 'ring-violet-100',
    titleText: 'text-violet-950',
    seatHover: 'hover:border-violet-400',
  },
  {
    surface: 'bg-slate-100/80',
    border: 'border-slate-300',
    tableBg: 'bg-slate-700',
    tableRing: 'ring-slate-200',
    titleText: 'text-slate-900',
    seatHover: 'hover:border-slate-400',
  },
];

function fisherYatesShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateStudentGroups(
  students: Student[],
  groupSize: number,
  strategy: RemainderStrategy
): StudentGroup[] {
  if (students.length === 0) return [];
  const safeSize = Math.max(2, Math.min(groupSize, students.length));
  const shuffled = fisherYatesShuffle(students);

  let buckets: Student[][] = [];

  if (strategy === 'separate' || shuffled.length <= safeSize) {
    for (let i = 0; i < shuffled.length; i += safeSize) {
      buckets.push(shuffled.slice(i, i + safeSize));
    }
  } else {
    const fullGroups = Math.floor(shuffled.length / safeSize);
    const remainder = shuffled.length % safeSize;

    if (remainder === 0) {
      for (let i = 0; i < fullGroups; i++) {
        buckets.push(shuffled.slice(i * safeSize, (i + 1) * safeSize));
      }
    } else if (remainder >= Math.ceil(safeSize / 2)) {
      // Create fullGroups + 1 balanced groups so sizes differ by at most 1
      const groupCount = fullGroups + 1;
      buckets = Array.from({ length: groupCount }, () => []);
      shuffled.forEach((stu, idx) => {
        buckets[idx % groupCount].push(stu);
      });
    } else {
      // Distribute the few remaining students into the existing fullGroups
      buckets = Array.from({ length: fullGroups }, () => []);
      shuffled.forEach((stu, idx) => {
        buckets[idx % fullGroups].push(stu);
      });
    }
  }

  return buckets.map((members, idx) => ({
    id: `group-${idx + 1}-${Date.now()}`,
    name: `第 ${idx + 1} 組`,
    colorIndex: idx % GROUP_THEMES.length,
    members,
  }));
}

interface SwapSelection {
  groupId: string;
  studentId: string;
  studentName: string;
  groupName: string;
}

export const VisualGrouping: React.FC<VisualGroupingProps> = ({
  students,
  groups,
  onGroupsChange,
  groupSize,
  onGroupSizeChange,
  remainderStrategy,
  onRemainderStrategyChange,
  isPresentationMode,
  onNavigateToRoster,
  onLoadSimulatedRoster,
}) => {
  const [visualMode, setVisualMode] = useState<GroupVisualMode>('tables');
  const [shuffleKey, setShuffleKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloadedCsv, setDownloadedCsv] = useState(false);
  const [selectedForSwap, setSelectedForSwap] = useState<SwapSelection | null>(null);

  const maxGroupSize = Math.max(2, Math.min(12, students.length));
  const clampedGroupSize = Math.max(2, Math.min(groupSize, maxGroupSize));

  const previewSummary = useMemo(() => {
    if (students.length === 0) return '';
    const total = students.length;
    if (total <= clampedGroupSize) {
      return `預計分成 1 組（${total} 人）`;
    }
    const full = Math.floor(total / clampedGroupSize);
    const rem = total % clampedGroupSize;
    if (rem === 0) {
      return `預計分成 ${full} 組，每組 ${clampedGroupSize} 人`;
    }
    if (remainderStrategy === 'separate') {
      return `預計分成 ${full + 1} 組（${full} 組 ${clampedGroupSize} 人、1 組 ${rem} 人）`;
    }
    const groupCount = rem >= Math.ceil(clampedGroupSize / 2) ? full + 1 : full;
    const base = Math.floor(total / groupCount);
    const extra = total % groupCount;
    return `預計分成 ${groupCount} 組（每組 ${base}–${extra > 0 ? base + 1 : base} 人平均分配）`;
  }, [students.length, clampedGroupSize, remainderStrategy]);

  const handleGenerate = () => {
    const nextGroups = generateStudentGroups(students, clampedGroupSize, remainderStrategy);
    onGroupsChange(nextGroups);
    setSelectedForSwap(null);
    setShuffleKey((prev) => prev + 1);
    soundEngine.playGroupShuffle();
  };

  const handleStudentClick = (group: StudentGroup, student: Student) => {
    if (!selectedForSwap) {
      setSelectedForSwap({
        groupId: group.id,
        studentId: student.id,
        studentName: student.name,
        groupName: group.name,
      });
      return;
    }

    if (selectedForSwap.studentId === student.id && selectedForSwap.groupId === group.id) {
      setSelectedForSwap(null);
      return;
    }

    // Perform swap between selectedForSwap and clicked student
    const nextGroups = groups.map((g) => ({
      ...g,
      members: [...g.members],
    }));

    const sourceGroup = nextGroups.find((g) => g.id === selectedForSwap.groupId);
    const targetGroup = nextGroups.find((g) => g.id === group.id);
    if (!sourceGroup || !targetGroup) {
      setSelectedForSwap(null);
      return;
    }

    const sourceIdx = sourceGroup.members.findIndex((m) => m.id === selectedForSwap.studentId);
    const targetIdx = targetGroup.members.findIndex((m) => m.id === student.id);
    if (sourceIdx === -1 || targetIdx === -1) {
      setSelectedForSwap(null);
      return;
    }

    const temp = sourceGroup.members[sourceIdx];
    sourceGroup.members[sourceIdx] = targetGroup.members[targetIdx];
    targetGroup.members[targetIdx] = temp;

    onGroupsChange(nextGroups);
    setSelectedForSwap(null);
    soundEngine.playSwapPop();
  };

  const handleRenameGroup = (groupId: string, newName: string) => {
    onGroupsChange(
      groups.map((g) => (g.id === groupId ? { ...g, name: newName } : g))
    );
  };

  const handleCopyText = async () => {
    if (groups.length === 0) return;
    const text = groups
      .map(
        (g) =>
          `${g.name}（${g.members.length}人）：${g.members.map((m) => m.name).join('、')}`
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleDownloadCsv = () => {
    if (groups.length === 0) return;
    exportGroupsToCsv(groups);
    setDownloadedCsv(true);
    window.setTimeout(() => setDownloadedCsv(false), 2400);
  };

  if (students.length < 2) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-20 px-6 text-center">
        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">需要至少 2 位學生才能分組</h2>
        <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
          請先前往「名單管理」上傳 CSV 或貼上班級名單，或一鍵載入模擬名單立即體驗視覺化分組。
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
      {/* Page Intro */}
      {!isPresentationMode && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-balance">
              自動分組與座位視覺化
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 tabular-nums">
              <span>全班 {students.length} 人</span>
              <span aria-hidden="true">·</span>
              <span>{previewSummary}</span>
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

      {/* Control Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          {/* Left: Group size & remainder settings */}
          <div className="flex flex-wrap items-center gap-6">
            {/* Group Size Control */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                每組人數
              </span>
              <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
                <button
                  type="button"
                  onClick={() => onGroupSizeChange(Math.max(2, clampedGroupSize - 1))}
                  disabled={clampedGroupSize <= 2}
                  aria-label="減少每組人數"
                  className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-35 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {clampedGroupSize} 人
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onGroupSizeChange(Math.min(maxGroupSize, clampedGroupSize + 1))
                  }
                  disabled={clampedGroupSize >= maxGroupSize}
                  aria-label="增加每組人數"
                  className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-35 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <input
                type="range"
                min={2}
                max={maxGroupSize}
                value={clampedGroupSize}
                onChange={(e) => onGroupSizeChange(Number(e.target.value))}
                aria-label="滑桿調整每組人數"
                className="hidden sm:block w-28 accent-[#0284C7]"
              />
            </div>

            {/* Remainder Strategy */}
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                餘數處理
              </span>
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => onRemainderStrategyChange('distribute')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    remainderStrategy === 'distribute'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  平均分配
                </button>
                <button
                  type="button"
                  onClick={() => onRemainderStrategyChange('separate')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    remainderStrategy === 'separate'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  獨立成組
                </button>
              </div>
            </div>
          </div>

          {/* Right: Actions & Visual Mode */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Visual Mode Switch */}
            <div
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
              role="tablist"
              aria-label="分組視覺顯示模式"
            >
              <button
                type="button"
                role="tab"
                aria-selected={visualMode === 'tables'}
                onClick={() => setVisualMode('tables')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  visualMode === 'tables'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CircleDot className="w-3.5 h-3.5" />
                圓桌視覺圖
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={visualMode === 'cards'}
                onClick={() => setVisualMode('cards')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  visualMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                分組卡片牆
              </button>
            </div>

            {groups.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      已複製
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      複製文字
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0369A1] bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {downloadedCsv ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      已下載 CSV
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      下載 CSV 檔案
                    </>
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Shuffle className="w-4 h-4" />
              {groups.length > 0 ? '重新隨機分組' : '開始自動分組'}
            </button>
          </div>
        </div>

        {/* Interactive Swap Helper Bar */}
        {groups.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {selectedForSwap ? (
                <span className="text-[#0369A1] font-medium">
                  已選取「{selectedForSwap.studentName}」（{selectedForSwap.groupName}）— 請點擊另一位學生進行組別互換
                </span>
              ) : (
                <span>
                  手動微調：點擊任意兩位學生姓名即可直接互換組別；點擊組名可自訂名稱
                </span>
              )}
            </div>

            {selectedForSwap ? (
              <button
                type="button"
                onClick={() => setSelectedForSwap(null)}
                className="text-slate-500 hover:text-slate-900 font-medium whitespace-nowrap"
              >
                取消選取
              </button>
            ) : (
              <span className="font-mono tabular-nums text-slate-500">
                共 {groups.length} 組 · {groups.reduce((acc, g) => acc + g.members.length, 0)} 人
              </span>
            )}
          </div>
        )}
      </section>

      {/* Grouping Visualization Area */}
      {groups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 px-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center mx-auto">
            <Shuffle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">準備好進行班級分組</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            目前共有 {students.length} 位學生，設定為每組 {clampedGroupSize} 人（{previewSummary}）。點擊上方「開始自動分組」即可產生視覺化分組圖。
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap"
            >
              <Shuffle className="w-4 h-4" />
              開始自動分組
            </button>
          </div>
        </div>
      ) : visualMode === 'tables' ? (
        /* Visual Classroom Round Table Cluster Diagram */
        <div
          key={`tables-${shuffleKey}`}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          {groups.map((group, groupIdx) => {
            const theme = GROUP_THEMES[group.colorIndex % GROUP_THEMES.length];
            const count = group.members.length;
            // Adaptive radial radius based on member count so seats never overlap
            const orbitRadius = count <= 4 ? 104 : count <= 6 ? 114 : 124;

            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.28,
                  delay: Math.min(groupIdx * 0.045, 0.36),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={`rounded-2xl border p-5 flex flex-col items-center ${theme.surface} ${theme.border}`}
              >
                {/* Editable Group Title Header */}
                <div className="w-full flex items-center justify-between gap-2 mb-2">
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => handleRenameGroup(group.id, e.target.value)}
                    aria-label={`組別 ${groupIdx + 1} 名稱`}
                    className={`bg-transparent font-semibold text-base focus:bg-white focus:px-2 py-0.5 rounded transition-all w-40 ${theme.titleText}`}
                  />
                  <span className="font-mono text-xs text-slate-600 tabular-nums shrink-0">
                    {group.members.length} 人
                  </span>
                </div>

                {/* Radial Table Cluster Canvas */}
                <div className="relative w-full h-[300px] flex items-center justify-center">
                  {/* Connector lines SVG */}
                  <svg
                    aria-hidden="true"
                    viewBox="-160 -150 320 300"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  >
                    <circle
                      cx="0"
                      cy="0"
                      r={orbitRadius}
                      fill="none"
                      stroke="rgba(15, 23, 42, 0.08)"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    {group.members.map((m, idx) => {
                      const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
                      const x = Math.cos(angle) * orbitRadius;
                      const y = Math.sin(angle) * orbitRadius;
                      return (
                        <line
                          key={m.id}
                          x1="0"
                          y1="0"
                          x2={x}
                          y2={y}
                          stroke="rgba(15, 23, 42, 0.1)"
                          strokeWidth="1.5"
                        />
                      );
                    })}
                  </svg>

                  {/* Center Classroom Table */}
                  <div
                    className={`relative z-10 w-24 h-24 rounded-full ${theme.tableBg} ring-8 ${theme.tableRing} flex flex-col items-center justify-center text-white select-none`}
                  >
                    <span className="text-xs opacity-85 font-mono tabular-nums">
                      GROUP {String(groupIdx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-lg font-bold leading-tight mt-0.5 tabular-nums">
                      {group.members.length} 人
                    </span>
                  </div>

                  {/* Seated Student Nodes around the Table */}
                  {group.members.map((member, idx) => {
                    const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
                    const x = Math.cos(angle) * orbitRadius;
                    const y = Math.sin(angle) * orbitRadius;
                    const isSelected =
                      selectedForSwap?.studentId === member.id &&
                      selectedForSwap?.groupId === group.id;

                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleStudentClick(group, member)}
                        style={{
                          transform: `translate(${x}px, ${y}px)`,
                        }}
                        className={`absolute z-20 px-3 py-1.5 rounded-lg border text-center transition-all min-w-[78px] max-w-[116px] ${
                          isSelected
                            ? 'bg-[#0284C7] text-white border-[#0284C7] ring-4 ring-sky-200 scale-105'
                            : `bg-white text-slate-900 border-slate-200 ${theme.seatHover} shadow-2xs`
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={`font-mono text-[11px] tabular-nums shrink-0 ${
                              isSelected ? 'text-sky-100' : 'text-slate-400'
                            }`}
                          >
                            {String(member.seatNo).padStart(2, '0')}
                          </span>
                          <span className="text-sm font-semibold truncate">
                            {member.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Structured Card Wall View */
        <div
          key={`cards-${shuffleKey}`}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {groups.map((group, groupIdx) => {
            const theme = GROUP_THEMES[group.colorIndex % GROUP_THEMES.length];
            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.24,
                  delay: Math.min(groupIdx * 0.04, 0.32),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                <div
                  className={`px-4 py-3 border-b ${theme.surface} ${theme.border} flex items-center justify-between gap-2`}
                >
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => handleRenameGroup(group.id, e.target.value)}
                    aria-label={`組別 ${groupIdx + 1} 名稱`}
                    className={`bg-transparent font-semibold text-sm focus:bg-white focus:px-1.5 py-0.5 rounded w-36 ${theme.titleText}`}
                  />
                  <span className="font-mono text-xs text-slate-600 tabular-nums shrink-0">
                    {group.members.length} 人
                  </span>
                </div>

                <ul className="p-3 space-y-1.5 flex-1">
                  {group.members.map((member, memberIdx) => {
                    const isSelected =
                      selectedForSwap?.studentId === member.id &&
                      selectedForSwap?.groupId === group.id;
                    return (
                      <li key={member.id}>
                        <button
                          type="button"
                          onClick={() => handleStudentClick(group, member)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                            isSelected
                              ? 'bg-[#0284C7] text-white'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`font-mono text-xs tabular-nums shrink-0 w-5 ${
                                isSelected ? 'text-sky-100' : 'text-slate-400'
                              }`}
                            >
                              {memberIdx + 1}.
                            </span>
                            <span className="text-sm font-medium truncate">
                              {member.name}
                            </span>
                          </div>
                          <span
                            className={`font-mono text-xs tabular-nums shrink-0 ${
                              isSelected ? 'text-sky-100' : 'text-slate-400'
                            }`}
                          >
                            {String(member.seatNo).padStart(2, '0')}號
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
