# Configuração de Volume Persistente - Cloud Run SKYNET

## 📋 Objetivo

Configurar um volume persistente no Google Cloud Run para manter as credenciais do WhatsApp (pasta `auth` do Baileys) entre reinicializações do serviço.

**VERSION:** v1.0.0 | **DATE:** 2025-01-30 | **AUTHOR:** VeloHub Development Team

---

## ⚠️ PRÉ-REQUISITOS

1. **Google Cloud SDK instalado** (`gcloud`)
2. **Acesso ao projeto GCP** com permissões de:
   - Cloud Run Admin
   - Compute Engine Admin (para criar volumes)
3. **Projeto GCP configurado** e autenticado
4. **SKYNET já deployado** no Cloud Run (ou pronto para deploy)

---

## 📍 PASSO 1: Verificar Configuração Atual do SKYNET

### 1.1 Identificar o serviço Cloud Run do SKYNET

```bash
# Listar serviços Cloud Run
gcloud run services list --region=us-east1

# Ou verificar se já existe um serviço SKYNET
gcloud run services list --region=us-east1 --filter="metadata.name:skynet"
```

**Nota:** Anote o nome exato do serviço (ex: `skynet-backend` ou `console-conteudo-backend`)

### 1.2 Verificar região e projeto atual

```bash
# Verificar projeto atual
gcloud config get-value project

# Verificar região padrão
gcloud config get-value compute/region

# Se necessário, configurar projeto e região
gcloud config set project SEU_PROJECT_ID
gcloud config set compute/region us-east1
```

---

## 📍 PASSO 2: Criar Volume Persistente (Filestore)

### 2.1 Criar instância Filestore (NFS)

O Cloud Run usa Filestore para volumes persistentes. Vamos criar uma instância:

```bash
# Definir variáveis
export PROJECT_ID=$(gcloud config get-value project)
export REGION=us-east1
export ZONE=us-east1-b
export INSTANCE_NAME=skynet-whatsapp-auth
export VOLUME_NAME=whatsapp-auth-volume
export CAPACITY=10GB  # Tamanho mínimo (ajuste conforme necessário)

# Criar instância Filestore
gcloud filestore instances create ${INSTANCE_NAME} \
    --project=${PROJECT_ID} \
    --zone=${ZONE} \
    --tier=BASIC_HDD \
    --file-share=name=${VOLUME_NAME},capacity=${CAPACITY} \
    --network=name=default
```

**⚠️ IMPORTANTE:**
- `BASIC_HDD` é o tier mais barato (suficiente para credenciais)
- `BASIC_SSD` é mais rápido mas mais caro
- O tamanho mínimo é 1TB para BASIC_HDD (verificar limites atuais)
- A instância Filestore tem custo mesmo quando não está em uso

### 2.2 Obter informações da instância criada

```bash
# Obter IP e caminho do volume
gcloud filestore instances describe ${INSTANCE_NAME} \
    --zone=${ZONE} \
    --format="value(networks[0].ipAddresses[0])"

# Salvar o IP em uma variável
export FILESTORE_IP=$(gcloud filestore instances describe ${INSTANCE_NAME} \
    --zone=${ZONE} \
    --format="value(networks[0].ipAddresses[0])")

echo "Filestore IP: ${FILESTORE_IP}"
echo "Caminho do volume: ${FILESTORE_IP}:/${VOLUME_NAME}"
```

---

## 📍 PASSO 3: Configurar Cloud Run com Volume Persistente

### 3.1 Atualizar serviço Cloud Run existente

Se o SKYNET já está deployado:

```bash
# Definir variáveis
export SERVICE_NAME=skynet-backend  # Ajustar conforme seu serviço
export REGION=us-east1
export FILESTORE_IP=<IP_OBTIDO_NO_PASSO_2>
export VOLUME_NAME=whatsapp-auth-volume
export MOUNT_PATH=/app/backend/auth

# Atualizar serviço com volume
gcloud run services update ${SERVICE_NAME} \
    --region=${REGION} \
    --add-volume=name=${VOLUME_NAME},type=cloud-storage-fuse,cloud-storage-fuse-config="bucket=gs://skynet-whatsapp-auth" \
    --add-volume-mount=volume=${VOLUME_NAME},mount-path=${MOUNT_PATH}
```

**⚠️ NOTA:** Cloud Run suporta volumes via Cloud Storage FUSE ou NFS. Para Filestore (NFS), o comando é diferente:

### 3.2 Alternativa: Usar Cloud Storage FUSE (Recomendado)

Cloud Storage FUSE é mais simples e barato para volumes pequenos:

```bash
# Criar bucket GCS para armazenar credenciais
export BUCKET_NAME=skynet-whatsapp-auth-${PROJECT_ID}

# Criar bucket
gsutil mb -p ${PROJECT_ID} -l ${REGION} gs://${BUCKET_NAME}

# Atualizar serviço Cloud Run com Cloud Storage FUSE
gcloud run services update ${SERVICE_NAME} \
    --region=${REGION} \
    --add-volume=name=whatsapp-auth,type=cloud-storage-fuse,cloud-storage-fuse-config="bucket=gs://${BUCKET_NAME}" \
    --add-volume-mount=volume=whatsapp-auth,mount-path=/app/backend/auth
```

### 3.3 Alternativa: Usar Filestore (NFS) - Mais Complexo

Se preferir usar Filestore diretamente:

