// VERSION: v1.6.0 | DATE: 2026-04-16 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.6.0 - GET /academy-trophy-temas-list (imagens em icones_conquistas/temas para reutilizar Bronze/Prata)
// CHANGELOG: v1.5.1 - POST academy-trophy: folder icones_conquistas/modulos|temas (sem duplicar nome do bucket)
// CHANGELOG: v1.5.0 - GET /academy-trophy-media?filename= (stream; bucket privado — pré-visualização Console)
// CHANGELOG: v1.4.0 - POST /academy-trophy (multipart → servidor → GCS; sem CORS no bucket)
// CHANGELOG: v1.3.0 - POST/GET configure-academy-cors / academy-cors-config (bucket GCS_BUCKET_NAME3; uploads troféus Academy)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  uploadImage,
  uploadAcademyTrophyImage,
  listAcademyTrophyTemasObjects,
  isAcademyTrophyObjectPath,
  generateImageUploadSignedUrl,
  validateFileType,
  validateFileSize,
  configureBucketImagesCORS,
  configureBucketAcademyTrophiesCORS,
  getBucketCORS,
  getBucketAcademyTrophies
} = require('../config/gcs');

// Configurar multer para upload de arquivos em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limite para imagens
  },
  fileFilter: (req, file, cb) => {
    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use apenas imagens (jpg, jpeg, png, gif, webp).'), false);
    }
  }
});

// POST /api/uploads/image - Upload de imagem para GCS
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    global.emitTraffic('Uploads', 'received', 'Entrada recebida - POST /api/uploads/image');
    global.emitLog('info', 'POST /api/uploads/image - Upload de imagem iniciado');

    if (!req.file) {
      global.emitTraffic('Uploads', 'error', 'Nenhum arquivo enviado');
      global.emitLog('error', 'POST /api/uploads/image - Nenhum arquivo enviado');
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    global.emitJson({
      fileName: originalname,
      mimeType: mimetype,
      size: size
    });

    // Fazer upload da imagem
    global.emitTraffic('Uploads', 'processing', 'Fazendo upload para GCS');
    const result = await uploadImage(buffer, originalname, mimetype);

    global.emitTraffic('Uploads', 'completed', 'Upload concluído com sucesso');
    global.emitLog('success', `POST /api/uploads/image - Imagem "${originalname}" uploadada com sucesso`);
    global.emitJson(result);

    // INBOUND: Resposta para o frontend
    global.emitJsonInput(result);

    res.status(200).json({
      success: true,
      message: 'Imagem uploadada com sucesso',
      data: result
    });
  } catch (error) {
    global.emitTraffic('Uploads', 'error', 'Erro no upload');
    global.emitLog('error', `POST /api/uploads/image - Erro: ${error.message}`);
    console.error('❌ Erro detalhado no upload de imagem:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({
      success: false,
      error: 'Erro ao fazer upload da imagem',
      message: error.message || 'Erro desconhecido ao processar upload'
    });
  }
});

// GET /api/uploads/academy-trophy-temas-list — imagens já em icones_conquistas/temas/ (reutilizar no formulário)
router.get('/academy-trophy-temas-list', async (req, res) => {
  try {
    const items = await listAcademyTrophyTemasObjects();
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('❌ academy-trophy-temas-list:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar troféus existentes',
      message: error.message || 'Erro desconhecido'
    });
  }
});

// GET /api/uploads/academy-trophy-media?filename= — stream do objeto (bucket pode ser privado)
router.get('/academy-trophy-media', async (req, res) => {
  try {
    const filename = typeof req.query.filename === 'string' ? req.query.filename.trim() : '';
    if (!filename || !isAcademyTrophyObjectPath(filename)) {
      return res.status(400).json({ success: false, error: 'Parâmetro filename inválido' });
    }

    const bucket = getBucketAcademyTrophies();
    if (!bucket) {
      return res.status(500).json({ success: false, error: 'Bucket Academy não disponível' });
    }

    const file = bucket.file(filename);
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).end();
    }

    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    file.createReadStream().on('error', (err) => {
      console.error('❌ academy-trophy-media stream:', err.message);
      if (!res.headersSent) {
        res.status(500).end();
      }
    }).pipe(res);
  } catch (error) {
    console.error('❌ academy-trophy-media:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

// POST /api/uploads/academy-trophy - Troféus Academy: multipart para o servidor (evita CORS browser→GCS)
router.post('/academy-trophy', upload.single('image'), async (req, res) => {
  try {
    global.emitTraffic('Uploads', 'received', 'POST /api/uploads/academy-trophy');
    global.emitLog('info', 'POST /api/uploads/academy-trophy');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    const { folder } = req.body;
    if (!folder || typeof folder !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Campo folder é obrigatório (icones_conquistas/modulos ou icones_conquistas/temas)'
      });
    }

    const { buffer, originalname, mimetype } = req.file;

    const result = await uploadAcademyTrophyImage(buffer, originalname, mimetype, folder.trim());

    res.json({
      success: true,
      data: {
        url: result.url,
        fileName: result.fileName,
        bucket: result.bucket
      }
    });
  } catch (error) {
    global.emitLog('error', `POST /api/uploads/academy-trophy - ${error.message}`);
    console.error('❌ academy-trophy:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao enviar troféu Academy',
      message: error.message || 'Erro desconhecido'
    });
  }
});

