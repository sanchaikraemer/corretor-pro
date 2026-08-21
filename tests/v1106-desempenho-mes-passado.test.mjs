import fs from 'node:fs';
import assert from 'node:assert/strict';
// v1337 — o fuso do app saiu de 35 literais "America/Sao_Paulo" e virou cpFuso(). Este import
// entrega as funções REAIS de fuso do app.js pros trechos que este teste roda com eval.
import "./_fuso-do-app.mjs";

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v1106 — o dono, no dia 1º de agosto, vendo o Desempenho zerado: "pra ver resultados do mês
// passado como faço?". Não fazia — virou o mês, a tela zerava e julho sumia da vista (os dados
// continuam guardados, tudo tem data). Agora o Desempenho tem o seletor "Este mês / mês passado".

const DIA = 86400000;

// ── 1. As métricas aceitam um período FECHADO e separam os meses direito ──────────────────────
{
  const fonte = app.match(/function cpDesempenhoMetricas\(items, all, periodo\)\{[\s\S]*?\n\}/)[0];
  const agora = Date.now();
  const iniMesAtual = agora - 10 * DIA;   // simula: estamos no dia 10 do mês
  const iniMesPassado = iniMesAtual - 30 * DIA;

  const { cpDesempenhoMetricas } = eval(`
    const cpInicioMesMs = () => ${iniMesAtual};
    const cpContarAtividade = (chave, desde, ate) => {
      // registra o que foi pedido pra conferir a janela
      globalThis.__janelas = globalThis.__janelas || [];
      globalThis.__janelas.push([chave, desde, ate]);
      return 0;
    };
    const cpTempoAppSegundosHoje = () => 0;
    const cpTempoAppMediaSegundos7d = () => 0;
    const produtosLabel = () => "";
    ${fonte}
    ({ cpDesempenhoMetricas });
  `);

  const iso = (ms) => new Date(ms).toISOString();
  const leads = [{
    id: 'a',
    recentMessages: [
      { iso: iso(agora - 2 * DIA), text: 'msg deste mês' },
      { iso: iso(iniMesAtual - 5 * DIA), text: 'msg do mês passado' },
      { iso: iso(iniMesAtual - 8 * DIA), text: 'outra do mês passado' }
    ],
    analysis: { aprendizado: { eventos: [
      { evento: 'contato_manual', quando: iso(agora - 1 * DIA) },
      { evento: 'contato_manual', quando: iso(iniMesAtual - 3 * DIA) },
      { evento: 'mensagem_copiada', quando: iso(iniMesAtual - 4 * DIA) }
    ] } }
  }];

  // Mês corrente (sem período): só o que é deste mês.
  const atual = cpDesempenhoMetricas(leads, leads, null);
  assert.equal(atual.mensagensTrocadas, 1, 'este mês tem 1 mensagem');
  assert.equal(atual.leadsAtendidos, 1, 'este mês tem 1 lead atendido');
  assert.equal(atual.mensagensCopiadas, 0, 'a cópia foi no mês passado, não pode contar neste');

  // Mês passado (período fechado): só o que caiu dentro dele.
  const passado = cpDesempenhoMetricas(leads, leads, { ini: iniMesPassado, fim: iniMesAtual });
  assert.equal(passado.mensagensTrocadas, 2, 'o mês passado tem 2 mensagens');
  assert.equal(passado.leadsAtendidos, 1, 'o atendimento de 3 dias antes da virada é do mês passado');
  assert.equal(passado.mensagensCopiadas, 1, 'a cópia do mês passado aparece lá');

  // E as atividades locais foram pedidas com a janela fechada (ini E fim).
  const janelas = globalThis.__janelas.filter(j => j[1] === iniMesPassado);
  assert.ok(janelas.length >= 2, 'análises e importações precisam ser contadas na janela do mês passado');
  for (const j of janelas) assert.equal(j[2], iniMesAtual, 'a janela precisa FECHAR na virada do mês');
}

// ── 2. O contador de atividade respeita o fim da janela ───────────────────────────────────────
{
  const fonte = app.match(/function cpContarAtividade\(chave, desdeMs, ateMs\)\{[\s\S]*?\n\}/)[0];
  const agora = Date.now();
  const guardado = JSON.stringify([
    new Date(agora - 2 * DIA).toISOString(),   // este mês
    new Date(agora - 40 * DIA).toISOString(),  // mês passado
    new Date(agora - 45 * DIA).toISOString()   // mês passado
  ]);
  const { cpContarAtividade } = eval(`
    const localStorage = { getItem: () => ${JSON.stringify(guardado)} };
    ${fonte}
    ({ cpContarAtividade });
  `);
  assert.equal(cpContarAtividade('analise', agora - 30 * DIA, null), 1, 'janela aberta: só o recente');
  assert.equal(cpContarAtividade('analise', agora - 60 * DIA, agora - 30 * DIA), 2, 'janela fechada: só o mês passado');
  assert.equal(cpContarAtividade('analise'), 3, 'sem janela: tudo');
}

// ── 3. O seletor existe na tela e alterna ─────────────────────────────────────────────────────
{
  assert.match(app, /cpDesempenhoTrocarMes\('atual'\)/, 'o chip "Este mês" precisa existir');
  assert.match(app, /cpDesempenhoTrocarMes\('anterior'\)/, 'o chip do mês passado precisa existir');
  assert.match(app, /window\.cpDesempenhoTrocarMes = cpDesempenhoTrocarMes/, 'a troca precisa estar publicada (o botão chama por window)');
  assert.match(app, /function cpInicioMesAnteriorMs\(\)/, 'o começo do mês anterior precisa ser calculado de verdade');
  assert.match(css, /\.cp-met-mes-chip\.ativo/, 'o chip ativo precisa de destaque visual');
  // Os rótulos acompanham o mês escolhido (nada de dizer "este mês" olhando julho).
  assert.match(app, /Com clientes, \$\{rotuloMes\}/, 'o rótulo das mensagens precisa acompanhar o mês escolhido');
}

// ── 4. A virada de mês é calculada certo (inclusive janeiro) ──────────────────────────────────
{
  const fonte = app.match(/function cpInicioMesAnteriorMs\(\)\{[\s\S]*?\n\}/)[0];
  const casos = [
    ['2026-08-01', 7 - 1],   // agosto → julho (mês 6, zero-based)
    ['2026-01-15', 11]       // janeiro → dezembro do ano anterior
  ];
  for (const [dia, mesEsperado] of casos) {
    const ini = new Date(`${dia}T12:00:00-03:00`);
    const iniMes = new Date(`${dia.slice(0, 7)}-01T00:00:00-03:00`).getTime();
    const { cpInicioMesAnteriorMs } = eval(`
      const cpInicioMesMs = () => ${iniMes};
      ${fonte}
      ({ cpInicioMesAnteriorMs });
    `);
    const r = new Date(cpInicioMesAnteriorMs());
    assert.equal(r.getMonth(), mesEsperado, `${dia}: o mês anterior precisa ser o ${mesEsperado}`);
    assert.equal(r.getDate(), 1, 'e começar no dia 1º');
  }
}

console.log('v1106-desempenho-mes-passado: ok');
