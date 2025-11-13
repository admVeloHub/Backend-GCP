# 📊 Collections MongoDB - Console de Conteúdo VeloHub v3.1.0

## 🗄️ **Collections Definidas:**

### **1. `Artigos`**
**Propósito:** Armazenar artigos do portal
**Campos:**
```javascript
{
  _id: ObjectId,
  title: String,           // Título do artigo
  content: String,         // Conteúdo do artigo
  category: String,        // Categoria do artigo
  keywords: [String],      // Array de palavras-chave
  createdAt: Date,         // Data de criação
  updatedAt: Date          // Data de atualização
}
```
**Índices:**
- `createdAt: -1` (ordenação por data)
- `category: 1` (busca por categoria)
- `title: text, content: text` (busca textual)

### **2. `Velonews`**
**Propósito:** Armazenar notícias do ciclismo
**Campos:**
```javascript
{
  _id: ObjectId,
  title: String,           // Título da notícia
  content: String,         // Conteúdo da notícia
  isCritical: Boolean,     // Se é notícia crítica
  createdAt: Date,         // Data de criação
  updatedAt: Date          // Data de atualização
}
```
**Índices:**
- `createdAt: -1` (ordenação por data)
- `isCritical: 1` (busca por criticidade)
- `title: text, content: text` (busca textual)

### **3. `Bot_perguntas`**
**Propósito:** Armazenar perguntas e respostas do bot
**Campos:**
```javascript
{
  _id: ObjectId,
  topic: String,           // Tópico da pergunta
  context: String,         // Contexto da pergunta
  keywords: String,        // Palavras-chave
  question: String,        // Pergunta
  imageUrls: [String],     // URLs de imagens
  createdAt: Date,         // Data de criação
  updatedAt: Date          // Data de atualização
}
```
**Índices:**
- `createdAt: -1` (ordenação por data)
- `topic: 1` (busca por tópico)
- `question: text, context: text` (busca textual)


## 🔧 **Inicialização Automática:**

As collections são criadas automaticamente quando:
1. **Primeiro documento** é inserido
2. **Servidor inicia** (cria índices)
3. **Health check** é executado

## 📊 **Monitoramento:**

### **Health Check com Collections:**
```bash
GET /api/health
```

**Resposta:**
```json
{
  "status": "OK",
  "timestamp": "2024-12-19T...",
  "version": "3.1.0",
  "database": {
    "status": "healthy",
    "message": "MongoDB conectado"
  },
  "collections": {
    "Artigos": 5,
    "Velonews": 3,
    "Bot_perguntas": 8
  }
}
```

## 🚀 **Deploy:**

As collections serão criadas automaticamente no MongoDB Atlas quando:
1. **Primeira requisição** for feita para cada endpoint
2. **Servidor iniciar** no Vercel
3. **Health check** for executado

## 🔍 **Verificação:**

Para verificar se as collections foram criadas:
1. Acesse o **MongoDB Atlas**
2. Vá para **Collections**
3. Verifique se as collections aparecem:
   - `Artigos`
   - `Velonews`
   - `Bot_perguntas`

## 📝 **Exemplo de Uso:**

### **Criar Artigo:**
```bash
POST /api/artigos
{
  "title": "Novo Artigo",
  "content": "Conteúdo do artigo",
  "category": "tecnologia",
  "keywords": "nodejs, mongodb, api"
}
```

### **Criar Velonews:**
```bash
POST /api/velonews
{
  "title": "Notícia Importante",
  "content": "Conteúdo da notícia",
  "isCritical": true
}
```

### **Criar Pergunta do Bot:**
```bash
POST /api/bot-perguntas
{
  "topic": "ciclismo",
  "context": "equipamentos",
  "question": "Qual a melhor bicicleta?",
  "keywords": "bicicleta, equipamento"
}
```

---

**Status:** ✅ Collections Configuradas  
**Versão:** 3.1.0  
**Data:** 2024-12-19
