# 🔌 MongoDB API - VeloAcademy Quiz System
<!-- VERSION: v1.1.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team -->

## 🎯 API REST para Integração MongoDB

Endpoints para inserir e consultar dados do sistema de quizzes VeloAcademy no MongoDB.

---

## 📍 Endpoints Disponíveis

### **Inserção:**
- `POST /api/mongodb/insert` - Inserir certificados ou reprovações

### **Consulta de Certificados:**
- `GET /api/mongodb/certificados` - Listar todos os certificados
- `GET /api/mongodb/certificados/:id` - Buscar certificado por ID
- `GET /api/mongodb/certificados/email/:email` - Buscar certificados por email
- `GET /api/mongodb/certificados/course/:courseName` - Buscar certificados por curso

### **Consulta de Reprovações:**
- `GET /api/mongodb/reprovas` - Listar todas as reprovações
- `GET /api/mongodb/reprovas/:id` - Buscar reprovação por ID
- `GET /api/mongodb/reprovas/email/:email` - Buscar reprovações por email
- `GET /api/mongodb/reprovas/course/:courseName` - Buscar reprovações por curso

---

## 📝 Endpoint de Inserção

Endpoint intermediário para receber dados do Google Apps Script do sistema de quizzes VeloAcademy e inserir no MongoDB.

---

## 📍 Endpoint

**POST** `/api/mongodb/insert`

**Base URL:** `https://seu-dominio.vercel.app/api/mongodb/insert`

---

## 📋 Formato da Requisição

### **Headers:**
```
Content-Type: application/json
```

### **Body (JSON):**
```json
{
  "database": "velohubcentral",
  "collection": "curso_certificados" | "quiz_reprovas",
  "document": {
    // Estrutura do documento (ver abaixo)
  }
}
```

---

## 📊 Estruturas dos Documentos

### **A) CERTIFICADOS** (collection: `curso_certificados`)

```json
{
  "date": "2025-01-30T10:00:00.000Z" | Date,
  "name": "Nome do Aluno",
  "email": "aluno@email.com",
  "courseId": "curso-123" | null,
  "courseName": "Nome do Curso",
  "finalGrade": 85 | null,
  "wrongQuestions": "[\"questao1\", \"questao2\"]" | String,
  "status": "Aprovado",
  "certificateUrl": "https://drive.google.com/file/...",
  "certificateId": "uuid-gerado"
}
```

**Campos Obrigatórios:**
- `date` - Data do certificado (Date ou ISO String)
- `name` - Nome do aluno (String)
- `email` - Email do aluno (String, formato válido)
- `courseName` - Nome do curso (String)
- `status` - Status do certificado (deve ser "Aprovado")
- `certificateUrl` - URL do certificado (String)
- `certificateId` - ID único do certificado (String, UUID)

**Campos Opcionais:**
- `courseId` - ID do curso (String ou null)
- `finalGrade` - Nota final (Number entre 0-100 ou null)
- `wrongQuestions` - Questões erradas (String, JSON stringificado ou texto)

---

### **B) REPROVAÇÕES** (collection: `quiz_reprovas`)

```json
{
  "date": "2025-01-30T10:00:00.000Z" | Date,
  "name": "Nome do Aluno",
  "email": "aluno@email.com",
  "courseName": "Nome do Curso",
  "finalGrade": 45 | null,
  "wrongQuestions": "[\"questao1\", \"questao2\", \"questao3\"]" | String
}
```

**Campos Obrigatórios:**
- `date` - Data da reprovação (Date ou ISO String)
- `name` - Nome do aluno (String)
- `email` - Email do aluno (String, formato válido)
- `courseName` - Nome do curso (String)

**Campos Opcionais:**
- `finalGrade` - Nota final (Number entre 0-100 ou null)
- `wrongQuestions` - Questões erradas (String, JSON stringificado ou texto)

---

## ✅ Respostas de Sucesso

### **Status 200 - Sucesso:**
```json
{
  "success": true,
  "insertedId": "507f1f77bcf86cd799439011",
  "database": "velohubcentral",
  "collection": "curso_certificados"
}
```

