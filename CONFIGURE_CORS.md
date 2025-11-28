# Configurar CORS no Bucket GCS

## Problema
O bucket do GCS não está configurado com CORS, causando erro ao fazer upload de áudio do frontend.

## Solução

### Opção 1: Via Console do GCP (Mais Rápido - Recomendado)

1. Acesse: https://console.cloud.google.com/storage/browser/qualidade_audio_envio
2. Clique no bucket: `qualidade_audio_envio`
3. Vá na aba **"Permissions"** (Permissões)
4. Clique em **"CORS"** no menu lateral
5. Clique em **"Edit"** (Editar)
6. Cole a seguinte configuração JSON:

```json
[
  {
    "origin": [
      "https://console-v2-hfsqj6konq-ue.a.run.app",
      "https://console-v2-278491073220.us-east1.run.app",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:8080"
    ],
    "method": ["PUT", "OPTIONS", "GET", "POST", "HEAD"],
    "responseHeader": [
      "Content-Type",
      "x-goog-resumable",
      "x-goog-content-length-range",
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Methods",
      "Access-Control-Allow-Headers",
      "Access-Control-Max-Age"
    ],
    "maxAgeSeconds": 3600
  }
]
```

7. Clique em **"Save"** (Salvar)

### Opção 2: Via API (Após Deploy)

**IMPORTANTE:** Esta opção só funcionará após fazer deploy do código atualizado.

Execute uma requisição POST para configurar CORS:

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "https://backend-gcp-278491073220.us-east1.run.app/api/audio-analise/configure-cors" -Method POST -ContentType "application/json"
```

**cURL:**
```bash
curl -X POST https://backend-gcp-278491073220.us-east1.run.app/api/audio-analise/configure-cors \
  -H "Content-Type: application/json"
```

**Verificar configuração atual:**
```powershell
Invoke-RestMethod -Uri "https://backend-gcp-278491073220.us-east1.run.app/api/audio-analise/cors-config" -Method GET
```

### Opção 3: Via gsutil (Se tiver instalado)

Crie um arquivo `cors.json` com o conteúdo acima e execute:

```bash
gsutil cors set cors.json gs://qualidade_audio_envio
```

### Opção 2: Via Console do GCP

1. Acesse: https://console.cloud.google.com/storage/browser
2. Selecione o bucket: `qualidade_audio_envio`
3. Clique em **"Permissions"** (Permissões)
4. Vá na aba **"CORS"**
5. Clique em **"Edit"** (Editar)
6. Cole a seguinte configuração:

```json
[
  {
    "origin": [
      "https://console-v2-hfsqj6konq-ue.a.run.app",
      "https://console-v2-278491073220.us-east1.run.app",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:8080"
    ],
    "method": ["PUT", "OPTIONS", "GET", "POST", "HEAD"],
    "responseHeader": [
      "Content-Type",
      "x-goog-resumable",
      "x-goog-content-length-range",
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Methods",
      "Access-Control-Allow-Headers",
      "Access-Control-Max-Age"
    ],
    "maxAgeSeconds": 3600
  }
]
```

7. Clique em **"Save"** (Salvar)

### Opção 3: Via Script Local (Requer Credenciais)

Se você tiver credenciais do GCP configuradas localmente:

```powershell
cd "EXP - SKYNET + GPT"
$env:GCP_PROJECT_ID="velohub-471220"
$env:GCS_BUCKET_NAME="qualidade_audio_envio"
node scripts/configure-gcs-cors.js
```

## Verificação

Após configurar, teste o upload de áudio novamente. O erro de CORS deve desaparecer.

## Notas

- A configuração CORS permite que o navegador faça requisições PUT diretas para o GCS
- O erro ocorria porque o GCS bloqueava requisições OPTIONS (preflight) do navegador
- Após configurar, o upload deve funcionar normalmente

