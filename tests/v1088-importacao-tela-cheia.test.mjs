import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1088 — o dono relatou: "aparecem 5 telas mudando até firmar na análise, isso chega deixar a
// gente meio perdido, tem umas que piscam e mudam tão rápido que nem consegui fazer o print".
// Ele escolheu o modelo "Foco total": uma tela só cobrindo o app enquanto a importação roda.
//
// O RISCO desse modelo é um só, e é grave: uma tela que cobre tudo pode PRENDER o corretor. Este
// teste existe principalmente pra travar as saídas — os pontos em que ela é obrigada a sair de
// cena. Se alguém mexer nisso, o teste quebra.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// ── 1. A tela existe e começa escondida ───────────────────────────────────────────────────────
assert.match(index, /<div id="cpImportOverlay" hidden/,
  'a tela cheia precisa existir no HTML e começar escondida');
for (const alvo of ['cpioProgresso', 'cpioPct', 'cpioTitulo', 'cpioSub', 'cpioPassos']) {
  assert.ok(index.includes(`id="${alvo}"`), `a tela cheia precisa ter o alvo ${alvo}`);
}
assert.match(css, /#cpImportOverlay\{[\s\S]*?position:fixed;\s*inset:0/,
  'a tela cheia precisa cobrir o app inteiro');

// ── 2. Ela é dirigida pelo ÚNICO funil de etapas da importação ─────────────────────────────────
// A chamada vem DEPOIS de setBotoesImportacao (ver v862: os botões são travados primeiro) e
// dentro de try/catch — é assim que o v862 consegue extrair renderEtapas e rodá-la contra um DOM
// falso, onde a tela cheia não existe.
const fnRender = app.match(/function renderEtapas\(idxAtual, sub, opts\)\{[\s\S]*?\n\}/);
assert.ok(fnRender, 'renderEtapas precisa aceitar o terceiro parâmetro (opts)');
assert.match(fnRender[0], /try\{ cpImportOverlaySincronizar\(idxAtual, sub, opts\); \}catch\(_\)\{\}/,
  'renderEtapas precisa ser quem dirige a tela cheia — um funil só, sem caminho paralelo');
assert.ok(fnRender[0].indexOf('setBotoesImportacao(') < fnRender[0].indexOf('cpImportOverlaySincronizar('),
  'os botões precisam ser travados ANTES de mexer na tela cheia (ver v862)');

// ── 3. AS SAÍDAS (o que impede de prender o corretor) ─────────────────────────────────────────
const sinc = app.match(/function cpImportOverlaySincronizar\(idx, sub, opts\)\{[\s\S]*?\n\}/);
assert.ok(sinc, 'cpImportOverlaySincronizar precisa existir');
const corpo = sinc[0];

// 3a. Ponto de decisão do corretor (salvar/atualizar): a tela SAI, senão cobre os botões e a
// importação trava de vez.
assert.match(corpo, /if\(opts && opts\.pausar\)\{ cpImportOverlayVisivel\(false\); return; \}/,
  'quando o app espera uma decisão do corretor, a tela cheia precisa sair ANTES de qualquer outra regra');
// v1089 — a etapa "aguardando confirmação" NÃO é mais uma pausa: no caminho normal o app salva
// sozinho logo em seguida, e esconder a tela ali fazia os cartões da importação piscarem no meio
// da análise ("apareceu essa tela e depois voltou pro carregamento", relato do dono).
assert.ok(!app.includes('"aguardando confirmação para salvar", { pausar: true }'),
  'a etapa de preparar o salvamento não pode mais esconder a tela cheia — o app salva sozinho ali');
// A ÚNICA saída por decisão do corretor é o caso de nome só parecido, que realmente pergunta.
assert.match(app, /Nome só parecido[\s\S]{0,400}?cpImportOverlayVisivel\(false\)/,
  'o caso de nome só parecido (o único que pergunta de verdade) precisa liberar a tela cheia');

// 3b. Falha recuperável (etapa 7) e qualquer índice fora do fluxo: sai.
assert.match(corpo, /cpImportOverlayVisivel\(false\);\s*\n\}/,
  'qualquer etapa fora do trabalho automático precisa terminar com a tela fora de cena');

