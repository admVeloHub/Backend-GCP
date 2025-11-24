// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// MIGRAÇÃO CRÍTICA - QUALIDADE_FUNCIONARIOS
// Campo atuacao deve ser alterado de String para [ObjectId] (array de referências)

const mongoose = require('mongoose');
const QualidadeFuncionario = require('../../models/QualidadeFuncionario');
const QualidadeFuncoes = require('../../models/QualidadeFuncoes');

// Configurar conexão específica para console_analises
// MONGODB_URI deve ser configurada via variável de ambiente (secrets)
if (!process.env.MONGODB_URI) {
  throw new Error('❌ MONGODB_URI não configurada. Configure a variável de ambiente MONGODB_URI.');
}
const MONGODB_URI = process.env.MONGODB_URI;
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';

async function migrateQualidadeFuncionariosAtuacao() {
  try {
    console.log('🔄 [MIGRAÇÃO] Iniciando migração de qualidade_funcionarios.atuacao');
    console.log('🔄 [MIGRAÇÃO] String -> Array de ObjectIds');
    
    // Conectar ao banco
    const analisesConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: ANALISES_DB_NAME
    });
    
    // Buscar todos os funcionários com atuacao como string
    const funcionarios = await QualidadeFuncionario.find({
      atuacao: { $type: 'string', $ne: '' }
    });
    
    console.log(`🔄 [MIGRAÇÃO] Encontrados ${funcionarios.length} funcionários para migrar`);
    
    let migrados = 0;
    let erros = 0;
    
    for (const funcionario of funcionarios) {
      try {
        const atuacaoString = funcionario.atuacao;
        
        // Buscar a função correspondente
        const funcao = await QualidadeFuncoes.findOne({ funcao: atuacaoString });
        
        if (funcao) {
          // Atualizar para array de ObjectIds
          await QualidadeFuncionario.findByIdAndUpdate(funcionario._id, {
            $set: {
              atuacao: [funcao._id],
              updatedAt: new Date()
            }
          });
          
          console.log(`✅ [MIGRAÇÃO] Funcionário ${funcionario.colaboradorNome}: "${atuacaoString}" -> [${funcao._id}]`);
          migrados++;
        } else {
          console.log(`⚠️ [MIGRAÇÃO] Função não encontrada para "${atuacaoString}" - Funcionário: ${funcionario.colaboradorNome}`);
          
          // Criar função automaticamente se não existir
          const novaFuncao = new QualidadeFuncoes({
            funcao: atuacaoString,
            descricao: `Função migrada automaticamente para ${funcionario.colaboradorNome}`
          });
          
          const funcaoCriada = await novaFuncao.save();
          
          // Atualizar funcionário com a nova função
          await QualidadeFuncionario.findByIdAndUpdate(funcionario._id, {
            $set: {
              atuacao: [funcaoCriada._id],
              updatedAt: new Date()
            }
          });
          
          console.log(`✅ [MIGRAÇÃO] Função criada automaticamente: "${atuacaoString}" -> [${funcaoCriada._id}]`);
          migrados++;
        }
      } catch (error) {
        console.error(`❌ [MIGRAÇÃO] Erro ao migrar funcionário ${funcionario.colaboradorNome}:`, error.message);
        erros++;
      }
    }
    
    console.log('🔄 [MIGRAÇÃO] Migração concluída:');
    console.log(`✅ Migrados: ${migrados}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`📊 Total processados: ${funcionarios.length}`);
    
    // Verificar funcionários com atuacao vazia ou null
    const funcionariosSemAtuacao = await QualidadeFuncionario.find({
      $or: [
        { atuacao: { $exists: false } },
        { atuacao: null },
        { atuacao: '' }
      ]
    });
    
    if (funcionariosSemAtuacao.length > 0) {
      console.log(`⚠️ [MIGRAÇÃO] ${funcionariosSemAtuacao.length} funcionários sem atuação definida:`);
      funcionariosSemAtuacao.forEach(func => {
        console.log(`   - ${func.colaboradorNome} (ID: ${func._id})`);
      });
    }
    
    // Verificar funcionários com atuacao como array (já migrados)
    const funcionariosMigrados = await QualidadeFuncionario.find({
      atuacao: { $type: 'array' }
    });
    
    console.log(`✅ [MIGRAÇÃO] ${funcionariosMigrados.length} funcionários já com atuacao como array`);
    
    console.log('🔄 [MIGRAÇÃO] Migração de qualidade_funcionarios.atuacao concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ [MIGRAÇÃO] Erro durante a migração:', error);
    throw error;
  }
}

// Executar migração se chamado diretamente
if (require.main === module) {
  migrateQualidadeFuncionariosAtuacao()
    .then(() => {
      console.log('✅ [MIGRAÇÃO] Migração executada com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ [MIGRAÇÃO] Erro na migração:', error);
      process.exit(1);
    });
}

module.exports = migrateQualidadeFuncionariosAtuacao;
