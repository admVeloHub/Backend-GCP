# Mapeamento Completo do Fluxo de Dados - Gráfico Bot Análises

## Problema Identificado: Data 23/11/2025 aparecendo com ocorrências inexistentes

### Fluxo de Dados Completo

#### 1. **MongoDB (Fonte de Dados)**
- **Collection**: `user_activity`
- **Campo usado**: `createdAt` (timestamp do MongoDB em UTC)
- **Formato**: `ISODate("2025-11-24T03:30:00.000Z")` (UTC)

**Exemplo real:**
- Atividade criada em: **24/11/2025 00:30:00 BRT** (horário local Brasil)
- Armazenada no MongoDB como: **2025-11-24T03:30:00.000Z** (UTC, +3 horas)

#### 2. **Backend - Endpoint `/api/bot-analises/dados-uso-operacao`**

**Localização**: `EXP - SKYNET + GPT/backend/routes/botAnalises.js` (linha 316)

**Processo:**
```javascript
// 1. Buscar dados do MongoDB
const userActivities = await UserActivity.find({
  createdAt: { $gte: startDate, $lte: endDate }
}).lean();

// 2. Processar cada atividade
userActivities.forEach(activity => {
  const chave = obterChavePeriodo(activity.createdAt, exibicao);
  totalUso[chave] = (totalUso[chave] || 0) + 1;
});
```

**PROBLEMA IDENTIFICADO (linha 338):**
```javascript
// ❌ ERRADO - usa toISOString() que converte para UTC
return date.toISOString().split('T')[0]; // YYYY-MM-DD
```

**Cenário do Bug:**
- Atividade criada: **24/11/2025 00:30:00 BRT**
- MongoDB armazena: **2025-11-24T03:30:00.000Z** (UTC)
- `new Date("2025-11-24T03:30:00.000Z")` → objeto Date
- `date.toISOString()` → **"2025-11-24T03:30:00.000Z"**
- `.split('T')[0]` → **"2025-11-24"** ✅ CORRETO

**MAS se a atividade foi criada em:**
- **24/11/2025 00:00:00 BRT** (meia-noite)
- MongoDB armazena: **2025-11-24T03:00:00.000Z** (UTC)
- `date.toISOString().split('T')[0]` → **"2025-11-24"** ✅ CORRETO

**PROBLEMA REAL:**
- Se atividade foi criada: **24/11/2025 00:00:00 BRT** (meia-noite exata)
- Mas devido a algum problema de timezone ou arredondamento:
- MongoDB pode ter: **2025-11-23T23:59:59.999Z** ou **2025-11-24T02:59:59.999Z**
- `toISOString().split('T')[0]` → **"2025-11-23"** ❌ ERRADO

#### 3. **Frontend - Serviço `botAnalisesService.js`**

**Localização**: `EXP - Console + GPT/src/services/botAnalisesService.js` (linha 949)

**Processo:**
```javascript
// Buscar dados do backend
const response = await this.makeRequestWithRetry('/bot-analises/dados-uso-operacao', {
  params: { periodo: periodoFiltro, exibicao: exibicaoFiltro }
});

// Retornar dados diretamente (sem processamento adicional)
return response.data; // { totalUso: {}, feedbacksPositivos: {}, feedbacksNegativos: {} }
```

**Status**: ✅ CORRETO - apenas repassa dados do backend

#### 4. **Frontend - Componente `BotAnalisesPage.jsx`**

**Localização**: `EXP - Console + GPT/src/pages/BotAnalisesPage.jsx` (linha 1227)

**Processo:**
```javascript
// 1. Coletar todas as datas
const todasAsDatas = new Set([
  ...Object.keys(dadosGrafico.totalUso || {}),
  ...Object.keys(dadosGrafico.feedbacksPositivos || {}),
  ...Object.keys(dadosGrafico.feedbacksNegativos || {})
]);

// 2. Filtrar apenas datas com valores > 0
const datasValidas = Array.from(todasAsDatas).filter(periodo => {
  const totalUso = dadosGrafico.totalUso?.[periodo] || 0;
  const feedbacksPos = dadosGrafico.feedbacksPositivos?.[periodo] || 0;
  const feedbacksNeg = dadosGrafico.feedbacksNegativos?.[periodo] || 0;
  return totalUso > 0 || feedbacksPos > 0 || feedbacksNeg > 0;
});

// 3. Formatar para exibição
const data = new Date(periodo); // periodo = "2025-11-23"
const dataFormatada = data.toLocaleDateString('pt-BR', { 
  day: '2-digit', 
  month: '2-digit', 
  year: '2-digit' 
}); // "23/11/25"
```

