// VERSION: v2.9.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const { ModuleStatus } = require('../models/ModuleStatus');

// GET /api/module-status - Buscar status atual de todos os módulos
router.get('/', async (req, res) => {
  try {
    if (global.emitTraffic) {
      global.emitTraffic('ModuleStatus', 'received', 'Entrada recebida - GET /api/module-status');
    }
    if (global.emitLog) {
      global.emitLog('info', 'GET /api/module-status - Buscando status de todos os módulos e FAQ');
    }
    
    // Buscar documento de status (ou criar se não existir)
    let statusDoc = await ModuleStatus.findOne({ _id: 'status' });
    
    if (!statusDoc) {
      if (global.emitTraffic) {
        global.emitTraffic('ModuleStatus', 'processing', 'Criando documento padrão de status no MongoDB');
      }
      statusDoc = new ModuleStatus({ _id: 'status' });
      await statusDoc.save();
    } else {
      if (global.emitTraffic) {
        global.emitTraffic('ModuleStatus', 'processing', 'Consultando documento de status existente no MongoDB');
      }
    }
    
    // Mapear campos do schema para nomes do frontend
    const data = {
      'credito-trabalhador': statusDoc._trabalhador,
      'credito-pessoal': statusDoc._pessoal,
      'antecipacao': statusDoc._antecipacao,
      'pagamento-antecipado': statusDoc._pgtoAntecip,
      'modulo-irpf': statusDoc._irpf,
      'seguro-prestamista': statusDoc._seguroCred,
      'seguro-celular': statusDoc._seguroCel
    };
    
    const result = {
      success: true,
      data: data
    };
    
    if (global.emitTraffic) {
      global.emitTraffic('ModuleStatus', 'completed', `Status de ${Object.keys(data).length} módulos obtidos`);
    }
    
    if (global.emitJson) {
      global.emitJson(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erro ao buscar status dos módulos:', error);
    console.error('Stack trace:', error.stack);
    
    if (global.emitTraffic) {
      global.emitTraffic('ModuleStatus', 'error', `Erro detalhado: ${error.message}`);
    }
    
    if (global.emitLog) {
      global.emitLog('error', `GET /api/module-status - Erro: ${error.message}`);
    }
    
    // Determinar tipo de erro para resposta mais específica
    let errorMessage = 'Erro interno do servidor';
    let statusCode = 500;
    
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      errorMessage = 'Erro de conexão com o banco de dados';
      statusCode = 503;
    } else if (error.name === 'ValidationError') {
      errorMessage = 'Erro de validação dos dados';
      statusCode = 400;
    } else if (error.name === 'CastError') {
      errorMessage = 'Erro de formato de dados';
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/module-status - Atualizar status de módulo ou FAQ
router.post('/', async (req, res) => {
  try {
    const { _id, moduleKey, status, updatedBy, dados, totalPerguntas } = req.body;
    
    if (global.emitTraffic) {
      global.emitTraffic('ModuleStatus', 'received', `Entrada recebida - POST /api/module-status - _id: ${_id || 'auto-detect'}`);
    }
    if (global.emitLog) {
      global.emitLog('info', `POST /api/module-status - Processando requisição para _id: ${_id || 'auto-detect'}`);
    }
    if (global.emitJson) {
      global.emitJson(req.body);
    }
    
    // Detectar formato dos dados recebidos primeiro
    const schemaFields = ['_trabalhador', '_pessoal', '_antecipacao', '_pgtoAntecip', '_irpf', '_seguroCred', '_seguroCel'];
    const frontendKeys = ['credito-trabalhador', 'credito-pessoal', 'antecipacao', 'pagamento-antecipado', 'modulo-irpf', 'seguro-prestamista', 'seguro-celular'];
    
    const hasSchemaFields = schemaFields.some(field => req.body.hasOwnProperty(field));
    const hasFrontendKeys = frontendKeys.some(key => req.body.hasOwnProperty(key));
    
    // Se não há _id e há chaves do frontend ou schema, assumir que é para status
    let documentId = _id;
    if (!_id && (hasFrontendKeys || hasSchemaFields)) {
      documentId = 'status';
    } else if (!_id) {
      documentId = 'status'; // Padrão
    }
    
    // Validar _id se fornecido
    if (_id && !['status', 'faq'].includes(_id)) {
      return res.status(400).json({
        success: false,
        error: '_id deve ser "status" ou "faq"'
      });
    }
    
    // Processar documento de status dos módulos
    if (documentId === 'status') {
      
      if (hasSchemaFields) {
        // FORMATO NOVO: Frontend envia campos do schema diretamente
        if (global.emitTraffic) {
          global.emitTraffic('ModuleStatus', 'processing', 'Processando formato do schema MongoDB (campos _trabalhador, _pessoal, etc.)');
        }
        
        // Extrair apenas os campos válidos do schema
        const updateData = {};
        const validStatuses = ['on', 'off', 'revisao'];
        
        for (const field of schemaFields) {
          if (req.body.hasOwnProperty(field)) {
            // Validar status
            if (!validStatuses.includes(req.body[field])) {
              return res.status(400).json({
                success: false,
                error: `Status inválido para ${field}: ${req.body[field]}. Deve ser: on, off ou revisao`
              });
            }
            updateData[field] = req.body[field];
          }
        }
        
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Nenhum campo válido do schema encontrado. Campos válidos: _trabalhador, _pessoal, _antecipacao, _pgtoAntecip, _irpf, _seguroCred, _seguroCel'
          });
        }
        
        if (global.emitTraffic) {
          global.emitTraffic('ModuleStatus', 'processing', `Atualizando ${Object.keys(updateData).length} campos no documento status`);
        }
        
        // Atualizar documento
        const updatedModule = await ModuleStatus.findOneAndUpdate(
          { _id: 'status' },
          updateData,
          { upsert: true, new: true, runValidators: true }
        );
        
        console.log(`Módulos atualizados via schema: ${Object.keys(updateData).length} campos${updatedBy ? ` por ${updatedBy}` : ''}`);
        
        // Monitoramento e resposta
        if (global.emitTraffic) {
          global.emitTraffic('ModuleStatus', 'completed', `${Object.keys(updateData).length} módulos atualizados via schema`);
        }
        
        const responseData = {
          success: true,
          message: `${Object.keys(updateData).length} módulos atualizados com sucesso`,
          data: updateData
        };
        
        if (global.emitJson) {
          global.emitJson(responseData);
        }
        
        return res.json(responseData);
        
      } else if (hasFrontendKeys) {
        // FORMATO FRONTEND: Frontend envia chaves dos módulos (credito-trabalhador, credito-pessoal, etc.)
        if (global.emitTraffic) {
          global.emitTraffic('ModuleStatus', 'processing', 'Processando formato do frontend (chaves dos módulos)');
        }
        
        // Mapear chaves do frontend para campos do schema
        const fieldMapping = {
          'credito-trabalhador': '_trabalhador',
          'credito-pessoal': '_pessoal',
          'antecipacao': '_antecipacao',
          'pagamento-antecipado': '_pgtoAntecip',
          'modulo-irpf': '_irpf',
          'seguro-prestamista': '_seguroCred',
          'seguro-celular': '_seguroCel'
        };
        
        const updateData = {};
        const validStatuses = ['on', 'off', 'revisao'];
        
        // Processar cada chave do frontend
        for (const [frontendKey, status] of Object.entries(req.body)) {
          if (frontendKeys.includes(frontendKey)) {
            // Validar status
            if (!validStatuses.includes(status)) {
              return res.status(400).json({
                success: false,
                error: `Status inválido para ${frontendKey}: ${status}. Deve ser: on, off ou revisao`
              });
            }
            
            const schemaField = fieldMapping[frontendKey];
            updateData[schemaField] = status;
          }
        }
        
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Nenhuma chave válida do frontend encontrada. Chaves válidas: credito-trabalhador, credito-pessoal, antecipacao, pagamento-antecipado, modulo-irpf, seguro-prestamista, seguro-celular'
          });
        }
        
        if (global.emitTraffic) {
          global.emitTraffic('ModuleStatus', 'processing', `Atualizando ${Object.keys(updateData).length} campos via chaves do frontend`);
        }
        
        // Atualizar documento
        const updatedModule = await ModuleStatus.findOneAndUpdate(
          { _id: 'status' },
          updateData,
          { upsert: true, new: true, runValidators: true }
        );
        
        console.log(`Módulos atualizados via frontend: ${Object.keys(updateData).length} campos${updatedBy ? ` por ${updatedBy}` : ''}`);
        
        // Monitoramento e resposta
        if (global.emitTraffic) {
          global.emitTraffic('ModuleStatus', 'completed', `${Object.keys(updateData).length} módulos atualizados via frontend`);
        }
        
        const responseData = {
          success: true,
          message: `${Object.keys(updateData).length} módulos atualizados com sucesso`,
          data: req.body // Retornar os dados originais do frontend
        };
        
        if (global.emitJson) {
          global.emitJson(responseData);
        }
        
        return res.json(responseData);
        
      } else {
        // FORMATO ANTIGO: Validação de moduleKey e status individual
        if (!moduleKey || !status) {
          return res.status(400).json({
            success: false,
            error: 'moduleKey e status são obrigatórios para _id: "status" (formato antigo) ou campos do schema (_trabalhador, _pessoal, etc.)'
          });
        }
      
      const validKeys = ['credito-trabalhador', 'credito-pessoal', 'antecipacao', 'pagamento-antecipado', 'modulo-irpf', 'seguro-prestamista', 'seguro-celular'];
      const validStatuses = ['on', 'off', 'revisao'];
      
      if (!validKeys.includes(moduleKey)) {
        return res.status(400).json({
          success: false,
          error: 'moduleKey inválido. Deve ser um dos: ' + validKeys.join(', ')
        });
      }
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'status deve ser: on, off ou revisao'
        });
      }
      
      // Mapear moduleKey para campo do schema
      const fieldMapping = {
        'credito-trabalhador': '_trabalhador',
        'credito-pessoal': '_pessoal',
        'antecipacao': '_antecipacao',
        'pagamento-antecipado': '_pgtoAntecip',
        'modulo-irpf': '_irpf',
        'seguro-prestamista': '_seguroCred',
        'seguro-celular': '_seguroCel'
      };
      
      const fieldName = fieldMapping[moduleKey];
      const updateData = { [fieldName]: status };
      
      if (global.emitTraffic) {
        global.emitTraffic('ModuleStatus', 'processing', `Atualizando campo ${fieldName} no documento status`);
      }
      
      // Atualizar documento de status
      const updatedModule = await ModuleStatus.findOneAndUpdate(
        { _id: 'status' },
        updateData,
        { 
          upsert: true, 
          new: true, 
          runValidators: true 
        }
      );
      
      console.log(`Status do módulo ${moduleKey} atualizado para ${status}${updatedBy ? ` por ${updatedBy}` : ''}`);
      
      const responseData = {
        success: true,
        message: `Status do ${moduleKey} atualizado para ${status}`,
        data: {
          moduleKey: moduleKey,
          status: status,
          updatedAt: updatedModule.updatedAt
        }
      };
      
      if (global.emitTraffic) {
        global.emitTraffic('ModuleStatus', 'completed', `Módulo ${moduleKey} atualizado para ${status}`);
      }
      
      if (global.emitJson) {
        global.emitJson(responseData);
      }
      
      res.json(responseData);
      
      } // Fim do bloco do formato antigo
      
    } else {
      return res.status(400).json({
        success: false,
        error: 'Para atualizar FAQ, use o endpoint /api/faq-bot'
      });
    }
    
  } catch (error) {
    console.error('Erro ao atualizar documento:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('ModuleStatus', 'error', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// PUT /api/module-status - Atualizar múltiplos módulos de uma vez
router.put('/', async (req, res) => {
  try {
    const { _id, ...modules } = req.body;
    const updatedBy = modules.updatedBy || null;
    
    if (global.emitTraffic) {
      global.emitTraffic('ModuleStatus', 'received', `Entrada recebida - PUT /api/module-status - _id: ${_id}`);
    }
    if (global.emitLog) {
      global.emitLog('info', `PUT /api/module-status - Atualizando múltiplos módulos para _id: ${_id}`);
    }
    if (global.emitJson) {
      global.emitJson(req.body);
    }
    
    // Se não há _id, assumir que é para status
    const documentId = _id || 'status';
    
    // Processar documento de status dos módulos
    if (documentId === 'status') {
      // Remover updatedBy do objeto de módulos se presente
      delete modules.updatedBy;
      
      if (!modules || Object.keys(modules).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Dados dos módulos são obrigatórios para _id: "status"'
        });
      }
      
      const validKeys = ['credito-trabalhador', 'credito-pessoal', 'antecipacao', 'pagamento-antecipado', 'modulo-irpf', 'seguro-prestamista', 'seguro-celular'];
      const validStatuses = ['on', 'off', 'revisao'];
      
      // Mapear moduleKey para campo do schema
      const fieldMapping = {
        'credito-trabalhador': '_trabalhador',
        'credito-pessoal': '_pessoal',
        'antecipacao': '_antecipacao',
        'pagamento-antecipado': '_pgtoAntecip',
        'modulo-irpf': '_irpf',
        'seguro-prestamista': '_seguroCred',
        'seguro-celular': '_seguroCel'
      };
      
      // Validar todos os dados antes de fazer qualquer atualização
      for (const [moduleKey, status] of Object.entries(modules)) {
        if (!validKeys.includes(moduleKey)) {
          return res.status(400).json({
            success: false,
            error: `moduleKey inválido: ${moduleKey}. Deve ser um dos: ${validKeys.join(', ')}`
          });
        }
        
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            error: `status inválido para ${moduleKey}: ${status}. Deve ser: ${validStatuses.join(', ')}`
          });
        }
      }
      
      // Preparar dados de atualização
      const updateData = {};
      const results = [];
      
      for (const [moduleKey, status] of Object.entries(modules)) {
        const fieldName = fieldMapping[moduleKey];
        updateData[fieldName] = status;
        results.push({
          moduleKey: moduleKey,
          status: status
        });
      }
      
      if (global.emitTraffic) {
        global.emitTraffic('ModuleStatus', 'processing', `Atualizando ${Object.keys(updateData).length} campos no documento status`);
      }
      
      // Atualizar documento de status com todos os campos
      const updatedModule = await ModuleStatus.findOneAndUpdate(
        { _id: 'status' },
        updateData,
        { 
          upsert: true, 
          new: true, 
          runValidators: true 
        }
      );
      
      console.log(`Múltiplos módulos atualizados: ${Object.keys(modules).length} módulos${updatedBy ? ` por ${updatedBy}` : ''}`);
      
      const responseData = {
        success: true,
        message: `${Object.keys(modules).length} módulos atualizados com sucesso`,
        data: modules
      };
      
      if (global.emitTraffic) {
        global.emitTraffic('ModuleStatus', 'completed', `${Object.keys(modules).length} módulos atualizados`);
      }
      
      if (global.emitJson) {
        global.emitJson(responseData);
      }
      
      res.json(responseData);
      
    } else {
      return res.status(400).json({
        success: false,
        error: 'Para atualizar FAQ, use o endpoint /api/faq-bot'
      });
    }
    
  } catch (error) {
    console.error('Erro ao atualizar múltiplos módulos:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('ModuleStatus', 'error', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