---

## ❌ Respostas de Erro

### **Status 400 - Erro de Validação:**

**Campos obrigatórios faltando:**
```json
{
  "success": false,
  "error": "Campos obrigatórios faltando: database, collection e document são obrigatórios"
}
```

**Collection não permitida:**
```json
{
  "success": false,
  "error": "Collection não permitida. Collections permitidas: curso_certificados, quiz_reprovas"
}
```

**Erros de validação do documento:**
```json
{
  "success": false,
  "error": "Erros de validação",
  "details": [
    "Campo \"name\" é obrigatório",
    "Campo \"email\" é obrigatório",
    "Campo \"email\" deve ser um email válido"
  ]
}
```

### **Status 500 - Erro de Servidor:**
```json
{
  "success": false,
  "error": "Erro interno do servidor ao inserir documento",
  "message": "Detalhes do erro"
}
```

---

## 🔒 Segurança e Validações

### **Validações Implementadas:**

1. **Campos obrigatórios:** Verifica se `database`, `collection` e `document` foram fornecidos
2. **Database:** Deve ser uma string não vazia
3. **Collection:** Apenas `curso_certificados` e `quiz_reprovas` são permitidas
4. **Document:** Deve ser um objeto válido (não array, não null)
5. **Estrutura específica:** Valida campos obrigatórios conforme a collection
6. **Email:** Valida formato de email usando regex
7. **Status:** Para certificados, valida que status seja "Aprovado"
8. **Sanitização:** Aplica `trim()` em strings e limita tamanhos
9. **Tipos:** Valida e normaliza tipos (Date, Number, String)

### **Sanitização Automática:**

- **Strings:** Aplicado `trim()` e limitado tamanho máximo
- **Email:** Convertido para lowercase e validado formato
- **Date:** Convertido para objeto Date se for string ISO
- **Number:** Validado e limitado entre 0-100 para `finalGrade`
- **Timestamps:** Adicionados automaticamente `createdAt` e `updatedAt`

---

## 📝 Exemplos de Uso

### **Exemplo 1: Inserir Certificado**

```javascript
// Google Apps Script
const payload = {
  database: "velohubcentral",
  collection: "curso_certificados",
  document: {
    date: new Date().toISOString(),
    name: "João Silva",
    email: "joao.silva@email.com",
    courseId: "curso-produtos-digital",
    courseName: "Produtos Digitais",
    finalGrade: 85,
    wrongQuestions: JSON.stringify(["questao-5", "questao-8"]),
    status: "Aprovado",
    certificateUrl: "https://drive.google.com/file/d/abc123/view",
    certificateId: Utilities.getUuid()
  }
};

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  payload: JSON.stringify(payload)
};

const response = UrlFetchApp.fetch('https://seu-dominio.vercel.app/api/mongodb/insert', options);
const result = JSON.parse(response.getContentText());

console.log(result);
// { success: true, insertedId: "...", database: "velohubcentral", collection: "curso_certificados" }
```

### **Exemplo 2: Inserir Reprovação**

```javascript
// Google Apps Script
const payload = {
  database: "velohubcentral",
  collection: "quiz_reprovas",
  document: {
    date: new Date().toISOString(),
    name: "Maria Santos",
    email: "maria.santos@email.com",
    courseName: "Produtos Digitais",
    finalGrade: 45,
    wrongQuestions: JSON.stringify(["questao-1", "questao-2", "questao-3", "questao-5"])
  }
};

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  payload: JSON.stringify(payload)
};

const response = UrlFetchApp.fetch('https://seu-dominio.vercel.app/api/mongodb/insert', options);
const result = JSON.parse(response.getContentText());

console.log(result);
// { success: true, insertedId: "...", database: "velohubcentral", collection: "quiz_reprovas" }
```

### **Exemplo 3: Usando Fetch API (JavaScript)**

