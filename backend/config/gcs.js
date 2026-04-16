// VERSION: v1.17.0 | DATE: 2026-04-16 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.17.0 - listAcademyTrophyTemasObjects: listar imagens em icones_conquistas/temas/ (reutilizar no Console)
// CHANGELOG: v1.16.0 - Troféus Academy: objeto = icones_conquistas/modulos|temas (bucket já é mediabank_academy; sem pasta duplicada)
// CHANGELOG: v1.15.0 - isAcademyTrophyObjectPath: validação path para GET proxy (leitura privada)
// CHANGELOG: v1.14.0 - uploadAcademyTrophyImage: upload servidor→GCS (evita CORS browser→storage.googleapis.com quando bucket não tem CORS/IAM)
// CHANGELOG: v1.13.1 - Academy troféus: object prefix explícito mediabank_academy/icones_conquistas/modulos|temas (convenção pedida; bucket GCS_BUCKET_NAME3)
// CHANGELOG: v1.13.0 - generateImageUploadSignedUrl: path sem duplicar nome do bucket (GCS_BUCKET_NAME3 já é mediabank_academy); configureBucketAcademyTrophiesCORS
// CHANGELOG: v1.12.1 - parseGcpServiceAccountKey: aspas tipográficas; JSON como string; fallback aspas simples→duplas se credencial válida
// CHANGELOG: v1.12.0 - parseGcpServiceAccountKey(): normaliza BOM/aspas/{{ acidental; mensagens PT para JSON inválido no .env
// CHANGELOG: v1.11.0 - Signed URL imagens Academy (pasta mediabank_academy/...): bucket GCS_BUCKET_NAME3; demais imagens mantêm GCS_BUCKET_NAME2
// CHANGELOG: v1.10.0 - generateImageUploadSignedUrl: validação explícita GCP_PROJECT_ID, GCS_BUCKET_NAME2, GCP_SERVICE_ACCOUNT_KEY (mensagens para dev local)
// CHANGELOG: v1.9.0 - publishAudioToPubSub agora usa as mesmas credenciais do GCS (Service Account Key) para garantir autenticação correta
// v1.8.0 - Adicionada validação de credenciais GCP antes de gerar Signed URLs, melhoradas mensagens de erro para problemas de autenticação
const { Storage } = require('@google-cloud/storage');
const { PubSub } = require('@google-cloud/pubsub');

// Configuração do Google Cloud Storage
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME; // Para outras funções (áudio, etc)
const GCS_BUCKET_NAME_IMAGES = process.env.GCS_BUCKET_NAME2; // Imagens gerais (ex.: img_velonews)
const GCS_BUCKET_NAME_ACADEMY_TROPHIES = process.env.GCS_BUCKET_NAME3; // Troféus Academy (prefixo mediabank_academy/...)

// LOG CRÍTICO: Verificar valores das variáveis de ambiente ao carregar o módulo
console.log('🔍 [GCS CONFIG] Verificando variáveis de ambiente:');
console.log(`   GCP_PROJECT_ID: ${GCP_PROJECT_ID ? '✅ DEFINIDO' : '❌ NÃO DEFINIDO'}`);
console.log(`   GCS_BUCKET_NAME (outras funções): ${GCS_BUCKET_NAME ? `✅ DEFINIDO = "${GCS_BUCKET_NAME}"` : '❌ NÃO DEFINIDO'}`);
console.log(`   GCS_BUCKET_NAME2 (imagens): ${GCS_BUCKET_NAME_IMAGES ? `✅ DEFINIDO = "${GCS_BUCKET_NAME_IMAGES}"` : '❌ NÃO DEFINIDO'}`);
console.log(`   GCS_BUCKET_NAME3 (troféus Academy): ${GCS_BUCKET_NAME_ACADEMY_TROPHIES ? `✅ DEFINIDO = "${GCS_BUCKET_NAME_ACADEMY_TROPHIES}"` : '❌ NÃO DEFINIDO'}`);
if (!GCS_BUCKET_NAME_IMAGES) {
  console.error('🚨 ERRO CRÍTICO: GCS_BUCKET_NAME2 não está definido! Upload de imagens (exceto Academy) NÃO funcionará!');
}
if (!GCS_BUCKET_NAME_ACADEMY_TROPHIES) {
  console.warn('⚠️ GCS_BUCKET_NAME3 não definido — uploads de troféus Academy (mediabank_academy) falharão até configurar.');
}

