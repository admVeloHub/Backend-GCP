// VERSION: v1.1.0 | DATE: 2026-03-25 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.1.0 - Payloads de teste alinhados ao schema module_status atual
const axios = require('axios');

const API_BASE_URL = 'https://back-console.vercel.app/api';

async function testModuleStatusEndpoints() {
  console.log('🧪 Testando correção dos endpoints Module Status...\n');

  try {
    // Teste 1: GET /api/module-status
    console.log('1️⃣ Testando GET /api/module-status...');
    const getResponse = await axios.get(`${API_BASE_URL}/module-status`);
    
    console.log('✅ GET Response Status:', getResponse.status);
    console.log('📊 GET Response Data:', JSON.stringify(getResponse.data, null, 2));
    
    if (getResponse.data.success && getResponse.data.data) {
      console.log('✅ GET funcionando corretamente');
    } else {
      console.log('❌ GET com problemas na estrutura');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 2: POST /api/module-status com formato do frontend (schema MongoDB)
    console.log('2️⃣ Testando POST /api/module-status com formato do frontend...');
    
    const frontendData = {
      "_id": "status",
      "_pessoal": "revisao",
      "_antecipacao": "off",
      "_pgtoAntecip": "on",
      "_seguroCred": "on",
      "_seguroCel": "off",
      "_perdaRenda": "on",
      "_cupons": "revisao",
      "_seguroPessoal": "off"
    };
    
    console.log('📤 Enviando dados do frontend:', JSON.stringify(frontendData, null, 2));
    
    const postResponse = await axios.post(`${API_BASE_URL}/module-status`, frontendData);
    
    console.log('✅ POST Response Status:', postResponse.status);
    console.log('📊 POST Response Data:', JSON.stringify(postResponse.data, null, 2));
    
    if (postResponse.data.success) {
      console.log('✅ POST com formato do frontend funcionando corretamente');
    } else {
      console.log('❌ POST com formato do frontend com problemas');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 3: Verificar se os dados foram salvos
    console.log('3️⃣ Verificando se os dados foram salvos...');
    const verifyResponse = await axios.get(`${API_BASE_URL}/module-status`);
    
    console.log('✅ Verify Response Status:', verifyResponse.status);
    console.log('📊 Verify Response Data:', JSON.stringify(verifyResponse.data, null, 2));
    
    if (verifyResponse.data.success && verifyResponse.data.data) {
      const data = verifyResponse.data.data;
      console.log('✅ Dados salvos corretamente:');
      console.log(`   - Crédito Pessoal: ${data['credito-pessoal']}`);
      console.log(`   - Antecipação: ${data['antecipacao']}`);
      console.log(`   - Pagamento Antecipado: ${data['pagamento-antecipado']}`);
      console.log(`   - Seguro Crédito: ${data['seguro-credito']}`);
      console.log(`   - Seguro Celular: ${data['seguro-celular']}`);
      console.log(`   - Perda Renda: ${data['perda-renda']}`);
      console.log(`   - Cupons: ${data['cupons']}`);
      console.log(`   - Seguro Pessoal: ${data['seguro-pessoal']}`);
    } else {
      console.log('❌ Dados não foram salvos corretamente');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 4: POST com formato antigo (retrocompatibilidade)
    console.log('4️⃣ Testando POST com formato antigo (retrocompatibilidade)...');
    
    const oldFormatData = {
      "_id": "status",
      "moduleKey": "credito-pessoal",
      "status": "off"
    };
    
    console.log('📤 Enviando dados formato antigo:', JSON.stringify(oldFormatData, null, 2));
    
    const oldFormatResponse = await axios.post(`${API_BASE_URL}/module-status`, oldFormatData);
    
    console.log('✅ Old Format Response Status:', oldFormatResponse.status);
    console.log('📊 Old Format Response Data:', JSON.stringify(oldFormatResponse.data, null, 2));
    
    if (oldFormatResponse.data.success) {
      console.log('✅ Retrocompatibilidade funcionando corretamente');
    } else {
      console.log('❌ Retrocompatibilidade com problemas');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');

    // Teste 5: POST com dados inválidos (validação)
    console.log('5️⃣ Testando validação com dados inválidos...');
    
    const invalidData = {
      "_id": "status",
      "_trabalhador": "invalid_status"
    };
    
    console.log('📤 Enviando dados inválidos:', JSON.stringify(invalidData, null, 2));
    
    try {
      const invalidResponse = await axios.post(`${API_BASE_URL}/module-status`, invalidData);
      console.log('❌ Validação falhou - deveria ter retornado erro 400');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Validação funcionando corretamente - erro 400 retornado');
        console.log('📊 Error Response:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('❌ Erro inesperado na validação:', error.message);
      }
    }
    
    console.log('\n🎉 Testes concluídos!');
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
    if (error.response) {
      console.error('📊 Error Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Executar testes
testModuleStatusEndpoints();