// 3c. Concluído (etapa 6): mostra "Pronto" e sai sozinha.
assert.match(corpo, /if\(idx === 6\)\{[\s\S]*?setTimeout\(\(\) => cpImportOverlayVisivel\(false\), \d+\);/,
  'ao concluir, a tela precisa sumir sozinha pra dar lugar ao lead');

// 3d. Redes de segurança fora do funil: fim de toda importação e os dois erros de gravação.
// Sem estas, um caminho de erro que não passe por renderEtapas deixaria a tela aberta pra sempre.
const saidas = app.match(/cpImportOverlayVisivel\(false\)/g) || [];
assert.ok(saidas.length >= 5,
  `precisa haver várias saídas independentes da tela cheia (achei ${saidas.length})`);
// v1090 — O FINALLY DE processFile NÃO PODE MAIS ESCONDER A TELA. processFile TERMINA ANTES do
// salvamento (renderProcessedResult dispara salvarLeadPendente/atualizarLeadComEvolucao sem
// esperar), então esconder ali fazia a tela sumir COM O SALVAMENTO EM CURSO: os cartões da
// importação apareciam e o "salvando" trazia a tela de volta. Era a tela que piscava no meio.
const finallyProcess = app.match(/\}finally\{\s*\n\s*state\.processing=false;[\s\S]*?\n  \}/);
assert.ok(finallyProcess, 'não localizei o finally de processFile');
assert.ok(!finallyProcess[0].includes('cpImportOverlayVisivel'),
  'o finally de processFile não pode esconder a tela cheia — ele roda com o salvamento ainda em curso');

// A proteção contra ficar presa virou um VIGIA POR TEMPO, que só dispara se NADA acontecer —
// nunca no meio de um fluxo que está andando.
assert.match(app, /const CPIO_VIGIA_MS = (\d+);/, 'precisa existir o vigia por tempo');
const vigiaMs = Number(app.match(/const CPIO_VIGIA_MS = (\d+);/)[1]);
assert.ok(vigiaMs >= 60000,
  `o vigia precisa ser folgado (uma conversa cheia de áudio demora); está em ${vigiaMs}ms`);
