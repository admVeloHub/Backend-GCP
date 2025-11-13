# 📚 Academy API - Endpoints para Frontend
<!-- VERSION: v1.1.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team -->

## 🎯 Base URL
```
/api/academy
```

---

## 📊 Course Progress Endpoints

### 1. Listar Todos os Progressos
**GET** `/api/academy/course-progress`

**Descrição:** Retorna todos os registros de progresso de cursos

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "userEmail": "usuario@email.com",
      "subtitle": "Seguro Prestamista",
      "completedVideos": {
        "Aula em vídeo": true,
        "Ebook - Seguro Prestamista": true
      },
      "quizUnlocked": true,
      "completedAt": "2025-01-30T10:00:00.000Z",
      "createdAt": "2025-01-30T09:00:00.000Z",
      "updatedAt": "2025-01-30T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Buscar Progresso por ID
**GET** `/api/academy/course-progress/:id`

**Parâmetros:**
- `id` (URL) - ObjectId do progresso

**Resposta:**
```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "userEmail": "usuario@email.com",
    "subtitle": "Seguro Prestamista",
    "completedVideos": {
      "Aula em vídeo": true,
      "Ebook - Seguro Prestamista": true
    },
    "quizUnlocked": true,
    "completedAt": "2025-01-30T10:00:00.000Z",
    "createdAt": "2025-01-30T09:00:00.000Z",
    "updatedAt": "2025-01-30T10:00:00.000Z"
  }
}
```

**Erro 404:**
```json
{
  "success": false,
  "error": "Progresso não encontrado"
}
```

---

### 3. Buscar Progressos por Usuário
**GET** `/api/academy/course-progress/user/:userEmail`

**Parâmetros:**
- `userEmail` (URL) - Email do usuário

**Exemplo:** `/api/academy/course-progress/user/usuario@email.com`

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "userEmail": "usuario@email.com",
      "subtitle": "Seguro Prestamista",
      "completedVideos": {...},
      "quizUnlocked": true,
      "completedAt": "2025-01-30T10:00:00.000Z",
      "createdAt": "2025-01-30T09:00:00.000Z",
      "updatedAt": "2025-01-30T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 4. Buscar Progresso Específico (Usuário + Subtítulo)
**GET** `/api/academy/course-progress/user/:userEmail/subtitle/:subtitle`

**Parâmetros:**
- `userEmail` (URL) - Email do usuário
- `subtitle` (URL) - Nome do subtítulo/seção

**Exemplo:** `/api/academy/course-progress/user/usuario@email.com/subtitle/Seguro Prestamista`

**Resposta:**
```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "userEmail": "usuario@email.com",
    "subtitle": "Seguro Prestamista",
    "completedVideos": {
      "Aula em vídeo": true,
      "Ebook - Seguro Prestamista": true
    },
    "quizUnlocked": true,
    "completedAt": "2025-01-30T10:00:00.000Z",
    "createdAt": "2025-01-30T09:00:00.000Z",
    "updatedAt": "2025-01-30T10:00:00.000Z"
  }
}
```

---

### 5. Criar Novo Progresso
**POST** `/api/academy/course-progress`

**Body (JSON):**
```json
{
  "userEmail": "usuario@email.com",
  "subtitle": "Seguro Prestamista",
  "completedVideos": {
    "Aula em vídeo": true,
    "Ebook - Seguro Prestamista": false
  },
  "quizUnlocked": false,
  "completedAt": null
}
```

**Campos Obrigatórios:**
- `userEmail` (String)
- `subtitle` (String)

**Campos Opcionais:**
- `completedVideos` (Object) - Padrão: `{}`
- `quizUnlocked` (Boolean) - Padrão: `false`
- `completedAt` (Date) - Padrão: `null`

**Resposta 201:**
```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "userEmail": "usuario@email.com",
    "subtitle": "Seguro Prestamista",
    "completedVideos": {...},
    "quizUnlocked": false,
    "completedAt": null,
    "createdAt": "2025-01-30T09:00:00.000Z",
    "updatedAt": "2025-01-30T09:00:00.000Z"
  },
  "message": "Progresso criado com sucesso"
}
```

**Erro 400:**
```json
{
  "success": false,
  "error": "userEmail e subtitle são obrigatórios"
}
```

**Erro 409 (Duplicado):**
```json
{
  "success": false,
  "error": "Já existe um registro de progresso para este usuário e subtítulo"
}
```

---

### 6. Atualizar Progresso
**PUT** `/api/academy/course-progress/:id`

**Parâmetros:**
- `id` (URL) - ObjectId do progresso

**Body (JSON):**
```json
{
  "completedVideos": {
    "Aula em vídeo": true,
    "Ebook - Seguro Prestamista": true
  },
  "quizUnlocked": true
}
```

