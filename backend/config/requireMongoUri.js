// VERSION: v1.0.0 | DATE: 2026-04-23 | AUTHOR: VeloHub Development Team
// URI Mongo apenas via ambiente (MONGO_ENV ou MONGODB_URI); sem fallback hardcoded.

function requireMongoUri() {
  const u = process.env.MONGO_ENV || process.env.MONGODB_URI;
  if (!u || !String(u).trim()) {
    console.error('❌ Defina MONGO_ENV ou MONGODB_URI (GCP Secret / FONTE DA VERDADE/.env).');
    process.exit(1);
  }
  return u.trim();
}

module.exports = { requireMongoUri };
