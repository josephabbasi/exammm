import katex from 'katex';

export interface FormulaPreset {
  id: string;
  label: string;
  category: 'basic' | 'algebra' | 'calculus' | 'geometry';
  latex: string;
}

export const FORMULA_PRESETS: FormulaPreset[] = [
  { id: 'frac', label: 'کسر ساده', category: 'basic', latex: '\\frac{a}{b}' },
  { id: 'mixed_frac', label: 'جمع کسرها', category: 'basic', latex: '\\frac{2}{3} + \\frac{5}{4} = ' },
  { id: 'power', label: 'توان', category: 'basic', latex: 'x^{2} + y^{n}' },
  { id: 'sqrt', label: 'رادیکال', category: 'basic', latex: '\\sqrt{x + 1}' },
  { id: 'nroot', label: 'ریشه nام', category: 'basic', latex: '\\sqrt[n]{a^{m}}' },
  { id: 'quadratic', label: 'فرمول درجه دو', category: 'algebra', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { id: 'system', label: 'دستگاه معادلات', category: 'algebra', latex: '\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}' },
  { id: 'matrix', label: 'ماتریس ۲×۲', category: 'algebra', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { id: 'integral', label: 'انتگرال معین', category: 'calculus', latex: '\\int_{a}^{b} f(x)\\,dx' },
  { id: 'sum', label: 'مجموع (سیگما)', category: 'calculus', latex: '\\sum_{i=1}^{n} x_i' },
  { id: 'limit', label: 'حد (لیمیت)', category: 'calculus', latex: '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1' },
  { id: 'deriv', label: 'مشتق کسری', category: 'calculus', latex: '\\frac{dy}{dx} = 3x^2 - 2x' },
  { id: 'trig', label: 'اتحاد مثلثاتی', category: 'geometry', latex: '\\sin^2\\theta + \\cos^2\\theta = 1' },
  { id: 'angle', label: 'زاویه و پی', category: 'geometry', latex: '\\widehat{ABC} = 90^\\circ, \\quad \\pi \\approx 3.14' },
];

export interface MathSymbolButton {
  label: string;
  insert: string;
  title: string;
}

export const MATH_SYMBOLS: MathSymbolButton[] = [
  { label: 'a/b', insert: '\\frac{a}{b}', title: 'کسر' },
  { label: 'xⁿ', insert: '^{n}', title: 'توان' },
  { label: 'xₙ', insert: '_{n}', title: 'اندیس' },
  { label: '√', insert: '\\sqrt{x}', title: 'رادیکال' },
  { label: 'ⁿ√', insert: '\\sqrt[n]{x}', title: 'ریشه nام' },
  { label: '∫', insert: '\\int_{a}^{b} ', title: 'انتگرال' },
  { label: '∑', insert: '\\sum_{i=1}^{n} ', title: 'سیگما' },
  { label: 'lim', insert: '\\lim_{x \\to 0} ', title: 'حد' },
  { label: '×', insert: '\\times ', title: 'ضرب' },
  { label: '÷', insert: '\\div ', title: 'تقسیم' },
  { label: '±', insert: '\\pm ', title: 'مثبت منفی' },
  { label: '≠', insert: '\\neq ', title: 'نامساوی' },
  { label: '≤', insert: '\\leq ', title: 'کوچک‌تر مساوی' },
  { label: '≥', insert: '\\geq ', title: 'بزرگ‌تر مساوی' },
  { label: '≈', insert: '\\approx ', title: 'تقریباً مساوی' },
  { label: '∞', insert: '\\infty ', title: 'بینهایت' },
  { label: 'π', insert: '\\pi ', title: 'عدد پی' },
  { label: 'θ', insert: '\\theta ', title: 'تتا' },
  { label: 'α', insert: '\\alpha ', title: 'آلفا' },
  { label: 'β', insert: '\\beta ', title: 'بتا' },
  { label: '°', insert: '^\\circ ', title: 'درجه' },
  { label: '→', insert: '\\rightarrow ', title: 'پیکان' },
  { label: '∈', insert: '\\in ', title: 'عضو' },
  { label: '∪', insert: '\\cup ', title: 'اجتماع' },
  { label: '∩', insert: '\\cap ', title: 'اشتراک' },
];

export function renderLatexToHtml(latex: string, displayMode = false): { html: string; error?: string } {
  const trimmed = latex.trim();
  if (!trimmed) {
    return { html: '' };
  }
  try {
    const html = katex.renderToString(trimmed, {
      displayMode,
      throwOnError: true,
      strict: false,
      output: 'htmlAndMathml',
    });
    return { html };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطا در ساختار فرمول';
    return {
      html: `<span dir="ltr" class="text-red-600 font-mono text-xs bg-red-50 px-1.5 py-0.5 rounded">${escapeHtml(trimmed)}</span>`,
      error: `فرمول نامعتبر است: ${message}`,
    };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Hydrates inline math placeholders inside question HTML into rendered KaTeX spans
 * while keeping data-latex attributes intact for editing and DOCX export.
 */
export function renderRichHtmlWithMath(rawHtml: string): string {
  if (!rawHtml) return '';
  if (typeof document === 'undefined') return rawHtml;
  const container = document.createElement('div');
  container.innerHTML = rawHtml;
  const mathNodes = container.querySelectorAll('[data-latex]');
  mathNodes.forEach((node) => {
    const latex = node.getAttribute('data-latex') ?? '';
    const { html } = renderLatexToHtml(latex, false);
    node.innerHTML = html;
    node.setAttribute('dir', 'ltr');
    node.classList.add('math-inline-node');
  });
  return container.innerHTML;
}
