// VERSION: v1.3.0 | DATE: 2026-04-23 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.3.0 - Leituras unificadas: tema_certificados + curso_certificados + cursos_certificados (legado); dedupe por certificateId / _id; prioridade à coleção nova
// CHANGELOG: v1.2.0 - (histórico)
const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

// Connection string do MongoDB - usando helper centralizado
const { getMongoUri } = require('../config/mongodb');
const DATABASE_NAME = process.env.ACADEMY_REGISTROS_DB || 'academy_registros';

/** Ordem de prioridade na deduplicação: registros em tema_certificados prevalecem sobre legados. */
const CERTIFICADOS_COLLECTIONS = [
  'tema_certificados',
  'curso_certificados',
  'cursos_certificados',
];

function buildSort(sortBy, sortOrder) {
  const sort = {};
  if (sortBy) {
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
  } else {
    sort.createdAt = -1;
  }
  return sort;
}

function mergeCertificadosDocs(arraysInPriorityOrder) {
  const seenCert = new Set();
  const seenOid = new Set();
  const out = [];
  for (const arr of arraysInPriorityOrder) {
    for (const doc of arr) {
      const cid =
        doc.certificateId != null && String(doc.certificateId).trim() !== ''
          ? String(doc.certificateId).trim()
          : null;
      if (cid) {
        if (seenCert.has(cid)) continue;
        seenCert.add(cid);
        out.push(doc);
        continue;
      }
      const oid = doc._id ? doc._id.toString() : null;
      if (oid) {
        if (seenOid.has(oid)) continue;
        seenOid.add(oid);
      }
      out.push(doc);
    }
  }
  return out;
}

function sortMergedDocuments(docs, sortBy, sortOrder) {
  const key = sortBy || 'createdAt';
  const asc = sortOrder === 'asc';
  docs.sort((a, b) => {
    let va = a[key];
    let vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const ta = new Date(va).getTime();
    const tb = new Date(vb).getTime();
    const dateLike =
      !Number.isNaN(ta) &&
      !Number.isNaN(tb) &&
      (va instanceof Date || vb instanceof Date || (typeof va === 'string' && typeof vb === 'string'));
    if (dateLike && !Number.isNaN(ta) && !Number.isNaN(tb)) {
      return asc ? ta - tb : tb - ta;
    }
    if (typeof va === 'number' && typeof vb === 'number') {
      return asc ? va - vb : vb - va;
    }
    const c = String(va).localeCompare(String(vb));
    return asc ? c : -c;
  });
}

async function listCertificadosMerged(db, filter, sortBy, sortOrder, limit, skip) {
  const sort = buildSort(sortBy, sortOrder);
  const perCollection = await Promise.all(
    CERTIFICADOS_COLLECTIONS.map((name) => db.collection(name).find(filter).sort(sort).toArray()),
  );
  const merged = mergeCertificadosDocs(perCollection);
  sortMergedDocuments(merged, sortBy, sortOrder);
  const total = merged.length;
  const lim = limit != null ? parseInt(limit, 10) : null;
  const sk = skip != null ? parseInt(skip, 10) : 0;
  const sliced =
    lim != null && !Number.isNaN(lim) ? merged.slice(sk, sk + lim) : sk > 0 ? merged.slice(sk) : merged;
  return { certificados: sliced, total };
}

async function findCertificadoById(db, id) {
  if (!ObjectId.isValid(id)) return null;
  const oid = new ObjectId(id);
  for (const name of CERTIFICADOS_COLLECTIONS) {
    const doc = await db.collection(name).findOne({ _id: oid });
    if (doc) return doc;
  }
  return null;
}

// GET /api/mongodb/certificados - Listar todos os certificados
router.get('/', async (req, res) => {
  let client;

  try {
    global.emitTraffic('Certificados', 'received', 'Entrada recebida - GET /api/mongodb/certificados');
    global.emitLog('info', 'GET /api/mongodb/certificados - Listando todos os certificados');

    // Query params opcionais
    const { email, courseName, courseId, limit, skip, sortBy, sortOrder } = req.query;

    global.emitTraffic('Certificados', 'processing', 'Conectando ao MongoDB');

    const MONGODB_URI = getMongoUri();
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    const db = client.db(DATABASE_NAME);

    // Construir query de filtro
    const filter = {};
    if (email) filter.email = email.toLowerCase().trim();
    if (courseName) filter.courseName = { $regex: courseName, $options: 'i' };
    if (courseId) filter.courseId = courseId;

    global.emitTraffic('Certificados', 'processing', 'Consultando certificados (coleções unificadas)');
    const { certificados, total } = await listCertificadosMerged(db, filter, sortBy, sortOrder, limit, skip);

    global.emitTraffic('Certificados', 'completed', `Concluído - ${certificados.length} certificados encontrados`);
    global.emitLog('success', `GET /api/mongodb/certificados - ${certificados.length} certificados encontrados`);

    const response = {
      success: true,
      data: certificados,
      count: certificados.length,
      total: total,
    };

    global.emitJsonInput(response);
    res.json(response);
  } catch (error) {
    global.emitTraffic('Certificados', 'error', `Erro ao listar certificados: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/certificados - Erro: ${error.message}`);
    console.error('Erro ao listar certificados:', error);

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao listar certificados',
      message: error.message,
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Erro ao fechar conexão MongoDB:', closeError);
      }
    }
  }
});

