# VERSION: v1.2.0 | DATE: 2025-12-08 | AUTHOR: VeloHub Development Team
# Dockerfile para Backend API - Cloud Run

FROM node:20-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Expor porta padrão do Cloud Run
EXPOSE 8080

# Nota: PORT é definido automaticamente pelo Cloud Run, não precisa definir aqui

# Comando para iniciar a aplicação
CMD ["node", "backend/server.js"]

