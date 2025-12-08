# 📱 WhatsApp API - Endpoints e Permissionamento
<!-- VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team -->

## 🎯 Base URL
```
/api/whatsapp
```

## 🔐 Sistema de Permissionamento

**IMPORTANTE:** Todas as rotas de gerenciamento (`/status`, `/qr`, `/logout`, `/number`) requerem permissão `whatsapp` no sistema de permissionamento do Console.

### Como funciona:
1. O frontend envia o email do usuário via header `X-User-Email` em todas as requisições
2. O backend verifica se o usuário existe e possui a permissão `whatsapp` em `_userClearance`
3. Se não tiver permissão, retorna erro 403 (Forbidden)

### Configuração de Permissão:
- Acesse o módulo **Config** no Console
- Edite o usuário desejado
- Na seção de permissões, marque a opção **WhatsApp**
- Salve as alterações

---

## 📊 Endpoints Disponíveis

### 1. Obter Status da Conexão
**GET** `/api/whatsapp/status`

**Descrição:** Retorna o status atual da conexão WhatsApp

**Headers:**
```
X-User-Email: usuario@email.com
```

**Resposta:**
```json
{
  "connected": true,
  "status": "connected",
  "number": "5511999999999",
  "numberFormatted": "(11) 99999-9999",
  "hasQR": false
}
```

**Status possíveis:**
- `connected` - Conectado e funcionando
- `connecting` - Tentando conectar
- `disconnected` - Desconectado

**Códigos de Erro:**
- `401` - Email do usuário não fornecido
- `403` - Usuário não tem permissão `whatsapp`
- `500` - Erro interno do servidor

---

### 2. Obter QR Code
**GET** `/api/whatsapp/qr`

**Descrição:** Retorna o QR code atual para conexão (se disponível)

**Headers:**
```
X-User-Email: usuario@email.com
```

**Resposta (QR disponível):**
```json
{
  "hasQR": true,
  "qr": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "expiresIn": 60
}
```

**Resposta (QR não disponível):**
```json
{
  "hasQR": false,
  "message": "QR code não disponível"
}
```

**Códigos de Erro:**
- `401` - Email do usuário não fornecido
- `403` - Usuário não tem permissão `whatsapp`
- `500` - Erro interno do servidor

---

### 3. Fazer Logout
**POST** `/api/whatsapp/logout`

**Descrição:** Desconecta o WhatsApp atual e gera um novo QR code

**Headers:**
```
X-User-Email: usuario@email.com
Content-Type: application/json
```

**Resposta:**
```json
{
  "success": true,
  "message": "Logout realizado. Novo QR code será gerado."
}
```

**Códigos de Erro:**
- `401` - Email do usuário não fornecido
- `403` - Usuário não tem permissão `whatsapp`
- `500` - Erro ao fazer logout

---

### 4. Obter Número Conectado
**GET** `/api/whatsapp/number`

**Descrição:** Retorna o número de telefone conectado ao WhatsApp

**Headers:**
```
X-User-Email: usuario@email.com
```

**Resposta:**
```json
{
  "number": "5511999999999",
  "formatted": "(11) 99999-9999",
  "connected": true
}
```

**Códigos de Erro:**
- `401` - Email do usuário não fornecido
- `403` - Usuário não tem permissão `whatsapp`
- `500` - Erro interno do servidor

---

### 5. Enviar Mensagem (VeloHub)
**POST** `/api/whatsapp/send`

**Descrição:** Envia mensagem via WhatsApp (usado pelo VeloHub, não requer permissão específica)

**Body:**
```json
{
  "jid": "5511999999999@s.whatsapp.net",
  "numero": "5511999999999",
  "mensagem": "Texto da mensagem",
  "imagens": ["url1", "url2"],
  "videos": ["url1"],
  "cpf": "12345678900",
  "solicitacao": "ID da solicitação",
  "agente": "Nome do agente"
}
```

**Resposta:**
```json
{
  "ok": true,
  "messageId": "3EB0C767F26D",
  "messageIds": ["3EB0C767F26D"]
}
```

**Nota:** Esta rota não requer permissão `whatsapp` pois é usada pelo sistema VeloHub para envio automático de mensagens.

---

## 🔧 Middleware de Autenticação

O middleware `checkPermission('whatsapp')` é aplicado automaticamente nas rotas de gerenciamento. Ele:

1. Verifica se o header `X-User-Email` está presente
2. Busca o usuário no banco de dados (`console_config.users`)
3. Verifica se `_userClearance.whatsapp === true`
4. Retorna erro 403 se não tiver permissão
5. Adiciona informações do usuário em `req.user` para uso nas rotas

---

## 📝 Exemplo de Uso no Frontend

```javascript
import { getStatus, getQR, logout, getNumber } from '../services/whatsappApi';

// O serviço automaticamente adiciona o header X-User-Email
// usando o email do usuário logado do localStorage

try {
  const status = await getStatus();
  console.log('Status:', status);
  
  if (!status.connected && status.hasQR) {
    const qrData = await getQR();
    // Exibir QR code
  }
} catch (error) {
  if (error.response?.status === 403) {
    console.error('Usuário não tem permissão para acessar WhatsApp');
  }
}
```

---

## 🗄️ Schema de Permissão no MongoDB

A permissão WhatsApp é armazenada no campo `_userClearance.whatsapp` do modelo `Users`:

```javascript
{
  _userMail: "usuario@email.com",
  _userId: "Nome do Usuário",
  _userRole: "Administrador",
  _userClearance: {
    // ... outras permissões
    whatsapp: true  // ← Permissão WhatsApp
  }
}
```

---

## ⚠️ Notas Importantes

1. **Segurança:** Apenas usuários com permissão `whatsapp` podem gerenciar a conexão WhatsApp
2. **Header obrigatório:** Todas as rotas de gerenciamento requerem o header `X-User-Email`
3. **Rota /send:** Não requer permissão específica pois é usada pelo sistema VeloHub
4. **Persistência:** As credenciais do WhatsApp são armazenadas no MongoDB (`hub_escalacoes.auth`)

---

## 🔄 Versão

- **v1.0.0** (2025-02-02) - Implementação inicial com sistema de permissionamento

