// VERSION: v1.0.0 | DATE: 2026-06-05 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.0.0 - Leitura absoluta de dataLigacao/horaLigacao; legado BSON Date com TZ America/Sao_Paulo

const DATA_LIGACAO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_LIGACAO_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Fuso dos monitores no fluxo legado (data/hora informadas em horário local da operação). */
const LEGACY_WALL_CLOCK_TZ = 'America/Sao_Paulo';

const coerceToDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (DATA_LIGACAO_REGEX.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isUtcMidnight = (d) =>
  d.getUTCHours() === 0 &&
  d.getUTCMinutes() === 0 &&
  d.getUTCSeconds() === 0 &&
  d.getUTCMilliseconds() === 0;

const utcDateYmd = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const wallClockParts = (d, timeZone = LEGACY_WALL_CLOCK_TZ) => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = fmt.formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return {
    y: get('year'),
    m: get('month'),
    d: get('day'),
    h: hour,
    min: get('minute')
  };
};

/**
 * Gravação / entrada: YYYY-MM-DD absoluto (aceita legado na migração).
 */
const normalizeDataLigacaoAbsolute = (value) => {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (DATA_LIGACAO_REGEX.test(s)) return s;

  const d = coerceToDate(value);
  if (!d) return null;

  if (isUtcMidnight(d)) return utcDateYmd(d);

  const { y, m, day } = wallClockParts(d);
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
};

const normalizeHoraLigacaoField = (value) => {
  if (value == null || value === '') return '';
  const s = String(value).trim().substring(0, 5);
  return HORA_LIGACAO_REGEX.test(s) ? s : null;
};

/**
 * Leitura legado: hora embutida em dataLigacao Date quando horaLigacao não existe.
 */
const resolveHoraLigacaoFromStored = (avaliacao) => {
  if (!avaliacao) return '';
  const persisted = normalizeHoraLigacaoField(avaliacao.horaLigacao);
  if (persisted) return persisted;

  const d = coerceToDate(avaliacao.dataLigacao);
  if (!d || isUtcMidnight(d)) return '';

  const { h, min } = wallClockParts(d);
  if (!h && !min) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

/**
 * Leitura legado: normaliza documento para dataLigacao String + horaLigacao String absolutos.
 */
const normalizarAvaliacaoDataLigacaoLegado = (avaliacao) => {
  if (!avaliacao || typeof avaliacao !== 'object') return avaliacao;

  const rawData = avaliacao.dataLigacao;
  const dataLigacao = normalizeDataLigacaoAbsolute(rawData) || '';
  const horaLigacao = resolveHoraLigacaoFromStored(avaliacao);

  return {
    ...avaliacao,
    dataLigacao,
    horaLigacao
  };
};

module.exports = {
  DATA_LIGACAO_REGEX,
  HORA_LIGACAO_REGEX,
  normalizeDataLigacaoAbsolute,
  normalizeHoraLigacaoField,
  resolveHoraLigacaoFromStored,
  normalizarAvaliacaoDataLigacaoLegado
};
