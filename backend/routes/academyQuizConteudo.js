// VERSION: v1.0.1 | DATE: 2026-03-27 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const QuizConteudo = require('../models/QuizConteudo');

const questaoValida = (q) => {
  if (!q || typeof q !== 'object') return false;
  const obr = ['pergunta', 'opção1', 'opção2'];
  if (!obr.every((k) => typeof q[k] === 'string' && q[k].trim().length > 0)) return false;
  if (typeof q.opção3 !== 'string' || typeof q.opção4 !== 'string') return false;
  const t3 = q.opção3.trim();
  const t4 = q.opção4.trim();
  if (!t3 && !t4) return true;
  if (t3 && t4) return true;
  if (t3 && !t4) return true;
  return false;
};

// GET /api/academy/quiz-conteudo/quiz/:quizID
router.get('/quiz/:quizID', async (req, res) => {
  try {
    const { quizID } = req.params;
    if (!quizID || !quizID.trim()) {
      return res.status(400).json({ success: false, error: 'quizID é obrigatório' });
    }
    global.emitLog('info', `GET /api/academy/quiz-conteudo/quiz/${quizID}`);
    const result = await QuizConteudo.getByQuizID(quizID.trim());
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Erro ao buscar quiz' });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    global.emitLog('error', `GET quiz-conteudo/quiz - ${error.message}`);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// PUT /api/academy/quiz-conteudo/quiz/:quizID — cria ou atualiza documento quiz_conteudo
router.put('/quiz/:quizID', async (req, res) => {
  try {
    const { quizID } = req.params;
    const { questões, notaCorte } = req.body || {};
    if (!quizID || !quizID.trim()) {
      return res.status(400).json({ success: false, error: 'quizID é obrigatório' });
    }
    if (!Array.isArray(questões) || questões.length === 0) {
      return res.status(400).json({ success: false, error: 'questões deve ser um array não vazio' });
    }
    const todasValidas = questões.every(questaoValida);
    if (!todasValidas) {
      return res.status(400).json({
        success: false,
        error: 'Cada questão: pergunta + opção1 + opção2 obrigatórios; opção3/opção4 vazias (V/F), só opção3 (3 alternativas) ou opção3+opção4 (4 alternativas)'
      });
    }
    let nota = notaCorte;
    if (typeof nota !== 'number' || Number.isNaN(nota)) {
      nota = Math.max(1, Math.ceil(questões.length * 0.7));
    }
    nota = Math.min(Math.max(0, Math.floor(nota)), questões.length);
    global.emitLog('info', `PUT /api/academy/quiz-conteudo/quiz/${quizID}`);
    const result = await QuizConteudo.upsertByQuizID(quizID.trim(), { questões, notaCorte: nota });
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Erro ao salvar quiz' });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    global.emitLog('error', `PUT quiz-conteudo/quiz - ${error.message}`);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

module.exports = router;
