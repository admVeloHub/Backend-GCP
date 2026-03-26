// VERSION: v3.3.0 | DATE: 2026-03-26 | AUTHOR: VeloHub Development Team
const { getDatabase } = require('./database');

// Definir as collections do projeto
const COLLECTIONS = {
  ARTIGOS: 'Artigos',
  ARTIGOS_CATEGORIAS: 'artigos_categorias',
  VELONEWS: 'Velonews', 
  BOT_PERGUNTAS: 'Bot_perguntas',
  USERS: 'users'
};

// Inicializar collections se necessário
const initializeCollections = async () => {
  try {
    const db = getDatabase();
    
    // Verificar se as collections existem e criar índices se necessário
    const collections = await db.listCollections().toArray();
    const existingCollections = collections.map(col => col.name);
    
    console.log('📊 Collections existentes:', existingCollections);
    
    // Criar índices para otimização
    for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
      if (!existingCollections.includes(collectionName)) {
        console.log(`📝 Criando collection: ${collectionName}`);
      }
      
      const collection = db.collection(collectionName);
      
      // Criar índices específicos para cada collection
      switch (collectionName) {
        case COLLECTIONS.ARTIGOS:
          await collection.createIndex({ createdAt: -1 });
          await collection.createIndex({ category: 1 });
          await collection.createIndex({ title: 'text', content: 'text' });
          break;
          
        case COLLECTIONS.VELONEWS:
          await collection.createIndex({ createdAt: -1 });
          await collection.createIndex({ isCritical: 1 });
          await collection.createIndex({ title: 'text', content: 'text' });
          break;
          
        case COLLECTIONS.BOT_PERGUNTAS:
          await collection.createIndex({ createdAt: -1 });
          await collection.createIndex({ topic: 1 });
          await collection.createIndex({ question: 'text', context: 'text' });
          break;
          
        case COLLECTIONS.USERS:
          await collection.createIndex({ _userMail: 1 }, { unique: true });
          await collection.createIndex({ _userId: 1 }, { unique: true });
          await collection.createIndex({ _userRole: 1 });
          await collection.createIndex({ _userClearance: 1 });
          break;
      }
    }
    
    console.log('✅ Collections e índices inicializados com sucesso');
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao inicializar collections:', error);
    return false;
  }
};

// Função para obter estatísticas das collections
const getCollectionsStats = async () => {
  try {
    const db = getDatabase();
    const stats = {};
    
    for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      stats[collectionName] = count;
    }
    
    return stats;
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
    return {};
  }
};

module.exports = {
  COLLECTIONS,
  initializeCollections,
  getCollectionsStats
};
