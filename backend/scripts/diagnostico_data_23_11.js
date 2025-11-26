/**
 * Script de Diagnóstico - Data 23/11/2025
 * Verifica ocorrências na collection user_activity para a data 23/11/2025
 */

const mongoose = require('mongoose');
const UserActivity = require('../models/UserActivity');

// Conectar ao MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';

async function diagnosticarData2311() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    // Verificar qual é o ano atual e ajustar busca
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    console.log(`📅 Ano atual detectado: ${anoAtual}\n`);

    // Definir range para 23/11 (domingo) - usar ano atual
    // Considerar timezone: 23/11 00:00:00 até 23/11 23:59:59 (horário local Brasil)
    // Brasil está em UTC-3, então:
    // 23/11 00:00:00 BRT = 23/11 03:00:00 UTC
    // 23/11 23:59:59 BRT = 24/11 02:59:59 UTC
    
    const inicioBRT = new Date(`${anoAtual}-11-23T00:00:00-03:00`); // 23/11 00:00 BRT
    const fimBRT = new Date(`${anoAtual}-11-23T23:59:59-03:00`); // 23/11 23:59 BRT
    
    console.log('📅 Buscando atividades para 23/11/2025 (domingo)');
    console.log(`   Início (BRT): ${inicioBRT.toISOString()}`);
    console.log(`   Fim (BRT): ${fimBRT.toISOString()}`);
    console.log(`   Início (UTC): ${inicioBRT.toUTCString()}`);
    console.log(`   Fim (UTC): ${fimBRT.toUTCString()}\n`);

    // Buscar atividades no período
    const atividades = await UserActivity.find({
      createdAt: {
        $gte: inicioBRT,
        $lte: fimBRT
      }
    }).lean();

    console.log(`📊 Total de atividades encontradas: ${atividades.length}\n`);

    if (atividades.length > 0) {
      console.log('⚠️ ATENÇÃO: Foram encontradas atividades em um domingo!');
      console.log('\nPrimeiras 10 atividades:');
      atividades.slice(0, 10).forEach((activity, index) => {
        const createdAt = new Date(activity.createdAt);
        console.log(`\n${index + 1}. ID: ${activity._id}`);
        console.log(`   createdAt (UTC): ${createdAt.toISOString()}`);
        console.log(`   createdAt (BRT): ${createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
        console.log(`   Action: ${activity.action}`);
        console.log(`   UserId: ${activity.userId || 'N/A'}`);
      });
    } else {
      console.log('✅ Nenhuma atividade encontrada para 23/11/2025 - CORRETO!\n');
    }

    // Agora verificar o que acontece quando usamos toISOString().split('T')[0]
    console.log('\n🔍 TESTE: Como o código atual processa datas\n');
    
    // Simular algumas datas que podem estar causando problema
    const datasTeste = [
      new Date('2025-11-24T00:30:00-03:00'), // 24/11 00:30 BRT = 23/11 21:30 UTC
      new Date('2025-11-24T01:00:00-03:00'), // 24/11 01:00 BRT = 23/11 22:00 UTC
      new Date('2025-11-24T02:00:00-03:00'), // 24/11 02:00 BRT = 23/11 23:00 UTC
      new Date('2025-11-24T03:00:00-03:00'), // 24/11 03:00 BRT = 24/11 00:00 UTC
    ];

    datasTeste.forEach((data, index) => {
      const chaveISO = data.toISOString().split('T')[0];
      const chaveBRT = data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
      
      console.log(`Teste ${index + 1}:`);
      console.log(`   Data original: ${data.toISOString()}`);
      console.log(`   Data local (BRT): ${data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      console.log(`   Chave ISO (toISOString): ${chaveISO} ⚠️ PROBLEMA AQUI`);
      console.log(`   Chave BRT (correta): ${chaveBRT}`);
      console.log('');
    });

    // Verificar atividades próximas ao período (24/11 início do dia)
    console.log('\n🔍 Verificando atividades do dia 24/11 que podem estar sendo agrupadas como 23/11\n');
    
    const inicio24BRT = new Date(`${anoAtual}-11-24T00:00:00-03:00`);
    const fim24BRT = new Date(`${anoAtual}-11-24T03:00:00-03:00`); // Primeiras 3 horas do dia 24
    
    const atividades24Inicio = await UserActivity.find({
      createdAt: {
        $gte: inicio24BRT,
        $lte: fim24BRT
      }
    }).lean();

    console.log(`📊 Atividades encontradas entre 24/11 00:00 e 24/11 03:00 BRT: ${atividades24Inicio.length}`);
    
    if (atividades24Inicio.length > 0) {
      console.log('\n⚠️ PROBLEMA IDENTIFICADO:');
      console.log('Atividades do início do dia 24/11 estão sendo agrupadas como 23/11 devido ao timezone!\n');
      
      atividades24Inicio.slice(0, 5).forEach((activity, index) => {
        const createdAt = new Date(activity.createdAt);
        const chaveISO = createdAt.toISOString().split('T')[0];
        const chaveBRT = createdAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
        
        console.log(`${index + 1}. createdAt: ${createdAt.toISOString()}`);
        console.log(`   Data local: ${createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
        console.log(`   Chave ISO (ERRADA): ${chaveISO}`);
        console.log(`   Chave BRT (CORRETA): ${chaveBRT}`);
        console.log('');
      });
    }

    // Verificar últimas atividades no banco para entender o período real
    console.log('\n🔍 Verificando últimas 10 atividades no banco para entender período real\n');
    const ultimasAtividades = await UserActivity.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    if (ultimasAtividades.length > 0) {
      console.log(`📊 Últimas ${ultimasAtividades.length} atividades encontradas:\n`);
      ultimasAtividades.forEach((activity, index) => {
        const createdAt = new Date(activity.createdAt);
        console.log(`${index + 1}. createdAt: ${createdAt.toISOString()}`);
        console.log(`   Data local (BRT): ${createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
        console.log(`   Action: ${activity.action || 'N/A'}\n`);
      });
    } else {
      console.log('⚠️ Nenhuma atividade encontrada no banco!\n');
    }

    // Verificar TODAS as atividades próximas ao período (20/11 a 30/11) para identificar o problema
    // Tentar tanto 2024 quanto 2025
    console.log('\n🔍 Verificando atividades dos dias 20/11 a 30/11 (2024 e 2025) para identificar agrupamento incorreto\n');
    
    const inicioPeriodo2024 = new Date('2024-11-20T00:00:00-03:00');
    const fimPeriodo2024 = new Date('2024-11-30T23:59:59-03:00');
    const inicioPeriodo2025 = new Date('2025-11-20T00:00:00-03:00');
    const fimPeriodo2025 = new Date('2025-11-30T23:59:59-03:00');
    
    const [todasAtividades2024, todasAtividades2025] = await Promise.all([
      UserActivity.find({
        createdAt: {
          $gte: inicioPeriodo2024,
          $lte: fimPeriodo2024
        }
      }).sort({ createdAt: 1 }).lean(),
      UserActivity.find({
        createdAt: {
          $gte: inicioPeriodo2025,
          $lte: fimPeriodo2025
        }
      }).sort({ createdAt: 1 }).lean()
    ]);

    const todasAtividades = [...todasAtividades2024, ...todasAtividades2025];

    console.log(`📊 Total de atividades encontradas entre 20/11 e 30/11 (2024 e 2025): ${todasAtividades.length}\n`);

    if (todasAtividades.length > 0) {
      console.log('Analisando como cada atividade seria agrupada:\n');
      
      const agrupamentoISO = {};
      const agrupamentoBRT = {};
      
      todasAtividades.forEach((activity) => {
        const createdAt = new Date(activity.createdAt);
        
        // Método ANTIGO (ISO/UTC)
        const chaveISO = createdAt.toISOString().split('T')[0];
        agrupamentoISO[chaveISO] = (agrupamentoISO[chaveISO] || 0) + 1;
        
        // Método NOVO (BRT)
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const partesBRT = formatter.formatToParts(createdAt);
        const anoBRT = partesBRT.find(p => p.type === 'year').value;
        const mesBRT = partesBRT.find(p => p.type === 'month').value;
        const diaBRT = partesBRT.find(p => p.type === 'day').value;
        const chaveBRT = `${anoBRT}-${mesBRT}-${diaBRT}`;
        agrupamentoBRT[chaveBRT] = (agrupamentoBRT[chaveBRT] || 0) + 1;
      });

      console.log('📊 Agrupamento usando método ANTIGO (ISO/UTC):');
      Object.keys(agrupamentoISO).sort().forEach(data => {
        console.log(`   ${data}: ${agrupamentoISO[data]} atividades`);
      });

      console.log('\n📊 Agrupamento usando método NOVO (BRT):');
      Object.keys(agrupamentoBRT).sort().forEach(data => {
        console.log(`   ${data}: ${agrupamentoBRT[data]} atividades`);
      });

      // Verificar se há diferença
      if (agrupamentoISO['2025-11-23'] && agrupamentoISO['2025-11-23'] > 0) {
        console.log('\n⚠️ PROBLEMA CONFIRMADO:');
        console.log(`   Método ANTIGO agrupa ${agrupamentoISO['2025-11-23']} atividades como 23/11`);
        if (!agrupamentoBRT['2025-11-23'] || agrupamentoBRT['2025-11-23'] === 0) {
          console.log(`   Método NOVO não agrupa nenhuma atividade como 23/11 ✅`);
          console.log(`   Isso confirma que as atividades são de outros dias mas foram agrupadas incorretamente!`);
        }
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Diagnóstico concluído');
    
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    process.exit(1);
  }
}

diagnosticarData2311();

