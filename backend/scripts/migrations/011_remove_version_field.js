// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Script para remover campo __v (versionKey) dos documentos

const mongoose = require('mongoose');

// Configuração da conexão
const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';

async function removeVersionField() {
  let connection;
  
  try {
    console.log('🧹 Iniciando remoção do campo __v...');
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
    
    console.log('📊 Verificando documentos com campo __v...');
    
    // Contar documentos com campo __v
    const totalUsers = await usersCollection.countDocuments();
    const usersWithVersionField = await usersCollection.countDocuments({
      "__v": { $exists: true }
    });
    
    console.log(`📈 Estatísticas:`);
    console.log(`   - Total de usuários: ${totalUsers}`);
    console.log(`   - Usuários com campo '__v': ${usersWithVersionField}`);
    
    // Remover campo __v se existir
    if (usersWithVersionField > 0) {
      console.log('🧹 Removendo campo "__v" dos documentos...');
      const result = await usersCollection.updateMany(
        { "__v": { $exists: true } },
        { $unset: { "__v": "" } }
      );
      console.log(`✅ Campo "__v" removido de ${result.modifiedCount} documentos`);
    } else {
      console.log('✅ Nenhum documento possui o campo "__v"');
    }
    
    // Verificar resultado final
    console.log('🔍 Verificando resultado da limpeza...');
    const finalUsersWithVersionField = await usersCollection.countDocuments({
      "__v": { $exists: true }
    });
    
    console.log(`📊 Estatísticas após limpeza:`);
    console.log(`   - Usuários com campo '__v': ${finalUsersWithVersionField}`);
    
    // Mostrar exemplo de documento limpo
    const sampleUser = await usersCollection.findOne({}, {
      projection: {
        _userMail: 1,
        _userClearance: 1,
        _funcoesAdministrativas: 1,
        createdAt: 1,
        updatedAt: 1,
        __v: 1
      }
    });
    
    if (sampleUser) {
      console.log('📄 Exemplo de documento após limpeza:');
      console.log(JSON.stringify(sampleUser, null, 2));
    }
    
    console.log('✅ Remoção do campo __v concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
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

// Executar limpeza se chamado diretamente
if (require.main === module) {
  removeVersionField()
    .then(() => {
      console.log('🎉 Limpeza finalizada!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na limpeza:', error);
      process.exit(1);
    });
}

module.exports = { removeVersionField };
