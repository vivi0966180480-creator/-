import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type {
  ActiveTab,
  DrawRecord,
  RemainderStrategy,
  SoundTheme,
  Student,
  StudentGroup,
} from './types';
import { createSampleRoster } from './data/sampleRoster';
import { RosterManager } from './components/RosterManager';
import { RandomPicker } from './components/RandomPicker';
import { VisualGrouping } from './components/VisualGrouping';

const STORAGE_KEY = 'classroom_toolkit_v1';

interface PersistedState {
  students: Student[];
  allowRepeat: boolean;
  drawHistory: DrawRecord[];
  groups: StudentGroup[];
  groupSize: number;
  remainderStrategy: RemainderStrategy;
  soundTheme: SoundTheme;
  soundVolume: number;
}

function loadInitialState(): PersistedState {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if (Array.isArray(parsed.students)) {
          return {
            students: parsed.students,
            allowRepeat: parsed.allowRepeat ?? false,
            drawHistory: Array.isArray(parsed.drawHistory) ? parsed.drawHistory : [],
            groups: Array.isArray(parsed.groups) ? parsed.groups : [],
            groupSize: typeof parsed.groupSize === 'number' ? parsed.groupSize : 4,
            remainderStrategy: parsed.remainderStrategy ?? 'distribute',
            soundTheme: parsed.soundTheme ?? 'marimba',
            soundVolume: typeof parsed.soundVolume === 'number' ? parsed.soundVolume : 0.7,
          };
        }
      }
    } catch {
      // Ignore malformed storage
    }
  }

  return {
    students: createSampleRoster(),
    allowRepeat: false,
    drawHistory: [],
    groups: [],
    groupSize: 4,
    remainderStrategy: 'distribute',
    soundTheme: 'marimba',
    soundVolume: 0.7,
  };
}

