// VERSION: v1.0.1 | DATE: 2026-05-29 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.0.1 - Dev Windows: DNS público para querySrv MongoDB (Node c-ares vs resolver do SO)
// Carrega .env da pasta FONTE DA VERDADE (irmã do monorepo) ou bootstrapFonteEnv.cjs.
// Ordem: sobe diretórios a partir de `startDir` até encontrar FONTE DA VERDADE/.env ou bootstrap; senão VELOHUB_DOTENV_PATH.

const path = require('path');
const fs = require('fs');
const dns = require('dns');

/** Node no Windows pode falhar querySrv com DNS do SO; nslookup funciona. Desative com SKYNET_DISABLE_DNS_FIX=1 */
function applyDevWindowsMongoDnsFix() {
  if (process.env.SKYNET_DISABLE_DNS_FIX === '1') return;
  if (process.platform !== 'win32') return;
  if ((process.env.NODE_ENV || 'development') === 'production') return;
  try {
    const custom = process.env.SKYNET_DNS_SERVERS;
    dns.setServers(
      custom
        ? custom.split(',').map((s) => s.trim()).filter(Boolean)
        : ['8.8.8.8', '8.8.4.4', '1.1.1.1']
    );
  } catch (_) {
    /* ignore */
  }
}

applyDevWindowsMongoDnsFix();

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
