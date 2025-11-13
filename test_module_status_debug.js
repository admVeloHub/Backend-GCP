// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
const axios = require('axios');

const API_BASE_URL = 'https://back-console.vercel.app/api';

async function debugModuleStatus() {
  console.log('🔍 Debugando problema do Module Status...\n');

  try {
    // Teste 1: Health check
    console.log('1️⃣ Testando health check...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health Status:', healthResponse.status);
    console.log('📊 Health Data:', JSON.stringify(healthResponse.data, null, 2));
    
    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 2: Testar outros endpoints para ver se o problema é geral
    console.log('2️⃣ Testando outros endpoints...');
    
    try {
      const artigosResponse = await axios.get(`${API_BASE_URL}/artigos`);
      console.log('✅ Artigos Status:', artigosResponse.status);
    } catch (error) {
      console.log('❌ Artigos Error:', error.response?.status, error.response?.data);
    }
    
    try {
      const velonewsResponse = await axios.get(`${API_BASE_URL}/velonews`);
      console.log('✅ Velonews Status:', velonewsResponse.status);
    } catch (error) {
      console.log('❌ Velonews Error:', error.response?.status, error.response?.data);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 3: Testar module-status com mais detalhes
    console.log('3️⃣ Testando module-status com detalhes...');
    
    try {
      const moduleResponse = await axios.get(`${API_BASE_URL}/module-status`);
      console.log('✅ Module Status:', moduleResponse.status);
      console.log('📊 Module Data:', JSON.stringify(moduleResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Module Status Error:', error.response?.status);
      console.log('📊 Error Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('📊 Error Headers:', JSON.stringify(error.response?.headers, null, 2));
    }
    
    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 4: Verificar se o problema é específico do GET
    console.log('4️⃣ Testando POST module-status...');
    
    const testData = {
      "_id": "status",
      "_trabalhador": "on"
    };
    
    try {
      const postResponse = await axios.post(`${API_BASE_URL}/module-status`, testData);
      console.log('✅ POST Status:', postResponse.status);
      console.log('📊 POST Data:', JSON.stringify(postResponse.data, null, 2));
    } catch (error) {
      console.log('❌ POST Error:', error.response?.status);
      console.log('📊 POST Error Data:', JSON.stringify(error.response?.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    if (error.response) {
      console.error('📊 Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Executar debug
debugModuleStatus();
