# 🚀 Quick Start - Configuração de Volume Persistente

## Opção Recomendada: Cloud Storage FUSE (Mais Simples e Barato)

### Passo 1: Criar Bucket GCS

```bash
# Definir variáveis
export PROJECT_ID=$(gcloud config get-value project)
export REGION=us-east1
export BUCKET_NAME=skynet-whatsapp-auth-${PROJECT_ID}

# Criar bucket
gsutil mb -p ${PROJECT_ID} -l ${REGION} gs://${BUCKET_NAME}
```

### Passo 2: Identificar Nome do Serviço SKYNET

```bash
# Listar serviços Cloud Run
gcloud run services list --region=us-east1

# Anotar o nome do serviço SKYNET (ex: skynet-backend ou console-conteudo-backend)
export SERVICE_NAME=SEU_SERVICO_SKYNET_AQUI
```

### Passo 3: Atualizar Serviço com Volume

```bash
# Atualizar serviço Cloud Run com volume montado
gcloud run services update ${SERVICE_NAME} \
    --region=${REGION} \
    --add-volume=name=whatsapp-auth,type=cloud-storage-fuse,cloud-storage-fuse-config="bucket=gs://${BUCKET_NAME}" \
    --add-volume-mount=volume=whatsapp-auth,mount-path=/app/backend/auth
```

### Passo 4: Verificar

```bash
# Verificar configuração
gcloud run services describe ${SERVICE_NAME} \
    --region=${REGION} \
    --format="yaml(spec.template.spec.volumes,spec.template.spec.containers[0].volumeMounts)"
```

### Passo 5: Testar

1. Acessar Console → WhatsApp
2. Escanear QR code e conectar
3. Reiniciar serviço: `gcloud run services update-traffic ${SERVICE_NAME} --region=${REGION} --to-latest`
4. Verificar se conexão foi mantida

---

## ⚠️ IMPORTANTE

- O caminho de montagem deve ser `/app/backend/auth` (já configurado no código)
- O bucket será criado vazio - o Baileys criará os arquivos automaticamente
- Custo estimado: ~$0.02/GB/mês (muito barato para credenciais)

---

Para instruções detalhadas, consulte: `CONFIGURACAO_VOLUME_PERSISTENTE.md`

