# 🔍 VERIFICAÇÃO DETALHADA - Upload de Imagens

## Data: 2025-01-30
## Versão do código: v1.3.1

---

## ✅ CHECKLIST COMPLETO DO FLUXO

### 1. FRONTEND - Chamada da API

#### 1.1 Arquivo: `EXP - Console + GPT/src/services/uploadAPI.js`
- ✅ Chama `api.post('/uploads/image', formData)`
- ✅ Usa `api` de `./api`
- ✅ Envia FormData com campo `'image'`

#### 1.2 Arquivo: `EXP - Console + GPT/src/services/api.js`
- ✅ `API_BASE_URL` = `https://backend-gcp-278491073220.us-east1.run.app/api`
- ✅ Configurado corretamente

---

### 2. BACKEND - Rota de Upload

#### 2.1 Arquivo: `EXP - SKYNET + GPT/backend/routes/uploads.js`
- ✅ Rota: `POST /api/uploads/image`
- ✅ Importa: `const { uploadImage } = require('../config/gcs');`
- ✅ Chama: `await uploadImage(buffer, originalname, mimetype);`
- ✅ Registrada em: `server.js` linha 171: `app.use('/api/uploads', uploadsRoutes);`

---

### 3. BACKEND - Configuração GCS

#### 3.1 Arquivo: `EXP - SKYNET + GPT/backend/config/gcs.js`

##### 3.1.1 Variáveis de Ambiente (linhas 5-7)
```javascript
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME; // Para outras funções (áudio, etc)
const GCS_BUCKET_NAME_IMAGES = process.env.GCS_BUCKET_NAME2; // EXCLUSIVO para imagens
```
- ✅ `GCS_BUCKET_NAME_IMAGES` lê de `process.env.GCS_BUCKET_NAME2`
- ✅ Separado de `GCS_BUCKET_NAME` (outras funções)

##### 3.1.2 Logs de Inicialização (linhas 9-16)
- ✅ Logs críticos adicionados para verificar variáveis ao carregar módulo
- ✅ Mostra se `GCS_BUCKET_NAME2` está definido ou não

##### 3.1.3 Função `getBucketImages()` (linhas 113-149)
```javascript
const getBucketImages = () => {
  // Valida GCS_BUCKET_NAME_IMAGES
  // Inicializa storage se necessário
  // Cria bucket com: storage.bucket(GCS_BUCKET_NAME_IMAGES)
  // Retorna bucketImages
}
```
- ✅ Valida `GCS_BUCKET_NAME_IMAGES` antes de usar
- ✅ Usa `storage.bucket(GCS_BUCKET_NAME_IMAGES)` - CORRETO
- ✅ Logs detalhados adicionados

##### 3.1.4 Função `uploadImage()` (linhas 372-456)
```javascript
const uploadImage = async (fileBuffer, fileName, mimeType) => {
  // Valida GCS_BUCKET_NAME_IMAGES
  // Chama getBucketImages()
  // Usa bucket para salvar arquivo
  // Retorna URL com GCS_BUCKET_NAME_IMAGES
}
```
- ✅ Valida `GCS_BUCKET_NAME_IMAGES` (linha 377)
- ✅ Chama `getBucketImages()` (linha 403) - usa bucket correto
- ✅ Caminho do arquivo: `img_velonews/${timestamp}-${fileName}` (linha 412)
- ✅ URL pública usa `GCS_BUCKET_NAME_IMAGES` (linha 437)
- ✅ Retorna `bucket: GCS_BUCKET_NAME_IMAGES` (linha 443)
- ✅ Logs detalhados adicionados

---

## 🔍 PONTOS CRÍTICOS VERIFICADOS

### ✅ Variável de Ambiente Correta
- **Variável usada**: `process.env.GCS_BUCKET_NAME2`
- **Constante criada**: `GCS_BUCKET_NAME_IMAGES = process.env.GCS_BUCKET_NAME2`
- **Usada em**: `getBucketImages()` e `uploadImage()`
- **NÃO misturada com**: `GCS_BUCKET_NAME` (outras funções)

### ✅ Separação de Buckets
- `GCS_BUCKET_NAME` → outras funções (áudio, etc)
- `GCS_BUCKET_NAME_IMAGES` → EXCLUSIVO para imagens
- Funções separadas: `getBucket()` vs `getBucketImages()`

### ✅ Logs de Diagnóstico
- Logs ao carregar módulo (linhas 9-16)
- Logs em `getBucketImages()` (linhas 115, 118)
- Logs em `uploadImage()` (linhas 377-382)
- Logs ao criar bucket (linha 143)

---

## 🚨 VERIFICAÇÕES NECESSÁRIAS NO DEPLOY

### 1. Variável de Ambiente no Cloud Run
```
GCS_BUCKET_NAME2=mediabank_velohub
```

### 2. Logs Esperados no Startup
Ao iniciar o servidor, deve aparecer:
```
🔍 [GCS CONFIG] Verificando variáveis de ambiente:
   GCP_PROJECT_ID: ✅ DEFINIDO
   GCS_BUCKET_NAME (outras funções): ✅ DEFINIDO = "..."
   GCS_BUCKET_NAME2 (imagens): ✅ DEFINIDO = "mediabank_velohub"
```

### 3. Logs Esperados no Upload
Ao fazer upload, deve aparecer:
```
🔍 [getBucketImages] Verificando GCS_BUCKET_NAME_IMAGES: "mediabank_velohub"
🔍 [getBucketImages] Criando bucket com nome: "mediabank_velohub"
✅ [getBucketImages] Bucket de imagens inicializado: "mediabank_velohub"
🔍 [uploadImage] Verificando GCS_BUCKET_NAME_IMAGES: "mediabank_velohub"
✅ [uploadImage] Variável GCS_BUCKET_NAME_IMAGES está definida: "mediabank_velohub"
🪣 Bucket de Imagens: mediabank_velohub
```

---

## 📋 RESUMO DA VERIFICAÇÃO

| Item | Status | Observação |
|------|--------|------------|
| Variável de ambiente lida corretamente | ✅ | `process.env.GCS_BUCKET_NAME2` |
| Constante criada corretamente | ✅ | `GCS_BUCKET_NAME_IMAGES` |
| Função `getBucketImages()` usa variável correta | ✅ | Usa `GCS_BUCKET_NAME_IMAGES` |
| Função `uploadImage()` usa variável correta | ✅ | Usa `GCS_BUCKET_NAME_IMAGES` |
| Buckets separados | ✅ | Não mistura com `GCS_BUCKET_NAME` |
| Logs de diagnóstico | ✅ | Adicionados em pontos críticos |
| Caminho do arquivo | ✅ | `img_velonews/` |
| URL pública | ✅ | Usa `GCS_BUCKET_NAME_IMAGES` |

---

## ⚠️ PRÓXIMOS PASSOS

1. **Deploy do backend** com esta versão (v1.3.1)
2. **Verificar logs do Cloud Run** ao iniciar servidor
3. **Testar upload de imagem** e verificar logs detalhados
4. **Confirmar** que aparece `"mediabank_velohub"` nos logs
5. **Se ainda falhar**, verificar variável de ambiente no Cloud Run

---

## 🔧 COMANDO PARA VERIFICAR VARIÁVEIS NO CLOUD RUN

```bash
gcloud run services describe backend-gcp --region us-east1 --format="value(spec.template.spec.containers[0].env)"
```

Ou verificar no Console do GCP:
- Cloud Run → backend-gcp → Variáveis de ambiente

---

**Última atualização**: 2025-01-30
**Versão do código**: v1.3.1