// Inicializar cliente do GCS
let storage;
let bucket; // Bucket padrão (para outras funções)
let bucketImages; // Bucket EXCLUSIVO para imagens (GCS_BUCKET_NAME2)
let bucketAcademyTrophies; // Bucket troféus Academy (GCS_BUCKET_NAME3)

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
 * Faz parse do JSON da Service Account a partir de process.env (uma linha no .env).
 * Corrige casos comuns: BOM, aspas simples à volta do JSON, "{{" duplicado no início,
 * aspas tipográficas, JSON guardado como string JSON, chaves com aspas simples (erro na coluna 2 após "{").
 */
function isLikelyGcpServiceAccountJson(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.type === 'string' &&
    obj.type === 'service_account' &&
    typeof obj.client_email === 'string' &&
    typeof obj.private_key === 'string'
  );
}

function parseGcpServiceAccountKey(raw) {
  if (raw == null || typeof raw !== 'string') {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY tem de ser texto (JSON da Service Account).');
  }
  let s = raw.trim();
  if (s.length === 0) {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY está vazio.');
  }
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
  }
  if (s.startsWith("'") && s.endsWith("'") && s.length > 2) {
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('{{')) {
    s = `{${s.slice(2)}`;
  }
  // Excel / colagem: "=" no início do valor
  if (s.startsWith('=') && s.includes('{')) {
    s = s.slice(1).trim();
  }

  const tryParse = (input) => {
    try {
      const cred = JSON.parse(input);
      if (!cred || typeof cred !== 'object') {
        return null;
      }
      return cred;
    } catch {
      return null;
    }
  };

  let cred = tryParse(s);
  if (cred !== null && typeof cred === 'object') {
    return cred;
  }

  // Aspas tipográficas em vez de " (colagem Word/Outlook)
  const sSmart = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  cred = tryParse(sSmart);
  if (cred !== null && typeof cred === 'object') {
    return cred;
  }

  // Valor = string JSON (ficheiro inteiro escapado como string numa variável)
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      const inner = JSON.parse(s);
      if (typeof inner === 'string') {
        const t = inner.trim();
        if (t.startsWith('{')) {
          cred = tryParse(t);
          if (cred && isLikelyGcpServiceAccountJson(cred)) {
            return cred;
          }
        }
      }
    } catch {
      /* continuar */
    }
  }

  // Erro típico "position 1": após "{" vem "'" (objeto estilo JavaScript, não JSON)
  const sSingleToDouble = s.replace(/'/g, '"');
  cred = tryParse(sSingleToDouble);
  if (cred && isLikelyGcpServiceAccountJson(cred)) {
    return cred;
  }

  let lastErr = 'parse falhou';
  try {
    JSON.parse(s);
  } catch (e) {
    lastErr = e.message;
  }

  throw new Error(
    `GCP_SERVICE_ACCOUNT_KEY: JSON inválido (${lastErr}). ` +
      'O ficheiro .json da Google usa sempre aspas duplas (") nas chaves; não uses aspas simples (\') no interior. ' +
      'Cole o JSON completo numa única linha minificada, sem quebras no meio. ' +
      'Se copiaste de Word/Excel, volta a colar a partir do ficheiro .json original. ' +
      'Confirma que não há texto nem "=" antes do primeiro "{".'
  );
}

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
      try {
        const credentials = parseGcpServiceAccountKey(process.env.GCP_SERVICE_ACCOUNT_KEY);
        
        // Validar que credentials contém client_email (necessário para Signed URLs)
        if (!credentials.client_email) {
          console.error('❌ [GCS CONFIG] GCP_SERVICE_ACCOUNT_KEY não contém client_email. Signed URLs não funcionarão.');
          throw new Error('GCP_SERVICE_ACCOUNT_KEY deve conter um objeto JSON com client_email');
        }
        
        storage = new Storage({
          projectId: GCP_PROJECT_ID,
          credentials: credentials
        });
        console.log('✅ [GCS CONFIG] Storage inicializado com Service Account Key');
      } catch (parseError) {
        console.error('❌ [GCS CONFIG] Erro ao parsear GCP_SERVICE_ACCOUNT_KEY:', parseError.message);
        throw new Error(`GCP_SERVICE_ACCOUNT_KEY inválido: ${parseError.message}`);
      }
    } else {
      console.warn('⚠️ [GCS CONFIG] GCP_SERVICE_ACCOUNT_KEY não definido. Tentando usar ADC (Application Default Credentials).');
      console.warn('⚠️ [GCS CONFIG] NOTA: Signed URLs podem falhar sem Service Account Key configurado.');
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
 * Obter instância do bucket (para outras funções - áudio, etc)
 */
const getBucket = () => {
  if (!bucket) {
    initializeGCS();
  }
  return bucket;
};

/**
 * Obter instância do bucket de IMAGENS (exclusivo)
 */
const getBucketImages = () => {
  // Validar se variável está configurada
  console.log(`🔍 [getBucketImages] Verificando GCS_BUCKET_NAME_IMAGES: ${GCS_BUCKET_NAME_IMAGES ? `"${GCS_BUCKET_NAME_IMAGES}"` : 'UNDEFINED'}`);
  if (!GCS_BUCKET_NAME_IMAGES) {
    console.error('❌ [getBucketImages] GCS_BUCKET_NAME2 não está configurado nas variáveis de ambiente');
    console.error('❌ [getBucketImages] process.env.GCS_BUCKET_NAME2 =', process.env.GCS_BUCKET_NAME2);
    throw new Error('GCS_BUCKET_NAME2 não está configurado nas variáveis de ambiente');
  }
  
  ensureStorageForSignedUrls();
  
  // Criar/obter bucket de imagens se ainda não existe
  if (!bucketImages) {
    console.log(`🔍 [getBucketImages] Criando bucket com nome: "${GCS_BUCKET_NAME_IMAGES}"`);
    bucketImages = storage.bucket(GCS_BUCKET_NAME_IMAGES);
    console.log(`✅ [getBucketImages] Bucket de imagens inicializado: "${GCS_BUCKET_NAME_IMAGES}"`);
  } else {
    console.log(`✅ [getBucketImages] Bucket de imagens já existe: "${GCS_BUCKET_NAME_IMAGES}"`);
  }
  
  return bucketImages;
};

/**
 * Storage compartilhado por getBucketImages / getBucketAcademyTrophies (evita duplicar init).
 */
const ensureStorageForSignedUrls = () => {
  if (!storage) {
    if (!GCP_PROJECT_ID) {
      throw new Error('GCP_PROJECT_ID não está configurado nas variáveis de ambiente');
    }
    if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
      const credentials = parseGcpServiceAccountKey(process.env.GCP_SERVICE_ACCOUNT_KEY);
      storage = new Storage({
        projectId: GCP_PROJECT_ID,
        credentials
      });
    } else {
      storage = new Storage({
        projectId: GCP_PROJECT_ID
      });
    }
  }
};

