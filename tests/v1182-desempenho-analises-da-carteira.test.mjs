import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1182 — o dono mandou o print do Desempenho em julho: 696 mensagens trocadas, 159 leads
// atendidos, 73 mensagens copiadas... e "Análises feitas 0 / Importações 0". Essas duas linhas
// eram lidas SÓ do registro de uso guardado no próprio aparelho, que não sincroniza e é podado em
// 90 dias — no print, "Tempo no app: menos de 1min" em julho denuncia que aquele aparelho não
// tinha histórico local nenhum. Agora as duas também são deduzidas da carteira (sincronizada).

const DIA = 86400000;
const MIN = 60000;

function montar({ atividadeLocal = () => 0, inicioMes = 0 } = {}) {
  // v1340 — cpDesempenhoMetricas passou a chamar cpResultadoDasSugestoes (medição de "as sugestões
  // estão funcionando?"), que usa cpMensagemEhDoCliente. As três vêm juntas.
  const fonte = [
    app.match(/function cpMensagemEhDoCliente\(l, m\)\{[\s\S]*?\n\}/)[0],
    app.match(/function cpResultadoDasSugestoes\(todos, dentro\)\{[\s\S]*?\n\}/)[0],
    app.match(/function cpDesempenhoMetricas\(items, all, periodo\)\{[\s\S]*?\n\}/)[0]
  ].join("\n");
  globalThis.__atividadeLocal = atividadeLocal;
  return eval(`
    const cpInicioMesMs = () => ${inicioMes};
    const cpContarAtividade = (chave, desde, ate) => globalThis.__atividadeLocal(chave, desde, ate);
    const cpTempoAppSegundosHoje = () => 0;
    const cpTempoAppMediaSegundos7d = () => 0;
    const produtosLabel = () => "";
    const cpNomeCorretorCerebro = () => "";
    ${fonte}
    ({ cpDesempenhoMetricas });
  `).cpDesempenhoMetricas;
}

const agora = Date.now();
const iniMesAtual = agora - 10 * DIA;          // simula: estamos no dia 10 do mês
const iniMesPassado = iniMesAtual - 30 * DIA;  // "julho"
const mesPassado = { ini: iniMesPassado, fim: iniMesAtual };
const iso = (ms) => new Date(ms).toISOString();

// ── 1. Aparelho sem histórico local: a carteira sustenta os dois números ──────────────────────
{
  const cpDesempenhoMetricas = montar({ inicioMes: iniMesAtual }); // registro local zerado (aparelho novo/reinstalado)
  const emJulho = (dias) => iso(iniMesPassado + dias * DIA);
  const leads = [
    // importada e analisada em julho (geradoEm + reanalisadoEm no mesmo minuto = 1 análise só)
    { id: 'a', createdAt: emJulho(2), analysis: { geradoEm: emJulho(2), reanalisadoEm: iso(iniMesPassado + 2 * DIA + 30000) } },
    { id: 'b', createdAt: emJulho(5), analysis: { geradoEm: emJulho(5), reanalisadoEm: emJulho(5) } },
    // importada em julho e reanalisada de novo dias depois: 2 análises em julho, 1 importação
    { id: 'c', createdAt: emJulho(7), analysis: { geradoEm: emJulho(7), reanalisadoEm: emJulho(9) } },
    // importada em junho e reanalisada em julho: 1 análise em julho, nenhuma importação de julho
    { id: 'd', createdAt: iso(iniMesPassado - 12 * DIA), analysis: { geradoEm: iso(iniMesPassado - 12 * DIA), reanalisadoEm: emJulho(4) } },
    // deste mês: não pode vazar pra julho
    { id: 'e', createdAt: iso(iniMesAtual + 1 * DIA), analysis: { geradoEm: iso(iniMesAtual + 1 * DIA) } }
  ];

  const julho = cpDesempenhoMetricas(leads, leads, mesPassado);
  assert.equal(julho.importacoes, 3, 'julho teve 3 cadastros criados = 3 importações');
  assert.equal(julho.analisesFeitas, 5, 'julho teve 5 análises (a, b, c duas vezes, d reanalisado)');

  const esteMes = cpDesempenhoMetricas(leads, leads, null);
  assert.equal(esteMes.importacoes, 1, 'só o lead deste mês conta como importação do mês corrente');
  assert.equal(esteMes.analisesFeitas, 1, 'só a análise deste mês conta no mês corrente');
}

// ── 2. Quem sempre usou o mesmo aparelho não perde nada: vale o MAIOR dos dois ─────────────────
{
  // O registro local conta o que a carteira não sabe (reanálise repetida, reimportação que não
  // cria cadastro novo). Quando ele é maior, é ele que aparece.
  const cpDesempenhoMetricas = montar({ inicioMes: iniMesAtual, atividadeLocal: (chave) => (chave === 'importacao' ? 90 : 40) });
  const leads = [{ id: 'a', createdAt: iso(iniMesPassado + 3 * DIA), analysis: { geradoEm: iso(iniMesPassado + 3 * DIA) } }];
  const julho = cpDesempenhoMetricas(leads, leads, mesPassado);
  assert.equal(julho.importacoes, 90, 'o registro do aparelho, quando é maior, continua valendo');
  assert.equal(julho.analisesFeitas, 40, 'idem para as análises');
}

// ── 3. Carimbos do mesmo instante não viram duas análises ─────────────────────────────────────
{
  const cpDesempenhoMetricas = montar({ inicioMes: iniMesAtual });
  const base = iniMesPassado + 6 * DIA;
  const leads = [{
    id: 'a',
    createdAt: iso(base),
    analysis: {
      geradoEm: iso(base),
      analisadoEm: iso(base + 2 * MIN),
      reanalisadoEm: iso(base + 4 * MIN),
      iaComercialV2: { geradoEm: iso(base + 1 * MIN) }
    },
    analysisReadyAt: iso(base + 3 * MIN)
  }];
  const julho = cpDesempenhoMetricas(leads, leads, mesPassado);
  assert.equal(julho.analisesFeitas, 1, 'cinco carimbos da MESMA análise contam como uma só');
}

// ── 4. Lead sem data nenhuma não quebra nem inventa número ────────────────────────────────────
{
  const cpDesempenhoMetricas = montar({ inicioMes: iniMesAtual });
  const leads = [{ id: 'a' }, { id: 'b', createdAt: null, analysis: null }, null];
  const julho = cpDesempenhoMetricas(leads.filter(Boolean), leads.filter(Boolean), mesPassado);
  assert.equal(julho.importacoes, 0, 'sem data de criação, nada é contado');
  assert.equal(julho.analisesFeitas, 0, 'sem carimbo de análise, nada é contado');
}

// ── 5. Os carimbos que a lista precisa continuam viajando da API pro app ──────────────────────
{
  const persistencia = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');
  const compact = persistencia.match(/function compactAnalysisForList\([\s\S]*?\n  \}/)[0];
  for (const campo of ['reanalisadoEm', 'geradoEm', 'analisadoEm']) {
    assert.ok(compact.includes(`"${campo}"`), `a carteira precisa receber ${campo} pra contar as análises`);
  }
  assert.match(persistencia, /createdAt: row\.criado_em/, 'a carteira precisa receber a data de criação do lead');
}

console.log('v1182-desempenho-analises-da-carteira: ok');
