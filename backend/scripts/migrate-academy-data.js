// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
// Script de migração: cursos_conteudo -> cursos, modulos, secoes, aulas
// Usa URI específica fornecida para conexão direta

const mongoose = require('mongoose');

// URI do MongoDB fornecida
const MONGODB_URI = 'mongodb+srv://REDACTED_ATLAS_URI';
const DB_NAME = 'academy_registros';

// Estatísticas de migração
const stats = {
  cursos: { total: 0, success: 0, failed: 0 },
  modulos: { total: 0, success: 0, failed: 0 },
  secoes: { total: 0, success: 0, failed: 0 },
  aulas: { total: 0, success: 0, failed: 0 },
  errors: []
};

// Função para log
const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

// Função para log de erro
const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❌ ${message}`);
  if (error) {
    console.error(`[${timestamp}] Erro:`, error.message);
    if (error.stack) {
      console.error(`[${timestamp}] Stack:`, error.stack);
    }
    stats.errors.push({ message, error: error.message, stack: error.stack });
  }
};

// Schemas para as novas coleções
const cursoSchema = new mongoose.Schema({
  cursoClasse: String,
  cursoNome: String,
  cursoDescription: String,
  courseOrder: Number,
  isActive: Boolean,
  createdBy: String,
  version: Number
}, { timestamps: true, versionKey: false, collection: 'cursos' });

const moduloSchema = new mongoose.Schema({
  cursoId: mongoose.Schema.Types.ObjectId,
  moduleId: String,
  moduleNome: String,
  moduleOrder: Number,
  isActive: Boolean
}, { timestamps: true, versionKey: false, collection: 'modulos' });

const secaoSchema = new mongoose.Schema({
  moduloId: mongoose.Schema.Types.ObjectId,
  temaNome: String,
  temaOrder: Number,
  isActive: Boolean,
  hasQuiz: Boolean,
  quizId: String
}, { timestamps: true, versionKey: false, collection: 'secoes' });

const aulaSchema = new mongoose.Schema({
  secaoId: mongoose.Schema.Types.ObjectId,
  lessonId: String,
  lessonTipo: String,
  lessonTitulo: String,
  lessonOrdem: Number,
  isActive: Boolean,
  lessonContent: [{
    url: String
  }],
  driveId: String,
  youtubeId: String,
  duration: String
}, { timestamps: true, versionKey: false, collection: 'aulas' });

// Modelos
let CursosModel, ModulosModel, SecoesModel, AulasModel, CursosConteudoModel;
let connection = null;

// Função para migrar um curso
const migrarCurso = async (cursoAntigo) => {
  try {
    log(`📚 Migrando curso: ${cursoAntigo.cursoNome} (${cursoAntigo._id})`);
    
    // 1. Criar curso na nova coleção
    const cursoData = {
      cursoClasse: cursoAntigo.cursoClasse,
      cursoNome: cursoAntigo.cursoNome,
      cursoDescription: cursoAntigo.cursoDescription || null,
      courseOrder: cursoAntigo.courseOrder,
      isActive: cursoAntigo.isActive !== undefined ? cursoAntigo.isActive : true,
      createdBy: cursoAntigo.createdBy,
      version: cursoAntigo.version || 1,
      createdAt: cursoAntigo.createdAt || new Date(),
      updatedAt: cursoAntigo.updatedAt || new Date()
    };
    
    const novoCurso = new CursosModel(cursoData);
    await novoCurso.save();
    
    stats.cursos.total++;
    stats.cursos.success++;
    log(`✅ Curso criado: ${novoCurso._id} - ${novoCurso.cursoNome}`);
    
    // 2. Migrar módulos
    if (cursoAntigo.modules && Array.isArray(cursoAntigo.modules)) {
      for (let i = 0; i < cursoAntigo.modules.length; i++) {
        const moduloAntigo = cursoAntigo.modules[i];
        stats.modulos.total++;
        
        try {
          const moduloData = {
            cursoId: novoCurso._id,
            moduleId: moduloAntigo.moduleId,
            moduleNome: moduloAntigo.moduleNome,
            moduleOrder: moduloAntigo.moduleOrder || (i + 1), // Usar moduleOrder se existir, senão usar índice + 1
            isActive: moduloAntigo.isActive !== undefined ? moduloAntigo.isActive : true,
            createdAt: cursoAntigo.createdAt || new Date(),
            updatedAt: cursoAntigo.updatedAt || new Date()
          };
          
          const novoModulo = new ModulosModel(moduloData);
          await novoModulo.save();
          
          stats.modulos.success++;
          log(`  ✅ Módulo criado: ${novoModulo.moduleNome} (${novoModulo._id})`);
          
          // 3. Migrar seções
          if (moduloAntigo.sections && Array.isArray(moduloAntigo.sections)) {
            for (let j = 0; j < moduloAntigo.sections.length; j++) {
              const secaoAntiga = moduloAntigo.sections[j];
              stats.secoes.total++;
              
              try {
                const secaoData = {
                  moduloId: novoModulo._id,
                  temaNome: secaoAntiga.temaNome,
                  temaOrder: secaoAntiga.temaOrder || j + 1,
                  isActive: secaoAntiga.isActive !== undefined ? secaoAntiga.isActive : true,
                  hasQuiz: secaoAntiga.hasQuiz || false,
                  quizId: secaoAntiga.quizId || null,
                  createdAt: cursoAntigo.createdAt || new Date(),
                  updatedAt: cursoAntigo.updatedAt || new Date()
                };
                
                const novaSecao = new SecoesModel(secaoData);
                await novaSecao.save();
                
                stats.secoes.success++;
                log(`    ✅ Seção criada: ${novaSecao.temaNome} (${novaSecao._id})`);
                
                // 4. Migrar aulas
                if (secaoAntiga.lessons && Array.isArray(secaoAntiga.lessons)) {
                  for (const aulaAntiga of secaoAntiga.lessons) {
                    stats.aulas.total++;
                    
                    try {
                      const aulaData = {
                        secaoId: novaSecao._id,
                        lessonId: aulaAntiga.lessonId,
                        lessonTipo: aulaAntiga.lessonTipo,
                        lessonTitulo: aulaAntiga.lessonTitulo,
                        lessonOrdem: aulaAntiga.lessonOrdem,
                        isActive: aulaAntiga.isActive !== undefined ? aulaAntiga.isActive : true,
                        lessonContent: aulaAntiga.lessonContent || [],
                        driveId: aulaAntiga.driveId || null,
                        youtubeId: aulaAntiga.youtubeId || null,
                        duration: aulaAntiga.duration || null,
                        createdAt: cursoAntigo.createdAt || new Date(),
                        updatedAt: cursoAntigo.updatedAt || new Date()
                      };
                      
                      const novaAula = new AulasModel(aulaData);
                      await novaAula.save();
                      
                      stats.aulas.success++;
                      log(`      ✅ Aula criada: ${novaAula.lessonTitulo} (${novaAula._id})`);
                    } catch (error) {
                      stats.aulas.failed++;
                      logError(`Erro ao migrar aula ${aulaAntiga.lessonId || 'sem ID'}`, error);
                    }
                  }
                }
              } catch (error) {
                stats.secoes.failed++;
                logError(`Erro ao migrar seção ${secaoAntiga.temaNome || 'sem nome'}`, error);
              }
            }
          }
        } catch (error) {
          stats.modulos.failed++;
          logError(`Erro ao migrar módulo ${moduloAntigo.moduleNome || 'sem nome'}`, error);
        }
      }
    }
    
    return { success: true, cursoId: novoCurso._id };
  } catch (error) {
    stats.cursos.failed++;
    logError(`Erro ao migrar curso ${cursoAntigo.cursoNome || 'sem nome'}`, error);
    return { success: false, error: error.message };
  }
};

// Função principal de migração
const executarMigracao = async () => {
  try {
    log('🚀 Iniciando migração do schema Academy...');
    log(`📊 Database: ${DB_NAME}`);
    log(`🔗 URI: ${MONGODB_URI.replace(/:[^:@]+@/, ':****@')}`); // Ocultar senha no log
    
    // Conectar ao MongoDB
    connection = await mongoose.createConnection(MONGODB_URI, {
      dbName: DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    log('✅ Conectado ao MongoDB');
    
    // Criar modelos usando a conexão
    CursosModel = connection.model('Cursos', cursoSchema, 'cursos');
    ModulosModel = connection.model('Modulos', moduloSchema, 'modulos');
    SecoesModel = connection.model('Secoes', secaoSchema, 'secoes');
    AulasModel = connection.model('Aulas', aulaSchema, 'aulas');
    
    // Schema temporário para ler cursos_conteudo
    const cursosConteudoSchema = new mongoose.Schema({}, { strict: false, collection: 'cursos_conteudo' });
    CursosConteudoModel = connection.model('CursosConteudo', cursosConteudoSchema, 'cursos_conteudo');
    
    // Buscar todos os cursos antigos
    log('📖 Buscando cursos antigos da collection cursos_conteudo...');
    const cursosAntigos = await CursosConteudoModel.find({});
    log(`📚 Encontrados ${cursosAntigos.length} cursos para migrar`);
    
    if (cursosAntigos.length === 0) {
      log('⚠️  Nenhum curso encontrado para migrar');
      await connection.close();
      return;
    }
    
    // Limpar coleções existentes (opcional - descomente se quiser limpar antes de migrar)
    // log('🗑️  Limpando coleções existentes...');
    // await CursosModel.deleteMany({});
    // await ModulosModel.deleteMany({});
    // await SecoesModel.deleteMany({});
    // await AulasModel.deleteMany({});
    // log('✅ Coleções limpas');
    
    // Migrar cada curso
    log('\n🔄 Iniciando migração dos cursos...\n');
    for (let i = 0; i < cursosAntigos.length; i++) {
      const cursoAntigo = cursosAntigos[i];
      log(`\n[${i + 1}/${cursosAntigos.length}] Processando curso...`);
      await migrarCurso(cursoAntigo);
    }
    
    // Exibir estatísticas
    log('\n\n📊 ========================================');
    log('📊 ESTATÍSTICAS DE MIGRAÇÃO');
    log('📊 ========================================');
    log(`  Cursos: ${stats.cursos.success}/${stats.cursos.total} sucesso, ${stats.cursos.failed} falhas`);
    log(`  Módulos: ${stats.modulos.success}/${stats.modulos.total} sucesso, ${stats.modulos.failed} falhas`);
    log(`  Seções: ${stats.secoes.success}/${stats.secoes.total} sucesso, ${stats.secoes.failed} falhas`);
    log(`  Aulas: ${stats.aulas.success}/${stats.aulas.total} sucesso, ${stats.aulas.failed} falhas`);
    
    if (stats.errors.length > 0) {
      log(`\n⚠️  ${stats.errors.length} erro(s) encontrado(s):`);
      stats.errors.forEach((err, index) => {
        log(`  ${index + 1}. ${err.message}: ${err.error}`);
      });
    }
    
    log('\n✅ Migração concluída!');
    
    await connection.close();
    log('🔌 Desconectado do MongoDB');
  } catch (error) {
    logError('Erro fatal na migração', error);
    if (connection) {
      await connection.close();
    }
    process.exit(1);
  }
};

// Executar migração se script for chamado diretamente
if (require.main === module) {
  executarMigracao()
    .then(() => {
      log('\n🎉 Script finalizado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { executarMigracao };

