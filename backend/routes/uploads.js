// VERSION: v1.1.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadImage, generateImageUploadSignedUrl, validateFileType, validateFileSize } = require('../config/gcs');

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

module.exports = router;