// GET /api/mongodb/certificados/email/:email - Buscar certificados por email (deve vir antes de /:id)
router.get('/email/:email', async (req, res) => {
  let client;

  try {
    const { email } = req.params;

    global.emitTraffic('Certificados', 'received', `Entrada recebida - GET /api/mongodb/certificados/email/${email}`);
    global.emitLog('info', `GET /api/mongodb/certificados/email/${email} - Buscando certificados por email`);

    global.emitTraffic('Certificados', 'processing', 'Conectando ao MongoDB');

    const MONGODB_URI = getMongoUri();
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    const db = client.db(DATABASE_NAME);

    const filter = { email: email.toLowerCase().trim() };

    global.emitTraffic('Certificados', 'processing', 'Consultando certificados por email');
    const { certificados, total } = await listCertificadosMerged(db, filter, null, null, null, null);

    global.emitTraffic('Certificados', 'completed', `Concluído - ${certificados.length} certificados encontrados`);
    global.emitLog('success', `GET /api/mongodb/certificados/email/${email} - ${certificados.length} certificados encontrados`);

    const response = {
      success: true,
      data: certificados,
      count: certificados.length,
      total: total,
    };

    global.emitJsonInput(response);
    res.json(response);
  } catch (error) {
    global.emitTraffic('Certificados', 'error', `Erro ao buscar certificados por email: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/certificados/email/:email - Erro: ${error.message}`);
    console.error('Erro ao buscar certificados por email:', error);

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao buscar certificados',
      message: error.message,
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Erro ao fechar conexão MongoDB:', closeError);
      }
    }
  }
});

// GET /api/mongodb/certificados/course/:courseName - Buscar certificados por nome do curso (deve vir antes de /:id)
router.get('/course/:courseName', async (req, res) => {
  let client;

  try {
    const { courseName } = req.params;

    global.emitTraffic('Certificados', 'received', `Entrada recebida - GET /api/mongodb/certificados/course/${courseName}`);
    global.emitLog('info', `GET /api/mongodb/certificados/course/${courseName} - Buscando certificados por curso`);

    global.emitTraffic('Certificados', 'processing', 'Conectando ao MongoDB');

    const MONGODB_URI = getMongoUri();
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    const db = client.db(DATABASE_NAME);

    const filter = { courseName: { $regex: courseName, $options: 'i' } };

    global.emitTraffic('Certificados', 'processing', 'Consultando certificados por curso');
    const { certificados, total } = await listCertificadosMerged(db, filter, null, null, null, null);

    global.emitTraffic('Certificados', 'completed', `Concluído - ${certificados.length} certificados encontrados`);
    global.emitLog('success', `GET /api/mongodb/certificados/course/${courseName} - ${certificados.length} certificados encontrados`);

    const response = {
      success: true,
      data: certificados,
      count: certificados.length,
      total: total,
    };

    global.emitJsonInput(response);
    res.json(response);
  } catch (error) {
    global.emitTraffic('Certificados', 'error', `Erro ao buscar certificados por curso: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/certificados/course/:courseName - Erro: ${error.message}`);
    console.error('Erro ao buscar certificados por curso:', error);

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao buscar certificados',
      message: error.message,
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Erro ao fechar conexão MongoDB:', closeError);
      }
    }
  }
});

// GET /api/mongodb/certificados/:id - Buscar certificado por ID (deve vir por último)
router.get('/:id', async (req, res) => {
  let client;

  try {
    const { id } = req.params;

    global.emitTraffic('Certificados', 'received', `Entrada recebida - GET /api/mongodb/certificados/${id}`);
    global.emitLog('info', `GET /api/mongodb/certificados/${id} - Buscando certificado por ID`);

    global.emitTraffic('Certificados', 'processing', 'Conectando ao MongoDB');

    const MONGODB_URI = getMongoUri();
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    const db = client.db(DATABASE_NAME);

    if (!ObjectId.isValid(id)) {
      global.emitTraffic('Certificados', 'error', 'ID inválido');
      global.emitLog('error', `GET /api/mongodb/certificados/${id} - ID inválido`);
      return res.status(400).json({
        success: false,
        error: 'ID inválido',
      });
    }

    global.emitTraffic('Certificados', 'processing', 'Consultando certificado');
    const certificado = await findCertificadoById(db, id);

    if (!certificado) {
      global.emitTraffic('Certificados', 'error', 'Certificado não encontrado');
      global.emitLog('error', `GET /api/mongodb/certificados/${id} - Certificado não encontrado`);
      return res.status(404).json({
        success: false,
        error: 'Certificado não encontrado',
      });
    }

    global.emitTraffic('Certificados', 'completed', 'Concluído - Certificado encontrado');
    global.emitLog('success', `GET /api/mongodb/certificados/${id} - Certificado encontrado`);

    const response = {
      success: true,
      data: certificado,
    };

    global.emitJsonInput(response);
    res.json(response);
  } catch (error) {
    global.emitTraffic('Certificados', 'error', `Erro ao buscar certificado: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/certificados/:id - Erro: ${error.message}`);
    console.error('Erro ao buscar certificado:', error);

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao buscar certificado',
      message: error.message,
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Erro ao fechar conexão MongoDB:', closeError);
      }
    }
  }
});

module.exports = router;
