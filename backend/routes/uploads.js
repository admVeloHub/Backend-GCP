// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadImage } = require('../config/gcs');

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

module.exports = router;

