// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
// Script de migração: cursos_conteudo -> cursos, modulos, secoes, aulas

(function loadVelohubFonteEnv(here) {
  const path = require('path');
  const fs = require('fs');
  let d = here;
  for (let i = 0; i < 14; i++) {
    const loader = path.join(d, 'FONTE DA VERDADE', 'bootstrapFonteEnv.cjs');
    if (fs.existsSync(loader)) {
      require(loader).loadFrom(here);
      return;
    }
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
})(__dirname);

const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');
const CursosConteudo = require('../models/CursosConteudo');
const Cursos = require('../models/Cursos');
const Modulos = require('../models/Modulos');
const Secoes = require('../models/Secoes');
const Aulas = require('../models/Aulas');

const ACADEMY_REGISTROS_DB_NAME = process.env.ACADEMY_REGISTROS_DB || 'academy_registros';

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
    stats.errors.push({ message, error: error.message, stack: error.stack });
  }
};

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
      version: cursoAntigo.version || 1
    };
    
    const cursoResult = await Cursos.createCurso(cursoData);
    if (!cursoResult.success) {
      throw new Error(`Erro ao criar curso: ${cursoResult.error}`);
    }
    
    const novoCurso = cursoResult.data;
    stats.cursos.total++;
    stats.cursos.success++;
    log(`✅ Curso criado: ${novoCurso._id}`);
    
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
            moduleOrder: i + 1, // Usar índice + 1 como ordem
            isActive: moduloAntigo.isActive !== undefined ? moduloAntigo.isActive : true
          };
          
          const moduloResult = await Modulos.createModulo(moduloData);
          if (!moduloResult.success) {
            throw new Error(`Erro ao criar módulo: ${moduloResult.error}`);
          }
          
          const novoModulo = moduloResult.data;
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
                  quizId: secaoAntiga.quizId || null
                };
                
                const secaoResult = await Secoes.createSecao(secaoData);
                if (!secaoResult.success) {
                  throw new Error(`Erro ao criar seção: ${secaoResult.error}`);
                }
                
                const novaSecao = secaoResult.data;
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
                        duration: aulaAntiga.duration || null
                      };
                      
                      const aulaResult = await Aulas.createAula(aulaData);
                      if (!aulaResult.success) {
                        throw new Error(`Erro ao criar aula: ${aulaResult.error}`);
                      }
                      
                      stats.aulas.success++;
                      log(`      ✅ Aula criada: ${aulaResult.data.lessonTitulo} (${aulaResult.data._id})`);
                    } catch (error) {
                      stats.aulas.failed++;
                      logError(`Erro ao migrar aula ${aulaAntiga.lessonId}`, error);
                    }
                  }
                }
              } catch (error) {
                stats.secoes.failed++;
                logError(`Erro ao migrar seção ${secaoAntiga.temaNome}`, error);
              }
            }
          }
        } catch (error) {
          stats.modulos.failed++;
          logError(`Erro ao migrar módulo ${moduloAntigo.moduleNome}`, error);
        }
      }
    }
    
    return { success: true, cursoId: novoCurso._id };
  } catch (error) {
    stats.cursos.failed++;
    logError(`Erro ao migrar curso ${cursoAntigo.cursoNome}`, error);
    return { success: false, error: error.message };
  }
};

// Função principal de migração
const executarMigracao = async () => {
  try {
    log('🚀 Iniciando migração do schema Academy...');
    log(`📊 Database: ${ACADEMY_REGISTROS_DB_NAME}`);
    
    // Conectar ao MongoDB
    const MONGODB_URI = getMongoUri();
    await mongoose.connect(MONGODB_URI, {
      dbName: ACADEMY_REGISTROS_DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    log('✅ Conectado ao MongoDB');
    
    // Buscar todos os cursos antigos
    log('📖 Buscando cursos antigos...');
    // Usar método estático getAll que já retorna os dados
    const cursosAntigosResult = await CursosConteudo.getAll();
    if (!cursosAntigosResult.success) {
      throw new Error(`Erro ao buscar cursos: ${cursosAntigosResult.error}`);
    }
    const cursosAntigos = cursosAntigosResult.data || [];
    log(`📚 Encontrados ${cursosAntigos.length} cursos para migrar`);
    
    if (cursosAntigos.length === 0) {
      log('⚠️  Nenhum curso encontrado para migrar');
      await mongoose.disconnect();
      return;
    }
    
    // Migrar cada curso
    for (const cursoAntigo of cursosAntigos) {
      await migrarCurso(cursoAntigo);
    }
    
    // Exibir estatísticas
    log('\n📊 Estatísticas de Migração:');
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
    
    await mongoose.disconnect();
    log('🔌 Desconectado do MongoDB');
  } catch (error) {
    logError('Erro fatal na migração', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Executar migração se script for chamado diretamente
if (require.main === module) {
  executarMigracao()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { executarMigracao };

