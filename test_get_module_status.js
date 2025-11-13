// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

async function testGetModuleStatus() {
  console.log('🧪 Testando GET /api/module-status...\n');

  try {
    // Teste 1: GET /api/module-status
    console.log('1️⃣ Fazendo requisição GET /api/module-status...');
    const response = await axios.get(`${API_BASE_URL}/module-status`);
    
    console.log('✅ Response Status:', response.status);
    console.log('📊 Response Data:', JSON.stringify(response.data, null, 2));
    
    // Verificar estrutura da resposta
    if (response.data.success && response.data.data) {
      console.log('✅ Estrutura correta: { success: true, data: {...} }');
      
      // Verificar se todos os módulos estão presentes
      const expectedModules = [
        'credito-trabalhador',
        'credito-pessoal', 
        'antecipacao',
        'pagamento-antecipado',
        'modulo-irpf',
        'modulo-seguro'
      ];
      
      const receivedModules = Object.keys(response.data.data);
      const allModulesPresent = expectedModules.every(module => receivedModules.includes(module));
      
      if (allModulesPresent) {
        console.log('✅ Todos os módulos estão presentes na resposta');
      } else {
        console.log('❌ Alguns módulos estão faltando');
        console.log('Esperados:', expectedModules);
        console.log('Recebidos:', receivedModules);
      }
      
      // Verificar se os valores são válidos
      const validValues = ['on', 'off', 'revisao'];
      const allValuesValid = Object.values(response.data.data).every(value => validValues.includes(value));
      
      if (allValuesValid) {
        console.log('✅ Todos os valores são válidos (on, off, revisao)');
      } else {
        console.log('❌ Alguns valores são inválidos');
        console.log('Valores recebidos:', Object.values(response.data.data));
      }
      
    } else {
      console.log('❌ Estrutura incorreta');
    }
    
    console.log('\n🎉 Teste concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    if (error.response) {
      console.error('📊 Response Status:', error.response.status);
      console.error('📊 Response Data:', error.response.data);
    }
  }
}

// Executar teste
testGetModuleStatus();