// POST /api/uploads/generate-upload-url - Gerar Signed URL para upload direto de imagem
router.post('/generate-upload-url', async (req, res) => {
  try {
    global.emitTraffic('Uploads', 'received', 'Entrada recebida - POST /api/uploads/generate-upload-url');
    global.emitLog('info', 'POST /api/uploads/generate-upload-url - Gerando Signed URL para imagem');

    const { fileName, mimeType, fileSize, folder } = req.body;

    // Validações obrigatórias
    if (!fileName || !mimeType) {
      global.emitTraffic('Uploads', 'error', 'Nome do arquivo e tipo MIME são obrigatórios');
      global.emitLog('error', 'POST /api/uploads/generate-upload-url - Nome do arquivo e tipo MIME são obrigatórios');
      return res.status(400).json({
        success: false,
        error: 'Nome do arquivo e tipo MIME são obrigatórios'
      });
    }

    // Validar tipo de arquivo
    const typeValidation = validateFileType(mimeType, fileName, 'image');
    if (!typeValidation.valid) {
      global.emitTraffic('Uploads', 'error', typeValidation.error);
      global.emitLog('error', `POST /api/uploads/generate-upload-url - ${typeValidation.error}`);
      return res.status(400).json({
        success: false,
        error: typeValidation.error
      });
    }

    // Validar tamanho do arquivo (se fornecido)
    if (fileSize) {
      const sizeValidation = validateFileSize(fileSize, 'image');
      if (!sizeValidation.valid) {
        global.emitTraffic('Uploads', 'error', sizeValidation.error);
        global.emitLog('error', `POST /api/uploads/generate-upload-url - ${sizeValidation.error}`);
        return res.status(400).json({
          success: false,
          error: sizeValidation.error
        });
      }
    }

    // Gerar Signed URL (usar folder fornecido ou padrão 'img_velonews')
    const uploadData = await generateImageUploadSignedUrl(fileName, mimeType, 15, folder || 'img_velonews');

    global.emitTraffic('Uploads', 'completed', 'Signed URL gerada com sucesso');
    global.emitLog('success', `POST /api/uploads/generate-upload-url - Signed URL gerada para ${uploadData.fileName}`);
    
    if (global.emitJson) {
      global.emitJson({
        tipo: 'OUTBOUND',
        origem: 'Uploads',
        dados: {
          uploadUrl: uploadData.url,
          fileName: uploadData.fileName,
          bucket: uploadData.bucket,
          expiresIn: uploadData.expiresIn
        }
      });
    }

    res.json({
      success: true,
      data: {
        uploadUrl: uploadData.url,
        fileName: uploadData.fileName,
        bucket: uploadData.bucket,
        expiresIn: uploadData.expiresIn
      }
    });
  } catch (error) {
    global.emitTraffic('Uploads', 'error', 'Erro ao gerar Signed URL');
    global.emitLog('error', `POST /api/uploads/generate-upload-url - Erro: ${error.message}`);
    console.error('❌ Erro ao gerar Signed URL para imagem:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar URL de upload',
      message: error.message || 'Erro desconhecido ao gerar URL de upload'
    });
  }
});

