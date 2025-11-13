// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// TESTE DE COMPLIANCE - ENDPOINTS QUALIDADE FUNÇÕES

const axios = require('axios');

// Configuração do teste
const BASE_URL = 'http://localhost:3000/api/qualidade';
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Função para executar teste
async function runTest(testName, testFunction) {
  try {
    console.log(`\n🧪 [TESTE] ${testName}`);
    await testFunction();
    testResults.passed++;
    testResults.tests.push({ name: testName, status: 'PASSED' });
    console.log(`✅ [TESTE] ${testName} - PASSOU`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name: testName, status: 'FAILED', error: error.message });
    console.log(`❌ [TESTE] ${testName} - FALHOU: ${error.message}`);
  }
}

// Teste 1: GET /api/qualidade/funcoes - Listar funções
async function testGetFuncoes() {
  const response = await axios.get(`${BASE_URL}/funcoes`);
  
  if (!response.data.success) {
    throw new Error('Response success deve ser true');
  }
  
  if (!Array.isArray(response.data.data)) {
    throw new Error('Response data deve ser um array');
  }
  
  if (typeof response.data.count !== 'number') {
    throw new Error('Response count deve ser um número');
  }
  
  console.log(`   📊 Funções encontradas: ${response.data.count}`);
}

// Teste 2: POST /api/qualidade/funcoes - Criar função
async function testPostFuncoes() {
  const testData = {
    funcao: `Teste Função ${Date.now()}`,
    descricao: 'Função criada para teste de compliance'
  };
  
  const response = await axios.post(`${BASE_URL}/funcoes`, testData);
  
  if (!response.data.success) {
    throw new Error('Response success deve ser true');
  }
  
  if (!response.data.data._id) {
    throw new Error('Response data deve conter _id');
  }
  
  if (response.data.data.funcao !== testData.funcao) {
    throw new Error('Função criada não confere com dados enviados');
  }
  
  console.log(`   📝 Função criada: ${response.data.data.funcao} (ID: ${response.data.data._id})`);
  
  // Retornar ID para testes subsequentes
  return response.data.data._id;
}

// Teste 3: POST /api/qualidade/funcoes - Validação de duplicação
async function testPostFuncoesDuplicacao() {
  const testData = {
    funcao: 'Função Duplicada Teste',
    descricao: 'Teste de duplicação'
  };
  
  // Criar primeira função
  await axios.post(`${BASE_URL}/funcoes`, testData);
  
  try {
    // Tentar criar função duplicada
    await axios.post(`${BASE_URL}/funcoes`, testData);
    throw new Error('Deveria ter retornado erro de duplicação');
  } catch (error) {
    if (error.response && error.response.status === 409) {
      if (!error.response.data.success) {
        throw new Error('Response success deve ser false para erro de duplicação');
      }
      if (error.response.data.error !== 'Função já existe') {
        throw new Error('Mensagem de erro de duplicação incorreta');
      }
      console.log('   ✅ Validação de duplicação funcionando corretamente');
    } else {
      throw error;
    }
  }
}

// Teste 4: PUT /api/qualidade/funcoes/:id - Atualizar função
async function testPutFuncoes() {
  // Primeiro criar uma função
  const createData = {
    funcao: `Função para Atualizar ${Date.now()}`,
    descricao: 'Função original'
  };
  
  const createResponse = await axios.post(`${BASE_URL}/funcoes`, createData);
  const funcaoId = createResponse.data.data._id;
  
  // Atualizar função
  const updateData = {
    funcao: `Função Atualizada ${Date.now()}`,
    descricao: 'Função atualizada para teste'
  };
  
  const response = await axios.put(`${BASE_URL}/funcoes/${funcaoId}`, updateData);
  
  if (!response.data.success) {
    throw new Error('Response success deve ser true');
  }
  
  if (response.data.data.funcao !== updateData.funcao) {
    throw new Error('Função não foi atualizada corretamente');
  }
  
  console.log(`   🔄 Função atualizada: ${response.data.data.funcao}`);
  
  return funcaoId;
}