```javascript
const insertDocument = async (database, collection, document) => {
  try {
    const response = await fetch('https://seu-dominio.vercel.app/api/mongodb/insert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        database,
        collection,
        document
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Documento inserido com sucesso:', result.insertedId);
      return result;
    } else {
      console.error('Erro ao inserir:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Erro na requisição:', error);
    throw error;
  }
};

// Uso
await insertDocument(
  'velohubcentral',
  'curso_certificados',
  {
    date: new Date().toISOString(),
    name: 'João Silva',
    email: 'joao@email.com',
    courseName: 'Produtos Digitais',
    status: 'Aprovado',
    certificateUrl: 'https://drive.google.com/...',
    certificateId: 'uuid-123'
  }
);
```

---

## 🔍 Validações Específicas

### **Para `curso_certificados`:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|------------|
| `date` | Date/String | ✅ Sim | Convertido para Date se string ISO |
| `name` | String | ✅ Sim | Trim, max 500 chars |
| `email` | String | ✅ Sim | Formato válido, lowercase, max 255 chars |
| `courseName` | String | ✅ Sim | Trim, max 500 chars |
| `status` | String | ✅ Sim | Deve ser exatamente "Aprovado" |
| `certificateUrl` | String | ✅ Sim | Trim, max 1000 chars |
| `certificateId` | String | ✅ Sim | Trim, max 100 chars |
| `courseId` | String/null | ❌ Não | Trim, max 100 chars se fornecido |
| `finalGrade` | Number/null | ❌ Não | Entre 0-100 se fornecido |
| `wrongQuestions` | String | ❌ Não | Max 10000 chars |

### **Para `quiz_reprovas`:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|------------|
| `date` | Date/String | ✅ Sim | Convertido para Date se string ISO |
| `name` | String | ✅ Sim | Trim, max 500 chars |
| `email` | String | ✅ Sim | Formato válido, lowercase, max 255 chars |
| `courseName` | String | ✅ Sim | Trim, max 500 chars |
| `finalGrade` | Number/null | ❌ Não | Entre 0-100 se fornecido |
| `wrongQuestions` | String | ❌ Não | Max 10000 chars |

---

## 🛡️ Segurança

### **Configurações de Segurança:**

1. **CORS:** Configurado para permitir requisições do Google Apps Script
2. **Connection String:** Usa variável de ambiente `MONGODB_URI` (fallback para valor padrão)
3. **Validação de Collections:** Apenas collections permitidas são aceitas
4. **Sanitização:** Todos os dados são sanitizados antes de inserir
5. **Rate Limiting:** Aplicado via middleware do Express (1000 req/15min por IP)
6. **Logs:** Todas as operações são logadas para monitoramento

### **Variáveis de Ambiente:**

```bash
MONGODB_URI=mongodb+srv://REDACTED_ATLAS_URI
```

---

## 📊 Monitoramento

O endpoint está integrado com o sistema de monitoramento Skynet:

- **Traffic Logs:** Todas as requisições são registradas
- **JSON Logs:** Payloads de entrada e saída são logados
- **Error Logs:** Erros são registrados com detalhes
- **Success Logs:** Inserções bem-sucedidas são registradas com ID

---

## 🧪 Testes

### **Teste 1: Certificado Válido**
```bash
curl -X POST https://seu-dominio.vercel.app/api/mongodb/insert \
  -H "Content-Type: application/json" \
  -d '{
    "database": "velohubcentral",
    "collection": "curso_certificados",
    "document": {
      "date": "2025-01-30T10:00:00.000Z",
      "name": "João Silva",
      "email": "joao@email.com",
      "courseName": "Produtos Digitais",
      "status": "Aprovado",
      "certificateUrl": "https://drive.google.com/file/abc123",
      "certificateId": "uuid-123",
      "finalGrade": 85
    }
  }'
```

### **Teste 2: Reprovação Válida**
```bash
curl -X POST https://seu-dominio.vercel.app/api/mongodb/insert \
  -H "Content-Type: application/json" \
  -d '{
    "database": "velohubcentral",
    "collection": "quiz_reprovas",
    "document": {
      "date": "2025-01-30T10:00:00.000Z",
      "name": "Maria Santos",
      "email": "maria@email.com",
      "courseName": "Produtos Digitais",
      "finalGrade": 45
    }
  }'
```

