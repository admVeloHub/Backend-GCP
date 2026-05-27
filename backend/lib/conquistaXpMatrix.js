// VERSION: v1.0.0 | DATE: 2026-04-30 | AUTHOR: VeloHub Development Team
// Espelha dev - VeloAcademy/lib/conquista-xp-matrix.js (matriz Excelência QA).
// Baixo 50 | Normal 100 | Alto 150 | Especial 250

const POINTS_BY_KEY = {
  baixo: 50,
  normal: 100,
  alto: 150,
  especial: 250
};

const LABEL_PT = {
  baixo: 'Baixa',
  normal: 'Normal',
  alto: 'Alta',
  especial: 'Especial'
};

const KEY_BY_POINTS = {
  50: 'baixo',
  100: 'normal',
  150: 'alto',
  250: 'especial'
};

function stripDiacritics(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * @param {unknown} raw — classe (string) ou valor numérico / legado
 * @returns {{ points: number|null, labelPt: string|null, matrixKey: string|null }}
 */
function resolveQaTrophyXp(raw) {
  if (raw == null || (typeof raw === 'string' && !String(raw).trim())) {
    return { points: null, labelPt: null, matrixKey: null };
  }

  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    const n = Math.round(raw);
    const key = KEY_BY_POINTS[n];
    if (key) {
      return { points: n, labelPt: LABEL_PT[key], matrixKey: key };
    }
    if (n > 0 && n <= 10000) {
      return { points: n, labelPt: null, matrixKey: null };
    }
    return { points: null, labelPt: null, matrixKey: null };
  }

  const s = stripDiacritics(String(raw).toLowerCase().trim());

  if (/\b(especial|special)\b/.test(s)) {
    return { points: POINTS_BY_KEY.especial, labelPt: LABEL_PT.especial, matrixKey: 'especial' };
  }
  if (/\b(baixo|baixa|low|bajo)\b/.test(s)) {
    return { points: POINTS_BY_KEY.baixo, labelPt: LABEL_PT.baixo, matrixKey: 'baixo' };
  }
  if (/\b(normal|medio|media)\b/.test(s)) {
    return { points: POINTS_BY_KEY.normal, labelPt: LABEL_PT.normal, matrixKey: 'normal' };
  }
  if (/\b(alto|alta|high)\b/.test(s)) {
    return { points: POINTS_BY_KEY.alto, labelPt: LABEL_PT.alto, matrixKey: 'alto' };
  }

  const asNum = Number(String(raw).replace(',', '.').trim());
  if (!Number.isNaN(asNum) && String(raw).trim() !== '') {
    return resolveQaTrophyXp(asNum);
  }

  return { points: null, labelPt: null, matrixKey: null };
}

module.exports = {
  resolveQaTrophyXp,
  POINTS_BY_KEY,
  LABEL_PT
};
