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
assert.match(app, /renderEtapas\(5, "aguardando confirmação para salvar", \{ pausar: true \}\);/,
  'o ponto que espera "Salvar lead" precisa avisar que é uma pausa');

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
assert.match(app, /\}finally\{[\s\S]*?state\.processing=false;[\s\S]*?cpImportOverlayVisivel\(false\)/,
  'o fim de TODA importação (deu certo ou não) precisa fechar a tela cheia');
assert.match(app, /cpImportOverlayVisivel\(false\); \}catch\(_\)\{\}\s*\n\s*toast\("Não foi possível salvar: "/,
  'erro ao salvar precisa liberar a tela pro corretor ver o aviso');
assert.match(app, /cpImportOverlayVisivel\(false\); \}catch\(_\)\{\}\s*\n\s*toast\("Não foi possível atualizar: "/,
  'erro ao atualizar precisa liberar a tela pro corretor ver o aviso');

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

console.log('v1088-importacao-tela-cheia: ok');
