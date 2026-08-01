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
  const fonte = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0]
    + '\n' + app.match(/function cpSemAtenderHaDias\(l, dias\)\{[\s\S]*?\n\}/)[0];
  const { cpSemAtenderHaDias } = eval(`
    const TIPOS_ATENDIMENTO_TIMELINE = new Set();
    const diasCalendarioBR = (ts) => Math.floor((Date.now() - ts) / ${DIA});
    ${fonte}
    ({ cpSemAtenderHaDias });
  `);

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
    ${app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0]}
    const TIPOS_ATENDIMENTO_TIMELINE = new Set();
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
  assert.match(nunca, /nunca atendido/i,
    'quem nunca foi atendido precisa dizer isso — no print aparecia "1 dia", que era a mensagem dele');
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
