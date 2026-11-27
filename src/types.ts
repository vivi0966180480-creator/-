export interface Student {
  id: string;
  name: string;
  seatNo: number;
}

export interface DrawRecord {
  id: string;
  student: Student;
  timestamp: string;
  drawNumber: number;
}

export interface StudentGroup {
  id: string;
  name: string;
  colorIndex: number;
  members: Student[];
}

export type ActiveTab = 'roster' | 'picker' | 'grouping';

export type DrawVisualMode = 'reel' | 'wheel';

export type SoundTheme = 'marimba' | 'chime' | 'mute';

export type RemainderStrategy = 'distribute' | 'separate';

export type GroupVisualMode = 'tables' | 'cards';

export interface ParsedCsvPreview {
  fileName: string;
  headers: string[];
  rows: string[][];
  suggestedColumnIndex: number;
  hasHeaderRow: boolean;
}
