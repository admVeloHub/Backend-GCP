listagem de schema de coleções do mongoDB
  <!-- VERSION: v2.3.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team -->
     
    🗄️ Database Principal: console_conteudo
  
  //schema console_conteudo.Artigos
  {
  _id: ObjectId,
  tag: String,                    // Tag do artigo
  categoria_id: String,           // ID da categoria
  categoria_titulo: String,       // Título da categoria
  artigo_titulo: String,          // Título do artigo
  artigo_conteudo: String,        // Conteúdo do artigo (FORMATADO - ver padrões abaixo)
  createdAt: Date,                // Data de criação
  updatedAt: Date                 // Data de atualização
  }
  
  //schema console_conteudo.Bot_perguntas
  {
  _id: ObjectId,
  pergunta: String,               // Pergunta do bot
  resposta: String,               // Resposta do bot (FORMATADA - ver padrões abaixo)
  palavrasChave: String,          // Palavras-chave
  sinonimos: String,              // Sinônimos
  tabulacao: String,              // Tabulação
  createdAt: Date,                // Data de criação
  updatedAt: Date                 // Data de atualização
  }
  
  //schema console_conteudo.Velonews
  {
  _id: ObjectId,
  titulo: String,                 // Título da notícia
  conteudo: String,               // Conteúdo da notícia
  isCritical: Boolean,            // Se é notícia crítica
  solved: Boolean,                // Se a notícia foi resolvida (default: false)
  createdAt: Date,                // Data de criação
  updatedAt: Date                 // Data de atualização
  }
      
  //schema console_conteudo.user_activity
  {
  _id: ObjectId,
  colaboradorNome: String,           // Nome do colaborador
  action: String,                    // Tipo de ação (question_asked, feedback_given, article_viewed, ai_button_used)
  details: {                         // Detalhes específicos da ação
    question: String,                // Pergunta feita (para question_asked)
    feedbackType: String,            // Tipo de feedback (positive/negative)
    messageId: String,               // ID da mensagem (para feedback)
    articleId: String,               // ID do artigo (para article_viewed)
    articleTitle: String,            // Título do artigo
    formatType: String               // Tipo de formatação (whatsapp/email)
  },
  sessionId: String,                 // ID da sessão
  source: String,                    // Fonte da ação (chatbot, ai_button, etc.)
  createdAt: Date,                   // Data de criação
  updatedAt: Date                    // Data de atualização
  }
  
  //schema console_conteudo.hub_sessions
  {
  _id: ObjectId,
  colaboradorNome: String,           // Nome do colaborador
  userEmail: String,                 // Email do usuário
  sessionId: String,                 // ID único da sessão (UUID)
  ipAddress: String,                 // IP do usuário (opcional)
  userAgent: String,                 // Navegador/dispositivo (opcional)
  isActive: Boolean,                 // Se a sessão está ativa
  loginTimestamp: Date,              // Data/hora do login
  logoutTimestamp: Date,             // Data/hora do logout (null se ativo)
  createdAt: Date,                   // Data de criação
  updatedAt: Date                    // Data de atualização
  }
  
  //schema console_conteudo.velonews_acknowledgments
  {
  _id: ObjectId,
  newsId: ObjectId,              // Referência à notícia (Velonews._id)
  colaboradorNome: String,       // Nome do colaborador que confirmou
  userEmail: String,             // Email do usuário
  acknowledgedAt: Date,          // Data/hora da confirmação
  createdAt: Date,               // Data de criação
  updatedAt: Date                // Data de atualização
  }
  
  //schema console_conteudo.bot_feedback
  {
  _id: ObjectId,
  colaboradorNome: String,           // Nome do colaborador que deu o feedback
  action: String,                    // Tipo de ação (feedback_given)
  messageId: String,                 // ID da mensagem que recebeu o feedback
  sessionId: String,                 // ID da sessão
  source: String,                    // Fonte da resposta (chatbot, ai_button, clarification, etc.)
  details: {                         // Detalhes específicos do feedback
    feedbackType: String,            // Tipo de feedback (positive/negative)
    comment: String,                 // Comentário opcional do usuário
    question: String,                // Pergunta original que gerou a resposta
    answer: String,                  // Resposta do bot que recebeu o feedback
    aiProvider: String,              // Provedor da IA (OpenAI, Gemini, null)
    responseSource: String           // Origem da resposta (bot_perguntas, ai, clarification, etc.)
  },
  createdAt: Date,                   // Data de criação
  updatedAt: Date                    // Data de atualização
  }
  

  🗄️ Database: console_chamados
  
    // schema DB console_chamados.tk_gestão
  // Tickets de gestão, RH e financeiro, facilities
  {
  _id: String,                    // ID personalizado com prefixo TKG- + numeração automática (ex: TKG-000001)
  _userEmail: String,             // Email do usuário (obtido via SSO) - MOVIDO para 2ª posição
  _genero: String,                // Gênero do ticket (Gestão, RH e Financeiro, Facilities)
  _tipo: String,                  // Tipo do ticket (solicitação, agendamento, notificação, etc.)
  _direcionamento: String,        // Direcionamento (supervisor, gestor, backoffice, RH, Financeiro, etc.)
  _corpo: [                       // Array de mensagens do ticket (ALTERADO de String para Array)
    {
      autor: String,              // "user" | "admin"
      userName: String,           // Nome obtido do SSO
      timestamp: Date,            // Data/hora da mensagem
      mensagem: String            // Conteúdo da mensagem
    }
  ],
  _atribuido: string,             // Atribuído a (opcional)
  _processo: string,              // Processo (opcional)
  _processamento: String,         // Processamento (aprovação do gestor, consulta viabilidade, processamento) - OPCIONAL
  _statusHub: String,             // Status para usuário (novo, aberto, em espera pendente, resolvido)
  _statusConsole: String,         // Status para gestor (novo, aberto, em espera, pendente, resolvido)
  _lastUpdatedBy: String,         // Quem atualizou por último (user, admin)
  createdAt: Date,                // Data de criação
  updatedAt: Date                 // Data de atualização
  }
  

  // schema DB console_chamados.tk_conteudos
  // Tickets de conteúdo (artigos, processos, roteiros, treinamentos, funcionalidades, recursos)
  {
  _id: String,                    // ID personalizado com prefixo TKC- + numeração automática (ex: TKC-000001)
  _userEmail: String,             // Email do usuário (obtido via SSO) - MOVIDO para 2ª posição
  _assunto: String,                // Assunto do ticket
  _genero: String,                // Gênero do ticket (Artigo, Processo, Roteiro, Treinamento, Funcionalidade, Recurso Adicional)
  _tipo: String,                  // Tipo do ticket (assunto, produto, ambiente, tipo_recurso, etc.)
  _corpo: [                       // Array de mensagens do ticket (ALTERADO de String para Array)
    {
      autor: String,              // "user" | "admin"
      userName: String,           // Nome obtido do SSO
      timestamp: Date,            // Data/hora da mensagem
      mensagem: String            // Conteúdo da mensagem
    }
  ],
  _obs: String,                   // Observações (opcional)
  _atribuido: string,             // Atribuído a (opcional)
  _processo: string,              // Processo (opcional)
  _processamento: String,         // Processamento (aprovação do gestor, consulta viabilidade, processamento) - OPCIONAL
  _statusHub: String,             // Status para usuário (novo, aberto, em espera pendente, resolvido)
  _statusConsole: String,         // Status para gestor (novo, aberto, em espera, pendente, resolvido)
  _lastUpdatedBy: String,         // Quem atualizou por último (user, admin)
  createdAt: Date,                // Data de criação
  updatedAt: Date                 // Data de atualização
  }
  
  // ===== MAPEAMENTO DE FORMULÁRIOS PARA SCHEMAS =====
  
  // FORMULÁRIOS TK_CONTEUDOS (6 Gêneros):
  // 1. Artigo: assunto → _assunto, tipo → _tipo, descrição → _corpo, ocorrência → _obs
  // 2. Processo: assunto → _assunto, tipo → _tipo, descrição → _corpo, ocorrência → _obs
  // 3. Roteiro: assunto → _assunto, tipo → _tipo, descrição → _corpo, ocorrência → _obs
  // 4. Treinamento: assunto → _assunto, tipo → _tipo, descrição → _corpo, ocorrência → _obs
  // 5. Funcionalidade: assunto → _assunto, tipo → _tipo, descrição → _corpo, ocorrência → _obs
  // 6. Recurso Adicional: assunto → _assunto, tipo → _tipo, descrição → _corpo, ocorrência → _obs
  
  // FORMULÁRIOS TK_GESTÃO (3 Gêneros):
  // 1. Gestão: tipo → _tipo, direcionado → _direcionamento, mensagem → _corpo
  // 2. RH e Financeiro: tipo → _tipo, setor → _direcionamento, mensagem → _corpo
  // 3. Facilities: tipo → _tipo, categoria → _direcionamento, mensagem → _corpo
  
  
  
  🗄️ Database: console_config
  
  // Schema Config
  {
  _id: ObjectId,
  _userMail: String,              // Email do usuário
  _userId: String,                // ID do usuário
  _userRole: String,              // Papel do usuário
  _userClearance: {               // Permissões do usuário
    artigos: Boolean,
    velonews: Boolean,
    botPerguntas: Boolean,
    botAnalises: Boolean,         // Permissão para Bot Análises
    chamadosInternos: Boolean,
    igp: Boolean,
    qualidade: Boolean,
    capacity: Boolean,
    config: Boolean,
    servicos: Boolean,
    academy: Boolean              // Permissão para Academy
  },
  _userTickets: {                 // Tipos de tickets
    artigos: Boolean,
    processos: Boolean,
    roteiros: Boolean,
    treinamentos: Boolean,
    funcionalidades: Boolean,
    recursos: Boolean,
    gestao: Boolean,
    rhFin: Boolean,
    facilities: Boolean
  },
  _funcoesAdministrativas: {      // Funções administrativas
    avaliador: Boolean,           // Se é avaliador no módulo Qualidade
    auditoria: Boolean,           // Se tem permissão para auditoria
    relatoriosGestao: Boolean     // Se tem permissão para relatórios de gestão
  },
  createdAt: Date,                // Data de criação
  updatedAt: Date                 // Data de atualização
  }
  
   //schema console_config.module_status
  {
  _id: "status",
  _trabalhador: String,    // Status do Crédito Trabalhador
  _pessoal: String,        // Status do Crédito Pessoal  
  _antecipacao: String,    // Status da Antecipação
  _pgtoAntecip: String,    // Status do Pagamento Antecipado
  _irpf: String,           // Status do Módulo IRPF
  _seguro: String,         // Status do Módulo Seguro
  createdAt: Date,         // Data de criação
  updatedAt: Date          // Data de atualização
  }
  
  
  //🗄️ Schema de Ping de Usuário
  // de login ou refresh
  {
  _userId: String,                // ID do usuário
  _collectionId: String,          // ID da collection
  createdAt: Date,                // Data de criação
  updatedAt: Date                 // Data de atualização
  }
  
  🗄️ Database console_analises
  9. schema console_analises.qualidade_avaliacoes
{
_id: ObjectId,
colaboradorNome: String,        // Nome do colaborador
avaliador: String,              // Avaliador
mes: String,                    // Mês da avaliação
ano: Number,                    // Ano da avaliação
saudacaoAdequada: Boolean,      // Critério de avaliação
escutaAtiva: Boolean,           // Critério de avaliação
clarezaObjetividade: Boolean,   // Critério de avaliação
resolucaoQuestao: Boolean,      // Critério de avaliação
dominioAssunto: Boolean,        // Critério de avaliação
empatiaCordialidade: Boolean,   // Critério de avaliação
direcionouPesquisa: Boolean,    // Critério de avaliação
procedimentoIncorreto: Boolean, // Critério de avaliação
encerramentoBrusco: Boolean,    // Critério de avaliação
pontuacaoTotal: Number,         // Pontuação total
observacoes: String,            // Observações da avaliação
dataLigacao: Date,              // Data da ligação
createdAt: Date,                // Data de criação
updatedAt: Date,                // Data de atualização
}

  //schema console_analises.qualidade_funcionarios
  {
  _id: ObjectId,
  colaboradorNome: String,        // Nome completo (padronizado)
  dataAniversario: Date,          // Data de aniversário
  empresa: String,                // Empresa
  dataContratado: Date,           // Data de contratação
  telefone: String,               // Telefone
  atuacao: [ObjectId],            // Array de referências para qualidade_funcoes
  escala: String,                 // Escala
  acessos: [{                     // Array de acessos
    sistema: String,
    perfil: String,
    observacoes: String,
    updatedAt: Date
  }],
  desligado: Boolean,             // Se foi desligado
  dataDesligamento: Date,         // Data de desligamento
  afastado: Boolean,              // Se está afastado
  dataAfastamento: Date,          // Data de afastamento
  createdAt: Date,                // Data de criação
  updatedAt: Date                 // Data de atualização
  }
  
    //schema console_analises.audio_analise_status
  {
  _id: ObjectId,                  // ID gerado pelo MongoDB
  nomeArquivo: String,            // Nome do arquivo de áudio
  sent: Boolean,                  // true quando transmissão para GCS ocorreu
  treated: Boolean,               // true quando relatório GPT for entregue
  createdAt: Date,                // Data de criação
  updatedAt: Date                 // Data de atualização
  }
  
  //schema console_analises.audio_analise_results
  {
  _id: ObjectId,                  // ID gerado pelo MongoDB
  audioStatusId: ObjectId,        // Referência ao audio_analise_status
  nomeArquivo: String,            // Nome do arquivo de áudio
  gcsUri: String,                 // URI do arquivo no GCS (gs://bucket/file)
  transcription: String,          // Transcrição completa do áudio
  timestamps: [{                  // Array de timestamps das palavras
    word: String,                 // Palavra
    startTime: Number,            // Tempo de início em segundos
    endTime: Number               // Tempo de fim em segundos
  }],
  emotion: {                      // Análise de emoção
    tom: String,                  // positivo|neutro|negativo
    empatia: Number,             // Nível de empatia (0-100)
    profissionalismo: Number      // Nível de profissionalismo (0-100)
  },
  nuance: {                       // Análise de nuance
    clareza: Number,             // Nível de clareza (0-100)
    tensao: Number               // Nível de tensão (0-100)
  },
  qualityAnalysis: {              // Análise de qualidade (Gemini)
    criterios: {                  // Critérios avaliados
      saudacaoAdequada: Boolean,
      escutaAtiva: Boolean,
      clarezaObjetividade: Boolean,
      resolucaoQuestao: Boolean,
      dominioAssunto: Boolean,
      empatiaCordialidade: Boolean,
      direcionouPesquisa: Boolean,
      procedimentoIncorreto: Boolean,
      encerramentoBrusco: Boolean
    },
    pontuacao: Number,           // Pontuação total (-160 a 100)
    confianca: Number,           // Nível de confiança (0-100)
    palavrasCriticas: [String],  // Palavras-chave críticas
    calculoDetalhado: [String],  // Explicação do cálculo
    analysis: String             // Análise completa em texto
  },
  gptAnalysis: {                 // Análise GPT (opcional)
    criterios: {                  // Critérios avaliados pelo GPT
      saudacaoAdequada: Boolean,
      escutaAtiva: Boolean,
      clarezaObjetividade: Boolean,
      resolucaoQuestao: Boolean,
      dominioAssunto: Boolean,
      empatiaCordialidade: Boolean,
      direcionouPesquisa: Boolean,
      procedimentoIncorreto: Boolean,
      encerramentoBrusco: Boolean
    },
    pontuacao: Number,           // Pontuação GPT (-160 a 100)
    palavrasCriticas: [String],  // Palavras-chave críticas identificadas pelo GPT
    recomendacoes: [String],     // Recomendações do GPT
    confianca: Number,           // Nível de confiança do GPT (0-100)
    validacaoGemini: {           // Validação cruzada com Gemini
      concorda: Boolean,         // Se GPT concorda com Gemini
      diferencas: [String]       // Lista de diferenças encontradas
    },
    analysis: String             // Análise completa do GPT em texto
  },
  pontuacaoConsensual: Number,   // Pontuação consensual (média entre Gemini e GPT) (-160 a 100)
  processingTime: Number,         // Tempo de processamento em segundos
  createdAt: Date,                // Data de criação
  updatedAt: Date                 // Data de atualização
  }
  
  //schema console_analises.qualidade_funcoes
  {
  _id: ObjectId,
  funcao: String,              // Nome da função (ex: "Atendimento", "Suporte Técnico")
  descricao: String,           // Descrição opcional da função
  createdAt: Date,             // Data de criação
  updatedAt: Date              // Data de atualização
  }
  
  //schema console_analises.faq_bot
  // 
  {
  _id: "faq",                      // ID fixo para identificação no backend
  dados: [String],                 // Array com as 10 perguntas mais feitas (apenas os textos)
  totalPerguntas: Number,          // Total de perguntas no período
  updatedAt: Date                  // Data de atualização (controle de versionamento)
  }
  
  🗄️ Database: academy_registros
  
  //schema academy_registros.course_progress
  {
  _id: ObjectId,                    // Gerado automaticamente pelo MongoDB
  userEmail: String,                 // Email do usuário (obrigatório)
  subtitle: String,                 // Subtítulo da seção (ex: "Seguro Prestamista") (obrigatório)
  completedVideos: {                 // Objeto com progresso de cada aula do subtítulo
    "Aula em vídeo": Boolean,        // true quando todos os vídeos da sequência forem assistidos
    "Ebook - Seguro Prestamista": Boolean,  // true quando clicado pela primeira vez
    // ... outras aulas do subtítulo (chave = título da aula, valor = Boolean)
  },
  quizUnlocked: Boolean,             // true quando todas as aulas do subtítulo estiverem completas (todos valores em completedVideos == true)
  completedAt: Date,                 // Data de conclusão do subtítulo (quando todas as aulas foram completadas)
  createdAt: Date,                   // Data de criação do registro
  updatedAt: Date                    // Data da última atualização
  }
  
  // Chave única (índice composto): userEmail + subtitle
  // Permite múltiplos registros por usuário (um por subtítulo)

  Collection: academy_registros.cursos_conteudo

