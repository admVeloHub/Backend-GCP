# Script de Migração - Academy Schema Normalizado

## VERSION: v1.0.0 | DATE: 2025-02-02

## Descrição

Este script migra todos os dados da collection `cursos_conteudo` (schema antigo monolítico) para as novas collections normalizadas:
- `cursos` - Metadados dos cursos
- `modulos` - Módulos vinculados aos cursos
- `secoes` - Seções vinculadas aos módulos
- `aulas` - Aulas vinculadas às seções

## Estrutura das Novas Coleções

### 1. `academy_registros.cursos`
Armazena apenas metadados do curso.

**Campos:**
- `_id`: ObjectId
- `cursoClasse`: String (Essencial, Atualização, Opcional, Reciclagem)
- `cursoNome`: String (único)
- `cursoDescription`: String (opcional)
- `courseOrder`: Number
- `isActive`: Boolean
- `createdBy`: String (email)
- `version`: Number
- `createdAt`: Date
- `updatedAt`: Date

### 2. `academy_registros.modulos`
Referência ao curso via `cursoId` (ObjectId).

**Campos:**
- `_id`: ObjectId
- `cursoId`: ObjectId (referência a `cursos`)
- `moduleId`: String
- `moduleNome`: String
- `moduleOrder`: Number
- `isActive`: Boolean
- `createdAt`: Date
- `updatedAt`: Date

### 3. `academy_registros.secoes`
Referência ao módulo via `moduloId` (ObjectId).

**Campos:**
- `_id`: ObjectId
- `moduloId`: ObjectId (referência a `modulos`)
- `temaNome`: String
- `temaOrder`: Number
- `isActive`: Boolean
- `hasQuiz`: Boolean
- `quizId`: String (opcional)
- `createdAt`: Date
- `updatedAt`: Date

### 4. `academy_registros.aulas`
Referência à seção via `secaoId` (ObjectId).

**Campos:**
- `_id`: ObjectId
- `secaoId`: ObjectId (referência a `secoes`)
- `lessonId`: String
- `lessonTipo`: String (video, pdf, audio, slide, document)
- `lessonTitulo`: String
- `lessonOrdem`: Number
- `isActive`: Boolean
- `lessonContent`: Array[{ url: String }]
- `driveId`: String (opcional)
- `youtubeId`: String (opcional)
- `duration`: String (opcional)
- `createdAt`: Date
- `updatedAt`: Date

## Como Executar

### Opção 1: Usando npm script (recomendado)

```bash
cd "Dev - SKYNET"
npm run migrate-academy
```

### Opção 2: Executar diretamente

```bash
cd "Dev - SKYNET"
node backend/scripts/migrate-academy-data.js
```

## Funcionamento

1. **Conecta ao MongoDB** usando a URI fornecida
2. **Busca todos os cursos** da collection `cursos_conteudo`
3. **Para cada curso:**
   - Cria documento em `cursos`
   - Para cada módulo:
     - Cria documento em `modulos` com referência ao curso
     - Para cada seção:
       - Cria documento em `secoes` com referência ao módulo
       - Para cada aula:
         - Cria documento em `aulas` com referência à seção
4. **Exibe estatísticas** de migração ao final

## Estatísticas

O script exibe ao final:
- Total de cursos migrados (sucesso/falhas)
- Total de módulos migrados (sucesso/falhas)
- Total de seções migradas (sucesso/falhas)
- Total de aulas migradas (sucesso/falhas)
- Lista de erros encontrados (se houver)

## Observações Importantes

⚠️ **ATENÇÃO:**
- O script **NÃO limpa** as coleções existentes por padrão
- Se quiser limpar antes de migrar, descomente as linhas 247-253 no script
- A collection `cursos_conteudo` **NÃO é removida** após a migração
- Os timestamps (`createdAt`, `updatedAt`) são preservados do documento original
- Se um módulo não tiver `moduleOrder`, será usado o índice + 1

## Tratamento de Erros

- O script continua mesmo se houver erros em módulos/seções/aulas individuais
- Erros são registrados e exibidos ao final
- A migração de um curso pode falhar sem afetar os outros

## Logs

O script gera logs detalhados com timestamps:
- ✅ Sucesso na criação de documentos
- ❌ Erros encontrados
- 📊 Estatísticas finais

## Exemplo de Saída

```
[2025-02-02T10:00:00.000Z] 🚀 Iniciando migração do schema Academy...
[2025-02-02T10:00:00.100Z] ✅ Conectado ao MongoDB
[2025-02-02T10:00:00.200Z] 📖 Buscando cursos antigos da collection cursos_conteudo...
[2025-02-02T10:00:00.300Z] 📚 Encontrados 5 cursos para migrar

[2025-02-02T10:00:00.400Z] [1/5] Processando curso...
[2025-02-02T10:00:00.500Z] 📚 Migrando curso: Curso de Exemplo (507f1f77bcf86cd799439011)
[2025-02-02T10:00:00.600Z] ✅ Curso criado: 507f191e810c19729de860ea - Curso de Exemplo
[2025-02-02T10:00:00.700Z]   ✅ Módulo criado: Módulo 1 (507f191e810c19729de860eb)
...

[2025-02-02T10:05:00.000Z] 📊 ========================================
[2025-02-02T10:05:00.000Z] 📊 ESTATÍSTICAS DE MIGRAÇÃO
[2025-02-02T10:05:00.000Z] 📊 ========================================
[2025-02-02T10:05:00.000Z]   Cursos: 5/5 sucesso, 0 falhas
[2025-02-02T10:05:00.000Z]   Módulos: 15/15 sucesso, 0 falhas
[2025-02-02T10:05:00.000Z]   Seções: 45/45 sucesso, 0 falhas
[2025-02-02T10:05:00.000Z]   Aulas: 120/120 sucesso, 0 falhas
[2025-02-02T10:05:00.000Z] ✅ Migração concluída!
```

## Suporte

Em caso de problemas, verifique:
1. Conexão com o MongoDB
2. Permissões de escrita nas collections
3. Logs de erro detalhados no console
4. Estrutura dos dados na collection `cursos_conteudo`