assert.match(app, /function cpioRearmarVigia\(\)\{[\s\S]*?clearTimeout\(_cpioVigia\);/,
  'o vigia precisa ser rearmado a cada sinal de vida da importação');

// v1090 — A SEGUNDA TELA QUE PISCAVA: ao concluir, a tela sumia num relógio curto (650ms) mas o
// lead só abria aos 800ms — nesse vão a tela de importação reaparecia. Agora ela FICA até o lead
// estar aberto, e quem a fecha é o próprio abrirLead.
assert.match(app, /async function cpioFecharQuandoLeadAbrir\(id\)\{[\s\S]*?await abrirLead\(id\);[\s\S]*?finally\{[\s\S]*?cpImportOverlayVisivel\(false\)/,
  'a tela cheia só pode fechar DEPOIS que o lead abriu');
assert.match(app, /setTimeout\(\(\) => \{ cpioFecharQuandoLeadAbrir\(state\.lead\?\.id\); \}, 800\);/,
  'o salvamento de lead novo precisa abrir o lead com a tela ainda de pé');
assert.match(app, /setTimeout\(\(\) => \{ cpioFecharQuandoLeadAbrir\(existente\.id\); \}, 800\);/,
  'a atualização de lead existente precisa abrir o lead com a tela ainda de pé');
const fechaNoConcluido = corpo.match(/setTimeout\(\(\) => cpImportOverlayVisivel\(false\), (\d+)\);/);
assert.ok(fechaNoConcluido && Number(fechaNoConcluido[1]) >= 3000,
  'ao concluir, o relógio que fecha a tela é só saída de emergência — precisa ter folga pro lead abrir');
// v1096 — entre o fechamento da tela cheia e o aviso passou a existir a escolha da mensagem
// (queda de conexão x demais erros). O que este teste protege continua igual: a tela cheia sai
// ANTES do aviso, senão o corretor não enxerga o que aconteceu.
// v1175 — quem tira a tela cheia nesses ramos passou a ser renderEtapas(7) ("Falha recuperável"),
// que além de fechá-la também para a rodinha e destrava os botões — antes a linha de andamento
// ficava girando em "Salvando... 94%" depois do erro (print do dono). A exigência é a mesma.
{
  const trecho = app.match(/renderEtapas\(7,[\s\S]{0,900}?toast\(/g) || [];
  const noSalvar = trecho.find(t => /gravação não terminou a tempo/.test(t));
  assert.ok(noSalvar, 'erro ao salvar precisa liberar a tela pro corretor ver o aviso');
  assert.ok(noSalvar.indexOf('renderEtapas(7,') < noSalvar.indexOf('toast('),
    'a tela cheia precisa sair ANTES do aviso aparecer');
}
// O erro ao ATUALIZAR um cliente existente passa pelo mesmo fim de linha (v1175), que fecha a
// tela cheia via renderEtapas(7) antes de qualquer aviso.
assert.match(app, /cpImportacaoFalhouNaGravacao\("Não foi possível atualizar", err\);/,
  'erro ao atualizar precisa liberar a tela pro corretor ver o aviso');
{
  const fim = app.slice(app.indexOf('function cpImportacaoFalhouNaGravacao(titulo, err){')).slice(0, 900);
  assert.ok(fim.indexOf('renderEtapas(7,') < fim.indexOf('toast('),
    'no fim de linha compartilhado, a tela cheia também sai antes do aviso');
}

// ── 4. Os rótulos falam a língua do corretor, não a do sistema ────────────────────────────────
const passos = app.match(/const CPIO_PASSOS = \[[\s\S]*?\];/);
assert.ok(passos, 'a lista de etapas da tela cheia precisa existir');
for (const tecnico of ['Extraindo', 'Transcrevendo', 'Recebendo"']) {
  assert.ok(!passos[0].includes(`rot:"${tecnico}`),
    `"${tecnico}" é nome de processo interno — a tela cheia precisa dizer o que acontece com a conversa`);
}
assert.match(passos[0], /Ouvindo os áudios/, 'a etapa dos áudios precisa dizer o que ela faz de verdade');
assert.match(passos[0], /Analisando pelo seu Cérebro/, 'a análise precisa citar o Cérebro do corretor');

// ── 5. A porcentagem do anel bate com a barra que já existia ──────────────────────────────────
const pct = app.match(/const CPIO_PCT = \[([^\]]+)\]/);
assert.ok(pct, 'as porcentagens da tela cheia precisam existir');
const lista = pct[1].split(',').map(n => Number(n.trim()));
assert.deepEqual(lista, [8, 32, 48, 70, 86, 94, 100],
  'a porcentagem precisa continuar batendo com a barra antiga (pctPorEtapa em renderEtapas)');

// ── 6. v1089 — o andamento anda sozinho, em vez de pular de etapa em etapa ────────────────────
// As etapas duram tempos muito diferentes (ouvir áudios e analisar levam dezenas de segundos), e
// o número ficava congelado entre um salto e outro.
assert.match(app, /function cpioAnimarAte\(destino, teto\)\{/, 'precisa existir a animação do andamento');
assert.match(app, /_cpioAlvo = Math\.max\(_cpioMostrado, destino\);/,
  'o andamento nunca pode voltar atrás');
assert.match(app, /if\(_cpioAlvo < _cpioTeto\) _cpioAlvo \+= \(_cpioTeto - _cpioAlvo\) \* [\d.]+;/,
  'enquanto a etapa não termina, o andamento precisa se arrastar sozinho em direção ao teto');
assert.match(app, /const proximo = CPIO_PCT\[idx \+ 1\] \?\? 100;\s*\n\s*cpioAnimarAte\(pct, Math\.max\(pct, proximo - 2\)\);/,
  'o teto precisa ser a etapa SEGUINTE menos uma folga — o número nunca anuncia etapa que não começou');

console.log('v1088-importacao-tela-cheia: ok');
