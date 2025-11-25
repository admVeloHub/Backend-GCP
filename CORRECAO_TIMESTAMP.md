# Correção: Problema com campo `timestamp` vs `createdAt`

## Problema Identificado

O gráfico estava mostrando **80 ocorrências no dia 23/11/2025**, mas na verdade **não havia nenhuma entrada** nesse dia na collection `user_activity`.

## Causa Raiz

O código em `backend/routes/botAnalises.js` estava usando o campo `timestamp` para consultar e processar dados de `user_activity`, mas esse campo **não existe** no schema do MongoDB.

### Schema Real
O modelo `UserActivity` usa `timestamps: true` do Mongoose, que cria automaticamente:
- `createdAt` ✅ (campo correto)
- `updatedAt` ✅

### Código Incorreto
```javascript
// ❌ ERRADO - campo 'timestamp' não existe
UserActivity.find({
  timestamp: { $gte: startDate, $lte: endDate }
})

// ❌ ERRADO - activity.timestamp retorna undefined
const date = new Date(activity.timestamp).toISOString().split('T')[0];
```

### Comportamento do Bug
1. A query com `timestamp: { $gte: startDate, $lte: endDate }` não encontra documentos porque o campo não existe
2. Quando processa `activity.timestamp`, retorna `undefined`
3. `new Date(undefined)` cria uma data inválida, causando comportamento inesperado
4. Isso resultava em dados incorretos sendo exibidos no gráfico

## Correção Aplicada

Todas as ocorrências de `timestamp` foram substituídas por `createdAt` nas seguintes rotas:

1. ✅ `GET /api/bot-analises/dados-completos` (linha 81)
2. ✅ `GET /api/bot-analises/dados-completos` (linha 132 - processamento de datas)
3. ✅ `GET /api/bot-analises/dados-uso-operacao` (linhas 326 e 340)
4. ✅ `GET /api/bot-analises/perguntas-frequentes` (linha 387)
5. ✅ `GET /api/bot-analises/ranking-agentes` (linha 431)
6. ✅ `GET /api/bot-analises/lista-atividades` (linhas 498, 507, 508)
7. ✅ `GET /api/bot-analises/analises-especificas` (linha 539)

### Código Corrigido
```javascript
// ✅ CORRETO - usando campo 'createdAt'
UserActivity.find({
  createdAt: { $gte: startDate, $lte: endDate }
})

// ✅ CORRETO - usando campo correto
const date = new Date(activity.createdAt).toISOString().split('T')[0];
```

## Resultado

Agora o gráfico deve mostrar corretamente:
- **0 ocorrências** no dia 23/11/2025 ✅
- Dados corretos para todos os outros dias

## Arquivos Modificados

- `backend/routes/botAnalises.js` - Todas as rotas corrigidas

## Data da Correção

25/11/2025

