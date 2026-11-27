import type { Student } from '../types';

export const SAMPLE_STUDENT_NAMES: string[] = [
  '林子軒',
  '陳品妤',
  '張宇恩',
  '王宥希',
  '李承翰',
  '黃語彤',
  '吳柏叡',
  '蔡昀蓁',
  '劉彥廷',
  '許芷晴',
  '楊凱文',
  '鄭羽涵',
  '謝承恩',
  '郭沛芸',
  '洪品睿',
  '邱詠晴',
  '曾柏宇',
  '廖苡安',
  '賴俊宇',
  '徐若寧',
  '周子謙',
  '葉忻恬',
  '蘇品誠',
  '莊語恩',
  '呂柏勳',
  '江采潔',
  '何品諺',
  '羅羽彤',
  '高宇翔',
  '蕭詠涵',
  '潘承祐',
  '簡苡瑄',
  '鍾柏宏',
  '施沛恩',
  '柯子齊',
  '游欣妍',
];

export type SimulatedRosterSize = 12 | 24 | 36;

export function createStudentsFromNames(names: string[]): Student[] {
  return names
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map((name, idx) => ({
      id: `stu-${idx + 1}-${name}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      seatNo: idx + 1,
    }));
}

export function createSimulatedRoster(count: SimulatedRosterSize = 24): Student[] {
  return createStudentsFromNames(SAMPLE_STUDENT_NAMES.slice(0, count));
}

export function createSampleRoster(): Student[] {
  return createSimulatedRoster(24);
}
