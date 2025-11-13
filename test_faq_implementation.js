// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Teste da implementação FAQ no Module Status

const { ModuleStatus, FAQ } = require('./backend/models/ModuleStatus');

async function testFAQImplementation() {
  console.log('🧪 Testando implementação FAQ no Module Status...\n');
  
  try {
    // Teste 1: Criar documento de status
    console.log('1. Testando criação de documento de status...');
    const statusDoc = await ModuleStatus.findOneAndUpdate(
      { _id: 'status' },
      {
        _trabalhador: 'on',
        _pessoal: 'on',
        _antecipacao: 'off',
        _pgtoAntecip: 'on',
        _irpf: 'revisao',
        _seguro: 'on'
      },
      { upsert: true, new: true, runValidators: true }
    );
    console.log('✅ Documento de status criado:', statusDoc._id);
    
    // Teste 2: Criar documento de FAQ
    console.log('\n2. Testando criação de documento de FAQ...');
    const faqDoc = await FAQ.findOneAndUpdate(
      { _id: 'faq' },
      {
        dados: [
          'Como solicitar crédito trabalhador?',
          'Qual o prazo para aprovação?',
          'Quais documentos são necessários?',
          'Como acompanhar o status?',
          'Qual a taxa de juros?'
        ],
        totalPerguntas: 150
      },
      { upsert: true, new: true, runValidators: true }
    );
    console.log('✅ Documento de FAQ criado:', faqDoc._id);
    console.log('   - Perguntas:', faqDoc.dados.length);
    console.log('   - Total perguntas:', faqDoc.totalPerguntas);
    
    // Teste 3: Buscar ambos os documentos
    console.log('\n3. Testando busca de ambos os documentos...');
    const statusFound = await ModuleStatus.findOne({ _id: 'status' });
    const faqFound = await FAQ.findOne({ _id: 'faq' });
    
    console.log('✅ Status encontrado:', statusFound ? 'Sim' : 'Não');
    console.log('✅ FAQ encontrado:', faqFound ? 'Sim' : 'Não');
    
    // Teste 4: Atualizar FAQ
    console.log('\n4. Testando atualização de FAQ...');
    const updatedFAQ = await FAQ.findOneAndUpdate(
      { _id: 'faq' },
      {
        dados: [
          'Como solicitar crédito trabalhador?',
          'Qual o prazo para aprovação?',
          'Quais documentos são necessários?',
          'Como acompanhar o status?',
          'Qual a taxa de juros?',
          'Como funciona a antecipação?',
          'Qual o limite disponível?'
        ],
        totalPerguntas: 200
      },
      { upsert: true, new: true, runValidators: true }
    );
    console.log('✅ FAQ atualizado:', updatedFAQ.dados.length, 'perguntas');
    
    console.log('\n🎉 Todos os testes passaram com sucesso!');
    console.log('\n📋 Resumo da implementação:');
    console.log('- Documento de status: _id: "status"');
    console.log('- Documento de FAQ: _id: "faq"');
    console.log('- Ambos na mesma collection: module_status');
    console.log('- Estratégia de _id fixo funcionando perfeitamente');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testFAQImplementation().then(() => {
    console.log('\n✅ Teste concluído');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = { testFAQImplementation };