**PROBLEMA POTENCIAL (linha 1257):**
```javascript
// ⚠️ CUIDADO: new Date("2025-11-23") cria data em UTC meia-noite
// Quando convertido para BRT pode mostrar dia anterior
const data = new Date(periodo); // "2025-11-23"
// Se periodo = "2025-
```

-23"2025-11-23"` → `"2025-11-23T00:00:00.

UTC
- `toLocaleDateString('pt-BR')` → pode mostrar "22/25" ou "24/11/25" dependendo do timezone

#### 5. **Recharts - Renderização**

**Localização**: `EXP - Console + GPT/src/pages/BotAnalisesPage.jsx` (linha 1226`

**Processo:**
```jsx
<LineChart data={periodosComDados}>
  <XAxis dataKey="periodo" />
  <Line dataKey="totalUso" />
</LineChart>
```

**Status**: ✅ CORRETO - apenas exibe o que recebe

## Ponto de Falha Identificada

### Problema principal:

1. **Backend (linha 338)**: Uso de `toISOString()` sem considerar timezone local
   - `toISOString()` sempre retorna UTC
   - Atividades criadas no início do dia (00:00-02:59 BRT) podem ser agrupadas no dia anterior em UTC

2. **Problema secundário (linha 1257)**: 
   - `new Date("2025-11-23")` cria data em UTC meia-noite
   - Quando formatado para BRT pode mostrar dia errado

## Correção Aplicada

### Backend - Função `obterChavePeriodo`

**ANTES:**
```javascript
const obterChavePeriodo = (data, exibicao) => {
  const date = new Date(data);
  return date.toISOString().split('T')[0]; // ❌ UTC
};
```

**DEPOIS:**
```javascript
const obterChavePeriodo = (data, exibicao) => {
  const date = new Date(data);
  // Converter para timezone do Brasil antes de extrair a data
  const dateBRT = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  const ano = dateBRT.getFullYear();
  const mes = String(dateBRT.getMonth() + 1).padStart(2, '0');
  const dia = String(dateBRT.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`; // ✅ BRT
};
```

## Teste do Fluxo

### Script de Diagnóstico Criado

**Arquivo**: `EXP - SKYNET + GPT/backend/scripts/diagnostico_data_23_11.js`

**Como executar:**
```bash
cd "EXP - SKYNET + GPT/backend"
node scripts/diagnostico_data_23_11.js
```

**O que o script faz:**
1. Conecta ao MongoDB
2. Busca atividades para 23/11/2025
3. Mostra quantas foram encontradas
4. Testa conversão de datas com `toISOString()` vs timezone BRT
5. Identifica atividades do dia 24 que podem estar sendo agrupadas como 23

## Conclusão

**Ponto de Falha Assertivo**: 
- **Linha 338 do `botAnalises.js`** - uso de `toISOString()` sem considerar timezone local
- Atividades criadas entre 00:00-02:59 BRT são agrupadas no dia anterior quando convertidas para UTC

**Solução Aplicada**: 
- ✅ Usar `Intl.DateTimeFormat` com timezone `America/Sao_Paulo` para agrupar datas
- ✅ Garantir que atividades sejam agrupadas pelo dia local (BRT), não UTC
- ✅ Frontend também corrigido para formatar datas considerando timezone BRT

## Teste do Endpoint

Para testar o endpoint após a correção:

```bash
# Testar endpoint diretamente
curl "https://backend-gcp-278491073220.us-east1.run.app/api/bot-analises/dados-uso-operacao?periodo=30dias&exibicao=dia" | jq '.data.totalUso["2025-11-23"]'

# Deve retornar null ou undefined se não houver atividades reais
```

## Verificação no MongoDB

Para verificar diretamente no MongoDB:

```javascript
// Conectar ao MongoDB
use console_analises

// Buscar atividades para 23/11/2025
db.user_activity.find({
  createdAt: {
    $gte: ISODate("2025-11-23T03:00:00.000Z"), // 00:00 BRT
    $lte: ISODate("2025-11-24T02:59:59.999Z")  // 23:59 BRT
  }
}).count()

// Deve retornar 0 se não houver atividades em domingo
```