**Nota:** Todos os campos são opcionais. Apenas os campos enviados serão atualizados.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "userEmail": "usuario@email.com",
    "subtitle": "Seguro Prestamista",
    "completedVideos": {...},
    "quizUnlocked": true,
    "completedAt": "2025-01-30T10:00:00.000Z",
    "updatedAt": "2025-01-30T10:00:00.000Z"
  },
  "message": "Progresso atualizado com sucesso"
}
```

**Nota:** Se todas as aulas em `completedVideos` forem `true`, o sistema automaticamente define `completedAt` e `quizUnlocked: true`.

---

### 7. Deletar Progresso
**DELETE** `/api/academy/course-progress/:id`

**Parâmetros:**
- `id` (URL) - ObjectId do progresso

**Resposta:**
```json
{
  "success": true,
  "message": "Progresso deletado com sucesso"
}
```

**Erro 404:**
```json
{
  "success": false,
  "error": "Progresso não encontrado"
}
```

---

## 📖 Cursos Conteudo Endpoints

### 1. Listar Todos os Cursos
**GET** `/api/academy/cursos-conteudo`

**Descrição:** Retorna todos os cursos cadastrados

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "cursoClasse": "Essencial",
      "cursoNome": "produtos",
      "courseOrder": 2,
      "isActive": true,
      "modules": [...],
      "createdBy": "criador@velotax.com.br",
      "version": 1,
      "createdAt": "2025-01-30T10:00:00.000Z",
      "updatedAt": "2025-01-30T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Buscar Curso por ID
**GET** `/api/academy/cursos-conteudo/:id`

**Parâmetros:**
- `id` (URL) - ObjectId do curso

**Resposta:**
```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "cursoClasse": "Essencial",
    "cursoNome": "produtos",
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
              }
            ]
          }
        ]
      }
    ],
    "createdBy": "criador@velotax.com.br",
    "version": 1,
    "createdAt": "2025-01-30T10:00:00.000Z",
    "updatedAt": "2025-01-30T10:00:00.000Z"
  }
}
```

---

### 3. Buscar Cursos Ativos
**GET** `/api/academy/cursos-conteudo/active`

**Descrição:** Retorna apenas cursos com `isActive: true`

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "cursoClasse": "Essencial",
      "cursoNome": "produtos",
      "courseOrder": 2,
      "isActive": true,
      "modules": [...],
      "createdBy": "criador@velotax.com.br",
      "version": 1,
      "createdAt": "2025-01-30T10:00:00.000Z",
      "updatedAt": "2025-01-30T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 4. Buscar Cursos por Nome
**GET** `/api/academy/cursos-conteudo/curso/:cursoNome`

**Parâmetros:**
- `cursoNome` (URL) - Nome do curso (ex: "produtos", "onboarding")

**Exemplo:** `/api/academy/cursos-conteudo/curso/produtos`

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "cursoClasse": "Essencial",
      "cursoNome": "produtos",
      "courseOrder": 2,
      "isActive": true,
      "modules": [...],
      "createdBy": "criador@velotax.com.br",
      "version": 1
    }
  ],
  "count": 1
}
```

---

### 5. Buscar Cursos por Classe
**GET** `/api/academy/cursos-conteudo/classe/:cursoClasse`

**Parâmetros:**
- `cursoClasse` (URL) - Classe do curso: `Essencial`, `Atualização`, `Opcional`, `Reciclagem`

