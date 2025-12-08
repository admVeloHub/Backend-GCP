// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
/**
 * Middleware de autenticação e verificação de permissões
 * Verifica se o usuário tem permissão para acessar recursos específicos
 */

const Users = require('../models/Users');

/**
 * Middleware para verificar permissão do usuário
 * @param {string} permission - Nome da permissão requerida (ex: 'whatsapp', 'config', etc.)
 * @returns {Function} Middleware Express
 */
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      // Obter email do usuário do header ou query
      const userEmail = req.headers['x-user-email'] || req.query.userEmail || req.body.userEmail;
      
      if (!userEmail) {
        return res.status(401).json({
          success: false,
          error: 'Email do usuário não fornecido. Forneça via header X-User-Email, query param userEmail ou body.userEmail'
        });
      }
      
      // Buscar usuário no banco
      const user = await Users.findOne({ _userMail: userEmail.toLowerCase().trim() });
      
      if (!user) {
        return res.status(403).json({
          success: false,
          error: 'Usuário não encontrado ou não autorizado'
        });
      }
      
      // Verificar se o usuário tem a permissão requerida
      const hasPermission = user._userClearance && user._userClearance[permission] === true;
      
      if (!hasPermission) {
        console.log(`[AUTH] Usuário ${userEmail} tentou acessar recurso que requer permissão '${permission}' mas não possui essa permissão`);
        return res.status(403).json({
          success: false,
          error: `Acesso negado. Permissão '${permission}' é necessária para acessar este recurso`
        });
      }
      
      // Adicionar informações do usuário ao request para uso posterior
      req.user = {
        email: user._userMail,
        id: user._userId,
        role: user._userRole,
        permissions: user._userClearance
      };
      
      // Continuar para o próximo middleware/rota
      next();
      
    } catch (error) {
      console.error('[AUTH] Erro ao verificar permissão:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno ao verificar permissões'
      });
    }
  };
};

/**
 * Middleware opcional - verifica permissão mas não bloqueia se não fornecido
 * Útil para rotas que podem funcionar com ou sem autenticação
 */
const optionalCheckPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userEmail = req.headers['x-user-email'] || req.query.userEmail || req.body.userEmail;
      
      if (userEmail) {
        const user = await Users.findOne({ _userMail: userEmail.toLowerCase().trim() });
        
        if (user) {
          const hasPermission = user._userClearance && user._userClearance[permission] === true;
          
          if (hasPermission) {
            req.user = {
              email: user._userMail,
              id: user._userId,
              role: user._userRole,
              permissions: user._userClearance
            };
          }
        }
      }
      
      next();
    } catch (error) {
      console.error('[AUTH] Erro ao verificar permissão opcional:', error);
      // Continuar mesmo em caso de erro para rotas opcionais
      next();
    }
  };
};

module.exports = {
  checkPermission,
  optionalCheckPermission
};

