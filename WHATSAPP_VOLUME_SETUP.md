# Configuração de Volume Persistente para WhatsApp Auth

## Checkpoint 4.1: Configurar Volume no Cloud Run

### Instruções para Configurar Volume Persistente

O volume persistente deve ser configurado no Cloud Run para manter a pasta `auth` entre reinicializações.

#### Opção 1: Via Console GCP

1. Acesse o Cloud Run no Google Cloud Console
2. Selecione o serviço SKYNET
3. Vá em "Edit & Deploy New Revision"
4. Aba "Volumes"
5. Clique em "Add Volume"
6. Configure:
   - **Volume Type**: Cloud Storage (ou NFS se disponível)
   - **Mount Path**: `/app/backend/auth`
   - **Volume Name**: `whatsapp-auth`
7. Salve e faça deploy

#### Opção 2: Via gcloud CLI

```bash
gcloud run services update skynet-backend \
  --add-volume name=whatsapp-auth,type=cloud-storage,bucket=skynet-whatsapp-auth \
  --add-volume-mount volume=whatsapp-auth,mount-path=/app/backend/auth \
  --region=us-central1
```

#### Opção 3: Via YAML (cloudbuild.yaml ou service.yaml)

Adicionar configuração de volume no arquivo de deploy.

### Validação

Após configurar:
- [ ] Volume criado no Cloud Run
- [ ] Caminho de montagem: `/app/backend/auth`
- [ ] Permissões de escrita configuradas
- [ ] Pasta `auth` persiste após reinicialização

### Nota

A pasta `auth` será criada automaticamente pelo Baileys quando necessário.
O caminho usado no código é relativo: `backend/auth` (que será `/app/backend/auth` no container).