{
  _id: ObjectId,
  cursoClasse: String,          // "Essencial", "Atualização", "Opcional", "Reciclagem"
  cursoNome: String,            // "onboarding", "produtos", etc
  cursoDescription: String,     // Descrição do curso (opcional)
  courseOrder: Number,          // Ordem de exibição
  isActive: Boolean,            // Ativar/desativar curso
  modules: [
    {
      moduleId: String,        // "modulo-1", "modulo-2"
      moduleNome: String,       // "Módulo 1: Treinamentos Essenciais"
      isActive: Boolean,
      sections: [              // Tema/Subtítulo
        {
          temaNome: String,     // "Seja Bem Vindo"
          temaOrder: Number,
          isActive: Boolean,
          hasQuiz: Boolean,     // Se tem quiz associado
          quizId: String,       // ID do quiz (se houver)
          lessons: [
            {
              lessonId: String,      // "l1-1"
              lessonTipo: String,    // "video", "pdf", "audio", "slide", "document"
              lessonTitulo: String,  // "Bem vindo ao VeloAcademy"
              lessonOrdem: Number,
              isActive: Boolean,
              lessonContent: [       // ARRAY de objetos com url
                {
                  url: String        // YouTube, Google Drive PDF, Google Slides, Google Drive Audio, Outros documentos
                }
              ],
              driveId: String,       // ID do Google Drive (se aplicável)
              youtubeId: String,     // ID do YouTube (se aplicável)
            }
          ]
        }
      ]
    }
  ],
  createdAt: Date,
  updatedAt: Date,
  createdBy: String,           // Email do criador
  version: Number              // Controle de versão
}
Exemplo Prático - Curso Produtos, Módulo Diversos, Tema Digital
{
  "_id": ObjectId("..."),
  "cursoClasse": "Essencial",
  "cursoNome": "produtos",
  "cursoDescription": "Curso completo sobre produtos digitais e suas funcionalidades",
  "courseOrder": 2,
  "isActive": true,
  "modules": [
    {
      "moduleId": "modulo-2",
      "moduleNome": "Módulo 2: Produtos Diversificados",
      "isActive": true,
      "sections": [
        {
          "temaNome": "Digital",
          "temaOrder": 1,
          "isActive": true,
          "hasQuiz": true,
          "quizId": "produtos-digital",
          "lessons": [
            {
              "lessonId": "p-digital-1",
              "lessonTipo": "video",
              "lessonTitulo": "Aula - Produtos Digitais",
              "lessonOrdem": 1,
              "isActive": true,
              "lessonContent": [
                {
                  "url": "https://youtu.be/ABC123xyz"
                }
              ],
              "driveId": null,
              "youtubeId": "ABC123xyz"
            },
            {
              "lessonId": "p-digital-2",
              "lessonTipo": "slide",
              "lessonTitulo": "Apresentação - Produtos Digitais",
              "lessonOrdem": 2,
              "isActive": true,
              "lessonContent": [
                {
                  "url": "https://docs.google.com/presentation/d/1a2b3c4d5e6f7g8h9i0j/edit"
                }
              ],
              "driveId": "1a2b3c4d5e6f7g8h9i0j",
              "youtubeId": null
            },
            {
              "lessonId": "p-digital-3",
              "lessonTipo": "pdf",
              "lessonTitulo": "Ebook - Guia de Produtos Digitais",
              "lessonOrdem": 3,
              "isActive": true,
              "lessonContent": [
                {
                  "url": "https://drive.google.com/file/d/1XyZ9AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=drive_link"
                }
              ],
              "driveId": "1XyZ9AbCdEfGhIjKlMnOpQrStUvWxYz",
              "youtubeId": null
            }
          ]
        }
      ]
    }
  ],
  "createdAt": ISODate("2025-01-30T10:00:00Z"),
  "updatedAt": ISODate("2025-01-30T10:00:00Z"),
  "createdBy": "criador@velotax.com.br",
  "version": 1
}
  // ========================================
  // 📋 PADRÕES DE FORMATAÇÃO DE CONTEÚDO
  // ========================================
  // VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
  
  /*
  🎯 PADRÕES DE FORMATAÇÃO PARA CONTEÚDO (Bot_perguntas.resposta e Artigos.artigo_conteudo)
  
  1. QUEBRAS DE LINHA:
     - Usar \n para quebras de linha simples
     - Usar \n\n para separação de parágrafos
     - Evitar mais de 2 \n consecutivos
  
  2. LISTAS NUMERADAS:
     - Formato: "1. Item\n2. Item\n3. Item"
     - Sempre usar números seguidos de ponto e espaço
     - Uma quebra de linha entre cada item
  
  3. LISTAS COM BULLETS:
     - Formato: "• Item\n• Item\n• Item"
     - Usar bullet Unicode (•) seguido de espaço
     - Uma quebra de linha entre cada item
  
  4. NEGRITO E ITÁLICO:
     - Negrito: **texto** (markdown)
     - Itálico: *texto* (markdown)
     - Evitar HTML tags (<b>, <i>, <strong>, <em>)
  
  5. LINKS:
     - Formato: [texto do link](URL)
     - Sempre incluir texto descritivo
     - URLs completas com http/https
  
  6. CARACTERES ESPECIAIS:
     - Usar encoding UTF-8 correto
     - Acentos: á, é, í, ó, ú, ã, õ, ç
     - Símbolos: R$, %, º, ª, etc.
  
  7. ESTRUTURA DE PARÁGRAFOS:
     - Máximo 3-4 linhas por parágrafo
     - Usar \n\n para separar seções
     - Evitar blocos de texto muito longos
  
  8. FORMATAÇÃO DE CÓDIGOS/COMANDOS:
     - Usar `código` para inline
     - Usar ```código``` para blocos
     - Especificar linguagem quando relevante
  
  9. FORMATAÇÃO DE DATAS:
     - Formato: DD/MM/AAAA
     - Horários: HH:MM (24h)
     - Evitar formatos ambíguos
  
  10. FORMATAÇÃO DE VALORES:
      - Moeda: R$ 1.234,56
      - Percentuais: 15%
      - Números grandes: 1.000.000
  
  EXEMPLOS DE FORMATAÇÃO CORRETA:
  
  ✅ BOM:
  "Para solicitar o crédito trabalhador:
  
  1. Acesse o portal VeloHub
  2. Preencha os dados pessoais
  3. Envie os documentos necessários
  
  **Importante:** O processo pode levar até 5 dias úteis.
  
  Para mais informações, consulte: [Manual do Crédito](https://manual.velohub.com)"
  
  ❌ RUIM:
  "Para solicitar o crédito trabalhador você deve acessar o portal VeloHub preencher os dados pessoais enviar os documentos necessários o processo pode levar até 5 dias úteis para mais informações consulte o manual"
  
  APLICAÇÃO:
  - Bot_perguntas.resposta: Sempre formatar seguindo estes padrões
  - Artigos.artigo_conteudo: Sempre formatar seguindo estes padrões
  - Backend: Aplicar formatação automática se conteúdo não estiver formatado
  - Frontend: Renderizar formatação markdown corretamente
  */
  npm 