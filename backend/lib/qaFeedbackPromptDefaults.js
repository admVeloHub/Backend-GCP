// VERSION: v1.0.0 | DATE: 2026-04-27 | AUTHOR: VeloHub Development Team
// Defaults alinhados ao plano "Container Feedback QA" (Elogio, Oportunidade, Apontamento).
// Override via env: QA_FEEDBACK_PROMPT_ELOGIO, QA_FEEDBACK_PROMPT_OPORTUNIDADE, QA_FEEDBACK_PROMPT_APONTAMENTO

module.exports = {
  ELOGIO: `PROMPT: Crie um e-mail de parabenização para um atendente que atingiu 100% de conformidade em uma monitoria de atendimento. O e-mail deve:

Ter tom motivador, valorizando fortemente o desempenho do agente; Destacar excelência no atendimento, domínio técnico, empatia e clareza. Fazer menções honrosas aos [destaques] listados no campo a seguir. Dar ênfase adicional ao ponto forte do atendente destacado na [obs individual], reforçando impacto positivo no cliente
Ser objetivo, mas com energia positiva; Seguir formato profissional de e-mail corporativo; Utilizar linguagem natural, sem exageros artificiais; Não utilizar travessões; Não ser genérico, trazer sensação de reconhecimento real;
NÃO COLOQUE OBSERVAÇÕES INICIAIS DO TIPO "Entendi, vou fazer o e-mail", "Certo, aqui vai um modelo" ou qualquer outro tipo de manifestação prévia. A resposta deve conter EXCLUSIVAMENTE O CORPO DO EMAIL SOLICITADO. 

Estrutura obrigatória do corpo:

Olá, [NOME],
Parabéns pelo excelente desempenho na monitoria!

[Descrição objetiva da conduta positiva observada no atendimento, incluindo os {destaques}]

[Habilidade principal do atendente, {obs individual}]

Isso garantiu 100% de conformidade na monitoria, refletindo um atendimento de alto nível e alinhado às melhores práticas.

Att.
{Avaliador} - QA do Atendimento Velotax

Dados (use na redação, não repita rótulos literalmente fora do tom do e-mail):
- colaboradorNome (participante): [[COLABORADOR_NOME_COMPLETO]]
- Destaques: [[DESTAQUES]]
- Obs Individual: [[OBS_INDIVIDUAL]]
- avaliador: [[AVALIADOR]]`,

  OPORTUNIDADE: `PROMPT: Crie um e-mail de feedback positivo para um atendente que atingiu boa margem de conformidade em uma monitoria de atendimento, porém possui oportunidades de melhora em vista. 

O e-mail deve:

Ter tom motivador, valorizando fortemente o desempenho. Dar destaque ao ponto forte do atendente, descrito na observação particular. Apontar gentilmente a oportunidade de melhoria percebida. Ser objetivo, mas com energia positiva. Seguir formato profissional de e-mail corporativo. Utilizar linguagem natural, sem exageros artificiais. Não utilizar travessões
Não ser genérico, trazer sensação de reconhecimento e real motivação de melhoria. Não coloque preâmbulos; a saída deve conter EXCLUSIVAMENTE o corpo do e-mail.

Estrutura obrigatória do corpo:

Olá, [NOME],

Parabéns pelo desempenho na monitoria!

[Descrição objetiva da conduta positiva observada no atendimento, elencando {destaques}]
[Valorizar {obs individual}]
[Abordar que foi notada uma oportunidade de crescimento em {oportunidade}]

Seguem sugestões de treinamento para revisitar, mirando em atingir os 100% de conformidade na monitoria!

Att.
{Avaliador}, QA do Atendimento Velotax

Dados:
- colaboradorNome: [[COLABORADOR_NOME_COMPLETO]]
- Destaques: [[DESTAQUES]]
- Obs Individual: [[OBS_INDIVIDUAL]]
- Oportunidade: [[OPORTUNIDADE]]
- avaliador: [[AVALIADOR]]`,

  APONTAMENTO: `PROMPT: Crie um e-mail de feedback para um atendente que não atingiu o padrão esperado de conformidade em uma monitoria de atendimento.

O e-mail deve:
Ter tom motivador, Destacar a importancia da excelência no atendimento e do domínio técnico, empatia e clareza. Ser objetivo, mas com energia positiva, abordando com "graça" e empatia o problema detectado. Seguir formato profissional de e-mail corporativo. Utilizar linguagem natural, sem exageros artificiais. Não utilizar travessões. Não ser genérico, trazer sensação de real preocupação com o sucesso futuro do colaborador. Não coloque preâmbulos; a saída deve conter EXCLUSIVAMENTE o corpo do e-mail.

Estrutura obrigatória do corpo:

Olá, [colaboradorNome],

Sua avaliação deste mês mostrou que há alguns pontos que precisam de atenção. 
[Descrição objetiva da conduta observada no atendimento, considerando {Apontamentos}]
[Desenvolva sobre {obs Individual} levando em conta o contexto do conteúdo do campo]

Peço que revisite os temas de treinamento sugeridos a seguir. Caso tenha alguma dúvida ou dificuldade que não seja sanada por esses materiais, procure o supervisor ou o responsável pelos treinamentos e comunique o que sentiu falta! Vamos trabalhar juntos para garantir o sucesso das próximas avaliações!

Att
{avaliador}, QA do Atendimento Velotax

Dados:
- colaboradorNome: [[COLABORADOR_NOME_COMPLETO]]
- Apontamentos: [[APONTAMENTOS]]
- Obs Individual: [[OBS_INDIVIDUAL]]
- avaliador: [[AVALIADOR]]`
};
