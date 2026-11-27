import React, { useMemo, useRef, useState } from 'react';
import {
  Upload,
  ClipboardList,
  Plus,
  Trash2,
  Download,
  Users,
  Check,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  FileSpreadsheet,
  UserMinus,
} from 'lucide-react';
import type { ParsedCsvPreview, Student } from '../types';
import {
  buildCsvPreview,
  parsePastedNames,
  readFileTextSmart,
} from '../utils/csvParser';
import {
  createSimulatedRoster,
  createStudentsFromNames,
  type SimulatedRosterSize,
} from '../data/sampleRoster';

interface RosterManagerProps {
  students: Student[];
  onReplaceRoster: (next: Student[]) => void;
  onAppendRoster: (addedNames: string[]) => void;
  onDeleteStudent: (id: string) => void;
  onAddSingleStudent: (name: string) => void;
  onRemoveDuplicates: () => number;
  onNavigateToPicker: () => void;
  onNavigateToGrouping: () => void;
}

type ImportMode = 'paste' | 'csv';

interface PreviewNameItem {
  name: string;
  index: number;
  isDuplicateOccurrence: boolean;
  hasAnyDuplicate: boolean;
  occurrence: number;
}

function analyzePreviewNames(names: string[]): {
  items: PreviewNameItem[];
  duplicateCount: number;
  duplicateNameList: string[];
} {
  const totalCounts = new Map<string, number>();
  for (const name of names) {
    totalCounts.set(name, (totalCounts.get(name) ?? 0) + 1);
  }

  const seenCounts = new Map<string, number>();
  const duplicateNamesSet = new Set<string>();
  let duplicateCount = 0;

  const items: PreviewNameItem[] = names.map((name, index) => {
    const occurrence = (seenCounts.get(name) ?? 0) + 1;
    seenCounts.set(name, occurrence);
    const isDuplicateOccurrence = occurrence > 1;
    if (isDuplicateOccurrence) {
      duplicateCount++;
      duplicateNamesSet.add(name);
    }
    return {
      name,
      index,
      isDuplicateOccurrence,
      hasAnyDuplicate: (totalCounts.get(name) ?? 0) > 1,
      occurrence,
    };
  });

  return {
    items,
    duplicateCount,
    duplicateNameList: Array.from(duplicateNamesSet),
  };
}

