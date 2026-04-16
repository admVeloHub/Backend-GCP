// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
// MIGRAÇÃO CRÍTICA - QUALIDADE_FUNCIONARIOS
// Campo acessos deve ser alterado de Array de objetos para Objeto booleano {Velohub: Boolean, Console: Boolean}

// Carregar variáveis de ambiente
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
const QualidadeFuncionario = require('../../models/QualidadeFuncionario');

// Configurar conexão específica para console_analises
// Tentar MONGO_ENV primeiro (produção), depois MONGODB_URI (desenvolvimento)
const MONGODB_URI = process.env.MONGO_ENV || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('❌ MONGO_ENV ou MONGODB_URI não configurada. Configure uma das variáveis de ambiente.');
}
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';

async function migrateQualidadeFuncionariosAcessos() {
  try {
    console.log('🔄 [MIGRAÇÃO] Iniciando migração de qualidade_funcionarios.acessos');
    console.log('🔄 [MIGRAÇÃO] Array de objetos -> Objeto booleano {Velohub: Boolean, Console: Boolean}');
    
    // Conectar ao banco
    const analisesConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: ANALISES_DB_NAME
    });
    
    // Buscar todos os funcionários com acessos como array
    const funcionarios = await QualidadeFuncionario.find({
      acessos: { $type: 'array' }
    });
    
    console.log(`🔄 [MIGRAÇÃO] Encontrados ${funcionarios.length} funcionários para migrar`);
    
    let migrados = 0;
    let erros = 0;
    let ignorados = 0;
    
    for (const funcionario of funcionarios) {
      try {
        const acessosArray = funcionario.acessos;
        
        if (!Array.isArray(acessosArray) || acessosArray.length === 0) {
          // Se array vazio, definir como null
          await QualidadeFuncionario.findByIdAndUpdate(funcionario._id, {
            $set: {
              acessos: null,
              updatedAt: new Date()
            }
          });
          console.log(`⚠️ [MIGRAÇÃO] Funcionário ${funcionario.colaboradorNome}: Array vazio -> null`);
          ignorados++;
          continue;
        }
        
        // Converter array para objeto booleano
        const novoAcessos = {};
        let temAcesso = false;
        
        acessosArray.forEach(acesso => {
          if (acesso && acesso.sistema) {
            const sistema = acesso.sistema.toLowerCase();
            if (sistema === 'velohub') {
              novoAcessos.Velohub = true;
              temAcesso = true;
            } else if (sistema === 'console') {
              novoAcessos.Console = true;
              temAcesso = true;
            }
          }
        });
        
        // Apenas definir acessos se houver pelo menos um acesso válido
        // Se não houver acesso válido, definir como null (não criar objeto vazio)
        const acessosParaSalvar = temAcesso ? novoAcessos : null;
        
        await QualidadeFuncionario.findByIdAndUpdate(funcionario._id, {
          $set: {
            acessos: acessosParaSalvar,
            updatedAt: new Date()
          }
        });
        
        if (temAcesso) {
          console.log(`✅ [MIGRAÇÃO] Funcionário ${funcionario.colaboradorNome}: Array -> ${JSON.stringify(novoAcessos)}`);
        } else {
          console.log(`⚠️ [MIGRAÇÃO] Funcionário ${funcionario.colaboradorNome}: Array sem sistemas válidos -> null`);
        }
        
        migrados++;
      } catch (error) {
        console.error(`❌ [MIGRAÇÃO] Erro ao migrar funcionário ${funcionario.colaboradorNome}:`, error.message);
        erros++;
      }
    }
    
    // Verificar funcionários que já estão no formato novo (objeto) ou null
    const funcionariosFormatados = await QualidadeFuncionario.find({
      $or: [
        { acessos: { $type: 'object', $not: { $type: 'array' } } },
        { acessos: null },
        { acessos: { $exists: false } }
      ]
    });
    
    console.log('🔄 [MIGRAÇÃO] Migração concluída:');
    console.log(`✅ Migrados: ${migrados}`);
    console.log(`⚠️ Ignorados (arrays vazios): ${ignorados}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`📊 Total processados: ${funcionarios.length}`);
    console.log(`✅ Já no formato correto ou null: ${funcionariosFormatados.length}`);
    
    // Verificar funcionários com acessos no formato antigo que não foram migrados
    const funcionariosNaoMigrados = await QualidadeFuncionario.find({
      acessos: { $type: 'array' }
    });
    
    if (funcionariosNaoMigrados.length > 0) {
      console.log(`⚠️ [MIGRAÇÃO] ATENÇÃO: ${funcionariosNaoMigrados.length} funcionários ainda no formato antigo:`);
      funcionariosNaoMigrados.forEach(func => {
        console.log(`   - ${func.colaboradorNome} (ID: ${func._id})`);
      });
    } else {
      console.log('✅ [MIGRAÇÃO] Todos os funcionários foram migrados com sucesso!');
    }
    
    await analisesConnection.close();
    console.log('✅ [MIGRAÇÃO] Conexão fechada');
    
  } catch (error) {
    console.error('❌ [MIGRAÇÃO] Erro fatal na migração:', error);
    throw error;
  }
}

// Executar migração se chamado diretamente
if (require.main === module) {
  migrateQualidadeFuncionariosAcessos()
    .then(() => {
      console.log('✅ [MIGRAÇÃO] Migração concluída com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ [MIGRAÇÃO] Erro na migração:', error);
      process.exit(1);
    });
}

module.exports = migrateQualidadeFuncionariosAcessos;

