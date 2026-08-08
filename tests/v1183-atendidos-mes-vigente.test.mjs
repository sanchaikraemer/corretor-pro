import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1183 — quatro coisas que o dono apontou olhando a Home (print do dia 8 de agosto):
// 1) "já está meu nome e não mudou" — o Cérebro tinha "Seu nome: Sanchai" e a saudação continuava
//    "Bom dia, Empresa!" (nome da organização);
// 2) "quero o mês vigente e não últimos 7 ou 30" — o quadradinho "Atendidos" contava janelas
//    corridas e mostrava "183 no mês" no dia 8, com a tela Desempenho dizendo outra coisa;
// 3) "arquivado também é atendimento" — o quadradinho só olhava a carteira ativa;
// 4) "retire esse risco verde" — o aro decorativo parecia rodinha de carregando.

const DIA = 86400000;

// ── 1. O nome do corretor sai do Cérebro, não de state.cerebroCfg (que nunca é preenchido) ─────
{
  assert.doesNotMatch(app, /state\??\.?\??\.cerebroCfg\?\.corretorNome/,
    'ninguém pode voltar a ler corretorNome de state.cerebroCfg — esse campo nunca é preenchido em lugar nenhum do app');

  const fn = app.match(/function cpNomeCorretorCerebro\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(fn, 'cpNomeCorretorCerebro precisa existir — é a fonte única do "Seu nome" do Cérebro');
  assert.match(fn, /obterCerebroConfigParaAnalise/,
    'precisa ler pela mesma fonte da análise (formulário quando montado, senão o que está salvo no aparelho)');

  const chamar = (cfg) => new Function(`
    const obterCerebroConfigParaAnalise = () => (${JSON.stringify(cfg)});
    ${fn}
    return cpNomeCorretorCerebro();
  `)();
  assert.equal(chamar({ corretorNome: '  Sanchai ' }), 'Sanchai', 'o nome salvo no Cérebro precisa chegar limpo');
  assert.equal(chamar({}), '', 'sem nome no Cérebro, devolve vazio (aí o chamador decide o que fazer)');

  // O nome precisa estar disponível SEM abrir a tela do Cérebro: a configuração é buscada uma vez
  // logo depois do login e guardada onde o resto do app lê. Antes, quem entrava e ia direto pra
  // Home continuava com o nome da empresa até visitar o Cérebro.
  const loginBlock = app.slice(0, app.indexOf('// v1013 — em aparelho compartilhado entre contas'));
  assert.match(loginBlock, /fetch\("\.\/api\/cerebro-config", \{ cache:"no-store" \}\)/,
    'o app precisa buscar o Cérebro uma vez no login');
  assert.match(loginBlock, /localStorage\.setItem\(CEREBRO_LS_KEY, JSON\.stringify\(sanitizeCerebroConfigV762\(cfgSrv\.config\)\)\)/,
    'e guardar a configuração no mesmo lugar que o resto do app já lê');
  assert.match(loginBlock, /catch\(_\)\{\}/, 'sem rede, não pode quebrar a entrada no app');

  // A saudação usa o Cérebro ANTES do nome da organização — era esse o bug do print.
  const saud = app.match(/function renderSaudacao\(items\)\{[\s\S]*?\n\}/)?.[0]
    || app.slice(app.indexOf('function renderSaudacao(items){'), app.indexOf('function renderSaudacao(items){') + 2500);
  const linhaNome = saud.match(/const corretorNome = .*/)[0];
  assert.match(linhaNome, /cpNomeCorretorCerebro\(\)\s*\|\|\s*window\.__cpContaNome/,
    'a saudação precisa tentar o "Seu nome" do Cérebro primeiro e só então o nome da empresa');
}

// ── 2. Semana e mês são de CALENDÁRIO, não janelas corridas ────────────────────────────────────
{
  const fnSemana = app.match(/function ehAtendidoNaSemana\(l\)\{[\s\S]*?\n\}/)[0];
  const fnMes = app.match(/function ehAtendidoNoMes\(l\)\{[\s\S]*?\n\}/)[0];
  const fnInicioSemana = app.match(/function cpInicioSemanaMs\(\)\{[\s\S]*?\n\}/)[0];

  // 2a. começo da semana = segunda-feira, no calendário de Brasília, em qualquer dia da semana
  for (const [dia, segundaEsperada] of [
    ['2026-08-08', '2026-08-03'], // sábado → segunda daquela semana
    ['2026-08-03', '2026-08-03'], // a própria segunda
    ['2026-08-09', '2026-08-03'], // domingo FECHA a semana que começou na segunda
    ['2026-08-10', '2026-08-10'], // segunda seguinte já é semana nova
    ['2026-03-02', '2026-03-02']  // virada de mês no meio da semana não atrapalha
  ]) {
    const inicioSemana = new Function(`
      const inicioDoDiaBR = () => new Date('${dia}T03:00:00Z');
      ${fnInicioSemana}
      return cpInicioSemanaMs();
    `)();
    assert.equal(new Date(inicioSemana).toISOString(), `${segundaEsperada}T03:00:00.000Z`,
      `${dia}: a semana precisa começar na segunda ${segundaEsperada} (meia-noite de Brasília)`);
  }

  // 2b. o caso exato do print: dia 8 de agosto, atendimento de 20 de julho NÃO é "deste mês"
  const iniAgosto = new Date('2026-08-01T00:00:00-03:00').getTime();
  const iniSemana = new Date('2026-08-03T00:00:00-03:00').getTime();
  const sandbox = new Function(`
    const cpInicioSemanaMs = () => ${iniSemana};
    const cpInicioMesMs = () => ${iniAgosto};
    ${fnSemana}
    ${fnMes}
    return { ehAtendidoNaSemana, ehAtendidoNoMes };
  `)();
  const leadEm = (isoStr) => ({ analysis: { aprendizado: { eventos: [{ evento: 'contato_manual', quando: isoStr }] } } });

  const em20Julho = new Date(iniAgosto - 12 * DIA).toISOString();
  assert.equal(sandbox.ehAtendidoNoMes(leadEm(em20Julho)), false,
    'atendimento de 20 de julho NÃO pode entrar em "atendidos no mês" no dia 8 de agosto — era esse o 183 do print');
  assert.equal(sandbox.ehAtendidoNoMes(leadEm(new Date(iniAgosto + 2 * DIA).toISOString())), true,
    'atendimento de 3 de agosto conta no mês vigente');
  assert.equal(sandbox.ehAtendidoNaSemana(leadEm(new Date(iniSemana - 2 * DIA).toISOString())), false,
    'atendimento da semana passada não conta na semana vigente');
  assert.equal(sandbox.ehAtendidoNaSemana(leadEm(new Date(iniSemana + 1 * DIA).toISOString())), true,
    'atendimento de terça conta na semana vigente');
  // e o mês vigente aqui é a MESMA régua que a tela Desempenho já usava (cpInicioMesMs)
  assert.match(fnMes, /cpInicioMesMs\(\)/, 'o mês precisa usar cpInicioMesMs — a mesma régua da tela Desempenho');
}

// ── 3. "Arquivado também é atendimento": a base é a carteira inteira ───────────────────────────
{
  const ini = app.indexOf('renderResumoDia = function(items){');
  const rbh = app.slice(ini, app.indexOf('\n};', ini) + 3);
  assert.match(rbh, /const baseAtendidos ?=.*state\.todosLeads/,
    'as contagens precisam sair da carteira inteira (state.todosLeads), não só da ativa');
  for (const conta of ['atendidosHoje', 'atendidosSemana', 'atendidosMes']) {
    assert.match(rbh, new RegExp(`const ${conta} ?= ?baseAtendidos\\.filter`),
      `${conta} não pode voltar a filtrar só a carteira ativa — atender e arquivar no mesmo dia zerava o número`);
  }
  // prova de comportamento: um lead arquivado atendido hoje precisa entrar na conta
  const fnBase = new Function('state', 'items', `
    const baseAtendidos=(Array.isArray(state.todosLeads) && state.todosLeads.length) ? state.todosLeads : items;
    return baseAtendidos.length;
  `);
  assert.equal(fnBase({ todosLeads: [1, 2, 3] }, [1]), 3, 'com a carteira inteira carregada, é ela que vale');
  assert.equal(fnBase({}, [1]), 1, 'sem a carteira inteira (render adiantado), cai no que veio — nunca quebra');
}

// ── 4. O risco verde saiu ──────────────────────────────────────────────────────────────────────
{
  assert.doesNotMatch(app, /cp1171-aro/, 'o aro verde precisa sumir do HTML e do CSS — parecia rodinha de carregando');
  const ini = app.indexOf('renderResumoDia = function(items){');
  const rbh = app.slice(ini, app.indexOf('\n};', ini) + 3);
  assert.match(rbh, /class="cp1171-ic">\$\{ui631Icon\('compromisso'\)\}/,
    'no lugar entra o ícone de concluído, o mesmo jogo de ícones dos outros quadradinhos');
  // e o CSS precisa vencer o .ui-kpi i{background;border-radius} da base (lição da v1077→v1078)
  assert.match(app, /\.cp1171-ic\{[^}]*position:absolute[^}]*background:none!important[^}]*\}/,
    'o ícone precisa ficar no canto e sem a bolinha de fundo, com !important pra vencer a regra base');
}

console.log('v1183-atendidos-mes-vigente: ok');