### **Teste 3: Erro de Validação**
```bash
curl -X POST https://seu-dominio.vercel.app/api/mongodb/insert \
  -H "Content-Type: application/json" \
  -d '{
    "database": "velohubcentral",
    "collection": "curso_certificados",
    "document": {
      "name": "João Silva"
    }
  }'
```

**Resposta esperada:**
```json
{
  "success": false,
  "error": "Erros de validação",
  "details": [
    "Campo \"date\" é obrigatório",
    "Campo \"email\" é obrigatório",
    "Campo \"courseName\" é obrigatório",
    "Campo \"status\" é obrigatório",
    "Campo \"certificateUrl\" é obrigatório",
    "Campo \"certificateId\" é obrigatório"
  ]
}
```

---

## 📌 Notas Importantes

1. **Collections Permitidas:** Apenas `curso_certificados` e `quiz_reprovas` são aceitas
2. **Database:** Deve ser `velohubcentral` (mas aceita qualquer database válido)
3. **Timestamps:** `createdAt` e `updatedAt` são adicionados automaticamente
4. **Date:** Se enviado como string ISO, é convertido para objeto Date
5. **Email:** Sempre convertido para lowercase
6. **finalGrade:** Limitado entre 0-100 automaticamente
7. **Conexão:** Nova conexão MongoDB é criada a cada requisição e fechada após uso

---

## 🚀 Status

- ✅ Endpoint implementado
- ✅ Validações completas
- ✅ Sanitização de dados
- ✅ Tratamento de erros
- ✅ Logs e monitoramento
- ✅ CORS configurado
- ✅ Pronto para uso

---

---

## 📖 Endpoints de Consulta (GET)

### **Certificados**

#### 1. Listar Todos os Certificados
**GET** `/api/mongodb/certificados`

**Query Parameters (opcionais):**
- `email` - Filtrar por email
- `courseName` - Filtrar por nome do curso (busca parcial, case-insensitive)
- `courseId` - Filtrar por ID do curso
- `limit` - Limitar número de resultados
- `skip` - Pular número de resultados (pagination)
- `sortBy` - Campo para ordenação
- `sortOrder` - Ordem: `asc` ou `desc` (padrão: `desc`)

**Exemplo:**
```
GET /api/mongodb/certificados?email=aluno@email.com&limit=10&sortBy=createdAt&sortOrder=desc
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "date": "2025-01-30T10:00:00.000Z",
      "name": "João Silva",
      "email": "joao@email.com",
      "courseId": "curso-123",
      "courseName": "Produtos Digitais",
      "finalGrade": 85,
      "wrongQuestions": "[\"questao-5\"]",
      "status": "Aprovado",
      "certificateUrl": "https://drive.google.com/...",
      "certificateId": "uuid-123",
      "createdAt": "2025-01-30T10:00:00.000Z",
      "updatedAt": "2025-01-30T10:00:00.000Z"
    }
  ],
  "count": 1,
  "total": 1
}
```

---

#### 2. Buscar Certificado por ID
**GET** `/api/mongodb/certificados/:id`

**Parâmetros:**
- `id` (URL) - ObjectId do certificado

**Resposta:**
```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "date": "2025-01-30T10:00:00.000Z",
    "name": "João Silva",
    "email": "joao@email.com",
    "courseName": "Produtos Digitais",
    "status": "Aprovado",
    "certificateUrl": "https://drive.google.com/...",
    "certificateId": "uuid-123",
    ...
  }
}
```

**Erro 404:**
```json
{
  "success": false,
  "error": "Certificado não encontrado"
}
```

---

#### 3. Buscar Certificados por Email
**GET** `/api/mongodb/certificados/email/:email`

**Parâmetros:**
- `email` (URL) - Email do aluno

