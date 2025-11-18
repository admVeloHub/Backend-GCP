# 📦 Arquitetura de Repositórios GitHub - VeloHub GCP
<!-- VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team -->

## 🎯 **Visão Geral**

O projeto está dividido em **2 repositórios GitHub separados** para manter isolamento e facilitar deploy independente:

1. **Backend API** - API RESTful principal
2. **Worker de Áudio** - Processamento assíncrono de análise de qualidade

---

## 📂 **1. Backend API**

### **Repositório:**
🔗 [https://github.com/admVeloHub/Backend-GCP](https://github.com/admVeloHub/Backend-GCP)

### **Descrição:**
Backend principal com API RESTful, endpoints CRUD, gerenciamento de conteúdo e integração com serviços GCP.

### **Componentes Principais:**
- ✅ Express.js server (`backend/server.js`)
- ✅ Rotas da API (`backend/routes/`)
- ✅ Models MongoDB (`backend/models/`)
- ✅ Configurações GCS (`backend/config/gcs.js`)
- ✅ SSE para notificações em tempo real
- ✅ Endpoints de análise de áudio (status, resultados)

### **Arquivos de Deploy:**
- `Dockerfile` - Container do backend API
- `cloudbuild.yaml` - Configuração Cloud Build para deploy no Cloud Run
- `.dockerignore` - Arquivos ignorados no build

### **Deploy:**
- **Serviço Cloud Run:** `backend-api`
- **Região:** `us-central1`
- **Porta:** `8080`

### **Estrutura de Arquivos:**
```
Backend-GCP/
├── backend/
│   ├── server.js              # Servidor Express principal
│   ├── routes/
│   │   ├── audioAnalise.js    # Rotas de análise de áudio
│   │   └── ...                # Outras rotas
│   ├── models/
│   │   ├── AudioAnaliseStatus.js
│   │   └── ...                # Outros models
│   └── config/
│       └── gcs.js             # Configuração GCS
├── Dockerfile
├── cloudbuild.yaml
├── package.json
└── env.example
```

---

## ⚙️ **2. Worker de Processamento de Áudio**

### **Repositório:**
🔗 [https://github.com/admVeloHub/gcp-worker-qualidade](https://github.com/admVeloHub/gcp-worker-qualidade)

### **Descrição:**
Worker assíncrono para processamento de análise de qualidade de áudio usando Vertex AI (Speech-to-Text + Gemini).

### **Componentes Principais:**
- ✅ Pub/Sub subscriber (`backend/worker/audioProcessor.js`)
- ✅ Vertex AI integration (`backend/config/vertexAI.js`)
- ✅ Processamento assíncrono de áudio
- ✅ Atualização de status no MongoDB
- ✅ Notificação ao Backend API via HTTP

### **Arquivos de Deploy:**
- `Dockerfile.worker` - Container do worker
- `cloudbuild.worker.yaml` - Configuração Cloud Build para deploy no Cloud Run
- `.dockerignore` - Arquivos ignorados no build

### **Deploy:**
- **Serviço Cloud Run:** `audio-worker`
- **Região:** `us-central1`
- **Porta:** `8080` (não exposta publicamente)
- **Autenticação:** `--no-allow-unauthenticated`

### **Estrutura de Arquivos:**
```
gcp-worker-qualidade/
├── backend/
│   ├── worker/
│   │   └── audioProcessor.js  # Worker principal
│   ├── config/
│   │   └── vertexAI.js        # Módulo Vertex AI
│   └── models/
│       ├── AudioAnaliseStatus.js  # Compartilhado
│       └── AudioAnaliseResult.js  # Compartilhado
├── Dockerfile.worker
├── cloudbuild.worker.yaml
├── package.json
└── env.example
```

---

## 🔄 **Comunicação Entre Repositórios**

### **Compartilhamento de Código:**
Alguns arquivos são compartilhados entre os repositórios e devem ser mantidos sincronizados:

1. **Models MongoDB:**
   - `backend/models/AudioAnaliseStatus.js`
   - `backend/models/AudioAnaliseResult.js`

2. **Schemas:**
   - `listagem de schema de coleções do mongoD.rb` (documentação)

### **Comunicação em Runtime:**
- **Pub/Sub:** GCS → Worker (mensagens de upload)
- **MongoDB:** Compartilhado (status e resultados)
- **HTTP:** Worker → Backend API (notificação SSE de conclusão)

---

## 📋 **Regras de Commit e Push**

### **✅ ANTES de fazer Push:**

1. **Verificar Remote:**
   ```bash
   git remote -v
   ```

2. **Confirmar Repositório Correto:**
   - Backend API → `https://github.com/admVeloHub/Backend-GCP`
   - Worker → `https://github.com/admVeloHub/gcp-worker-qualidade`

3. **Atualizar DEPLOY_LOG.md:**
   - Registrar data/hora, tipo, versão, arquivos modificados
   - Incluir descrição das mudanças

### **❌ NUNCA:**
- Fazer push para repositório errado
- Fazer push sem verificar o remote
- Fazer push sem atualizar DEPLOY_LOG.md

---

## 🚀 **Deploy**

### **Backend API:**
```bash
# Deploy via Cloud Build
gcloud builds submit --config=cloudbuild.yaml
```

### **Worker:**
```bash
# Deploy via Cloud Build
gcloud builds submit --config=cloudbuild.worker.yaml
```

---

## 📝 **Checklist de Validação**

Antes de fazer commit/push, verificar:

- [ ] Remote configurado corretamente (`git remote -v`)
- [ ] Arquivos modificados pertencem ao repositório correto
- [ ] Versões atualizadas nos arquivos modificados
- [ ] DEPLOY_LOG.md atualizado (se for push real)
- [ ] Models compartilhados sincronizados (se aplicável)
- [ ] Variáveis de ambiente documentadas no `env.example`

---

## 🔗 **Links Úteis**

- **Backend API:** [https://github.com/admVeloHub/Backend-GCP](https://github.com/admVeloHub/Backend-GCP)
- **Worker:** [https://github.com/admVeloHub/gcp-worker-qualidade](https://github.com/admVeloHub/gcp-worker-qualidade)
- **Diretrizes do Projeto:** `Diretrizes especificas do projeto.ini`
- **Deploy Log:** `DEPLOY_LOG.md`

---

**Última Atualização:** 2025-01-30  
**Versão:** v1.0.0