export const RosterManager: React.FC<RosterManagerProps> = ({
  students,
  onReplaceRoster,
  onAppendRoster,
  onDeleteStudent,
  onAddSingleStudent,
  onRemoveDuplicates,
  onNavigateToPicker,
  onNavigateToGrouping,
}) => {
  const [importMode, setImportMode] = useState<ImportMode>('csv');
  const [pasteText, setPasteText] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [csvPreview, setCsvPreview] = useState<ParsedCsvPreview | null>(null);
  const [selectedCol, setSelectedCol] = useState(0);
  const [skipHeader, setSkipHeader] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 3600);
  };

  const handleFile = async (file: File) => {
    try {
      const text = await readFileTextSmart(file);
      const preview = buildCsvPreview(file.name, text);
      if (!preview) {
        showFeedback('error', '檔案內沒有讀取到有效的文字資料，請確認檔案格式。');
        return;
      }
      setCsvPreview(preview);
      setSelectedCol(preview.suggestedColumnIndex);
      setSkipHeader(preview.hasHeaderRow);
      setImportMode('csv');
    } catch {
      showFeedback('error', '無法讀取此檔案，請確認是否為 CSV 或純文字檔。');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const extractedCsvNames = useMemo(() => {
    if (!csvPreview) return [];
    const dataRows = skipHeader ? csvPreview.rows.slice(1) : csvPreview.rows;
    return dataRows
      .map((row) => (row[selectedCol] ?? '').trim())
      .filter((val) => val.length > 0);
  }, [csvPreview, selectedCol, skipHeader]);

  const parsedPasteNames = useMemo(() => parsePastedNames(pasteText), [pasteText]);

  const csvAnalysis = useMemo(
    () => analyzePreviewNames(extractedCsvNames),
    [extractedCsvNames]
  );

  const pasteAnalysis = useMemo(
    () => analyzePreviewNames(parsedPasteNames),
    [parsedPasteNames]
  );

  const activeRosterAnalysis = useMemo(
    () => analyzePreviewNames(students.map((s) => s.name)),
    [students]
  );

  const handleDeduplicateCsvPreview = () => {
    if (!csvPreview) return;
    const headerRow = skipHeader ? [csvPreview.rows[0]] : [];
    const dataRows = skipHeader ? csvPreview.rows.slice(1) : csvPreview.rows;
    const seen = new Set<string>();
    let removed = 0;

    const dedupedDataRows = dataRows.filter((row) => {
      const name = (row[selectedCol] ?? '').trim();
      if (!name) return false;
      if (seen.has(name)) {
        removed++;
        return false;
      }
      seen.add(name);
      return true;
    });

    setCsvPreview({
      ...csvPreview,
      rows: [...headerRow, ...dedupedDataRows],
    });
    if (removed > 0) {
      showFeedback('success', `已從 CSV 預覽名單中一次性移除 ${removed} 筆重複姓名。`);
    }
  };

  const handleDeduplicatePastePreview = () => {
    if (parsedPasteNames.length === 0) return;
    const seen = new Set<string>();
    const unique: string[] = [];
    let removed = 0;

    for (const name of parsedPasteNames) {
      if (seen.has(name)) {
        removed++;
      } else {
        seen.add(name);
        unique.push(name);
      }
    }

    setPasteText(unique.join('\n'));
    if (removed > 0) {
      showFeedback('success', `已從貼上預覽名單中一次性移除 ${removed} 筆重複姓名。`);
    }
  };

  const handleConfirmCsvImport = (mode: 'replace' | 'append') => {
    if (extractedCsvNames.length === 0) {
      showFeedback('error', '所選欄位沒有有效的學生姓名。');
      return;
    }
    if (mode === 'replace') {
      onReplaceRoster(createStudentsFromNames(extractedCsvNames));
      showFeedback('success', `已從 ${csvPreview?.fileName} 匯入 ${extractedCsvNames.length} 位學生。`);
    } else {
      onAppendRoster(extractedCsvNames);
      showFeedback('success', `已追加 ${extractedCsvNames.length} 位學生至現有名單。`);
    }
    setCsvPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmPasteImport = (mode: 'replace' | 'append') => {
    if (parsedPasteNames.length === 0) {
      showFeedback('error', '請先貼上至少一位學生姓名。');
      return;
    }
    if (mode === 'replace') {
      onReplaceRoster(createStudentsFromNames(parsedPasteNames));
      showFeedback('success', `已更新班級名單，共 ${parsedPasteNames.length} 位學生。`);
    } else {
      onAppendRoster(parsedPasteNames);
      showFeedback('success', `已追加 ${parsedPasteNames.length} 位學生至名單。`);
    }
    setPasteText('');
  };

  const handleLoadSimulatedRoster = (size: SimulatedRosterSize) => {
    onReplaceRoster(createSimulatedRoster(size));
    showFeedback('success', `已載入 ${size} 人模擬班級名單，您可直接體驗抽籤與自動分組功能。`);
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickAddName.trim();
    if (!trimmed) return;
    onAddSingleStudent(trimmed);
    setQuickAddName('');
    showFeedback('success', `已新增學生「${trimmed}」。`);
  };

  const handleDownloadSampleCsv = () => {
    const sampleLines = [
      '座號,姓名',
      '1,林子軒',
      '2,陳品妤',
      '3,張宇恩',
      '4,王宥希',
      '5,李承翰',
      '6,黃語彤',
      '7,吳柏叡',
      '8,蔡昀蓁',
      '9,劉彥廷',
      '10,許芷晴',
      '11,楊凱文',
      '12,鄭羽涵',
    ];
    const blob = new Blob(['\uFEFF' + sampleLines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '班級名單範例.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Intro Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-balance">
            班級名單管理
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            上傳 CSV 檔案、貼上學生姓名，或一鍵載入模擬名單，立即體驗「隨機抽籤」與「自動分組」。
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onNavigateToPicker}
            disabled={students.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            前往隨機抽籤
          </button>
          <button
            type="button"
            onClick={onNavigateToGrouping}
            disabled={students.length < 2}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            前往自動分組
          </button>
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-red-50/70 border-red-200 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Simulated Roster Quick-Start Strip */}
      <section className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="w-4 h-4 text-[#0284C7] shrink-0" />
            <span>快速體驗：模擬名單</span>
          </div>
          <p className="text-xs text-slate-600">
            手邊還沒有學生名單嗎？點選下方模擬班級規模，立即自動填入名單以熟悉抽籤與分組操作。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {([12, 24, 36] as SimulatedRosterSize[]).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => handleLoadSimulatedRoster(size)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-sky-50 hover:text-[#0369A1] border border-slate-200 hover:border-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              模擬名單（{size}人）
            </button>
          ))}
        </div>
      </section>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Import Panel (5 cols) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900">匯入名單來源</h2>
            <div
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
              role="tablist"
              aria-label="匯入方式"
            >
              <button
                type="button"
                role="tab"
                aria-selected={importMode === 'csv'}
                onClick={() => setImportMode('csv')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  importMode === 'csv'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                上傳 CSV
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={importMode === 'paste'}
                onClick={() => setImportMode('paste')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  importMode === 'paste'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                貼上姓名
              </button>
            </div>
          </div>

          {importMode === 'csv' ? (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`flex flex-col items-center justify-center text-center px-6 py-8 rounded-lg border border-dashed transition-colors ${
                  isDragging
                    ? 'border-[#0284C7] bg-sky-50/70'
                    : 'border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-900">
                  點擊選擇檔案，或將 CSV / TXT 拖曳至此
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  自動支援 UTF-8 與學校系統常用的 Big5 編碼
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </div>

              {/* CSV Preview & Column Selection */}
              {csvPreview && (
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="font-medium text-slate-900 truncate">
                      已載入：{csvPreview.fileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCsvPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-slate-500 hover:text-slate-800 whitespace-nowrap shrink-0"
                    >
                      取消
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-xs font-medium text-slate-700 mb-1">
                        選擇「姓名」欄位
                      </span>
                      <select
                        value={selectedCol}
                        onChange={(e) => setSelectedCol(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-[#0284C7]"
                      >
                        {csvPreview.headers.map((header, idx) => (
                          <option key={idx} value={idx}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-center gap-2 sm:pt-6 text-sm text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={skipHeader}
                        onChange={(e) => setSkipHeader(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#0284C7]"
                      />
                      <span>第一列為標題列（略過）</span>
                    </label>
                  </div>

                  {/* CSV Duplicate Warning + One-Click Dedupe */}
                  {csvAnalysis.duplicateCount > 0 && (
                    <div
                      role="alert"
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-semibold tabular-nums">
                            預覽名單發現 {csvAnalysis.duplicateCount} 筆重複姓名
                          </p>
                          <p className="text-amber-800">
                            重複項目：{csvAnalysis.duplicateNameList.slice(0, 5).join('、')}
                            {csvAnalysis.duplicateNameList.length > 5 ? ' 等' : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeduplicateCsvPreview}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        一鍵移除重複
                      </button>
                    </div>
                  )}

                  {/* CSV Preview Name List with Duplicate Markers */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-medium text-slate-800">預覽匯入名單</span>
                      <span className="font-mono tabular-nums text-slate-700">
                        共 {csvAnalysis.items.length} 筆
                        {csvAnalysis.duplicateCount > 0 && ` · 重複 ${csvAnalysis.duplicateCount} 筆`}
                      </span>
                    </div>

                    <div className="max-h-44 overflow-y-auto pr-1 grid grid-cols-2 gap-1.5">
                      {csvAnalysis.items.map((item) => (
                        <div
                          key={`${item.index}-${item.name}`}
                          className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md text-xs border ${
                            item.isDuplicateOccurrence
                              ? 'bg-amber-50 border-amber-300 text-amber-950'
                              : item.hasAnyDuplicate
                                ? 'bg-white border-amber-200 text-slate-900'
                                : 'bg-white border-slate-200/70 text-slate-800'
                          }`}
                        >
                          <span className="truncate font-medium">
                            <span className="font-mono text-[11px] text-slate-400 tabular-nums mr-1.5">
                              {String(item.index + 1).padStart(2, '0')}
                            </span>
                            {item.name}
                          </span>
                          {item.isDuplicateOccurrence && (
                            <span className="text-[11px] font-semibold text-amber-700 whitespace-nowrap shrink-0">
                              重複
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleConfirmCsvImport('replace')}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap"
                    >
                      覆蓋目前名單
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmCsvImport('append')}
                      className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      追加至名單
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                <span>需要標準格式參考嗎？</span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="inline-flex items-center gap-1 font-medium text-[#0284C7] hover:text-[#0369A1] whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  下載範例 CSV
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="paste-roster-textarea"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  直接貼上學生姓名（支援換行、逗號、頓號或 Excel 整欄複製貼上）
                </label>
                <textarea
                  id="paste-roster-textarea"
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'林子軒\n陳品妤\n張宇恩\n王宥希'}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/60 border border-slate-200 rounded-lg focus:bg-white focus:border-[#0284C7] resize-y leading-relaxed"
                />
              </div>

              {/* Paste Preview & Duplicate Detection */}
              {pasteAnalysis.items.length > 0 && (
                <div className="space-y-3">
                  {pasteAnalysis.duplicateCount > 0 && (
                    <div
                      role="alert"
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-semibold tabular-nums">
                            預覽名單發現 {pasteAnalysis.duplicateCount} 筆重複姓名
                          </p>
                          <p className="text-amber-800">
                            重複項目：{pasteAnalysis.duplicateNameList.slice(0, 5).join('、')}
                            {pasteAnalysis.duplicateNameList.length > 5 ? ' 等' : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeduplicatePastePreview}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        一鍵移除重複
                      </button>
                    </div>
                  )}

                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-medium text-slate-800">貼上名單預覽</span>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono tabular-nums text-slate-700">
                          共 {pasteAnalysis.items.length} 筆
                          {pasteAnalysis.duplicateCount > 0 && ` · 重複 ${pasteAnalysis.duplicateCount} 筆`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPasteText('')}
                          className="text-slate-500 hover:text-slate-800 whitespace-nowrap"
                        >
                          清除
                        </button>
                      </div>
                    </div>

                    <div className="max-h-44 overflow-y-auto pr-1 grid grid-cols-2 gap-1.5">
                      {pasteAnalysis.items.map((item) => (
                        <div
                          key={`${item.index}-${item.name}`}
                          className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md text-xs border ${
                            item.isDuplicateOccurrence
                              ? 'bg-amber-50 border-amber-300 text-amber-950'
                              : item.hasAnyDuplicate
                                ? 'bg-white border-amber-200 text-slate-900'
                                : 'bg-white border-slate-200/70 text-slate-800'
                          }`}
                        >
                          <span className="truncate font-medium">
                            <span className="font-mono text-[11px] text-slate-400 tabular-nums mr-1.5">
                              {String(item.index + 1).padStart(2, '0')}
                            </span>
                            {item.name}
                          </span>
                          {item.isDuplicateOccurrence && (
                            <span className="text-[11px] font-semibold text-amber-700 whitespace-nowrap shrink-0">
                              重複
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleConfirmPasteImport('replace')}
                  disabled={parsedPasteNames.length === 0}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
                >
                  覆蓋目前名單
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmPasteImport('append')}
                  disabled={parsedPasteNames.length === 0}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  追加至名單
                </button>
              </div>
            </div>
          )}

          {/* Footer Action */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end text-xs">
            <button
              type="button"
              onClick={() => {
                onReplaceRoster([]);
                showFeedback('success', '已清空目前名單。');
              }}
              disabled={students.length === 0}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空目前名單
            </button>
          </div>
        </section>

        {/* Right: Active Roster Directory (7 cols) */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">目前班級名單</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                <span>共 {students.length} 位學生</span>
                <span aria-hidden="true">·</span>
                <span>自動儲存於此瀏覽器</span>
              </div>
            </div>

            {/* Single quick add */}
            <form onSubmit={handleQuickAdd} className="flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                placeholder="新增單一學生姓名..."
                aria-label="新增單一學生姓名"
                className="w-44 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#0284C7]"
              />
              <button
                type="submit"
                disabled={!quickAddName.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                新增
              </button>
            </form>
          </div>

          {/* Active Roster Duplicate Alert Banner */}
          {activeRosterAnalysis.duplicateCount > 0 && (
            <div
              role="alert"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold tabular-nums">
                    目前名單內有 {activeRosterAnalysis.duplicateCount} 筆重複姓名
                  </span>
                  <span className="text-amber-800 ml-1.5">
                    （{activeRosterAnalysis.duplicateNameList.slice(0, 6).join('、')}
                    {activeRosterAnalysis.duplicateNameList.length > 6 ? ' 等' : ''}）
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const removed = onRemoveDuplicates();
                  showFeedback('success', `已一次性移除 ${removed} 筆重複的學生姓名。`);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <UserMinus className="w-3.5 h-3.5" />
                一鍵移除重複姓名
              </button>
            </div>
          )}

          {students.length === 0 ? (
            <div className="py-14 px-6 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/40 space-y-3">
              <Users className="w-9 h-9 text-slate-300 mx-auto" />
              <div>
                <p className="text-sm font-medium text-slate-700">目前尚未建立學生名單</p>
                <p className="mt-1 text-xs text-slate-500">
                  請由左側上傳 CSV 檔案、貼上姓名，或點選下方按鈕立即載入模擬名單體驗功能。
                </p>
              </div>
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleLoadSimulatedRoster(24)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  載入 24 人模擬名單
                </button>
              </div>
            </div>
          ) : (
            <div className="max-h-[460px] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {students.map((student, idx) => {
                  const itemMeta = activeRosterAnalysis.items[idx];
                  const isDup = itemMeta?.isDuplicateOccurrence;
                  const hasDup = itemMeta?.hasAnyDuplicate;

                  return (
                    <div
                      key={student.id}
                      className={`group flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg border transition-colors ${
                        isDup
                          ? 'bg-amber-50 border-amber-300'
                          : hasDup
                            ? 'bg-amber-50/35 border-amber-200'
                            : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0 w-5">
                          {String(student.seatNo).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {student.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isDup && (
                          <span className="text-[11px] font-semibold text-amber-700 whitespace-nowrap">
                            重複
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteStudent(student.id)}
                          aria-label={`移除 ${student.name}`}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition-opacity shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
