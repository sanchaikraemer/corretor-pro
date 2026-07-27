import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

// v1025 — o dono relatou: "gerei proposta e salvei no lead, porem nao esta abrindo ela na linha
// de tempo, e isso ja funcionava antes". Investigando: o backend sempre guardou certinho o
// snapshot da proposta (itemManual.proposta em api/reanalisar-lead.js) e o devolve pro navegador
// (recentMessages[].proposta em api/_persistence.js) — e js/proposta.js sempre teve a função
// abrirPropostaSalva(leadId, nome, dados) pronta pra reabrir e editar. O que faltava (em toda a
// história do projeto — não foi este chat que quebrou) era a própria linha "Proposta gerada..."
// dentro de "Últimas mensagens" (cp704TimelineHtml) chamar essa função ao ser tocada: ela sempre
// caiu no ramo genérico de mensagem comum, sem nenhum onclick.

// ===== Parte A — cp704TimelineHtml reconhece o tipo "proposta" e vira clicável =====
{
  const fnMatch = app.match(/function cp704TimelineHtml\(lead\)\{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, 'cp704TimelineHtml não encontrada em app.js');
  const fn = fnMatch[0];

  assert.match(fn, /tipo==='proposta'\s*&&\s*m\.proposta/, 'precisa detectar mensagens do tipo proposta que tenham o snapshot salvo');
  assert.match(fn, /who='Proposta'/, 'proposta precisa de rótulo próprio no histórico');
  assert.match(fn, /dotCls='prop'/, 'proposta precisa de marcador visual próprio');
  assert.match(fn, /cp704-tmsg-prop/, 'proposta precisa de classe CSS própria (clicável)');
  assert.match(fn, /onclick='cp704AbrirPropostaSalva\(/, 'a linha da proposta precisa chamar o abridor ao ser clicada');
  assert.match(fn, /\$\{propAttr\}/, 'o onclick precisa estar de fato dentro da div renderizada, não só calculado e descartado');
  // Sem snapshot (m.proposta ausente/antigo), não pode virar "clicável" oferecendo algo que não existe.
  assert.match(fn, /if\(tipo==='proposta' && m\.proposta\)\{/, 'só vira clicável quando o snapshot realmente existe');

  console.log('v1025 (timeline reconhece proposta): ok');
}

// ===== Parte B — window.cp704AbrirPropostaSalva localiza o snapshot certo e delega pro abridor =====
{
  const ini = app.indexOf('window.cp704AbrirPropostaSalva = function(leadId, iso){');
  assert.ok(ini > -1, 'window.cp704AbrirPropostaSalva não encontrada em app.js');
  const fim = app.indexOf('\n  };', ini);
  assert.ok(fim > ini, 'não achei o fim de cp704AbrirPropostaSalva');
  const src = app.slice(ini, fim + 5);

  const chamadasToast = [];
  const chamadasAbrir = [];
  const sandbox = {
    prop: null,
    state: { lead: null },
    toast: (msg) => { chamadasToast.push(msg); },
    cp704Text: (v, fallback='') => String(v == null ? fallback : v).trim(),
    window: { abrirPropostaSalva: (leadId, nome, dados) => { chamadasAbrir.push({ leadId, nome, dados }); } }
  };
  const fnSandbox = new Function('state', 'toast', 'cp704Text', 'window', `
    ${src}
    return window.cp704AbrirPropostaSalva;
  `);
  const cp704AbrirPropostaSalva = fnSandbox(sandbox.state, sandbox.toast, sandbox.cp704Text, sandbox.window);

  // 1. Lead certo + iso certo + snapshot presente -> delega pro abridor real com os dados certos.
  const dadosSnapshot = { 'pf-cliente': 'Fulano', 'pf-empreendimento': 'Residencial X' };
  sandbox.state.lead = {
    id: 'lead-1',
    name: 'Fulano de Tal',
    recentMessages: [
      { iso: '2026-07-20T10:00:00.000Z', type: 'proposta', text: 'Proposta gerada — X', proposta: dadosSnapshot },
      { iso: '2026-07-21T10:00:00.000Z', type: 'atendimento', text: 'Ligou de novo' }
    ]
  };
  cp704AbrirPropostaSalva('lead-1', '2026-07-20T10:00:00.000Z');
  assert.equal(chamadasAbrir.length, 1, 'precisa delegar pro abridor real quando acha o snapshot');
  assert.equal(chamadasAbrir[0].leadId, 'lead-1');
  assert.equal(chamadasAbrir[0].nome, 'Fulano de Tal');
  assert.deepEqual(chamadasAbrir[0].dados, dadosSnapshot, 'precisa passar o snapshot EXATO salvo naquela proposta, não outro');
  assert.equal(chamadasToast.length, 0, 'não pode avisar erro quando dá certo');

  // 2. iso que não bate com nenhuma proposta salva -> avisa, não quebra, não abre nada.
  chamadasAbrir.length = 0; chamadasToast.length = 0;
  cp704AbrirPropostaSalva('lead-1', '2026-01-01T00:00:00.000Z');
  assert.equal(chamadasAbrir.length, 0, 'sem snapshot correspondente não pode chamar o abridor');
  assert.equal(chamadasToast.length, 1, 'precisa avisar que não achou a proposta');

  // 3. leadId não bate com o lead atualmente aberto -> mesma rede de segurança.
  chamadasAbrir.length = 0; chamadasToast.length = 0;
  cp704AbrirPropostaSalva('lead-outro', '2026-07-20T10:00:00.000Z');
  assert.equal(chamadasAbrir.length, 0, 'lead errado não pode reabrir proposta de outro lead');
  assert.equal(chamadasToast.length, 1, 'precisa avisar quando o lead não bate');

  console.log('v1025 (cp704AbrirPropostaSalva): acha o snapshot certo pelo iso e delega pro abridor real — ok');
}

// ===== Parte C — CSS do card de proposta na timeline existe =====
{
  assert.match(app, /\.cp704-dot\.prop\{background:var\(--accent\)\}/, 'precisa existir a cor do marcador da proposta');
  assert.match(app, /\.cp704-tmsg-prop\{cursor:pointer\}/, 'precisa existir o cursor de "clicável" na proposta');
  console.log('v1025 (CSS): marcador e cursor da proposta na timeline — ok');
}

// ===== Parte D — a ponte com o backend continua intacta (snapshot chega até o navegador) =====
{
  assert.match(persistence, /proposta:\s*m\?\.proposta\s*\|\|\s*null/, 'recentMessages precisa continuar devolvendo o snapshot da proposta pro navegador');
  console.log('v1025 (backend): recentMessages ainda devolve o snapshot da proposta — ok');
}

console.log('v1025-proposta-salva-abre-na-timeline: ok');
