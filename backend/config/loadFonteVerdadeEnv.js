// VERSION: v1.0.0 | DATE: 2026-04-23 | AUTHOR: VeloHub Development Team
// Carrega .env da pasta FONTE DA VERDADE (irmã do monorepo) ou bootstrapFonteEnv.cjs.
// Ordem: sobe diretórios a partir de `startDir` até encontrar FONTE DA VERDADE/.env ou bootstrap; senão VELOHUB_DOTENV_PATH.

const path = require('path');
const fs = require('fs');

function loadFrom(startDir) {
  let d = startDir;
  for (let i = 0; i < 14; i++) {
    const loader = path.join(d, 'FONTE DA VERDADE', 'bootstrapFonteEnv.cjs');
    if (fs.existsSync(loader)) {
      require(loader).loadFrom(startDir);
      return;
    }
    const envPath = path.join(d, 'FONTE DA VERDADE', '.env');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      return;
    }
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  const custom = process.env.VELOHUB_DOTENV_PATH;
  if (custom && fs.existsSync(custom)) {
    require('dotenv').config({ path: custom });
  }
}

module.exports = { loadFrom };
