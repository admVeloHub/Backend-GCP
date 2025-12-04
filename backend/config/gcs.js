// VERSION: v1.2.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const { Storage } = require('@google-cloud/storage');

// Configuração do Google Cloud Storage
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;

// Inicializar cliente do GCS
let storage;
let bucket;

// Tipos de arquivo permitidos para áudio
const ALLOWED_AUDIO_TYPES = [
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

// Tipos de arquivo permitidos para imagens
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

// Tipos de arquivo permitidos (compatibilidade com código existente)
const ALLOWED_FILE_TYPES = [...ALLOWED_AUDIO_TYPES, ...ALLOWED_IMAGE_TYPES];

// Extensões permitidas para áudio
const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg'];

// Extensões permitidas para imagens
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Extensões permitidas (compatibilidade com código existente)
const ALLOWED_EXTENSIONS = [...ALLOWED_AUDIO_EXTENSIONS, ...ALLOWED_IMAGE_EXTENSIONS];

// Tamanho máximo do arquivo de áudio (50MB em bytes)
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB

// Tamanho máximo do arquivo de imagem (10MB em bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

// Tamanho máximo do arquivo (compatibilidade - usa o maior)
const MAX_FILE_SIZE = MAX_AUDIO_SIZE;

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
 * Validar tipo de arquivo (áudio ou imagem)
 */
const validateFileType = (mimeType, fileName, fileType = 'audio') => {
  const allowedTypes = fileType === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_AUDIO_TYPES;
  const allowedExtensions = fileType === 'image' ? ALLOWED_IMAGE_EXTENSIONS : ALLOWED_AUDIO_EXTENSIONS;
  
  // Validar por MIME type
  if (mimeType && !allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido: ${mimeType}. Tipos permitidos: ${allowedTypes.join(', ')}`
    };
  }

  // Validar por extensão
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `Extensão de arquivo não permitida: ${extension}. Extensões permitidas: ${allowedExtensions.join(', ')}`
    };
  }

  return { valid: true };
};

/**
 * Validar tamanho do arquivo
 */
const validateFileSize = (fileSize, fileType = 'audio') => {
  const maxSize = fileType === 'image' ? MAX_IMAGE_SIZE : MAX_AUDIO_SIZE;
  
  if (fileSize > maxSize) {
    return {
      valid: false,
      error: `Arquivo muito grande: ${(fileSize / 1024 / 1024).toFixed(2)}MB. Tamanho máximo permitido: ${maxSize / 1024 / 1024}MB`
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

/**
 * Configurar CORS no bucket do GCS
 * Necessário para permitir uploads diretos do frontend
 * @param {Array<string>} allowedOrigins - Lista de origens permitidas (opcional)
 * @returns {Promise<void>}
 */
const configureBucketCORS = async (allowedOrigins = null) => {
  try {
    const bucket = getBucket();
    
    // Origens padrão se não fornecidas
    // NOTA: GCS não suporta wildcards como "*.run.app" diretamente
    // É necessário listar origens específicas ou usar "*" para todas
    const origins = allowedOrigins || [
      'https://console-v2-hfsqj6konq-ue.a.run.app',
      'https://console-v2-278491073220.us-east1.run.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080'
    ];
    
    // Configuração CORS
    const corsConfig = [
      {
        origin: origins,
        method: ['PUT', 'OPTIONS', 'GET', 'POST', 'HEAD'],
        responseHeader: [
          'Content-Type',
          'x-goog-resumable',
          'x-goog-content-length-range',
          'Access-Control-Allow-Origin',
          'Access-Control-Allow-Methods',
          'Access-Control-Allow-Headers',
          'Access-Control-Max-Age'
        ],
        maxAgeSeconds: 3600
      }
    ];
    
    // Aplicar configuração CORS ao bucket
    await bucket.setCorsConfiguration(corsConfig);
    
    console.log('✅ Configuração CORS aplicada ao bucket:', GCS_BUCKET_NAME);
    console.log('📋 Origens permitidas:', origins);
    
    return corsConfig;
  } catch (error) {
    console.error('❌ Erro ao configurar CORS no bucket:', error);
    throw error;
  }
};

/**
 * Verificar configuração CORS atual do bucket
 * @returns {Promise<Array>}
 */
const getBucketCORS = async () => {
  try {
    const bucket = getBucket();
    const [metadata] = await bucket.getMetadata();
    return metadata.cors || [];
  } catch (error) {
    console.error('❌ Erro ao obter configuração CORS:', error);
    return [];
  }
};

/**
 * Upload de imagem para GCS
 * @param {Buffer} fileBuffer - Buffer do arquivo
 * @param {string} fileName - Nome do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 * @returns {Promise<{url: string, fileName: string}>}
 */
const uploadImage = async (fileBuffer, fileName, mimeType) => {
  try {
    console.log(`📤 Iniciando upload de imagem: ${fileName} (${mimeType}, ${fileBuffer.length} bytes)`);
    
    // Validar tipo de arquivo
    const typeValidation = validateFileType(mimeType, fileName, 'image');
    if (!typeValidation.valid) {
      console.error('❌ Validação de tipo falhou:', typeValidation.error);
      throw new Error(typeValidation.error);
    }

    // Validar tamanho
    const sizeValidation = validateFileSize(fileBuffer.length, 'image');
    if (!sizeValidation.valid) {
      console.error('❌ Validação de tamanho falhou:', sizeValidation.error);
      throw new Error(sizeValidation.error);
    }

    // Garantir que GCS está inicializado e obter bucket
    const bucket = getBucket();
    if (!bucket) {
      throw new Error('Bucket do GCS não está disponível. Verifique as configurações.');
    }
    
    // Gerar nome único para o arquivo
    // O bucket já é mediabank_velohub, então o caminho é apenas a pasta dentro do bucket
    const timestamp = Date.now();
    const uniqueFileName = `img_velonews/${timestamp}-${fileName}`;
    console.log(`📁 Caminho do arquivo: ${uniqueFileName}`);
    console.log(`🪣 Bucket: ${GCS_BUCKET_NAME}`);
    
    // Criar referência do arquivo
    const file = bucket.file(uniqueFileName);

    // Upload do arquivo
    console.log('⬆️ Fazendo upload para GCS...');
    await file.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000' // Cache por 1 ano
      }
    });
    console.log('✅ Arquivo salvo no GCS');

    // Tornar arquivo público
    console.log('🔓 Tornando arquivo público...');
    await file.makePublic();
    console.log('✅ Arquivo tornado público');

    // Obter URL pública
    const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${uniqueFileName}`;
    console.log(`✅ Imagem uploadada com sucesso: ${uniqueFileName}`);
    console.log(`🔗 URL pública: ${publicUrl}`);

    return {
      url: publicUrl,
      fileName: uniqueFileName,
      bucket: GCS_BUCKET_NAME
    };
  } catch (error) {
    console.error('❌ Erro ao fazer upload da imagem:', error);
    console.error('❌ Stack trace:', error.stack);
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
  configureBucketCORS,
  getBucketCORS,
  fileExists,
  getFileMetadata,
  uploadImage,
  ALLOWED_FILE_TYPES,
  ALLOWED_AUDIO_TYPES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_EXTENSIONS,
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_AUDIO_SIZE,
  MAX_IMAGE_SIZE
};