**Exemplo:** `/api/academy/cursos-conteudo/classe/Essencial`

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "cursoClasse": "Essencial",
      "cursoNome": "produtos",
      "courseOrder": 2,
      "isActive": true,
      "modules": [...],
      "createdBy": "criador@velotax.com.br",
      "version": 1
    }
  ],
  "count": 1
}
```

---

### 6. Criar Novo Curso
**POST** `/api/academy/cursos-conteudo`

**Body (JSON):**
```json
{
  "cursoClasse": "Essencial",
  "cursoNome": "produtos",
  "cursoDescription": "Curso completo sobre produtos digitais",
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
            }
          ]
        }
      ]
    }
  ],
  "createdBy": "criador@velotax.com.br",
  "version": 1
}
```

**Campos Obrigatórios:**
- `cursoClasse` (String) - Valores: `Essencial`, `Atualização`, `Opcional`, `Reciclagem`
- `cursoNome` (String)
- `courseOrder` (Number) - Deve ser > 0
- `modules` (Array) - Deve ter pelo menos 1 módulo
- `createdBy` (String) - Email do criador

**Campos Opcionais:**
- `cursoDescription` (String) - Descrição do curso (opcional)
- `isActive` (Boolean) - Padrão: `true`
- `version` (Number) - Padrão: `1`

**Estrutura de Módulos:**
- Cada módulo deve ter pelo menos 1 `section`
- Cada section deve ter pelo menos 1 `lesson`
- Cada lesson deve ter pelo menos 1 `lessonContent`

**Tipos de Lesson (`lessonTipo`):**
- `video`
- `pdf`
- `audio`
- `slide`
- `document`

**Resposta 201:**
```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "cursoClasse": "Essencial",
    "cursoNome": "produtos",
    "courseOrder": 2,
    "isActive": true,
    "modules": [...],
    "createdBy": "criador@velotax.com.br",
    "version": 1,
    "createdAt": "2025-01-30T10:00:00.000Z",
    "updatedAt": "2025-01-30T10:00:00.000Z"
  },
  "message": "Curso criado com sucesso"
}
```

**Erro 400:**
```json
{
  "success": false,
  "error": "cursoClasse, cursoNome, courseOrder, modules e createdBy são obrigatórios"
}
```

---

### 7. Atualizar Curso
**PUT** `/api/academy/cursos-conteudo/:id`

**Parâmetros:**
- `id` (URL) - ObjectId do curso

**Body (JSON):**
```json
{
  "isActive": false,
  "modules": [...]
}
```

**Nota:** 
- Todos os campos são opcionais
- A versão é incrementada automaticamente a cada update
- Apenas os campos enviados serão atualizados

**Resposta:**
```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "cursoClasse": "Essencial",
    "cursoNome": "produtos",
    "courseOrder": 2,
    "isActive": false,
    "modules": [...],
    "createdBy": "criador@velotax.com.br",
    "version": 2,
    "updatedAt": "2025-01-30T11:00:00.000Z"
  },
  "message": "Curso atualizado com sucesso"
}
```

---

### 8. Deletar Curso
**DELETE** `/api/academy/cursos-conteudo/:id`

**Parâmetros:**
- `id` (URL) - ObjectId do curso

**Resposta:**
```json
{
  "success": true,
  "message": "Curso deletado com sucesso"
}
```

**Erro 404:**
```json
{
  "success": false,
  "error": "Curso não encontrado"
}
```

---

## 🔧 Códigos de Status HTTP

- **200** - Sucesso (GET, PUT, DELETE)
- **201** - Criado com sucesso (POST)
- **400** - Requisição inválida (dados obrigatórios ausentes)
- **404** - Recurso não encontrado
- **409** - Conflito (duplicado - apenas para course-progress)
- **500** - Erro interno do servidor

---

## 📝 Notas Importantes

### Course Progress
- O campo `completedVideos` é um objeto onde as chaves são os títulos das aulas e os valores são booleanos
- Quando todas as aulas em `completedVideos` forem `true`, o sistema automaticamente:
  - Define `completedAt` com a data/hora atual
  - Define `quizUnlocked: true`
- O índice único composto `userEmail + subtitle` impede duplicatas

### Cursos Conteudo
- A versão é incrementada automaticamente a cada update
- A estrutura hierárquica é validada: módulos → seções → aulas → conteúdo
- Cada nível deve ter pelo menos 1 item no nível inferior
- Os tipos de aula (`lessonTipo`) são validados contra enum

---

## 🚀 Exemplos de Uso (JavaScript/Fetch)

### Buscar Progressos do Usuário
```javascript
const userEmail = 'usuario@email.com';
const response = await fetch(`/api/academy/course-progress/user/${userEmail}`);
const data = await response.json();
console.log(data.data); // Array de progressos
```

### Criar Novo Progresso
```javascript
const progressData = {
  userEmail: 'usuario@email.com',
  subtitle: 'Seguro Prestamista',
  completedVideos: {
    'Aula em vídeo': true,
    'Ebook - Seguro Prestamista': false
  }
};

const response = await fetch('/api/academy/course-progress', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(progressData)
});
const data = await response.json();
```

### Buscar Cursos Ativos
```javascript
const response = await fetch('/api/academy/cursos-conteudo/active');
const data = await response.json();
console.log(data.data); // Array de cursos ativos
```

### Atualizar Progresso
```javascript
const progressId = 'ObjectId';
const updateData = {
  completedVideos: {
    'Aula em vídeo': true,
    'Ebook - Seguro Prestamista': true
  }
};

const response = await fetch(`/api/academy/course-progress/${progressId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(updateData)
});
const data = await response.json();
```

---

---

## 🔄 Atualizações Recentes (v1.1.0)

### Campo `cursoDescription` Adicionado
- ✅ Campo `cursoDescription` (String, opcional) adicionado ao modelo CursosConteudo
- ✅ Campo aceito em POST e PUT
- ✅ Campo retornado automaticamente em GET
- ✅ Salvamento funcionando corretamente (valores e null são persistidos)
- 📄 Ver documento `ACADEMY_CURSODESCRIPTION_UPDATE.md` para detalhes completos

---

**Versão:** v1.1.0  
**Data:** 2025-01-30  
**Autor:** VeloHub Development Team

