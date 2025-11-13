# 🚀 Backend API - Console de Conteúdo VeloHub
<!-- VERSION: v3.1.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team -->

## 📋 **Descrição**
Backend API para o Console de Conteúdo VeloHub. Esta é uma API RESTful construída com Express.js e MongoDB, responsável por gerenciar artigos, velonews, perguntas do bot e métricas IGP.

## 🛠️ **Tecnologias**
- **Node.js** (>=16.0.0)
- **Express.js** - Framework web
- **MongoDB** - Banco de dados
- **Socket.IO** - WebSocket para monitoramento em tempo real
- **CORS** - Cross-origin resource sharing
- **Helmet** - Segurança
- **Rate Limiting** - Controle de requisições

## 📁 **Estrutura do Projeto**
```
backend-deploy/
├── backend/
│   ├── config/
│   │   ├── database.js          # Configuração do MongoDB
│   │   └── collections.js       # Configuração das collections
│   ├── middleware/
│   │   └── monitoring.js        # Middleware de monitoramento
│   ├── models/
│   │   ├── Artigos.js          # Modelo de artigos
│   │   ├── BotPerguntas.js     # Modelo de perguntas
│   │   └── Velonews.js         # Modelo de velonews
│   ├── public/
│   │   └── monitor.html        # Monitor Skynet (interface)
│   ├── routes/
│   │   ├── artigos.js          # Rotas de artigos
│   │   ├── botPerguntas.js     # Rotas de perguntas
│   │   ├── igp.js              # Rotas de métricas IGP
│   │   └── velonews.js         # Rotas de velonews
│   └── server.js               # Servidor principal
├── package.json                # Dependências do projeto
├── env.example                 # Exemplo de variáveis de ambiente
└── README.md                   # Este arquivo
```

## 🔧 **Configuração**

### **1. Instalar Dependências**
```bash
npm install
```

### **2. Configurar Variáveis de Ambiente**
Copie o arquivo `env.example` para `.env` e configure as variáveis:

```bash
cp env.example .env
```

