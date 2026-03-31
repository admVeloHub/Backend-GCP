// VERSION: v1.0.0 | DATE: 2026-03-27 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');

const ACADEMY_REGISTROS_DB_NAME = process.env.ACADEMY_REGISTROS_DB || 'academy_registros';
let academyConnection = null;

const getAcademyConnection = () => {
  if (!academyConnection) {
    const MONGODB_URI = getMongoUri();
    academyConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: ACADEMY_REGISTROS_DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
  return academyConnection;
};

const questaoSchema = new mongoose.Schema({
  pergunta: { type: String, trim: true },
  opção1: { type: String, trim: true },
  opção2: { type: String, trim: true },
  opção3: { type: String, trim: true },
  opção4: { type: String, trim: true }
}, { _id: false });

const quizConteudoSchema = new mongoose.Schema({
  quizID: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  questões: {
    type: [questaoSchema],
    default: []
  },
  notaCorte: {
    type: Number,
    default: 1,
    min: 0
  }
}, {
  timestamps: true,
  collection: 'quiz_conteudo'
});

const getModel = () => {
  const conn = getAcademyConnection();
  return conn.models.QuizConteudo || conn.model('QuizConteudo', quizConteudoSchema);
};

const getByQuizID = async (quizID) => {
  try {
    const QuizConteudo = getModel();
    const doc = await QuizConteudo.findOne({ quizID }).lean();
    return { success: true, data: doc || null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const upsertByQuizID = async (quizID, payload) => {
  try {
    const QuizConteudo = getModel();
    const { questões, notaCorte } = payload;
    const update = {
      quizID,
      questões: questões || [],
      notaCorte: typeof notaCorte === 'number' ? notaCorte : 1
    };
    const doc = await QuizConteudo.findOneAndUpdate(
      { quizID },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    ).lean();
    return { success: true, data: doc };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  getByQuizID,
  upsertByQuizID
};
