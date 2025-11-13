#!/bin/bash

# 🧹 Script de Limpeza - Repositório back-console
# VERSION: v3.1.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team

echo "🧹 Iniciando limpeza do repositório back-console..."

# Remover arquivos HTML antigos
echo "📄 Removendo arquivos HTML antigos..."
rm -f artigos.html
rm -f bot-perguntas.html
rm -f velonews.html
rm -f index.html

# Remover imagens antigas
echo "🖼️ Removendo imagens antigas..."
rm -f console.png
rm -f success.gif

# Remover pastas antigas
echo "📁 Removendo pastas antigas..."
rm -rf css/
rm -rf js/
rm -rf public/
rm -rf api/

# Criar nova estrutura
echo "🏗️ Criando nova estrutura..."
mkdir -p backend/config
mkdir -p backend/models
mkdir -p backend/routes
mkdir -p backend/middleware
mkdir -p backend/public

echo "✅ Limpeza concluída!"
echo "📋 Próximos passos:"
echo "   1. Copiar arquivos do novo backend"
echo "   2. Atualizar package.json"
echo "   3. Atualizar vercel.json"
echo "   4. Substituir README.md"
echo "   5. Fazer commit e push"

echo "🚀 Repositório pronto para o novo backend com Monitor Skynet!"
