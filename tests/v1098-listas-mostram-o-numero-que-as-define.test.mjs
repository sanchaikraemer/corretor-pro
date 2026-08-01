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

// ── 1. O FILTRO de "sem atender 30d+" está certo — é a régua do ATENDIMENTO ────────────────────
{
  // v1102 — caso Jamil ("nunca atendido jamil?????"): a régua virou o último CONTATO REAL do
  // corretor — atendimento marcado OU última mensagem DELE na conversa do WhatsApp.
  const fonte = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0]
    + '\n' + app.match(/function cpUltimoContatoCorretorTs\(l\)\{[\s\S]*?\n\}/)[0]
    + '\n' + app.match(/function cpSemAtenderHaDias\(l, dias\)\{[\s\S]*?\n\}/)[0];
  const { cpSemAtenderHaDias, cpUltimoContatoCorretorTs } = eval(`
    const TIPOS_ATENDIMENTO_TIMELINE = new Set();
    const diasCalendarioBR = (ts) => Math.floor((Date.now() - ts) / ${DIA});
    const ehMsgManualTimeline = () => false;
    const ehMsgDoCliente = (m, pn) => String(m?.author||"").toLowerCase().startsWith(String(pn||"").toLowerCase());
    const window = {};
    ${fonte}
    ({ cpSemAtenderHaDias, cpUltimoContatoCorretorTs });
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
  assert.equal(cpSemAtenderHaDias(jamil, 30), true,
    'e como o último contato dele foi há 53 dias, o Jamil continua na lista de 30d+ — só que com a data certa');

  // Corretor respondeu ONTEM na conversa (sem marcar nada no app): NÃO pode entrar na lista.
  const respondidoOntem = { id: 'r', name: 'Cliente Novo', analysis: {},
    recentMessages: [{ author: 'Construtora Senger', text: 'segue a tabela', iso: hojeMenos(1) }] };
  assert.equal(cpSemAtenderHaDias(respondidoOntem, 30), false,
    'quem o corretor respondeu ontem pelo WhatsApp não está "sem atender"');

  // Cliente que MANDOU MENSAGEM ONTEM mas nunca foi atendido: entra na lista, e está certo.
  assert.equal(cpSemAtenderHaDias(leadNuncaAtendido('novo', 1), 30), true,
    'nunca atendido entra em "sem atender 30d+", mesmo tendo mandado mensagem ontem');
  // Atendido há 40 dias, mensagem há 12: entra (a régua é o atendimento).
  assert.equal(cpSemAtenderHaDias(leadAtendidoHa('velho', 40, 12), 30), true,
    'atendido há 40 dias entra, mesmo com mensagem recente');
  // Atendido há 5 dias: NÃO entra.
  assert.equal(cpSemAtenderHaDias(leadAtendidoHa('recente', 5, 90), 30), false,
    'atendido há 5 dias não pode entrar, mesmo sem mensagem há 90 dias');
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

  const semAtender = COLUNAS_POR_GRUPO.__semAtender30;
  assert.equal(semAtender.titulo, 'Sem atender desde', 'o título precisa dizer que o que vem é uma data');
  const nunca = semAtender.valor(leadNuncaAtendido('x', 1));
  assert.match(nunca, /nunca respondeu/i,
    'sem NENHUM contato do corretor (nem marcado, nem mensagem), diz isso com todas as letras');
  assert.doesNotMatch(nunca, /\b1 dia\b/, 'e não pode mostrar o "1 dia" da última mensagem');

  const velho = semAtender.valor(leadAtendidoHa('y', 53, 12));
  assert.match(velho, DATA, 'precisa mostrar a DATA do último atendimento');
  assert.match(velho, /53/, 'e há quantos dias foi, como apoio');
  assert.doesNotMatch(velho, /\b12\b/, 'o número da última mensagem não pode aparecer aqui');

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
