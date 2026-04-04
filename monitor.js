const fs = require('fs');
const nodemailer = require('nodemailer');

const EMAIL_DESTINO = process.env.EMAIL_DESTINO;
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE;
const EMAIL_SENHA = process.env.EMAIL_SENHA;
const ARQUIVO_ESTADO = 'estado.json';
const API_BASE = 'https://albalegis.nopapercloud.com.br/api/publico';

function carregarEstado() {
  if (fs.existsSync(ARQUIVO_ESTADO)) {
    return JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
  }
  return { proposicoes_vistas: [], ultima_execucao: '' };
}

function salvarEstado(estado) {
  fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado, null, 2));
}

async function enviarEmail(novas) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_REMETENTE, pass: EMAIL_SENHA },
  });

  const porTipo = {};
  novas.forEach(p => {
    const tipo = p.tipo || 'OUTROS';
    if (!porTipo[tipo]) porTipo[tipo] = [];
    porTipo[tipo].push(p);
  });

  const linhas = Object.keys(porTipo).sort().map(tipo => {
    const header = `<tr><td colspan="4" style="padding:10px 8px 4px;background:#f0f4f8;font-weight:bold;color:#1a3a5c;font-size:13px;border-top:2px solid #1a3a5c">${tipo} — ${porTipo[tipo].length} proposição(ões)</td></tr>`;
    const rows = porTipo[tipo].map(p => {
      const link = p.arquivo
        ? `<a href="${p.arquivo}" style="color:#1a3a5c;text-decoration:none" target="_blank">${p.numero}/${p.ano}</a>`
        : `${p.numero}/${p.ano}`;
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee"><strong>${link}</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${p.autor}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;white-space:nowrap">${p.data}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${p.ementa}</td>
      </tr>`;
    }).join('');
    return header + rows;
  }).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto">
      <h2 style="color:#1a3a5c;border-bottom:2px solid #1a3a5c;padding-bottom:8px">
        🏛️ ALBA — ${novas.length} nova(s) proposição(ões)
      </h2>
      <p style="color:#666">Monitoramento automático — ${new Date().toLocaleString('pt-BR')}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#1a3a5c;color:white">
            <th style="padding:10px;text-align:left">Número/Ano</th>
            <th style="padding:10px;text-align:left">Autor</th>
            <th style="padding:10px;text-align:left">Data</th>
            <th style="padding:10px;text-align:left">Assunto</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#999">
        Acesse: <a href="https://albalegis.nopapercloud.com.br/spl/">albalegis.nopapercloud.com.br/spl</a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Monitor ALBA" <${EMAIL_REMETENTE}>`,
    to: EMAIL_DESTINO,
    subject: `🏛️ ALBA: ${novas.length} nova(s) proposição(ões) — ${new Date().toLocaleDateString('pt-BR')}`,
    html,
  });

  console.log(`✅ Email enviado com ${novas.length} proposições novas.`);
}

async function buscarProposicoes() {
  const ano = new Date().getFullYear();
  const url = `${API_BASE}/proposicao/?pg=1&qtd=100&ano=${ano}`;
  console.log(`🔍 Buscando proposições de ${ano}...`);
  console.log(`   URL: ${url}`);

  let response;
  try {
    response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  } catch (err) {
    console.error(`❌ Erro de conexão: ${err.message}`);
    return [];
  }

  if (!response.ok) {
    console.error(`❌ API retornou ${response.status} — instabilidade no servidor da ALBA.`);
    console.error('   Nenhuma ação necessária. O monitor vai tentar novamente na próxima execução.');
    return [];
  }

  let json;
  try {
    json = await response.json();
  } catch (err) {
    console.error(`❌ Resposta não é JSON válido: ${err.message}`);
    return [];
  }

  if (!Array.isArray(json.Data)) {
    console.error('❌ Estrutura inesperada — campo Data ausente ou não é array.');
    console.error('   Amostra:', JSON.stringify(json).substring(0, 200));
    return [];
  }

  console.log(`📊 Total na API: ${json.total} proposições (paginação limitada a 100/página)`);
  console.log(`📦 ${json.Data.length} proposições recebidas neste run`);
  return json.Data;
}

function normalizarProposicao(p) {
  const autor = p.AutorRequerenteDados?.nomeRazao || '-';
  const dataCompleta = p.data || '-';
  const data = dataCompleta.includes(' ') ? dataCompleta.split(' ')[0] : dataCompleta;

  return {
    id: String(p.id),
    tipo: p.sigla || p.tipo || '-',
    numero: p.numero || p.processo || '-',
    ano: p.ano || String(new Date().getFullYear()),
    autor: autor.length > 40 ? autor.substring(0, 40) + '…' : autor,
    data,
    ementa: (p.assunto || '-').substring(0, 200),
    arquivo: p.arquivo || null,
  };
}

(async () => {
  console.log('🚀 Iniciando monitor ALBA (Bahia)...');
  console.log(`⏰ ${new Date().toLocaleString('pt-BR')}`);

  const estado = carregarEstado();
  const idsVistos = new Set(estado.proposicoes_vistas.map(String));

  const proposicoesRaw = await buscarProposicoes();

  if (proposicoesRaw.length === 0) {
    console.log('⚠️ Nenhuma proposição retornada. Encerrando sem alterar estado.');
    process.exit(0);
  }

  const proposicoes = proposicoesRaw.map(normalizarProposicao).filter(p => p.id);
  const novas = proposicoes.filter(p => !idsVistos.has(p.id));
  console.log(`🆕 Proposições novas: ${novas.length}`);

  const primeiroRun = estado.proposicoes_vistas.length === 0;

  if (novas.length > 0) {
    if (primeiroRun) {
      console.log(`⚙️ Primeiro run — salvando ${novas.length} proposição(ões) no estado sem enviar email.`);
    } else {
      novas.sort((a, b) => {
        if (a.tipo < b.tipo) return -1;
        if (a.tipo > b.tipo) return 1;
        return (parseInt(b.numero) || 0) - (parseInt(a.numero) || 0);
      });
      await enviarEmail(novas);
    }
    novas.forEach(p => idsVistos.add(p.id));
    estado.proposicoes_vistas = Array.from(idsVistos);
  } else {
    console.log('✅ Sem novidades. Nada a enviar.');
  }

  estado.ultima_execucao = new Date().toISOString();
  salvarEstado(estado);
})();