**Variáveis obrigatórias:**
- `MONGODB_URI` - String de conexão do MongoDB
- `CORS_ORIGIN` - URL do frontend (ex: https://front-console.vercel.app)

### **3. Configuração do MongoDB**
Para produção, use MongoDB Atlas:
1. Crie uma conta no [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crie um cluster
3. Configure a string de conexão no `.env`

**Exemplo de MONGODB_URI:**
```
MONGODB_URI=mongodb+srv://REDACTED_ATLAS_URI
```

## 🚀 **Deploy**

### **Opção 1: Railway**
1. Conecte sua conta GitHub ao Railway
2. Selecione este repositório
3. Configure as variáveis de ambiente
4. Deploy automático

### **Opção 2: Render**
1. Conecte sua conta GitHub ao Render
2. Crie um novo Web Service
3. Selecione este repositório
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Configure as variáveis de ambiente
6. Deploy

### **Opção 3: Heroku**
1. Instale o Heroku CLI
2. Crie um novo app:
   ```bash
   heroku create seu-app-backend
   ```
3. Configure as variáveis de ambiente:
   ```bash
   heroku config:set MONGODB_URI=sua-string-de-conexao
   heroku config:set CORS_ORIGIN=https://front-console.vercel.app
   ```
4. Deploy:
   ```bash
   git push heroku main
   ```

### **Opção 4: DigitalOcean App Platform**
1. Conecte sua conta GitHub
2. Crie um novo App
3. Selecione este repositório
4. Configure:
   - **Source Directory:** `/`
   - **Build Command:** `npm install`
   - **Run Command:** `npm start`
5. Configure as variáveis de ambiente
6. Deploy

## 🔗 **Endpoints da API**

### **Health Check**
- `GET /api/health` - Status da API e banco de dados

### **Artigos**
- `GET /api/artigos` - Listar todos os artigos
- `POST /api/artigos` - Criar novo artigo
- `PUT /api/artigos/:id` - Atualizar artigo
- `DELETE /api/artigos/:id` - Deletar artigo

### **Velonews**
- `GET /api/velonews` - Listar todas as velonews
- `POST /api/velonews` - Criar nova velonews
- `PUT /api/velonews/:id` - Atualizar velonews
- `DELETE /api/velonews/:id` - Deletar velonews

### **Bot Perguntas**
- `GET /api/bot-perguntas` - Listar todas as perguntas
- `POST /api/bot-perguntas` - Criar nova pergunta
- `PUT /api/bot-perguntas/:id` - Atualizar pergunta
- `DELETE /api/bot-perguntas/:id` - Deletar pergunta

### **IGP (Métricas)**
- `GET /api/igp/metrics` - Obter métricas
- `GET /api/igp/reports` - Obter relatórios
- `POST /api/igp/export/:format` - Exportar dados

### **Monitor Skynet**
- `GET /monitor` - Interface de monitoramento em tempo real
- WebSocket em tempo real para tráfego da API
- Console logs, tráfego de API e visualização JSON

## 🔒 **Segurança**
- **CORS** configurado para o domínio do frontend
- **Helmet** para headers de segurança
- **Rate Limiting** (100 requests por 15 minutos)
- **Validação** de entrada de dados
- **Sanitização** de dados

## 📊 **Monitoramento**
- Health check endpoint para verificar status
- Logs estruturados
- Tratamento de erros centralizado

## 🧪 **Testando a API**

### **Localmente**
```bash
npm start
```

### **Verificar se está funcionando**
```bash
curl https://seu-backend-url.com/api/health
```

## 🔄 **Atualização do Frontend**
Após o deploy do backend, atualize o frontend:

1. Edite `src/services/api.js`
2. Altere a URL base:
   ```javascript
   const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://seu-backend-url.com/api';
   ```
3. Configure a variável de ambiente no Vercel:
   ```
   REACT_APP_API_URL=https://seu-backend-url.com/api
   ```

## 📝 **Logs e Debugging**
- Logs são exibidos no console
- Use `NODE_ENV=development` para logs detalhados
- Health check retorna status do banco de dados

## 🆘 **Troubleshooting**

### **Erro de Conexão MongoDB**
- Verifique se a string de conexão está correta
- Confirme se o IP está liberado no MongoDB Atlas
- Verifique se o usuário tem permissões

### **Erro CORS**
- Confirme se `CORS_ORIGIN` está configurado corretamente
- Verifique se o frontend está usando a URL correta

### **Rate Limit**
- Ajuste `RATE_LIMIT_MAX_REQUESTS` se necessário
- Verifique se não há muitas requisições simultâneas

## 📞 **Suporte**
Para suporte técnico, entre em contato com a equipe de desenvolvimento VeloHub.

---
**Versão:** 3.1.0  
**Data:** 2024-12-19  
**Autor:** VeloHub Development Team

## 🔍 **Monitor Skynet**

O Monitor Skynet é uma interface de monitoramento em tempo real que permite observar o funcionamento da API. Acesse através da URL:

```
https://sua-url-backend.com/monitor
```

### **Características do Monitor:**
- **Design:** Background preto com tema futurístico
- **Título:** "MONITOR SKYNET" em fonte Anton
- **3 Containers Verticais:**
  - **Esquerda:** Console do navegador em tempo real
  - **Central:** Tráfego da API mostrando:
    - Entrada recebida
    - Origem (Artigo, Velonews, Bot Perguntas, IGP)
    - Transmitindo para DB
    - Concluído/Erro
  - **Direita:** JSON corrente dos dados sendo processados

### **Funcionalidades:**
- **WebSocket em tempo real** para comunicação instantânea
- **Logs coloridos** (info, success, warning, error)
- **Status de conexão** visual
- **Buttons para limpar** cada painel
- **Animações** para entradas de tráfego
- **Auto-scroll** nos painéis