// POST /api/uploads/configure-images-cors - Configurar CORS no bucket de imagens do GCS
router.post('/configure-images-cors', async (req, res) => {
  try {
    global.emitTraffic('Uploads', 'received', 'Entrada recebida - POST /api/uploads/configure-images-cors');
    global.emitLog('info', 'POST /api/uploads/configure-images-cors - Configurando CORS no bucket de imagens');

    const { allowedOrigins } = req.body;
    
    // Configurar CORS
    const corsConfig = await configureBucketImagesCORS(allowedOrigins);

    global.emitTraffic('Uploads', 'completed', 'CORS configurado com sucesso');
    global.emitLog('success', 'POST /api/uploads/configure-images-cors - CORS configurado com sucesso');

    res.json({
      success: true,
      message: 'Configuração CORS aplicada com sucesso',
      corsConfig
    });
  } catch (error) {
    global.emitTraffic('Uploads', 'error', 'Erro ao configurar CORS');
    global.emitLog('error', `POST /api/uploads/configure-images-cors - Erro: ${error.message}`);
    console.error('❌ Erro ao configurar CORS no bucket de imagens:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro ao configurar CORS no bucket de imagens',
      message: error.message || 'Erro desconhecido ao configurar CORS'
    });
  }
});

// POST /api/uploads/configure-academy-cors - CORS no bucket de troféus Academy (GCS_BUCKET_NAME3)
router.post('/configure-academy-cors', async (req, res) => {
  try {
    global.emitTraffic('Uploads', 'received', 'Entrada recebida - POST /api/uploads/configure-academy-cors');
    global.emitLog('info', 'POST /api/uploads/configure-academy-cors - Configurando CORS no bucket Academy');

    const { allowedOrigins } = req.body;
    const corsConfig = await configureBucketAcademyTrophiesCORS(allowedOrigins);

    global.emitTraffic('Uploads', 'completed', 'CORS Academy configurado');
    global.emitLog('success', 'POST /api/uploads/configure-academy-cors - OK');

    res.json({
      success: true,
      message: 'Configuração CORS aplicada ao bucket de troféus Academy',
      corsConfig
    });
  } catch (error) {
    global.emitTraffic('Uploads', 'error', 'Erro CORS Academy');
    global.emitLog('error', `POST /api/uploads/configure-academy-cors - ${error.message}`);
    console.error('❌ Erro ao configurar CORS no bucket Academy:', error);

    res.status(500).json({
      success: false,
      error: 'Erro ao configurar CORS no bucket de troféus Academy',
      message: error.message || 'Erro desconhecido'
    });
  }
});

// GET /api/uploads/academy-cors-config - CORS atual do bucket Academy
router.get('/academy-cors-config', async (req, res) => {
  try {
    global.emitTraffic('Uploads', 'received', 'GET /api/uploads/academy-cors-config');
    const bucket = getBucketAcademyTrophies();

    if (!bucket) {
      return res.status(500).json({
        success: false,
        error: 'Bucket de troféus Academy não está disponível (GCS_BUCKET_NAME3)'
      });
    }

    const [metadata] = await bucket.getMetadata();
    const corsConfig = metadata.cors || [];

    res.json({ success: true, corsConfig });
  } catch (error) {
    console.error('❌ academy-cors-config:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter CORS do bucket Academy',
      message: error.message
    });
  }
});

// GET /api/uploads/images-cors-config - Obter configuração CORS atual do bucket de imagens
router.get('/images-cors-config', async (req, res) => {
  try {
    global.emitTraffic('Uploads', 'received', 'Entrada recebida - GET /api/uploads/images-cors-config');
    global.emitLog('info', 'GET /api/uploads/images-cors-config - Obtendo configuração CORS');

    const { getBucketImages } = require('../config/gcs');
    const bucket = getBucketImages();
    
    if (!bucket) {
      return res.status(500).json({
        success: false,
        error: 'Bucket de imagens não está disponível'
      });
    }

    const [metadata] = await bucket.getMetadata();
    const corsConfig = metadata.cors || [];

    global.emitTraffic('Uploads', 'completed', 'Configuração CORS obtida');
    global.emitLog('success', 'GET /api/uploads/images-cors-config - Configuração CORS obtida');

    res.json({
      success: true,
      corsConfig
    });
  } catch (error) {
    global.emitTraffic('Uploads', 'error', 'Erro ao obter configuração CORS');
    global.emitLog('error', `GET /api/uploads/images-cors-config - Erro: ${error.message}`);
    console.error('❌ Erro ao obter configuração CORS:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro ao obter configuração CORS',
      message: error.message || 'Erro desconhecido ao obter configuração CORS'
    });
  }
});

module.exports = router;

