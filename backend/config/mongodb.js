// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
// Helper centralizado para obter URI do MongoDB
// A variável de ambiente correta é MONGO_ENV (definida no Secret Manager do GCP)

const getMongoUri = () => {
  const MONGODB_URI = process.env.MONGO_ENV;
  
  if (!MONGODB_URI) {
    throw new Error('❌ MONGO_ENV não configurada. Configure a variável de ambiente MONGO_ENV.');
  }
  
  return MONGODB_URI;
};

module.exports = { getMongoUri };

