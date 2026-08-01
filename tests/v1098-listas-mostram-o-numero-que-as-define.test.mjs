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

  // "Sem atender 30d+" — o caso EXATO do print: nunca atendido, mensagem há 1 dia.
  const semAtender = COLUNAS_POR_GRUPO.__semAtender30;
  assert.equal(semAtender.titulo, 'Sem atender há', 'o título precisa dizer o que o número é');
  const nunca = semAtender.valor(leadNuncaAtendido('x', 1));
  assert.match(nunca, /nunca/i,
    'quem nunca foi atendido precisa aparecer como "nunca" — no print aparecia "1 dia", que era a mensagem dele');
  assert.doesNotMatch(nunca, /\b1\b/, 'e não pode mostrar o "1 dia" da última mensagem');

  const velho = semAtender.valor(leadAtendidoHa('y', 53, 12));
  assert.match(velho, /53/, 'precisa mostrar os dias SEM ATENDIMENTO (53), não os da última mensagem (12)');
  assert.doesNotMatch(velho, /12/, 'o número da última mensagem não pode aparecer aqui');

  // "Aguardando cliente" — o caso do outro print: calado há 18 dias, atendido há 3, descanso 14.
  const aguardando = COLUNAS_POR_GRUPO.__aguardando;
  assert.equal(aguardando.titulo, 'Volta em', 'o título precisa responder "por que ele ainda está aqui?"');
  const espera = aguardando.valor(leadAtendidoHa('z', 3, 18));
  assert.match(espera, /\b12\b/, 'com descanso de 14 e atendido há 3, faltam 12 dias pra voltar');
  assert.match(espera, /atendido há 3d/, 'e precisa mostrar de onde vem a conta');
  assert.doesNotMatch(espera, /\b18\b/,
    'o "18 dias" da última mensagem era justamente o que fazia parecer que o prazo tinha estourado');

  // Quem acabou de ser atendido tem o prazo cheio pela frente.
  assert.match(aguardando.valor(leadAtendidoHa('w', 0, 40)), /\b15\b|\b14\b/,
    'atendido hoje precisa mostrar o prazo praticamente inteiro pela frente');

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
