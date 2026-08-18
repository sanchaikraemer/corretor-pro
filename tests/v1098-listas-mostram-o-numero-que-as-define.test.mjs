import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v1098 — dois relatos do dono no mesmo dia, mesma causa:
//
//   1) "por que aguardando cliente aparece com mais dos 14 dias pré-definidos? eles não teriam
//       que voltar para as prioridades após o prazo?" (viu 16 e 18 dias)
//   2) "e sem atender 30+, veja os dias ao lado, isso é incoerente, não tá funcionando meus
//       filtros" (lista de 30d+ mostrando 1 dia, 12 dias, e fora de ordem)
//
// Os FILTROS estavam certos. Quem mentia era a COLUNA: mostrava sempre "dias desde a última
// MENSAGEM", enquanto as duas listas são definidas pelo último ATENDIMENTO marcado.
// Este teste roda as regras de verdade e confere os números que aparecem.

const DIA = 86400000;
const hojeMenos = (d) => new Date(Date.now() - d * DIA).toISOString();
const leadAtendidoHa = (id, diasAtendimento, diasUltimaMsg) => ({
  id,
  daysSinceLastInteraction: diasUltimaMsg,
  analysis: { aprendizado: { eventos: [{ evento: 'contato_manual', quando: hojeMenos(diasAtendimento) }] } }
});
const leadNuncaAtendido = (id, diasUltimaMsg) => ({ id, daysSinceLastInteraction: diasUltimaMsg, analysis: {} });

// ── 1. O ÚLTIMO CONTATO REAL DO CORRETOR (a conta que alimenta as colunas) ────────────────────
//
// v1293 — esta seção testava a régua cpSemAtenderHaDias, removida na faxina: nenhuma tela e
// nenhuma fila a consultava (a justificativa escrita no código de que "a fila Fazer agora usa
// ela" foi conferida linha a linha e era falsa). O que continua valendo, e é o que de fato
// aparece na tela, é a conta abaixo — o caso Jamil, que deu origem a tudo isto.
{
  const fonte = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0]
    + '\n' + app.match(/function cpUltimoContatoCorretorTs\(l\)\{[\s\S]*?\n\}/)[0];
  const { cpUltimoContatoCorretorTs } = eval(`
    const TIPOS_ATENDIMENTO_TIMELINE = new Set();
    const diasCalendarioBR = (ts) => Math.floor((Date.now() - ts) / ${DIA});
    const ehMsgManualTimeline = () => false;
    const ehMsgDoCliente = (m, pn) => String(m?.author||"").toLowerCase().startsWith(String(pn||"").toLowerCase());
    const window = {};
    ${fonte}
    ({ cpUltimoContatoCorretorTs });
  `);

  // O CASO JAMIL: nunca marcado no app, mas o corretor mandou mensagem na conversa há 53 dias.
  const jamil = { id: 'jamil', name: 'Jamil Contalex', daysSinceLastInteraction: 53,
    analysis: {},
    recentMessages: [
      { author: 'Jamil Contalex', text: 'vou avaliar', iso: hojeMenos(53) },
      { author: 'Construtora Senger', text: 'te mando o material do Personalité', iso: hojeMenos(53) }
    ] };
  assert.ok(cpUltimoContatoCorretorTs(jamil) > 0,
    'mensagem que o CORRETOR mandou na conversa CONTA como contato — Jamil nunca mais é "nunca atendido"');

  // Fala só do cliente não conta como contato do corretor.
  const soCliente = { id: 'c', name: 'Ana Paula', analysis: {},
    recentMessages: [{ author: 'Ana Paula', text: 'ainda estou pensando', iso: hojeMenos(2) }] };
  assert.ok(!cpUltimoContatoCorretorTs(soCliente),
    'mensagem do cliente não pode virar "contato seu" — senão a coluna mente a favor do corretor');

  // Atendimento marcado no app conta, mesmo sem mensagem nenhuma na conversa.
  assert.ok(cpUltimoContatoCorretorTs(leadAtendidoHa('marcado', 40, 12)) > 0,
    'atendimento marcado no app conta como contato real');
}

