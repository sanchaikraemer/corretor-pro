import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1223 — "travou aqui" (print do dono, 11/08/2026, 19h32): a TELA CHEIA da importação parada em
// "Salvando na carteira · 98% · responda a pergunta acima pra continuar".
//
// Não estava salvando nada. A pergunta "é o mesmo cliente?" já estava pronta no topo da tela
// (v1220) — só que COBERTA pela tela cheia, que ainda por cima segura a rolagem do corpo da
// página. Sem ver a pergunta e sem conseguir rolar até ela, não havia como destravar: a
// importação ficava ali pra sempre.
//
// A causa foi um descuido meu na v1219: a importação fechava a tela cheia e, na linha seguinte,
// chamava renderEtapas(5, …, {aguardando:true}) — que caía no ramo "etapa 0..5 = trabalho em
// andamento" e REABRIA a tela cheia na mesma hora. O estado "esperando você" existia na linha de
// andamento, mas não tinha sido ensinado à tela cheia.
//
// Este teste executa a função de verdade contra dublês: é a única forma de provar que a tela cheia
// fecha nesse caso, já que o defeito não aparece em nenhuma leitura de texto do código.

const ini = app.indexOf('function cpImportOverlaySincronizar(');
const fim = app.indexOf('window.cpImportOverlaySincronizar =');
assert.ok(ini > -1 && fim > ini, 'não localizei a função que comanda a tela cheia');
const fonte = app.slice(ini, fim);

let visivel = null;
const chamadas = [];
// eslint-disable-next-line no-new-func
const { cpImportOverlaySincronizar } = new Function(
  'cpImportOverlayVisivel', 'cpImportOverlayAtualizar',
  fonte + '\nreturn { cpImportOverlaySincronizar };'
)(
  (mostrar) => { visivel = !!mostrar; },
  (idx, sub) => { chamadas.push([idx, sub]); }
);

// ── Trabalho de verdade (etapas 0 a 5): a tela cheia cobre a tela, como sempre ──────────────────
for(const idx of [0, 1, 2, 3, 4, 5]){
  visivel = null;
  cpImportOverlaySincronizar(idx, 'andando');
  assert.equal(visivel, true, `etapa ${idx} é trabalho automático: a tela cheia fica`);
}

// ── Esperando a resposta do corretor: a tela cheia SAI DA FRENTE ────────────────────────────────
visivel = null;
cpImportOverlaySincronizar(5, 'responda a pergunta acima pra continuar', { aguardando: true });
assert.equal(visivel, false, 'esperando resposta, a tela cheia precisa sair — senão cobre a pergunta e trava tudo');

// O mesmo já valia pro `pausar` (v1089); os dois casos são a mesma situação: a vez é do corretor.
visivel = null;
cpImportOverlaySincronizar(5, 'x', { pausar: true });
assert.equal(visivel, false, 'pausar continua fechando a tela cheia');

// ── E não pode nem redesenhar o conteúdo da tela cheia enquanto espera ─────────────────────────
chamadas.length = 0;
cpImportOverlaySincronizar(5, 'responda a pergunta acima pra continuar', { aguardando: true });
assert.equal(chamadas.length, 0, 'esperando resposta, nada de atualizar o que está por baixo');

// ── Concluído (6) e falha (7) seguem como estavam ───────────────────────────────────────────────
visivel = null;
cpImportOverlaySincronizar(7, 'falhou');
assert.equal(visivel, false, 'falha recuperável continua saindo na hora');

// ── A ordem lá na importação: fecha a tela cheia, marca a espera e só então rola pro topo ───────
{
  const importacao = fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
  const bloco = importacao.slice(importacao.indexOf('qs("#btnVerCadastroParecido")?.addEventListener'));
  const posFechar = bloco.indexOf('cpImportOverlayVisivel(false)');
  const posEspera = bloco.indexOf('{ aguardando: true }');
  const posRolar = bloco.indexOf('const irProTopo');
  assert.ok(posFechar > -1 && posEspera > posFechar && posRolar > posEspera,
    'a sequência precisa ser: fechar a tela cheia → marcar a espera → rolar pro topo');
}

console.log('v1223-tela-cheia-nao-cobre-a-pergunta: ok');