/**
 * Bucket de troféus / ícones Academy (prefixo de pasta mediabank_academy em signed uploads).
 */
const getBucketAcademyTrophies = () => {
  if (!GCS_BUCKET_NAME_ACADEMY_TROPHIES) {
    console.error('❌ [getBucketAcademyTrophies] GCS_BUCKET_NAME3 não está definido');
    throw new Error('GCS_BUCKET_NAME3 não está configurado nas variáveis de ambiente');
  }
  ensureStorageForSignedUrls();
  if (!bucketAcademyTrophies) {
    bucketAcademyTrophies = storage.bucket(GCS_BUCKET_NAME_ACADEMY_TROPHIES);
    console.log(`✅ [getBucketAcademyTrophies] Bucket: "${GCS_BUCKET_NAME_ACADEMY_TROPHIES}"`);
  }
  return bucketAcademyTrophies;
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
 * Gerar Signed URL para upload direto (áudio)
 * @param {string} fileName - Nome do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 * @param {number} expirationMinutes - Minutos até expiração (padrão: 15)
 * @returns {Promise<{url: string, fileName: string}>}
 */
const generateUploadSignedUrl = async (fileName, mimeType, expirationMinutes = 15) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7621/ingest/8e27b4c3-0140-42a6-b4bc-2e9c16a86c7a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'17a57b'},body:JSON.stringify({sessionId:'17a57b',location:'gcs.js:207',message:'generateUploadSignedUrl entry',data:{fileName,mimeType},timestamp:Date.now(),runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    
    // Validar credenciais antes de prosseguir
    // NOTA: Signed URLs requerem Service Account Key com client_email
    // ADC (Application Default Credentials) não funciona para Signed URLs
    if (!process.env.GCP_SERVICE_ACCOUNT_KEY) {
      const errorMsg = 'GCP_SERVICE_ACCOUNT_KEY não está configurado. Configure esta variável no arquivo .env com o JSON completo da Service Account Key do GCP (deve conter client_email). Application Default Credentials não suportam Signed URLs.';
      console.error('❌ [generateUploadSignedUrl]', errorMsg);
      throw new Error(errorMsg);
    }
    
    // Validar que o JSON contém client_email
    try {
      const credentials = parseGcpServiceAccountKey(process.env.GCP_SERVICE_ACCOUNT_KEY);
      if (!credentials.client_email) {
        const errorMsg = 'GCP_SERVICE_ACCOUNT_KEY não contém client_email. Verifique se o JSON da Service Account Key está completo.';
        console.error('❌ [generateUploadSignedUrl]', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (parseError) {
      if (parseError.message.includes('client_email')) {
        throw parseError; // Re-lançar erro de client_email
      }
      const errorMsg = `GCP_SERVICE_ACCOUNT_KEY inválido (não é JSON válido): ${parseError.message}`;
      console.error('❌ [generateUploadSignedUrl]', errorMsg);
      throw new Error(errorMsg);
    }
    
    // Validar tipo de arquivo
    const typeValidation = validateFileType(mimeType, fileName);
    if (!typeValidation.valid) {
      throw new Error(typeValidation.error);
    }

    // #region agent log
    fetch('http://127.0.0.1:7621/ingest/8e27b4c3-0140-42a6-b4bc-2e9c16a86c7a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'17a57b'},body:JSON.stringify({sessionId:'17a57b',location:'gcs.js:214',message:'before getBucket',data:{},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const bucket = getBucket();
    // #region agent log
    fetch('http://127.0.0.1:7621/ingest/8e27b4c3-0140-42a6-b4bc-2e9c16a86c7a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'17a57b'},body:JSON.stringify({sessionId:'17a57b',location:'gcs.js:215',message:'after getBucket',data:{hasBucket:!!bucket,bucketName:bucket?.name},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
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
    // #region agent log
    fetch('http://127.0.0.1:7621/ingest/8e27b4c3-0140-42a6-b4bc-2e9c16a86c7a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'17a57b'},body:JSON.stringify({sessionId:'17a57b',location:'gcs.js:232',message:'before getSignedUrl',data:{uniqueFileName,options:JSON.stringify(options)},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const [url] = await file.getSignedUrl(options);
    // #region agent log
    fetch('http://127.0.0.1:7621/ingest/8e27b4c3-0140-42a6-b4bc-2e9c16a86c7a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'17a57b'},body:JSON.stringify({sessionId:'17a57b',location:'gcs.js:233',message:'after getSignedUrl',data:{hasUrl:!!url},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    return {
      url,
      fileName: uniqueFileName,
      bucket: GCS_BUCKET_NAME,
      expiresIn: expirationMinutes * 60 // segundos
    };
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7621/ingest/8e27b4c3-0140-42a6-b4bc-2e9c16a86c7a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'17a57b'},body:JSON.stringify({sessionId:'17a57b',location:'gcs.js:241',message:'generateUploadSignedUrl catch',data:{errorMessage:error?.message,errorStack:error?.stack?.substring(0,500),errorName:error?.name},timestamp:Date.now(),runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    console.error('❌ Erro ao gerar Signed URL:', error);
    
    // Melhorar mensagem de erro para credenciais ausentes
    if (error.message && error.message.includes('client_email')) {
      const improvedError = new Error('Credenciais do GCP não configuradas corretamente. Verifique se GCP_SERVICE_ACCOUNT_KEY está definido nas variáveis de ambiente com um JSON válido contendo client_email.');
      improvedError.originalError = error.message;
      throw improvedError;
    }
    
    throw error;
  }
};

/**
 * Gerar Signed URL para upload direto de imagens
 * @param {string} fileName - Nome do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 * @param {number} expirationMinutes - Minutos até expiração (padrão: 15)
 * @param {string} folder - Pasta no GCS (padrão: 'img_velonews')
 * @returns {Promise<{url: string, fileName: string, bucket: string}>}
 */
const generateImageUploadSignedUrl = async (fileName, mimeType, expirationMinutes = 15, folder = 'img_velonews') => {
  try {
    console.log(`🔍 [generateImageUploadSignedUrl] Gerando Signed URL para imagem: ${fileName}`);

    const useAcademyTrophyBucket =
      typeof folder === 'string' &&
      (folder.startsWith('icones_conquistas/') ||
        folder.includes('mediabank_academy/icones_conquistas'));

    if (!GCP_PROJECT_ID) {
      throw new Error(
        'GCP_PROJECT_ID não está definido. Adicione em FONTE DA VERDADE/.env (carregado pelo SKYNET ao iniciar).'
      );
    }
    if (!process.env.GCP_SERVICE_ACCOUNT_KEY) {
      throw new Error(
        'GCP_SERVICE_ACCOUNT_KEY não está definido. Signed URLs V4 exigem o JSON da Service Account numa linha em FONTE DA VERDADE/.env (campo client_email + private_key).'
      );
    }
    if (useAcademyTrophyBucket) {
      if (!GCS_BUCKET_NAME_ACADEMY_TROPHIES) {
        throw new Error(
          'GCS_BUCKET_NAME3 não está definido (bucket de troféus Academy / mediabank_academy). Adicione em FONTE DA VERDADE/.env.'
        );
      }
    } else if (!GCS_BUCKET_NAME_IMAGES) {
      throw new Error(
        'GCS_BUCKET_NAME2 não está definido (bucket de imagens gerais). Adicione em FONTE DA VERDADE/.env.'
      );
    }
    
    // Validar tipo de arquivo (imagem)
    const typeValidation = validateFileType(mimeType, fileName, 'image');
    if (!typeValidation.valid) {
      console.error('❌ [generateImageUploadSignedUrl] Validação de tipo falhou:', typeValidation.error);
      throw new Error(typeValidation.error);
    }

    const bucket = useAcademyTrophyBucket ? getBucketAcademyTrophies() : getBucketImages();
    if (!bucket) {
      throw new Error(
        useAcademyTrophyBucket
          ? 'Bucket de troféus Academy (GCS_BUCKET_NAME3) não está disponível.'
          : 'Bucket de imagens do GCS não está disponível. Verifique GCS_BUCKET_NAME2.'
      );
    }
    const bucketNameOut = useAcademyTrophyBucket
      ? GCS_BUCKET_NAME_ACADEMY_TROPHIES
      : GCS_BUCKET_NAME_IMAGES;

    // Academy: objeto no bucket GCS_BUCKET_NAME3 (nome mediabank_academy) — ex.: icones_conquistas/modulos
    const objectFolder = folder;

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const uniqueFileName = `${objectFolder}/${timestamp}-${fileName}`;
    console.log(`📁 [generateImageUploadSignedUrl] Caminho: ${uniqueFileName} | bucket: ${bucketNameOut}`);
    
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
    console.log(`✅ [generateImageUploadSignedUrl] Signed URL gerada com sucesso`);

    return {
      url,
      fileName: uniqueFileName,
      bucket: bucketNameOut,
      expiresIn: expirationMinutes * 60 // segundos
    };
  } catch (error) {
    console.error('❌ Erro ao gerar Signed URL para imagem:', error);
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
 * Configurar CORS no bucket de IMAGENS do GCS
 * Necessário para permitir uploads diretos do frontend para imagens
 * @param {Array<string>} allowedOrigins - Lista de origens permitidas (opcional)
 * @returns {Promise<void>}
 */
const configureBucketImagesCORS = async (allowedOrigins = null) => {
  try {
    const bucket = getBucketImages();
    
    if (!bucket) {
      throw new Error('Bucket de imagens não está disponível. Verifique GCS_BUCKET_NAME2.');
    }
    
    // Origens padrão se não fornecidas
    // IMPORTANTE: Incluir todas as origens possíveis do frontend
    const origins = allowedOrigins || [
      'https://console-v2-hfsqj6konq-ue.a.run.app',
      'https://console-v2-278491073220.us-east1.run.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      '*' // Permitir todas as origens para uploads diretos (necessário para CORS do GCS)
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
    
    // Aplicar configuração CORS ao bucket de imagens
    await bucket.setCorsConfiguration(corsConfig);
    
    console.log('✅ Configuração CORS aplicada ao bucket de imagens:', GCS_BUCKET_NAME_IMAGES);
    console.log('📋 Origens permitidas:', origins);
    
    return corsConfig;
  } catch (error) {
    console.error('❌ Erro ao configurar CORS no bucket de imagens:', error);
    throw error;
  }
};

/**
 * Configurar CORS no bucket de troféus Academy (GCS_BUCKET_NAME3)
 * Obrigatório para PUT direto do browser (signed URL) com Content-Type
 */
const configureBucketAcademyTrophiesCORS = async (allowedOrigins = null) => {
  try {
    const bucket = getBucketAcademyTrophies();

    if (!bucket) {
      throw new Error('Bucket de troféus Academy não está disponível. Verifique GCS_BUCKET_NAME3.');
    }

    const origins = allowedOrigins || [
      'https://console-v2-hfsqj6konq-ue.a.run.app',
      'https://console-v2-278491073220.us-east1.run.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      '*'
    ];

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

    await bucket.setCorsConfiguration(corsConfig);

    console.log('✅ Configuração CORS aplicada ao bucket de troféus Academy:', GCS_BUCKET_NAME_ACADEMY_TROPHIES);
    console.log('📋 Origens permitidas:', origins);

    return corsConfig;
  } catch (error) {
    console.error('❌ Erro ao configurar CORS no bucket de troféus Academy:', error);
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
 * Publicar mensagem manualmente no Pub/Sub para reprocessar áudio
 * @param {string} fileName - Nome do arquivo no bucket
 * @param {string} bucketName - Nome do bucket (padrão: GCS_BUCKET_NAME)
 * @returns {Promise<string>} - ID da mensagem publicada
 */
const publishAudioToPubSub = async (fileName, bucketName = null) => {
  try {
    if (!GCP_PROJECT_ID) {
      throw new Error('GCP_PROJECT_ID deve estar configurado nas variáveis de ambiente');
    }

    const targetBucket = bucketName || GCS_BUCKET_NAME;
    const topicName = process.env.PUBSUB_TOPIC_NAME || 'qualidade_audio_envio';

    // Inicializar cliente Pub/Sub com as mesmas credenciais do GCS
    let pubsub;
    if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
      try {
        const credentials = parseGcpServiceAccountKey(process.env.GCP_SERVICE_ACCOUNT_KEY);
        pubsub = new PubSub({ 
          projectId: GCP_PROJECT_ID,
          credentials: credentials
        });
        console.log('✅ [publishAudioToPubSub] Pub/Sub inicializado com Service Account Key');
      } catch (parseError) {
        console.error('❌ [publishAudioToPubSub] Erro ao parsear credenciais:', parseError.message);
        // Tentar com ADC como fallback
        pubsub = new PubSub({ projectId: GCP_PROJECT_ID });
      }
    } else {
      // Usar Application Default Credentials (ADC)
      pubsub = new PubSub({ projectId: GCP_PROJECT_ID });
      console.log('⚠️ [publishAudioToPubSub] Usando ADC (Application Default Credentials)');
    }
    
    const topic = pubsub.topic(topicName);

    // Verificar se o tópico existe
    const [topicExists] = await topic.exists();
    if (!topicExists) {
      throw new Error(`Tópico Pub/Sub '${topicName}' não existe`);
    }

    // Criar mensagem no formato da notificação do GCS
    const messageData = {
      name: fileName,
      bucket: targetBucket,
      contentType: 'audio/mpeg', // Tipo padrão, pode ser ajustado se necessário
      timeCreated: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    // Publicar mensagem usando json (mais simples)
    const messageId = await topic.publishMessage({ json: messageData });

    console.log(`✅ Mensagem publicada no Pub/Sub com sucesso`);
    console.log(`   Tópico: ${topicName}`);
    console.log(`   Arquivo: ${fileName}`);
    console.log(`   Bucket: ${targetBucket}`);
    console.log(`   Message ID: ${messageId}`);

    return messageId;
  } catch (error) {
    console.error('❌ Erro ao publicar mensagem no Pub/Sub:', error);
    throw error;
  }
};

/**
 * Upload de imagem para GCS
 * @param {Buffer} fileBuffer - Buffer do arquivo
 * @param {string} fileName - Nome do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 * @param {string} folder - Pasta no GCS (padrão: 'img_velonews')
 * @returns {Promise<{url: string, fileName: string}>}
 */
const uploadImage = async (fileBuffer, fileName, mimeType, folder = 'img_velonews') => {
  try {
    console.log(`📤 Iniciando upload de imagem: ${fileName} (${mimeType}, ${fileBuffer.length} bytes)`);
    
    // Validar se variável está configurada
    console.log(`🔍 [uploadImage] Verificando GCS_BUCKET_NAME_IMAGES: ${GCS_BUCKET_NAME_IMAGES ? `"${GCS_BUCKET_NAME_IMAGES}"` : 'UNDEFINED'}`);
    console.log(`🔍 [uploadImage] process.env.GCS_BUCKET_NAME2 = "${process.env.GCS_BUCKET_NAME2 || 'UNDEFINED'}"`);
    if (!GCS_BUCKET_NAME_IMAGES) {
      console.error('❌ [uploadImage] GCS_BUCKET_NAME_IMAGES não está definido');
      console.error('❌ [uploadImage] process.env.GCS_BUCKET_NAME2 =', process.env.GCS_BUCKET_NAME2);
      throw new Error('GCS_BUCKET_NAME2 não está configurado nas variáveis de ambiente');
    }
    
    console.log(`✅ [uploadImage] Variável GCS_BUCKET_NAME_IMAGES está definida: "${GCS_BUCKET_NAME_IMAGES}"`);
    
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

    // Obter bucket EXCLUSIVO para imagens
    console.log('🔍 Tentando obter bucket de imagens...');
    const bucket = getBucketImages();
    if (!bucket) {
      console.error('❌ Bucket de imagens retornado é null/undefined');
      throw new Error('Bucket de imagens do GCS não está disponível. Verifique GCS_BUCKET_NAME2.');
    }
    console.log('✅ Bucket de imagens obtido com sucesso');
    
    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const uniqueFileName = `${folder}/${timestamp}-${fileName}`;
    console.log(`📁 Caminho do arquivo: ${uniqueFileName}`);
    console.log(`🪣 Bucket de Imagens: ${GCS_BUCKET_NAME_IMAGES}`);

    // Criar referência do arquivo
    console.log('🔍 Criando referência do arquivo...');
    const file = bucket.file(uniqueFileName);
    console.log('✅ Referência do arquivo criada');

    // Upload do arquivo
    console.log('⬆️ Fazendo upload para GCS...');
    await file.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000' // Cache por 1 ano
      }
    });
    console.log('✅ Arquivo salvo no GCS');

    // NOTA: Não usar file.makePublic() quando Uniform Bucket-Level Access está habilitado
    // As permissões são gerenciadas no nível do bucket via IAM
    // O bucket já deve ter permissões públicas configuradas via IAM
    console.log('ℹ️ Uniform Bucket-Level Access habilitado - permissões gerenciadas via IAM do bucket');

    // Obter URL pública usando GCS_BUCKET_NAME_IMAGES
    const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME_IMAGES}/${uniqueFileName}`;
    console.log(`✅ Imagem uploadada com sucesso: ${uniqueFileName}`);
    console.log(`🔗 URL pública: ${publicUrl}`);

    return {
      url: publicUrl,
      fileName: uniqueFileName,
      bucket: GCS_BUCKET_NAME_IMAGES
    };
  } catch (error) {
    console.error('❌ Erro ao fazer upload da imagem:', error);
    console.error('❌ Mensagem:', error.message);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Nome do erro:', error.name);
    throw error;
  }
};

/** Pastas permitidas para troféus Academy (upload via backend) — alinhado a AcademyPage / LISTA_SCHEMAS */
const ACADEMY_TROPHY_UPLOAD_FOLDERS = [
  'icones_conquistas/modulos',
  'icones_conquistas/temas'
];

/**
 * Objeto no bucket (path completo). Forma correta: icones_conquistas/modulos|temas/arquivo.
 * Aceita também legado mediabank_academy/icones_conquistas/... (uploads antigos com prefixo errado).
 */
function isAcademyTrophyObjectPath(objectPath) {
  if (typeof objectPath !== 'string') return false;
  if (/^icones_conquistas\/(modulos|temas)\/[^/]+$/.test(objectPath)) return true;
  if (/^mediabank_academy\/icones_conquistas\/(modulos|temas)\/[^/]+$/.test(objectPath)) return true;
  return false;
}

/**
 * Upload de imagem de troféu Academy para GCS (bucket GCS_BUCKET_NAME3), a partir do buffer no servidor.
 * Evita CORS no cliente (PUT direto a storage.googleapis.com exige CORS no bucket).
 */
const uploadAcademyTrophyImage = async (fileBuffer, fileName, mimeType, folder) => {
  if (!ACADEMY_TROPHY_UPLOAD_FOLDERS.includes(folder)) {
    throw new Error(`Pasta de troféu Academy inválida. Use: ${ACADEMY_TROPHY_UPLOAD_FOLDERS.join(' ou ')}`);
  }
  if (!GCS_BUCKET_NAME_ACADEMY_TROPHIES) {
    throw new Error('GCS_BUCKET_NAME3 não está configurado (bucket mediabank_academy).');
  }

  const typeValidation = validateFileType(mimeType, fileName, 'image');
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error);
  }
  const sizeValidation = validateFileSize(fileBuffer.length, 'image');
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error);
  }

  const bucket = getBucketAcademyTrophies();
  if (!bucket) {
    throw new Error('Bucket de troféus Academy (GCS_BUCKET_NAME3) não está disponível.');
  }

  const timestamp = Date.now();
  const uniqueFileName = `${folder}/${timestamp}-${fileName}`;
  const file = bucket.file(uniqueFileName);

  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000'
    }
  });

  const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME_ACADEMY_TROPHIES}/${uniqueFileName}`;
  console.log(`✅ [uploadAcademyTrophyImage] ${uniqueFileName}`);

  return {
    url: publicUrl,
    fileName: uniqueFileName,
    bucket: GCS_BUCKET_NAME_ACADEMY_TROPHIES
  };
};

const ACADEMY_TROPHY_TEMAS_PREFIX = 'icones_conquistas/temas/';
const ACADEMY_TROPHY_TEMAS_IMAGE_RE = /\.(jpe?g|png|gif|webp)$/i;

function buildAcademyBucketPublicUrl(objectName) {
  const enc = objectName.split('/').map(encodeURIComponent).join('/');
  return `https://storage.googleapis.com/${GCS_BUCKET_NAME_ACADEMY_TROPHIES}/${enc}`;
}

/**
 * Lista objetos de imagem já existentes na pasta temas (reutilização sem novo upload).
 */
const listAcademyTrophyTemasObjects = async () => {
  if (!GCS_BUCKET_NAME_ACADEMY_TROPHIES) {
    throw new Error('GCS_BUCKET_NAME3 não está configurado.');
  }
  const bucket = getBucketAcademyTrophies();
  if (!bucket) {
    throw new Error('Bucket de troféus Academy (GCS_BUCKET_NAME3) não está disponível.');
  }
  const [files] = await bucket.getFiles({ prefix: ACADEMY_TROPHY_TEMAS_PREFIX, maxResults: 1000 });
  const items = [];
  for (const f of files) {
    const name = f.name;
    if (!name || name.endsWith('/')) continue;
    if (!ACADEMY_TROPHY_TEMAS_IMAGE_RE.test(name)) continue;
    items.push({
      fileName: name,
      url: buildAcademyBucketPublicUrl(name)
    });
  }
  items.sort((a, b) => a.fileName.localeCompare(b.fileName, 'pt-BR'));
  return items;
};

module.exports = {
  initializeGCS,
  getBucket,
  getBucketImages,
  getBucketAcademyTrophies,
  validateFileType,
  validateFileSize,
  generateUploadSignedUrl,
  generateImageUploadSignedUrl,
  configureBucketNotification,
  configureBucketCORS,
  configureBucketImagesCORS,
  configureBucketAcademyTrophiesCORS,
  getBucketCORS,
  fileExists,
  getFileMetadata,
  uploadImage,
  uploadAcademyTrophyImage,
  listAcademyTrophyTemasObjects,
  isAcademyTrophyObjectPath,
  publishAudioToPubSub,
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

