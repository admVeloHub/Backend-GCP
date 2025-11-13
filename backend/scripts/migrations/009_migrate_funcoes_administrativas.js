// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Script de migração para adicionar campos faltantes em _funcoesAdministrativas

const mongoose = require('mongoose');

// Configuração da conexão
const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';

async function migrateFuncoesAdministrativas() {
  let connection;
  
  try {
    console.log('🚀 Iniciando migração de _funcoesAdministrativas...');
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
    
    console.log('📊 Verificando documentos existentes...');
    
    // Contar documentos antes da migração
    const totalUsers = await usersCollection.countDocuments();
    const usersWithoutAuditoria = await usersCollection.countDocuments({
      "_funcoesAdministrativas.auditoria": { $exists: false }
    });
    const usersWithoutRelatoriosGestao = await usersCollection.countDocuments({
      "_funcoesAdministrativas.relatoriosGestao": { $exists: false }
    });
    const usersWithExtraId = await usersCollection.countDocuments({
      "_userTickets._id": { $exists: true }
    });
    
    console.log(`📈 Estatísticas antes da migração:`);
    console.log(`   - Total de usuários: ${totalUsers}`);
    console.log(`   - Usuários sem campo 'auditoria': ${usersWithoutAuditoria}`);
    console.log(`   - Usuários sem campo 'relatoriosGestao': ${usersWithoutRelatoriosGestao}`);
    console.log(`   - Usuários com _id extra em _userTickets: ${usersWithExtraId}`);
    
    // 1. Adicionar campo 'auditoria' se não existir
    if (usersWithoutAuditoria > 0) {
      console.log('🔧 Adicionando campo "auditoria" aos documentos...');
      const resultAuditoria = await usersCollection.updateMany(
        { "_funcoesAdministrativas.auditoria": { $exists: false } },
        { $set: { "_funcoesAdministrativas.auditoria": false } }
      );
      console.log(`✅ Campo "auditoria" adicionado a ${resultAuditoria.modifiedCount} documentos`);
    }
    
    // 2. Adicionar campo 'relatoriosGestao' se não existir
    if (usersWithoutRelatoriosGestao > 0) {
      console.log('🔧 Adicionando campo "relatoriosGestao" aos documentos...');
      const resultRelatorios = await usersCollection.updateMany(
        { "_funcoesAdministrativas.relatoriosGestao": { $exists: false } },
        { $set: { "_funcoesAdministrativas.relatoriosGestao": false } }
      );
      console.log(`✅ Campo "relatoriosGestao" adicionado a ${resultRelatorios.modifiedCount} documentos`);
    }
    
    // 3. Remover campo _id extra do _userTickets se existir
    if (usersWithExtraId > 0) {
      console.log('🧹 Removendo campo _id extra do _userTickets...');
      const resultCleanup = await usersCollection.updateMany(
        { "_userTickets._id": { $exists: true } },
        { $unset: { "_userTickets._id": "" } }
      );
      console.log(`✅ Campo _id extra removido de ${resultCleanup.modifiedCount} documentos`);
    }
    
    // Verificar resultado final
    console.log('🔍 Verificando resultado da migração...');
    const finalUsersWithoutAuditoria = await usersCollection.countDocuments({
      "_funcoesAdministrativas.auditoria": { $exists: false }
    });
    const finalUsersWithoutRelatoriosGestao = await usersCollection.countDocuments({
      "_funcoesAdministrativas.relatoriosGestao": { $exists: false }
    });
    const finalUsersWithExtraId = await usersCollection.countDocuments({
      "_userTickets._id": { $exists: true }
    });
    
    console.log(`📊 Estatísticas após migração:`);
    console.log(`   - Usuários sem campo 'auditoria': ${finalUsersWithoutAuditoria}`);
    console.log(`   - Usuários sem campo 'relatoriosGestao': ${finalUsersWithoutRelatoriosGestao}`);
    console.log(`   - Usuários com _id extra em _userTickets: ${finalUsersWithExtraId}`);
    
    // Mostrar exemplo de documento atualizado
    const sampleUser = await usersCollection.findOne({}, {
      projection: {
        _userMail: 1,
        _funcoesAdministrativas: 1,
        _userTickets: 1
      }
    });
    
    if (sampleUser) {
      console.log('📄 Exemplo de documento após migração:');
      console.log(JSON.stringify(sampleUser, null, 2));
    }
    
    console.log('✅ Migração de _funcoesAdministrativas concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
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

// Executar migração se chamado diretamente
if (require.main === module) {
  migrateFuncoesAdministrativas()
    .then(() => {
      console.log('🎉 Migração finalizada!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na migração:', error);
      process.exit(1);
    });
}

module.exports = { migrateFuncoesAdministrativas };