// Teste 5: DELETE /api/qualidade/funcoes/:id - Deletar função
async function testDeleteFuncoes() {
  // Primeiro criar uma função
  const createData = {
    funcao: `Função para Deletar ${Date.now()}`,
    descricao: 'Função que será deletada'
  };
  
  const createResponse = await axios.post(`${BASE_URL}/funcoes`, createData);
  const funcaoId = createResponse.data.data._id;
  
  // Deletar função
  const response = await axios.delete(`${BASE_URL}/funcoes/${funcaoId}`);
  
  if (!response.data.success) {
    throw new Error('Response success deve ser true');
  }
  
  if (response.data.message !== 'Função deletada com sucesso') {
    throw new Error('Mensagem de sucesso incorreta');
  }
  
  console.log(`   🗑️ Função deletada com sucesso (ID: ${funcaoId})`);
}

// Teste 6: Validação de campos obrigatórios
async function testValidacaoCampos() {
  try {
    // Tentar criar função sem nome
    await axios.post(`${BASE_URL}/funcoes`, { descricao: 'Sem nome' });
    throw new Error('Deveria ter retornado erro de validação');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      if (!error.response.data.success) {
        throw new Error('Response success deve ser false para erro de validação');
      }
      if (error.response.data.error !== 'Nome da função é obrigatório') {
        throw new Error('Mensagem de erro de validação incorreta');
      }
      console.log('   ✅ Validação de campos obrigatórios funcionando');
    } else {
      throw error;
    }
  }
}

// Teste 7: Validação de ObjectId inválido
async function testObjectIdInvalido() {
  try {
    await axios.put(`${BASE_URL}/funcoes/invalid-id`, { funcao: 'Teste' });
    throw new Error('Deveria ter retornado erro de ObjectId inválido');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      if (error.response.data.error !== 'ID inválido') {
        throw new Error('Mensagem de erro de ObjectId incorreta');
      }
      console.log('   ✅ Validação de ObjectId funcionando');
    } else {
      throw error;
    }
  }
}

// Executar todos os testes
async function runAllTests() {
  console.log('🚀 [TESTE] Iniciando testes de compliance - Endpoints Qualidade Funções');
  console.log('🚀 [TESTE] Base URL:', BASE_URL);
  
  await runTest('GET /api/qualidade/funcoes - Listar funções', testGetFuncoes);
  await runTest('POST /api/qualidade/funcoes - Criar função', testPostFuncoes);
  await runTest('POST /api/qualidade/funcoes - Validação duplicação', testPostFuncoesDuplicacao);
  await runTest('PUT /api/qualidade/funcoes/:id - Atualizar função', testPutFuncoes);
  await runTest('DELETE /api/qualidade/funcoes/:id - Deletar função', testDeleteFuncoes);
  await runTest('Validação de campos obrigatórios', testValidacaoCampos);
  await runTest('Validação de ObjectId inválido', testObjectIdInvalido);
  
  // Relatório final
  console.log('\n📊 [RELATÓRIO] Resultados dos testes:');
  console.log(`✅ Testes passaram: ${testResults.passed}`);
  console.log(`❌ Testes falharam: ${testResults.failed}`);
  console.log(`📈 Taxa de sucesso: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  console.log('\n📋 [DETALHES] Testes executados:');
  testResults.tests.forEach(test => {
    const status = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`   ${status} ${test.name}`);
    if (test.error) {
      console.log(`      Erro: ${test.error}`);
    }
  });
  
  if (testResults.failed > 0) {
    console.log('\n❌ [RESULTADO] Alguns testes falharam. Verifique a implementação.');
    process.exit(1);
  } else {
    console.log('\n✅ [RESULTADO] Todos os testes passaram! Compliance total confirmado.');
    process.exit(0);
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ [ERRO] Falha na execução dos testes:', error.message);
    process.exit(1);
  });
}

module.exports = { runAllTests, testResults };
