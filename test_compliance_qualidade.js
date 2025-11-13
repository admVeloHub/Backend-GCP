// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Teste de Compliance - Módulo Qualidade - Novos Critérios

const axios = require('axios');

// Configuração da API
const API_BASE_URL = 'http://localhost:3000/api/qualidade';

// Payload de teste com novos campos obrigatórios
const payloadTeste = {
  colaboradorNome: "João Silva",
  avaliador: "Maria Santos",
  mes: "Dezembro",
  ano: 2024,
  dataAvaliacao: "2024-12-19T10:00:00.000Z",
  observacoes: "Avaliação de qualidade do atendimento - teste de compliance",
  dataLigacao: "2024-12-19T09:30:00.000Z",
  clarezaObjetividade: true,
  dominioAssunto: true,
  saudacaoAdequada: true,
  escutaAtiva: true,
  resolucaoQuestao: true,
  empatiaCordialidade: true,
  direcionouPesquisa: false,
  procedimentoIncorreto: false,
  encerramentoBrusco: false
};

// Payload de teste com pontuação máxima
const payloadMaxima = {
  colaboradorNome: "Ana Costa",
  avaliador: "Pedro Oliveira",
  mes: "Dezembro",
  ano: 2024,
  dataAvaliacao: "2024-12-19T11:00:00.000Z",
  observacoes: "Avaliação com pontuação máxima - todos os critérios positivos",
  dataLigacao: "2024-12-19T10:30:00.000Z",
  clarezaObjetividade: true,
  dominioAssunto: true,
  saudacaoAdequada: true,
  escutaAtiva: true,
  resolucaoQuestao: true,
  empatiaCordialidade: true,
  direcionouPesquisa: true,
  procedimentoIncorreto: false,
  encerramentoBrusco: false
};

// Payload de teste com critérios negativos
const payloadNegativa = {
  colaboradorNome: "Carlos Lima",
  avaliador: "Fernanda Rocha",
  mes: "Dezembro",
  ano: 2024,
  dataAvaliacao: "2024-12-19T12:00:00.000Z",
  observacoes: "Avaliação com critérios negativos - procedimento incorreto e encerramento brusco",
  dataLigacao: "2024-12-19T11:30:00.000Z",
  clarezaObjetividade: false,
  dominioAssunto: false,
  saudacaoAdequada: true,
  escutaAtiva: true,
  resolucaoQuestao: false,
  empatiaCordialidade: false,
  direcionouPesquisa: false,
  procedimentoIncorreto: true,
  encerramentoBrusco: true
};

// Função para testar endpoint POST
async function testarPOST(payload, nomeTeste) {
  try {
    console.log(`\n🧪 TESTE: ${nomeTeste}`);
    console.log('📤 Payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(`${API_BASE_URL}/avaliacoes`, payload);
    
    console.log('✅ SUCESSO - Status:', response.status);
    console.log('📥 Response:', JSON.stringify(response.data, null, 2));
    
    // Verificar se a pontuação foi calculada corretamente
    if (response.data.data && response.data.data.pontuacaoTotal !== undefined) {
      console.log(`🎯 Pontuação calculada: ${response.data.data.pontuacaoTotal} pontos`);
    }
    
    return response.data.data;
  } catch (error) {
    console.log('❌ ERRO - Status:', error.response?.status);
    console.log('📥 Error Response:', JSON.stringify(error.response?.data, null, 2));
    return null;
  }
}

// Função para testar endpoint PUT
async function testarPUT(id, payload, nomeTeste) {
  try {
    console.log(`\n🧪 TESTE: ${nomeTeste}`);
    console.log('📤 Payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.put(`${API_BASE_URL}/avaliacoes/${id}`, payload);
    
    console.log('✅ SUCESSO - Status:', response.status);
    console.log('📥 Response:', JSON.stringify(response.data, null, 2));
    
    return response.data.data;
  } catch (error) {
    console.log('❌ ERRO - Status:', error.response?.status);
    console.log('📥 Error Response:', JSON.stringify(error.response?.data, null, 2));
    return null;
  }
}

// Função para testar validações
async function testarValidacoes() {
  console.log('\n🔍 TESTANDO VALIDAÇÕES...');
  
  // Teste 1: Campos obrigatórios ausentes
  const payloadIncompleto = {
    colaboradorNome: "Teste",
    // Faltam campos obrigatórios
  };
  
  await testarPOST(payloadIncompleto, "Validação - Campos obrigatórios ausentes");
  
  // Teste 2: Tipos incorretos
  const payloadTiposIncorretos = {
    colaboradorNome: "Teste",
    avaliador: "Teste",
    mes: "Dezembro",
    ano: 2024,
    dataAvaliacao: "2024-12-19T10:00:00.000Z",
    observacoes: "Teste",
    dataLigacao: "2024-12-19T09:30:00.000Z",
    clarezaObjetividade: "true", // String em vez de Boolean
    dominioAssunto: 1 // Number em vez de Boolean
  };
  
  await testarPOST(payloadTiposIncorretos, "Validação - Tipos incorretos");
  
  // Teste 3: Datas inválidas
  const payloadDatasInvalidas = {
    colaboradorNome: "Teste",
    avaliador: "Teste",
    mes: "Dezembro",
    ano: 2024,
    dataAvaliacao: "data-invalida",
    observacoes: "Teste",
    dataLigacao: "data-invalida",
    clarezaObjetividade: true,
    dominioAssunto: true
  };
  
  await testarPOST(payloadDatasInvalidas, "Validação - Datas inválidas");
}

// Função principal de teste
async function executarTestes() {
  console.log('🚀 INICIANDO TESTES DE COMPLIANCE - MÓDULO QUALIDADE');
  console.log('=' .repeat(60));
  
  // Testar validações primeiro
  await testarValidacoes();
  
  // Testar payloads válidos
  const avaliacao1 = await testarPOST(payloadTeste, "POST - Payload básico com novos campos");
  const avaliacao2 = await testarPOST(payloadMaxima, "POST - Pontuação máxima");
  const avaliacao3 = await testarPOST(payloadNegativa, "POST - Critérios negativos");
  
  // Testar PUT se alguma avaliação foi criada
  if (avaliacao1 && avaliacao1._id) {
    const payloadAtualizacao = {
      ...payloadTeste,
      observacoes: "Observações atualizadas - teste PUT",
      clarezaObjetividade: false,
      dominioAssunto: false
    };
    
    await testarPUT(avaliacao1._id, payloadAtualizacao, "PUT - Atualização com novos campos");
  }
  
  console.log('\n🏁 TESTES CONCLUÍDOS');
  console.log('=' .repeat(60));
}

// Executar testes se o arquivo for chamado diretamente
if (require.main === module) {
  executarTestes().catch(console.error);
}

module.exports = {
  testarPOST,
  testarPUT,
  testarValidacoes,
  executarTestes
};
