import type { ParsedCsvPreview, StudentGroup } from '../types';

/**
 * Decodes an uploaded file buffer, trying strict UTF-8 first and falling back to Big5
 * (common for Taiwanese school administration CSV exports).
 */
export async function readFileTextSmart(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return utf8.replace(/^\uFEFF/, '');
  } catch {
    try {
      const big5 = new TextDecoder('big5').decode(buffer);
      return big5.replace(/^\uFEFF/, '');
    } catch {
      return new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
    }
  }
}

/**
 * RFC-4180 compliant lightweight CSV line parser handling quoted fields and escaped quotes.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',' || ch === '\t') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (ch === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

const NAME_HEADER_PATTERNS = [
  /姓名/,
  /名字/,
  /學生/,
  /同學/,
  /^name$/i,
  /student/i,
  /fullname/i,
];

const NON_NAME_HEADER_PATTERNS = [
  /座號/,
  /學號/,
  /編號/,
  /序號/,
  /班級/,
  /性別/,
  /email/i,
  /phone/i,
  /^id$/i,
  /^no\.?$/i,
];

export function buildCsvPreview(fileName: string, text: string): ParsedCsvPreview | null {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return null;

  const maxCols = Math.max(...rows.map((r) => r.length));
  const paddedRows = rows.map((r) => {
    const copy = [...r];
    while (copy.length < maxCols) copy.push('');
    return copy;
  });

  const firstRow = paddedRows[0];
  let suggestedColumnIndex = 0;
  let hasHeaderRow = false;

  // Check if first row looks like a header row
  const headerNameMatch = firstRow.findIndex((cell) =>
    NAME_HEADER_PATTERNS.some((pattern) => pattern.test(cell))
  );
  const headerMetaMatch = firstRow.some((cell) =>
    NON_NAME_HEADER_PATTERNS.some((pattern) => pattern.test(cell))
  );

  if (headerNameMatch !== -1) {
    suggestedColumnIndex = headerNameMatch;
    hasHeaderRow = true;
  } else if (headerMetaMatch) {
    hasHeaderRow = true;
    // Find first column whose body looks like names (non-numeric text)
    const sampleDataRow = paddedRows[1] ?? firstRow;
    const textCol = sampleDataRow.findIndex(
      (cell, idx) =>
        cell.length > 0 &&
        !/^\d+$/.test(cell) &&
        !NON_NAME_HEADER_PATTERNS.some((p) => p.test(firstRow[idx]))
    );
    suggestedColumnIndex = textCol !== -1 ? textCol : 0;
  } else if (maxCols > 1) {
    // No clear header; pick first column that isn't purely numeric seat numbers
    const textCol = firstRow.findIndex((cell) => cell.length > 0 && !/^\d+$/.test(cell));
    suggestedColumnIndex = textCol !== -1 ? textCol : 0;
  }

  const headers = firstRow.map((cell, idx) =>
    hasHeaderRow && cell ? cell : `第 ${idx + 1} 欄`
  );

  return {
    fileName,
    headers,
    rows: paddedRows,
    suggestedColumnIndex,
    hasHeaderRow,
  };
}

/**
 * Parses pasted text separated by newlines, commas, Chinese commas, semicolons, or tabs.
 */
export function parsePastedNames(rawText: string): string[] {
  return rawText
    .split(/[\n\r,，、;；\t]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Exports grouping results as a UTF-8 with BOM CSV file so Excel opens Traditional Chinese cleanly.
 */
export function exportGroupsToCsv(groups: StudentGroup[]): void {
  const lines: string[] = ['組別,組內序號,座號,學生姓名'];
  groups.forEach((group) => {
    group.members.forEach((member, idx) => {
      const escapedGroup = `"${group.name.replace(/"/g, '""')}"`;
      const escapedName = `"${member.name.replace(/"/g, '""')}"`;
      lines.push(`${escapedGroup},${idx + 1},${member.seatNo},${escapedName}`);
    });
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `班級分組結果_${dateStr}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
