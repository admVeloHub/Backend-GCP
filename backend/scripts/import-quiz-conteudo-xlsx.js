// VERSION: v1.0.5 | DATE: 2026-03-27 | AUTHOR: VeloHub Development Team
/**
 * Popula academy_registros.quiz_conteudo a partir do Excel VeloAcademy_Quizzes.xlsx
 *
 * Aba "Config" (linha 1 = cabeçalho):
 *   Coluna A: quizID (LISTA_SCHEMAS quiz_conteudo.quizID)
 *   Coluna C: notaCorte (mínimo de acertos, inteiro 0..N)
 *
 * Demais abas: nome da aba = quizId (pode estar truncado em 31 caracteres pelo Excel).
 *   Linha 1 = cabeçalho; da linha 2 em diante, cada linha = uma questão:
 *   Coluna A: pergunta (enunciado)
 *   Coluna B: opção A
 *   Coluna C: opção B
 *   Coluna D: opção C
 *   Coluna E: opção D
 *   Coluna F: resposta correta (gabarito) — qual das alternativas A–D está certa.
 *             Aceita: letras A, B, C ou D; números 1–4 (1=A…4=D);
 *             ou texto idêntico ao conteúdo de uma das células B–E.
 *   Mongo (LISTA_SCHEMAS): opção1 = correta; opção2–4 = demais na ordem A→B→C→D (excl. correta).
 *   Verdadeiro/Falso (só 2 colunas B–E preenchidas): opção1 = correta, opção2 = outra, opção3 e opção4 = "".
 *
 * Uso:
 *   cd "Dev - SKYNET"
 *   npm install
 *   npm run import-quiz-conteudo-xlsx -- "caminho/para/VeloAcademy_Quizzes.xlsx"
 *
 * Variáveis: MONGO_ENV (obrigatório), ACADEMY_REGISTROS_DB (opcional, default academy_registros)
 * Dry-run (só imprime resumo): --dry-run
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { MongoClient } = require('mongodb');

const pathEnvRoot = path.join(__dirname, '../..');
require('dotenv').config({ path: path.join(pathEnvRoot, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getMongoUri } = require('../config/mongodb');

const DB_NAME = process.env.ACADEMY_REGISTROS_DB || 'academy_registros';
const COLLECTION = 'quiz_conteudo';
const CONFIG_SHEET_NAMES = ['Config', 'config', 'CONFIG'];

function getCell(sheet, row0, col0) {
  const addr = XLSX.utils.encode_cell({ r: row0, c: col0 });
  const cell = sheet[addr];
  if (!cell) return '';
  if (cell.w != null && String(cell.w).trim() !== '') return String(cell.w).trim();
  if (cell.v != null && cell.v !== '') return String(cell.v).trim();
  return '';
}

/**
 * Índice 0–3 = opções A–D (colunas Excel B–E).
 * Gabarito F: A/B/C/D ou 1–4 ou texto igual a uma alternativa.
 */
function resolveGabaritoIndex(fVal, opcaoA, opcaoB, opcaoC, opcaoD) {
  const opts = [opcaoA, opcaoB, opcaoC, opcaoD];
  const s = String(fVal ?? '').trim();
  if (!s) return null;
  const u = s.toUpperCase();

  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 4) {
    return n - 1;
  }

  if (['A', 'B', 'C', 'D'].includes(u)) {
    return u.charCodeAt(0) - 'A'.charCodeAt(0);
  }

  for (let i = 0; i < 4; i += 1) {
    if (String(opts[i] ?? '').trim() === s) return i;
  }
  return null;
}

function buildQuestao(row0, sheet) {
  const pergunta = getCell(sheet, row0, 0);
  const opcaoA = getCell(sheet, row0, 1);
  const opcaoB = getCell(sheet, row0, 2);
  const opcaoC = getCell(sheet, row0, 3);
  const opcaoD = getCell(sheet, row0, 4);
  const gabarito = getCell(sheet, row0, 5);
  if (!pergunta && !opcaoA && !opcaoB && !opcaoC && !opcaoD) return null;

  const alternativas = [opcaoA, opcaoB, opcaoC, opcaoD];
  const idx = resolveGabaritoIndex(gabarito, opcaoA, opcaoB, opcaoC, opcaoD);
  if (idx === null) {
    return { error: `Linha ${row0 + 1}: coluna F (gabarito) inválida ou vazia ("${gabarito}")` };
  }
  const correct = alternativas[idx];
  if (!String(correct ?? '').trim()) {
    return { error: `Linha ${row0 + 1}: alternativa ${String.fromCharCode(65 + idx)} (correta pelo gabarito) está vazia` };
  }
  const wrongInOrder = [0, 1, 2, 3]
    .filter((i) => i !== idx)
    .map((i) => String(alternativas[i] ?? '').trim())
    .filter((t) => t.length > 0);
  if (wrongInOrder.length === 0) {
    return { error: `Linha ${row0 + 1}: é necessária pelo menos uma alternativa incorreta (opções A–D, colunas B–E)` };
  }
  const questao = {
    pergunta: String(pergunta).trim(),
    opção1: String(correct).trim(),
    opção2: wrongInOrder[0] || '',
    opção3: wrongInOrder[1] != null ? wrongInOrder[1] : '',
    opção4: wrongInOrder[2] != null ? wrongInOrder[2] : ''
  };
  return { questao };
}

function findConfigSheet(wb) {
  for (const name of CONFIG_SHEET_NAMES) {
    if (wb.SheetNames.includes(name)) return wb.Sheets[name];
  }
  return null;
}