// ── 2. A COLUNA de cada lista mostra o número que a define ────────────────────────────────────
{
  const bloco = app.match(/const COLUNA_PADRAO = \{[\s\S]*?const coluna = COLUNAS_POR_GRUPO\[grupo\] \|\| COLUNA_PADRAO;/);
  assert.ok(bloco, 'não localizei a configuração de colunas das listas');

  const { COLUNAS_POR_GRUPO, COLUNA_PADRAO } = eval(`
    const ehContatadoHoje = () => false;
    const diasCalendarioBR = (ts) => Math.floor((Date.now() - ts) / ${DIA});
    const limiarRetomada = () => 14;
    const TIPOS_ATENDIMENTO_TIMELINE = new Set();
    const ehMsgManualTimeline = () => false;
    const ehMsgDoCliente = (m, pn) => String(m?.author||"").toLowerCase().startsWith(String(pn||"").toLowerCase());
    const window = {};
    ${app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0]}
    ${app.match(/function cpUltimoContatoCorretorTs\(l\)\{[\s\S]*?\n\}/)[0]}
    ${bloco[0].replace('const coluna = COLUNAS_POR_GRUPO[grupo] || COLUNA_PADRAO;', '')}
    ({ COLUNAS_POR_GRUPO, COLUNA_PADRAO });
  `);

  // v1101 — as duas colunas passaram a mostrar DATA, não contagem de dias. O dono leu "14 dias"
  // ao lado da Silvana (atendida ONTEM) como "conversa parada há 14 dias". A conta estava certa,
  // mas número solto de dias na linha de um cliente vai ser lido como tempo de abandono — sempre.
  // Data ninguém lê errado.
  const DATA = /\b\d{2}\/\d{2}\b/;

  // v1246 — a coluna "__semAtender30" saiu junto com a lista: o dono mandou apagar o quadradinho
  // "Sem atender 30d+" ("nao sera mais necessario"), e sem ele não existia mais porta de entrada.
  assert.equal(COLUNAS_POR_GRUPO.__semAtender30, undefined,
    'a coluna da lista apagada não pode continuar sozinha no código');

  // "Aguardando cliente" — o caso da Silvana: atendida ontem, descanso de 14.
  const aguardando = COLUNAS_POR_GRUPO.__aguardando;
  assert.equal(aguardando.titulo, 'Volta dia', 'o título precisa responder "quando ele volta?"');
  const espera = aguardando.valor(leadAtendidoHa('silvana', 1, 14));
  assert.match(espera, DATA, 'precisa mostrar a DATA em que ele volta pra fila');
  assert.match(espera, /atendido ontem/, 'e quando foi atendido');
  assert.doesNotMatch(espera, /\b14 dias\b/,
    'nada de "14 dias" solto — foi exatamente isso que o dono leu como "conversa de 14 dias"');

  // A data tem que bater com a regra: volta no dia seguinte ao último dia de descanso.
  const esperada = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
    .format(new Date(Date.now() - 1 * DIA + 15 * DIA));
  assert.match(espera, new RegExp(esperada.replace('/', '\\/')),
    `atendida ontem com descanso 14, a data de volta precisa ser ${esperada}`);

  // As demais listas continuam mostrando "Parado há" (dias desde a última mensagem).
  assert.equal(COLUNA_PADRAO.titulo, 'Parado há', 'as outras listas não mudam');
  assert.match(COLUNA_PADRAO.valor({ daysSinceLastInteraction: 7 }), /\b7\b/);
}

// ── 3. O título da coluna é o da lista aberta (não pode ficar fixo) ───────────────────────────
{
  const cabecalho = app.match(/<div class="lgt-th">[\s\S]{0,220}?<\/div>/)[0];
  assert.match(cabecalho, /\$\{escapeHtml\(coluna\.titulo\)\}/,
    'o cabeçalho precisa usar o título da coluna da lista aberta');
  assert.doesNotMatch(cabecalho, />Parado há</,
    '"Parado há" não pode mais estar cravado no cabeçalho de todas as listas');
}

// ── 4. A explicação embaixo do número precisa ter estilo (senão não se lê) ────────────────────
{
  assert.match(css, /\.lgt-dias \.lgt-sub\{/, 'a segunda linha da coluna precisa de estilo próprio');
}

console.log('v1098-listas-mostram-o-numero-que-as-define: ok');