export default function App() {
  const [initial] = useState<PersistedState>(() => loadInitialState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('picker');
  const [students, setStudents] = useState<Student[]>(initial.students);
  const [allowRepeat, setAllowRepeat] = useState<boolean>(initial.allowRepeat);
  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>(initial.drawHistory);
  const [groups, setGroups] = useState<StudentGroup[]>(initial.groups);
  const [groupSize, setGroupSize] = useState<number>(initial.groupSize);
  const [remainderStrategy, setRemainderStrategy] = useState<RemainderStrategy>(
    initial.remainderStrategy
  );
  const [soundTheme, setSoundTheme] = useState<SoundTheme>(initial.soundTheme);
  const [soundVolume, setSoundVolume] = useState<number>(initial.soundVolume);
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  // Persist to localStorage
  useEffect(() => {
    try {
      const payload: PersistedState = {
        students,
        allowRepeat,
        drawHistory,
        groups,
        groupSize,
        remainderStrategy,
        soundTheme,
        soundVolume,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    students,
    allowRepeat,
    drawHistory,
    groups,
    groupSize,
    remainderStrategy,
    soundTheme,
    soundVolume,
  ]);

  const handleReplaceRoster = (next: Student[]) => {
    setStudents(next);
    setDrawHistory([]);
    setGroups([]);
  };

  const handleAppendRoster = (addedNames: string[]) => {
    setStudents((prev) => {
      const baseNo = prev.length;
      const appended: Student[] = addedNames.map((name, idx) => ({
        id: `stu-${baseNo + idx + 1}-${name}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        seatNo: baseNo + idx + 1,
      }));
      return [...prev, ...appended];
    });
  };

  const handleAddSingleStudent = (name: string) => {
    setStudents((prev) => [
      ...prev,
      {
        id: `stu-${prev.length + 1}-${name}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        seatNo: prev.length + 1,
      },
    ]);
  };

  const handleDeleteStudent = (id: string) => {
    setStudents((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, seatNo: idx + 1 }))
    );
    setDrawHistory((prev) => prev.filter((r) => r.student.id !== id));
    setGroups((prev) =>
      prev
        .map((g) => ({
          ...g,
          members: g.members.filter((m) => m.id !== id),
        }))
        .filter((g) => g.members.length > 0)
    );
  };

  const handleRemoveDuplicates = (): number => {
    const seen = new Set<string>();
    let removed = 0;
    const deduped: Student[] = [];
    for (const s of students) {
      if (seen.has(s.name)) {
        removed++;
      } else {
        seen.add(s.name);
        deduped.push({ ...s, seatNo: deduped.length + 1 });
      }
    }
    if (removed > 0) {
      setStudents(deduped);
      setDrawHistory([]);
      setGroups([]);
    }
    return removed;
  };

  const handleRecordDraw = (student: Student) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    setDrawHistory((prev) => [
      {
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        student,
        timestamp,
        drawNumber: prev.length + 1,
      },
      ...prev,
    ]);
  };

  const handleRemoveHistoryRecord = (recordId: string) => {
    setDrawHistory((prev) => prev.filter((r) => r.id !== recordId));
  };

  const handleResetHistory = () => {
    setDrawHistory([]);
  };

  const togglePresentationMode = () => {
    setIsPresentationMode((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        if (next && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (!next && document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  };

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'roster', label: '名單管理' },
    { id: 'picker', label: '隨機抽籤' },
    { id: 'grouping', label: '自動分組' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('picker')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            班級抽籤與分組
          </button>

          {/* Zone 2: Clean Single-Line Navigation Links */}
          <nav
            aria-label="主要功能導覽"
            className="flex items-center gap-6 sm:gap-8 overflow-x-auto"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#0284C7]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0284C7]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={togglePresentationMode}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {isPresentationMode ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">退出投影</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">投影模式</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main
        className={`flex-1 w-full mx-auto px-4 sm:px-6 ${
          isPresentationMode
            ? 'max-w-[1440px] py-6'
            : 'max-w-[1280px] py-8'
        }`}
      >
        {activeTab === 'roster' && (
          <RosterManager
            students={students}
            onReplaceRoster={handleReplaceRoster}
            onAppendRoster={handleAppendRoster}
            onDeleteStudent={handleDeleteStudent}
            onAddSingleStudent={handleAddSingleStudent}
            onRemoveDuplicates={handleRemoveDuplicates}
            onNavigateToPicker={() => setActiveTab('picker')}
            onNavigateToGrouping={() => setActiveTab('grouping')}
          />
        )}

        {activeTab === 'picker' && (
          <RandomPicker
            students={students}
            allowRepeat={allowRepeat}
            onAllowRepeatChange={setAllowRepeat}
            history={drawHistory}
            onRecordDraw={handleRecordDraw}
            onRemoveHistoryRecord={handleRemoveHistoryRecord}
            onResetHistory={handleResetHistory}
            soundTheme={soundTheme}
            onSoundThemeChange={setSoundTheme}
            soundVolume={soundVolume}
            onSoundVolumeChange={setSoundVolume}
            isPresentationMode={isPresentationMode}
            onNavigateToRoster={() => setActiveTab('roster')}
            onLoadSimulatedRoster={() => handleReplaceRoster(createSampleRoster())}
          />
        )}

        {activeTab === 'grouping' && (
          <VisualGrouping
            students={students}
            groups={groups}
            onGroupsChange={setGroups}
            groupSize={groupSize}
            onGroupSizeChange={setGroupSize}
            remainderStrategy={remainderStrategy}
            onRemainderStrategyChange={setRemainderStrategy}
            isPresentationMode={isPresentationMode}
            onNavigateToRoster={() => setActiveTab('roster')}
            onLoadSimulatedRoster={() => handleReplaceRoster(createSampleRoster())}
          />
        )}
      </main>

      {/* Quiet Minimal Footer */}
      {!isPresentationMode && (
        <footer className="border-t border-slate-200 bg-white">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>班級抽籤與分組 · 所有名單資料僅儲存在您的瀏覽器本機，不會上傳至任何伺服器</span>
            <span className="font-mono tabular-nums">
              目前名單：{students.length} 位學生
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}
