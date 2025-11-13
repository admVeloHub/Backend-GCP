// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Script de correção para resolver erros da migração anterior

const mongoose = require('mongoose');

// Configuração da conexão
const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';

async function fixMigrationErrors() {
  let connection;
  
  try {
    console.log('🔧 Iniciando correção dos erros de migração...');
    console.log(`📡 Conectando ao MongoDB: ${CONFIG_DB_NAME}`);
    
    // Conectar ao MongoDB
    connection = await mongoose.createConnection(MONGODB_URI, {
      dbName: CONFIG_DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });
    
    console.log('✅ Conexão estabelecida com sucesso');
    
    // Aguardar a conexão estar pronta
    await new Promise((resolve, reject) => {
      connection.once('open', () => {
        console.log('🔗 Conexão MongoDB aberta');
        resolve();
      });
      connection.once('error', (err) => {
        console.error('❌ Erro na conexão:', err);
        reject(err);
      });
    });
    
    const db = connection.db;
    const usersCollection = db.collection('users');
    
    console.log('📊 Verificando problemas existentes...');
    
    // Contar problemas
    const totalUsers = await usersCollection.countDocuments();
    const usersWithoutBotAnalises = await usersCollection.countDocuments({
      "_userClearance.botAnalises": { $exists: false }
    });
    const usersWithExtraIdInClearance = await usersCollection.countDocuments({
      "_userClearance._id": { $exists: true }
    });
    const usersWithExtraIdInFuncoes = await usersCollection.countDocuments({
      "_funcoesAdministrativas._id": { $exists: true }
    });
    
    console.log(`📈 Estatísticas dos problemas:`);
    console.log(`   - Total de usuários: ${totalUsers}`);
    console.log(`   - Usuários sem campo 'botAnalises' no _userClearance: ${usersWithoutBotAnalises}`);
    console.log(`   - Usuários com _id extra no _userClearance: ${usersWithExtraIdInClearance}`);
    console.log(`   - Usuários com _id extra no _funcoesAdministrativas: ${usersWithExtraIdInFuncoes}`);
    
    // 1. Adicionar campo 'botAnalises' ao _userClearance se não existir
    if (usersWithoutBotAnalises > 0) {
      console.log('🔧 Adicionando campo "botAnalises" ao _userClearance...');
      const resultBotAnalises = await usersCollection.updateMany(
        { "_userClearance.botAnalises": { $exists: false } },
        { $set: { "_userClearance.botAnalises": false } }
      );
      console.log(`✅ Campo "botAnalises" adicionado a ${resultBotAnalises.modifiedCount} documentos`);
    }
    
    // 2. Remover campo _id extra do _userClearance
    if (usersWithExtraIdInClearance > 0) {
      console.log('🧹 Removendo campo _id extra do _userClearance...');
      const resultClearanceCleanup = await usersCollection.updateMany(
        { "_userClearance._id": { $exists: true } },
        { $unset: { "_userClearance._id": "" } }
      );
      console.log(`✅ Campo _id extra removido de ${resultClearanceCleanup.modifiedCount} documentos no _userClearance`);
    }
    
    // 3. Remover campo _id extra do _funcoesAdministrativas
    if (usersWithExtraIdInFuncoes > 0) {
      console.log('🧹 Removendo campo _id extra do _funcoesAdministrativas...');
      const resultFuncoesCleanup = await usersCollection.updateMany(
        { "_funcoesAdministrativas._id": { $exists: true } },
        { $unset: { "_funcoesAdministrativas._id": "" } }
      );
      console.log(`✅ Campo _id extra removido de ${resultFuncoesCleanup.modifiedCount} documentos no _funcoesAdministrativas`);
    }
    
    // Verificar resultado final
    console.log('🔍 Verificando resultado da correção...');
    const finalUsersWithoutBotAnalises = await usersCollection.countDocuments({
      "_userClearance.botAnalises": { $exists: false }
    });
    const finalUsersWithExtraIdInClearance = await usersCollection.countDocuments({
      "_userClearance._id": { $exists: true }
    });
    const finalUsersWithExtraIdInFuncoes = await usersCollection.countDocuments({
      "_funcoesAdministrativas._id": { $exists: true }
    });
    
    console.log(`📊 Estatísticas após correção:`);
    console.log(`   - Usuários sem campo 'botAnalises' no _userClearance: ${finalUsersWithoutBotAnalises}`);
    console.log(`   - Usuários com _id extra no _userClearance: ${finalUsersWithExtraIdInClearance}`);
    console.log(`   - Usuários com _id extra no _funcoesAdministrativas: ${finalUsersWithExtraIdInFuncoes}`);
    
    // Mostrar exemplo de documento corrigido
    const sampleUser = await usersCollection.findOne({}, {
      projection: {
        _userMail: 1,
        _userClearance: 1,
        _funcoesAdministrativas: 1
      }
    });
    
    if (sampleUser) {
      console.log('📄 Exemplo de documento após correção:');
      console.log(JSON.stringify(sampleUser, null, 2));
    }
    
    console.log('✅ Correção dos erros de migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Fechar conexão se foi estabelecida
    if (connection) {
      try {
        await connection.close();
        console.log('🔌 Conexão MongoDB fechada');
      } catch (closeError) {
        console.error('⚠️ Erro ao fechar conexão:', closeError.message);
      }
    }
  }
}

// Executar correção se chamado diretamente
if (require.main === module) {
  fixMigrationErrors()
    .then(() => {
      console.log('🎉 Correção finalizada!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na correção:', error);
      process.exit(1);
    });
}

module.exports = { fixMigrationErrors };
