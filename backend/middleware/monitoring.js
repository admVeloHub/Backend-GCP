// VERSION: v3.1.1 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team

// Middleware para verificar se as funções de monitoramento estão disponíveis
const checkMonitoringFunctions = (req, res, next) => {
  // Se as funções globais não existirem, criar funções vazias para evitar erros
  if (!global.emitLog) {
    global.emitLog = () => {};
  }
  
  if (!global.emitTraffic) {
    global.emitTraffic = () => {};
  }
  
  if (!global.emitJson) {
    global.emitJson = () => {};
  }
  
  if (!global.emitJsonInput) {
    global.emitJsonInput = () => {};
  }
  
  // Continuar imediatamente sem delays
  next();
};

module.exports = { checkMonitoringFunctions };