function loadConfig(sheet) {
  const ref = sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows = [];
  for (let r = 1; r <= range.e.r; r++) {
    const quizID = getCell(sheet, r, 0);
    const notaRaw = getCell(sheet, r, 2);
    if (!quizID) continue;
    let notaCorte = Number(String(notaRaw).replace(',', '.').trim());
    if (Number.isNaN(notaCorte)) notaCorte = 0;
    notaCorte = Math.max(0, Math.floor(notaCorte));
    rows.push({ quizID: String(quizID).trim(), notaCorte });
  }
  return rows;
}

function resolveQuizIdFromSheetName(sheetName, configRows) {
  const sn = String(sheetName || '').trim();
  if (!sn) return null;
  let hit = configRows.find((r) => r.quizID === sn);
  if (hit) return hit;
  hit = configRows.find((r) => r.quizID.startsWith(sn));
  if (hit) return hit;
  hit = configRows.find((r) => {
    const t31 = r.quizID.slice(0, 31);
    return t31 === sn || r.quizID.startsWith(sn) || sn === r.quizID;
  });
  return hit || null;
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== '--dry-run');
  const dryRun = process.argv.includes('--dry-run');
  const xlsxAtRepoRoot = path.join(pathEnvRoot, '..', 'scripts', 'VeloAcademy_Quizzes.xlsx');
  const xlsxAtSkynet = path.join(pathEnvRoot, 'scripts', 'VeloAcademy_Quizzes.xlsx');
  let xlsxPath = argv[0];
  if (!xlsxPath) {
    if (fs.existsSync(xlsxAtRepoRoot)) xlsxPath = xlsxAtRepoRoot;
    else if (fs.existsSync(xlsxAtSkynet)) xlsxPath = xlsxAtSkynet;
    else xlsxPath = xlsxAtRepoRoot;
  }
  if (!fs.existsSync(xlsxPath)) {
    console.error('Arquivo não encontrado:', xlsxPath);
    console.error('Passe o caminho: npm run import-quiz-conteudo-xlsx -- "C:\\...\\VeloAcademy_Quizzes.xlsx"');
    process.exit(1);
  }

  const wb = XLSX.readFile(xlsxPath, { cellDates: false });
  const configSheet = findConfigSheet(wb);
  if (!configSheet) {
    console.error('Aba Config não encontrada. Nomes aceitos:', CONFIG_SHEET_NAMES.join(', '));
    process.exit(1);
  }
  const configRows = loadConfig(configSheet);
  if (configRows.length === 0) {
    console.error('Config: nenhuma linha com quizID na coluna A.');
    process.exit(1);
  }

  const errors = [];
  const summaries = [];

  for (const sheetName of wb.SheetNames) {
    if (CONFIG_SHEET_NAMES.includes(sheetName)) continue;
    const sheet = wb.Sheets[sheetName];
    const ref = sheet['!ref'];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    const resolved = resolveQuizIdFromSheetName(sheetName, configRows);
    if (!resolved) {
      errors.push(`Aba "${sheetName}": não encontrado quizID correspondente na Config`);
      continue;
    }
    const { quizID, notaCorte } = resolved;
    const questões = [];
    for (let r = 1; r <= range.e.r; r++) {
      const built = buildQuestao(r, sheet);
      if (!built) continue;
      if (built.error) {
        errors.push(`Aba "${sheetName}" (${quizID}): ${built.error}`);
        continue;
      }
      const { questao } = built;
      if (!questao.pergunta) {
        errors.push(`Aba "${sheetName}" linha ${r + 1}: pergunta vazia`);
        continue;
      }
      if (!questao.opção1 || !String(questao.opção1).trim() || !questao.opção2 || !String(questao.opção2).trim()) {
        errors.push(`Aba "${sheetName}" linha ${r + 1}: opção correta e pelo menos uma incorreta são obrigatórias`);
        continue;
      }
      questões.push(questao);
    }
    if (questões.length === 0) {
      errors.push(`Aba "${sheetName}" (${quizID}): nenhuma questão válida`);
      continue;
    }
    let nota = notaCorte;
    if (nota < 0) nota = 0;
    if (nota > questões.length) nota = questões.length;
    summaries.push({
      quizID,
      notaCorte: nota,
      count: questões.length,
      sheetName,
      questões
    });
  }

  if (errors.length) {
    console.error('--- Erros ---');
    errors.forEach((e) => console.error(e));
  }

  if (dryRun) {
    console.log('--- Dry-run (sem gravar no MongoDB) ---');
    summaries.forEach((s) => {
      console.log(`${s.quizID} | notaCorte=${s.notaCorte} | questões=${s.count} | aba="${s.sheetName}"`);
    });
    console.log(`Total documentos: ${summaries.length}`);
    process.exit(errors.length ? 1 : 0);
    return;
  }

  const uri = getMongoUri();
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  const coll = client.db(DB_NAME).collection(COLLECTION);
  const now = new Date();
  let upserted = 0;
  for (const s of summaries) {
    if (!s.questões) continue;
    await coll.updateOne(
      { quizID: s.quizID },
      {
        $set: {
          quizID: s.quizID,
          questões: s.questões,
          notaCorte: s.notaCorte,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );
    upserted += 1;
    console.log(`OK ${s.quizID} (${s.count} questões, notaCorte=${s.notaCorte})`);
  }
  await client.close();
  console.log(`Concluído. Upserts: ${upserted}. Database: ${DB_NAME}, collection: ${COLLECTION}`);
  if (errors.length) {
    console.error(`Avisos: ${errors.length} linha(s) ignorada(s).`);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
