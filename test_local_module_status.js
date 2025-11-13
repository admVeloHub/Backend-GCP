// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
const { ModuleStatus, FAQ } = require('./backend/models/ModuleStatus');

async function testLocalModuleStatus() {
  console.log('🧪 Testando Module Status localmente...\n');

  try {
    // Teste 1: Criar documento de status
    console.log('1️⃣ Testando criação de documento status...');
    
    const statusData = {
      _id: 'status',
      _trabalhador: 'on',
      _pessoal: 'revisao',
      _antecipacao: 'off',
      _pgtoAntecip: 'on',
      _irpf: 'off',
      _seguro: 'on'
    };
    
    const statusDoc = await ModuleStatus.findOneAndUpdate(
      { _id: 'status' },
      statusData,
      { upsert: true, new: true, runValidators: true }
    );
    
    console.log('✅ Status criado/atualizado:', statusDoc);
    
    // Teste 2: Buscar documento de status
    console.log('\n2️⃣ Testando busca de documento status...');
    
    const foundStatus = await ModuleStatus.findOne({ _id: 'status' });
    console.log('✅ Status encontrado:', foundStatus);
    
    // Teste 3: Criar documento de FAQ
    console.log('\n3️⃣ Testando criação de documento FAQ...');
    
    const faqData = {
      _id: 'faq',
      dados: [
        'Como solicitar crédito trabalhador?',
        'Qual o prazo para aprovação?',
        'Quais documentos são necessários?'
      ],
      totalPerguntas: 1250
    };
    
    const faqDoc = await FAQ.findOneAndUpdate(
      { _id: 'faq' },
      faqData,
      { upsert: true, new: true, runValidators: true }
    );
    
    console.log('✅ FAQ criado/atualizado:', faqDoc);
    
    // Teste 4: Buscar documento de FAQ
    console.log('\n4️⃣ Testando busca de documento FAQ...');
    
    const foundFAQ = await FAQ.findOne({ _id: 'faq' });
    console.log('✅ FAQ encontrado:', foundFAQ);
    
    console.log('\n🎉 Todos os testes locais passaram!');
    
  } catch (error) {
    console.error('❌ Erro nos testes locais:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar testes
testLocalModuleStatus();
