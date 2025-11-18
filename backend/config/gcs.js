// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const { Storage } = require('@google-cloud/storage');

// Configuração do Google Cloud Storage
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;

// Inicializar cliente do GCS
let storage;
let bucket;

// Tipos de arquivo permitidos
const ALLOWED_FILE_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg'
];

// Extensões permitidas
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg'];

// Tamanho máximo do arquivo (50MB em bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Inicializar cliente do Google Cloud Storage
 */
const initializeGCS = () => {
  try {
    if (!GCP_PROJECT_ID || !GCS_BUCKET_NAME) {
      throw new Error('GCP_PROJECT_ID e GCS_BUCKET_NAME devem estar configurados nas variáveis de ambiente');
    }

    // Inicializar Storage
    // Se GCP_SERVICE_ACCOUNT_KEY estiver definido, usar credenciais do arquivo
    // Caso contrário, usar Application Default Credentials (ADC)
    if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
      const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
      storage = new Storage({
        projectId: GCP_PROJECT_ID,
        credentials: credentials
      });
    } else {
      storage = new Storage({
        projectId: GCP_PROJECT_ID
        // ADC será usado automaticamente
      });
    }

    bucket = storage.bucket(GCS_BUCKET_NAME);
    console.log('✅ Google Cloud Storage inicializado');
    return { storage, bucket };
  } catch (error) {
    console.error('❌ Erro ao inicializar Google Cloud Storage:', error);
    throw error;
  }
};

/**
 * Obter instância do bucket
 */
const getBucket = () => {
  if (!bucket) {
    initializeGCS();
  }
  return bucket;
};

/**
 * Validar tipo de arquivo
 */
const validateFileType = (mimeType, fileName) => {
  // Validar por MIME type
  if (mimeType && !ALLOWED_FILE_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido: ${mimeType}. Tipos permitidos: ${ALLOWED_FILE_TYPES.join(', ')}`
    };
  }

  // Validar por extensão
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Extensão de arquivo não permitida: ${extension}. Extensões permitidas: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  return { valid: true };
};

/**
 * Validar tamanho do arquivo
 */
const validateFileSize = (fileSize) => {
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Arquivo muito grande: ${(fileSize / 1024 / 1024).toFixed(2)}MB. Tamanho máximo permitido: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    };
  }

  return { valid: true };
};

/**
 * Gerar Signed URL para upload direto
 * @param {string} fileName - Nome do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 * @param {number} expirationMinutes - Minutos até expiração (padrão: 15)
 * @returns {Promise<{url: string, fileName: string}>}
 */
const generateUploadSignedUrl = async (fileName, mimeType, expirationMinutes = 15) => {
  try {
    // Validar tipo de arquivo
    const typeValidation = validateFileType(mimeType, fileName);
    if (!typeValidation.valid) {
      throw new Error(typeValidation.error);
    }

    const bucket = getBucket();
    
    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const uniqueFileName = `audio/${timestamp}-${fileName}`;
    
    // Criar referência do arquivo
    const file = bucket.file(uniqueFileName);

    // Opções para Signed URL
    const options = {
      version: 'v4',
      action: 'write',
      expires: Date.now() + expirationMinutes * 60 * 1000,
      contentType: mimeType
    };

    // Gerar Signed URL
    const [url] = await file.getSignedUrl(options);

    return {
      url,
      fileName: uniqueFileName,
      bucket: GCS_BUCKET_NAME,
      expiresIn: expirationMinutes * 60 // segundos
    };
  } catch (error) {
    console.error('❌ Erro ao gerar Signed URL:', error);
    throw error;
  }
};

/**
 * Configurar notificação do bucket para Pub/Sub
 * @param {string} topicName - Nome do tópico Pub/Sub
 * @returns {Promise<void>}
 */
const configureBucketNotification = async (topicName) => {
  try {
    const bucket = getBucket();
    
    await bucket.addNotification({
      topic: topicName,
      eventTypes: ['OBJECT_FINALIZE'], // Quando arquivo é criado/upload concluído
      payloadFormat: 'JSON_API_V1'
    });

    console.log(`✅ Notificação do bucket configurada para tópico: ${topicName}`);
  } catch (error) {
    console.error('❌ Erro ao configurar notificação do bucket:', error);
    throw error;
  }
};

/**
 * Verificar se arquivo existe no bucket
 * @param {string} fileName - Nome do arquivo no bucket
 * @returns {Promise<boolean>}
 */
const fileExists = async (fileName) => {
  try {
    const bucket = getBucket();
    const file = bucket.file(fileName);
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error('❌ Erro ao verificar existência do arquivo:', error);
    return false;
  }
};

/**
 * Obter metadados do arquivo
 * @param {string} fileName - Nome do arquivo no bucket
 * @returns {Promise<object>}
 */
const getFileMetadata = async (fileName) => {
  try {
    const bucket = getBucket();
    const file = bucket.file(fileName);
    const [metadata] = await file.getMetadata();
    return metadata;
  } catch (error) {
    console.error('❌ Erro ao obter metadados do arquivo:', error);
    throw error;
  }
};

module.exports = {
  initializeGCS,
  getBucket,
  validateFileType,
  validateFileSize,
  generateUploadSignedUrl,
  configureBucketNotification,
  fileExists,
  getFileMetadata,
  ALLOWED_FILE_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE
};

