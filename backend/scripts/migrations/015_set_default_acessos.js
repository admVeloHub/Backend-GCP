// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
// MIGRAÇÃO - DEFINIR ACESSOS PADRÃO
// 1. Todos os funcionários ativos (desligado=false e afastado=false) recebem Velohub=true
// 2. Todos os funcionários com userMail correspondente no config recebem Console=true

// Carregar variáveis de ambiente
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../../../../env') });
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  require('dotenv').config();
} catch (error) {
  // Ignorar erro se dotenv não conseguir carregar
}

const mongoose = require('mongoose');
const QualidadeFuncionario = require('../../models/QualidadeFuncionario');
const Users = require('../../models/Users');

// Configurar conexões
const MONGODB_URI = process.env.MONGO_ENV || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('❌ MONGO_ENV ou MONGODB_URI não configurada. Configure uma das variáveis de ambiente.');
}
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';
const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';

async function setDefaultAcessos() {
  let analisesConnection = null;
  let configConnection = null;
  
  try {
    console.log('🔄 [MIGRAÇÃO] Iniciando definição de acessos padrão');
    console.log('🔄 [MIGRAÇÃO] 1. Funcionários ativos -> Velohub = true');
    console.log('🔄 [MIGRAÇÃO] 2. Funcionários com userMail no config -> Console = true');
    
    const MONGODB_URI = process.env.MONGO_ENV || process.env.MONGODB_URI;
    
    // Conectar ao banco console_analises
    analisesConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: ANALISES_DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Conectar ao banco console_config
    configConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: CONFIG_DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ [MIGRAÇÃO] Conexões estabelecidas');
    
    // Buscar todos os usuários no config
    const configUsers = await Users.find({});
    const configEmails = new Set(configUsers.map(u => u._userMail?.toLowerCase().trim()).filter(Boolean));
    console.log(`📊 [MIGRAÇÃO] Encontrados ${configUsers.length} usuários no config`);
    
    // Buscar todos os funcionários
    const funcionarios = await QualidadeFuncionario.find({});
    console.log(`📊 [MIGRAÇÃO] Encontrados ${funcionarios.length} funcionários`);
    
    let atualizadosVelohub = 0;
    let atualizadosConsole = 0;
    let erros = 0;
    
    for (const funcionario of funcionarios) {
      try {
        const isAtivo = !funcionario.desligado && !funcionario.afastado;
        const temUserMail = funcionario.userMail && funcionario.userMail.trim();
        const emailNoConfig = temUserMail && configEmails.has(funcionario.userMail.toLowerCase().trim());
        
        // Preparar novo objeto de acessos
        let novoAcessos = {};
        let precisaAtualizar = false;
        
        // Normalizar acessos existentes
        if (funcionario.acessos) {
          if (typeof funcionario.acessos === 'object' && !Array.isArray(funcionario.acessos)) {
            novoAcessos = { ...funcionario.acessos };
          } else if (Array.isArray(funcionario.acessos)) {
            funcionario.acessos.forEach(acesso => {
              if (acesso && acesso.sistema) {
                const sistema = acesso.sistema.toLowerCase();
                if (sistema === 'velohub') {
                  novoAcessos.Velohub = true;
                } else if (sistema === 'console') {
                  novoAcessos.Console = true;
                }
              }
            });
          }
        }
        
        // 1. Definir Velohub = true para funcionários ativos
        if (isAtivo) {
          if (novoAcessos.Velohub !== true) {
            novoAcessos.Velohub = true;
            precisaAtualizar = true;
          }
        }
        
        // 2. Definir Console = true para funcionários com email no config
        if (emailNoConfig) {
          if (novoAcessos.Console !== true) {
            novoAcessos.Console = true;
            precisaAtualizar = true;
          }
        }
        
        // Atualizar apenas se necessário
        if (precisaAtualizar) {
          await QualidadeFuncionario.findByIdAndUpdate(funcionario._id, {
            $set: {
              acessos: novoAcessos,
              updatedAt: new Date()
            }
          });
          
          if (novoAcessos.Velohub === true && funcionario.acessos?.Velohub !== true) {
            atualizadosVelohub++;
            console.log(`✅ [MIGRAÇÃO] ${funcionario.colaboradorNome}: Velohub = true`);
          }
          if (novoAcessos.Console === true && funcionario.acessos?.Console !== true) {
            atualizadosConsole++;
            console.log(`✅ [MIGRAÇÃO] ${funcionario.colaboradorNome}: Console = true (email: ${funcionario.userMail})`);
          }
        }
        
      } catch (error) {
        console.error(`❌ [MIGRAÇÃO] Erro ao processar funcionário ${funcionario.colaboradorNome}:`, error.message);
        erros++;
      }
    }
    
    // Relatório final
    console.log('\n📊 [MIGRAÇÃO] Relatório Final:');
    console.log(`✅ Velohub atualizados: ${atualizadosVelohub}`);
    console.log(`✅ Console atualizados: ${atualizadosConsole}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`📊 Total processados: ${funcionarios.length}`);
    
    // Fechar conexões
    await analisesConnection.close();
    await configConnection.close();
    console.log('✅ [MIGRAÇÃO] Conexões fechadas');
    
  } catch (error) {
    console.error('❌ [MIGRAÇÃO] Erro fatal na migração:', error);
    
    try {
      if (analisesConnection) await analisesConnection.close();
      if (configConnection) await configConnection.close();
    } catch (closeError) {
      console.error('❌ [MIGRAÇÃO] Erro ao fechar conexões:', closeError);
    }
    
    throw error;
  }
}

// Executar migração se chamado diretamente
if (require.main === module) {
  setDefaultAcessos()
    .then(() => {
      console.log('✅ [MIGRAÇÃO] Migração concluída com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ [MIGRAÇÃO] Erro na migração:', error);
      process.exit(1);
    });
}

module.exports = setDefaultAcessos;

