import { ExamInfo } from '../types/exam';
import { formatScore, toPersianDigits } from './jalali';

export interface DynamicFieldDefinition {
  token: string;
  label: string;
  sampleValue: string;
  category: 'exam' | 'student';
}

export const DYNAMIC_FIELDS: DynamicFieldDefinition[] = [
  { token: '{{SchoolName}}', label: 'نام مدرسه', sampleValue: 'دبیرستان شهید بهشتی', category: 'exam' },
  { token: '{{ExamTitle}}', label: 'عنوان امتحان', sampleValue: 'آزمون نوبت اول', category: 'exam' },
  { token: '{{Subject}}', label: 'نام درس', sampleValue: 'ریاضی', category: 'exam' },
  { token: '{{Grade}}', label: 'پایه تحصیلی', sampleValue: 'نهم', category: 'exam' },
  { token: '{{Class}}', label: 'کلاس', sampleValue: '۹۰۲', category: 'exam' },
  { token: '{{ExamDate}}', label: 'تاریخ امتحان', sampleValue: '۱۴۰۵/۱۰/۱۲', category: 'exam' },
  { token: '{{ExamDuration}}', label: 'مدت زمان امتحان', sampleValue: '۷۵ دقیقه', category: 'exam' },
  { token: '{{TeacherName}}', label: 'نام دبیر', sampleValue: 'استاد رضایی', category: 'exam' },
  { token: '{{TotalScore}}', label: 'نمره کل', sampleValue: '۲۰', category: 'exam' },
  { token: '{{StudentName}}', label: 'نام و نام خانوادگی دانش‌آموز', sampleValue: '........................', category: 'student' },
  { token: '{{StudentNumber}}', label: 'شماره دانش‌آموزی', sampleValue: '............', category: 'student' },
];

/**
 * Resolves {{DynamicField}} tokens inside a header cell's text.
 * - In examination rendering (`useSampleWhenEmpty = false`): populates from ExamInfo and cleanly
 *   omits empty values without ever displaying raw {{...}} placeholder tokens.
 *   Student write-in fields ({{StudentName}}, {{StudentNumber}}) render as clean dotted lines.
 * - In Header Designer live preview (`useSampleWhenEmpty = true`): falls back to realistic Persian
 *   sample values when examInfo fields are blank so the teacher sees a realistic A4 header.
 */
export function resolveHeaderDynamicText(
  rawText: string,
  examInfo?: ExamInfo,
  useSampleWhenEmpty = false
): string {
  if (!rawText) return '';

  const getVal = (val: string | undefined, sample: string): string => {
    const trimmed = (val ?? '').trim();
    if (trimmed) return trimmed;
    return useSampleWhenEmpty ? sample : '';
  };

  const map: Record<string, string> = {
    '{{SchoolName}}': getVal(examInfo?.schoolName, 'دبیرستان شهید بهشتی'),
    '{{ExamTitle}}': getVal(examInfo?.examName, 'آزمون نوبت اول'),
    '{{Subject}}': getVal(examInfo?.subject, 'ریاضی'),
    '{{Grade}}': getVal(examInfo?.grade, 'نهم'),
    '{{Class}}': getVal(examInfo?.className ? toPersianDigits(examInfo.className) : '', '۹۰۲'),
    '{{ExamDate}}': getVal(examInfo?.examDate ? toPersianDigits(examInfo.examDate) : '', '۱۴۰۵/۱۰/۱۲'),
    '{{ExamDuration}}': getVal(examInfo?.duration ? toPersianDigits(examInfo.duration) : '', '۷۵ دقیقه'),
    '{{TeacherName}}': getVal(examInfo?.teacherName, 'استاد رضایی'),
    '{{TotalScore}}':
      examInfo && typeof examInfo.totalScore === 'number'
        ? formatScore(examInfo.totalScore)
        : useSampleWhenEmpty
          ? '۲۰'
          : '',
    '{{StudentName}}': '........................',
    '{{StudentNumber}}': '............',
  };

  // Replace known tokens cleanly, then strip any stray unrecognized {{...}} tokens
  let result = rawText;
  for (const [token, replacement] of Object.entries(map)) {
    if (result.includes(token)) {
      result = result.split(token).join(replacement);
    }
  }
  result = result.replace(/\{\{[A-Za-z0-9_]+\}\}/g, '');
  return result;
}