**Exemplo:** `/api/mongodb/certificados/email/joao@email.com`

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "name": "João Silva",
      "email": "joao@email.com",
      "courseName": "Produtos Digitais",
      ...
    }
  ],
  "count": 1,
  "total": 1
}
```

---

#### 4. Buscar Certificados por Curso
**GET** `/api/mongodb/certificados/course/:courseName`

**Parâmetros:**
- `courseName` (URL) - Nome do curso (busca parcial, case-insensitive)

**Exemplo:** `/api/mongodb/certificados/course/Produtos`

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "name": "João Silva",
      "courseName": "Produtos Digitais",
      ...
    }
  ],
  "count": 1,
  "total": 1
}
```

---

### **Reprovações**

#### 1. Listar Todas as Reprovações
**GET** `/api/mongodb/reprovas`

**Query Parameters (opcionais):**
- `email` - Filtrar por email
- `courseName` - Filtrar por nome do curso (busca parcial, case-insensitive)
- `limit` - Limitar número de resultados
- `skip` - Pular número de resultados (pagination)
- `sortBy` - Campo para ordenação
- `sortOrder` - Ordem: `asc` ou `desc` (padrão: `desc`)

**Exemplo:**
```
GET /api/mongodb/reprovas?email=aluno@email.com&limit=10
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "date": "2025-01-30T10:00:00.000Z",
      "name": "Maria Santos",
      "email": "maria@email.com",
      "courseName": "Produtos Digitais",
      "finalGrade": 45,
      "wrongQuestions": "[\"questao-1\", \"questao-2\"]",
      "createdAt": "2025-01-30T10:00:00.000Z",
      "updatedAt": "2025-01-30T10:00:00.000Z"
    }
  ],
  "count": 1,
  "total": 1
}
```

---

#### 2. Buscar Reprovação por ID
**GET** `/api/mongodb/reprovas/:id`

**Parâmetros:**
- `id` (URL) - ObjectId da reprovação

**Resposta:**
```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "date": "2025-01-30T10:00:00.000Z",
    "name": "Maria Santos",
    "email": "maria@email.com",
    "courseName": "Produtos Digitais",
    "finalGrade": 45,
    ...
  }
}
```

---

#### 3. Buscar Reprovações por Email
**GET** `/api/mongodb/reprovas/email/:email`

**Parâmetros:**
- `email` (URL) - Email do aluno

**Exemplo:** `/api/mongodb/reprovas/email/maria@email.com`

---

#### 4. Buscar Reprovações por Curso
**GET** `/api/mongodb/reprovas/course/:courseName`

**Parâmetros:**
- `courseName` (URL) - Nome do curso (busca parcial, case-insensitive)

**Exemplo:** `/api/mongodb/reprovas/course/Produtos`

---

## 🚀 Exemplos de Uso (JavaScript/Fetch)

### **Listar Certificados com Filtros:**
```javascript
const response = await fetch('/api/mongodb/certificados?email=aluno@email.com&limit=10&sortBy=createdAt&sortOrder=desc');
const data = await response.json();
console.log(data.data); // Array de certificados
console.log(data.total); // Total de certificados encontrados
```

### **Buscar Certificado por ID:**
```javascript
const certificadoId = 'ObjectId';
const response = await fetch(`/api/mongodb/certificados/${certificadoId}`);
const data = await response.json();
console.log(data.data); // Certificado encontrado
```

### **Buscar Certificados por Email:**
```javascript
const email = 'aluno@email.com';
const response = await fetch(`/api/mongodb/certificados/email/${email}`);
const data = await response.json();
console.log(data.data); // Array de certificados do aluno
```

### **Buscar Reprovações por Curso:**
```javascript
const courseName = 'Produtos Digitais';
const response = await fetch(`/api/mongodb/reprovas/course/${encodeURIComponent(courseName)}`);
const data = await response.json();
console.log(data.data); // Array de reprovações do curso
```

### **Pagination:**
```javascript
const page = 1;
const limit = 20;
const skip = (page - 1) * limit;

const response = await fetch(`/api/mongodb/certificados?limit=${limit}&skip=${skip}`);
const data = await response.json();
console.log(data.data); // Página atual
console.log(data.total); // Total para calcular páginas
```

---

**Versão:** v1.1.0  
**Data:** 2025-01-30  
**Autor:** VeloHub Development Team



