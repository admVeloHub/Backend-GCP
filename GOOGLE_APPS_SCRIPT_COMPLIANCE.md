# 📋 Google Apps Script - Compliance MongoDB Insert API
<!-- VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team -->

## 🎯 Objetivo

Este documento garante que o Google Apps Script envie dados corretamente para o endpoint `/api/mongodb/insert` usando o database correto: `academy_registros`.

---

## 📝 Prompt Copiável para Assistente do Google Apps Script

```
Configure o código do Google Apps Script para enviar dados para o endpoint 
https://seu-dominio.vercel.app/api/mongodb/insert

REQUISITOS OBRIGATÓRIOS:
- Database: SEMPRE usar "academy_registros" (não usar "velohubcentral" ou outro)
- Collections permitidas: "curso_certificados" ou "quiz_reprovas"
- Endpoint: POST /api/mongodb/insert
- Content-Type: application/json

ESTRUTURA DO BODY:
{
  "database": "academy_registros",
  "collection": "curso_certificados" | "quiz_reprovas",
  "document": {
    // Estrutura do documento (ver abaixo)
  }
}

IMPORTANTE: 
- O campo "database" deve ser SEMPRE "academy_registros"
- O backend irá ignorar qualquer outro valor e sempre usará "academy_registros"
- Mas para compliance e clareza, sempre envie "academy_registros"
```

---

## 📊 Estrutura Completa para Certificados

### **Collection: `curso_certificados`**

```json
{
  "database": "academy_registros",
  "collection": "curso_certificados",
  "document": {
    "date": "2025-01-30T10:00:00.000Z",
    "name": "Nome do Aluno",
    "email": "aluno@email.com",
    "courseName": "Nome do Curso",
    "courseId": "id-do-curso",
    "status": "Aprovado",
    "certificateUrl": "https://drive.google.com/file/d/...",
    "certificateId": "uuid-do-certificado",
    "finalGrade": 8.5
  }
}
```

**Campos Obrigatórios para Certificados:**
- ✅ `date` (Date ou String ISO)
- ✅ `name` (String)
- ✅ `email` (String - formato válido)
- ✅ `courseName` (String)
- ✅ `status` (String - deve ser exatamente "Aprovado")
- ✅ `certificateUrl` (String)
- ✅ `certificateId` (String)

**Campos Opcionais:**
- `courseId` (String)
- `finalGrade` (Number - 0 a 100)

---

## 📊 Estrutura Completa para Reprovações

### **Collection: `quiz_reprovas`**

```json
{
  "database": "academy_registros",
  "collection": "quiz_reprovas",
  "document": {
    "date": "2025-01-30T10:00:00.000Z",
    "name": "Nome do Aluno",
    "email": "aluno@email.com",
    "courseName": "Nome do Curso",
    "courseId": "id-do-curso",
    "finalGrade": 5.0,
    "wrongQuestions": "Questões erradas: 1, 3, 5"
  }
}
```

**Campos Obrigatórios para Reprovações:**
- ✅ `date` (Date ou String ISO)
- ✅ `name` (String)
- ✅ `email` (String - formato válido)
- ✅ `courseName` (String)

**Campos Opcionais:**
- `courseId` (String)
- `finalGrade` (Number - 0 a 100)
- `wrongQuestions` (String)

---

## 💻 Exemplo de Código Google Apps Script

```javascript
function enviarCertificadoParaMongoDB() {
  const url = 'https://seu-dominio.vercel.app/api/mongodb/insert';
  
  const payload = {
    database: 'academy_registros',  // ⚠️ SEMPRE academy_registros
    collection: 'curso_certificados',
    document: {
      date: new Date().toISOString(),
      name: 'Nome do Aluno',
      email: 'aluno@email.com',
      courseName: 'Nome do Curso',
      courseId: 'id-do-curso',
      status: 'Aprovado',  // ⚠️ Deve ser exatamente "Aprovado"
      certificateUrl: 'https://drive.google.com/file/d/...',
      certificateId: Utilities.getUuid(),
      finalGrade: 8.5
    }
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());
  
  Logger.log('Resposta:', result);
  
  if (result.success) {
    Logger.log('✅ Certificado inserido com sucesso! ID:', result.insertedId);
  } else {
    Logger.log('❌ Erro:', result.error);
  }
  
  return result;
}

function enviarReprovacaoParaMongoDB() {
  const url = 'https://seu-dominio.vercel.app/api/mongodb/insert';
  
  const payload = {
    database: 'academy_registros',  // ⚠️ SEMPRE academy_registros
    collection: 'quiz_reprovas',
    document: {
      date: new Date().toISOString(),
      name: 'Nome do Aluno',
      email: 'aluno@email.com',
      courseName: 'Nome do Curso',
      courseId: 'id-do-curso',
      finalGrade: 5.0,
      wrongQuestions: 'Questões erradas: 1, 3, 5'
    }
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());
  
  Logger.log('Resposta:', result);
  
  if (result.success) {
    Logger.log('✅ Reprovação inserida com sucesso! ID:', result.insertedId);
  } else {
    Logger.log('❌ Erro:', result.error);
  }
  
  return result;
}
```

---

## ✅ Checklist de Compliance

- [ ] Database sempre é `"academy_registros"` (não `"velohubcentral"` ou outro)
- [ ] Collection é `"curso_certificados"` ou `"quiz_reprovas"`
- [ ] Todos os campos obrigatórios estão presentes
- [ ] Email está em formato válido
- [ ] Status é exatamente `"Aprovado"` (para certificados)
- [ ] Date está em formato ISO ou Date object
- [ ] Content-Type é `application/json`
- [ ] Endpoint correto: `/api/mongodb/insert`

---

## 🔍 Validações do Backend

O backend irá validar:

1. **Database**: Será sempre `academy_registros` (ignora o que vier no body)
2. **Collection**: Deve ser `curso_certificados` ou `quiz_reprovas`
3. **Documento**: Estrutura específica conforme a collection
4. **Campos obrigatórios**: Conforme listado acima
5. **Formato de email**: Regex de validação
6. **Status**: Deve ser `"Aprovado"` para certificados

---

## 📡 Resposta da API

### **Sucesso:**
```json
{
  "success": true,
  "insertedId": "6916253a99dd9345923391d9",
  "database": "academy_registros",
  "collection": "curso_certificados"
}
```

### **Erro:**
```json
{
  "success": false,
  "error": "Descrição do erro",
  "details": ["Lista de erros de validação"]
}
```

---

## 🚨 Observações Importantes

1. **Database Fixo**: O backend sempre usa `academy_registros`, mesmo que você envie outro valor
2. **Monitoramento**: Use o Monitor Skynet para ver o que está sendo recebido e processado
3. **Write Concern**: O backend usa `w: 'majority'` para garantir escrita confirmada
4. **Sanitização**: Todos os dados são sanitizados automaticamente (trim, lowercase, limites de tamanho)

---

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- Monitor Skynet: `/monitor`
- Logs do backend: Console do servidor
- Documentação da API: `MONGODB_INSERT_API.md`

---

**Versão:** v1.0.0  
**Data:** 2025-01-30  
**Autor:** VeloHub Development Team