```bash
# Criar VPC connector (necessário para Filestore)
export VPC_CONNECTOR_NAME=skynet-vpc-connector

gcloud compute networks vpc-access connectors create ${VPC_CONNECTOR_NAME} \
    --region=${REGION} \
    --network=default \
    --range=10.8.0.0/28

# Atualizar serviço com Filestore
gcloud run services update ${SERVICE_NAME} \
    --region=${REGION} \
    --vpc-connector=${VPC_CONNECTOR_NAME} \
    --add-volume=name=whatsapp-auth,type=nfs,nfs-server=${FILESTORE_IP},nfs-path=/${VOLUME_NAME} \
    --add-volume-mount=volume=whatsapp-auth,mount-path=/app/backend/auth
```

---

## 📍 PASSO 4: Verificar Configuração

### 4.1 Verificar volumes configurados

```bash
# Descrever serviço para ver volumes
gcloud run services describe ${SERVICE_NAME} \
    --region=${REGION} \
    --format="yaml(spec.template.spec.volumes,spec.template.spec.containers[0].volumeMounts)"
```

### 4.2 Verificar logs após reinicialização

```bash
# Ver logs do serviço
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME}" \
    --limit=50 \
    --format=json
```

---

## 📍 PASSO 5: Ajustar Código (Se Necessário)

### 5.1 Verificar caminho no código

O código já está configurado para usar `/app/backend/auth` (caminho absoluto no container).

**Arquivo:** `backend/services/whatsapp/baileysService.js`

```javascript
// Linha 27 - Já está correto
const AUTH_DIR = path.join(__dirname, '../../auth');
```

**No Cloud Run, `__dirname` será `/app/backend/services/whatsapp`, então:**
- `../../auth` = `/app/backend/auth` ✅

### 5.2 Garantir que o diretório é criado automaticamente

O código já cria o diretório se não existir (linha 65-68 do baileysService.js):

```javascript
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}
```

---

## 📍 PASSO 6: Testar Persistência

### 6.1 Fazer deploy do SKYNET

```bash
# Navegar para diretório do SKYNET
cd "C:\DEV - Ecosistema Velohub\EXP- Console GCP\Dev - SKYNET"

# Fazer deploy (ajustar conforme seu processo)
gcloud run deploy skynet-backend \
    --source . \
    --region=us-east1 \
    --platform=managed
```

### 6.2 Conectar WhatsApp e verificar

1. Acessar Console → WhatsApp
2. Escanear QR code
3. Aguardar conexão
4. Verificar se arquivos foram criados no volume

### 6.3 Reiniciar serviço e verificar persistência

```bash
# Forçar nova revisão (reinicia o serviço)
gcloud run services update-traffic ${SERVICE_NAME} \
    --region=${REGION} \
    --to-latest

# Verificar logs para confirmar que conexão foi mantida
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME} AND textPayload=~'WhatsApp conectado'" \
    --limit=10
```

---

## 🔧 SOLUÇÃO ALTERNATIVA: Cloud Storage Sync

Se volumes persistentes não funcionarem ou forem muito caros, podemos usar Cloud Storage com sincronização:

### Opção A: Sincronizar na inicialização

Modificar `baileysService.js` para baixar/upload credenciais do GCS:

```javascript
// No início do connect()
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket('skynet-whatsapp-auth-PROJECT_ID');

// Baixar credenciais do GCS se existirem
if (await bucket.file('auth/creds.json').exists().then(r => r[0])) {
  await bucket.file('auth/creds.json').download({ destination: path.join(AUTH_DIR, 'creds.json') });
}

// Após salvar credenciais, fazer upload
sock.ev.on('creds.update', async () => {
  await saveCreds();
  // Upload para GCS
  await bucket.upload(path.join(AUTH_DIR, 'creds.json'), { destination: 'auth/creds.json' });
});
```

**⚠️ Esta opção requer modificação do código e pode ter latência.**

---

## 💰 CUSTOS

### Filestore BASIC_HDD
- **Custo:** ~$0.20/GB/mês
- **Tamanho mínimo:** 1TB (verificar limites atuais)
- **Custo mínimo:** ~$200/mês

### Cloud Storage FUSE
- **Custo:** ~$0.020/GB/mês (Standard Storage)
- **Operações:** ~$0.05 por 10.000 operações
- **Muito mais barato** para volumes pequenos

### Recomendação
- **Para desenvolvimento/testes:** Cloud Storage FUSE
- **Para produção:** Avaliar custo-benefício (Filestore é mais rápido mas mais caro)

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [ ] Volume criado (Filestore ou Cloud Storage)
- [ ] Serviço Cloud Run atualizado com volume
- [ ] Volume montado no caminho correto (`/app/backend/auth`)
- [ ] Serviço reiniciado sem perder conexão WhatsApp
- [ ] Logs confirmam que credenciais foram mantidas
- [ ] Teste de troca de número funciona corretamente

---

## 🆘 TROUBLESHOOTING

### Erro: "Volume mount failed"
- Verificar se o caminho de montagem está correto
- Verificar permissões do volume
- Verificar se o serviço tem acesso à VPC (para Filestore)

### Erro: "Permission denied"
- Verificar IAM roles do Cloud Run service account
- Adicionar role: `roles/storage.objectAdmin` (para Cloud Storage)

### Conexão perdida após reinicialização
- Verificar se volume está realmente montado
- Verificar logs para erros de leitura/escrita
- Testar manualmente criando arquivo no volume

---

## 📚 REFERÊNCIAS

- [Cloud Run Volumes](https://cloud.google.com/run/docs/configuring/volumes)
- [Cloud Storage FUSE](https://cloud.google.com/storage/docs/gcs-fuse)
- [Filestore](https://cloud.google.com/filestore/docs)

---

**Última atualização:** 2025-01-30

