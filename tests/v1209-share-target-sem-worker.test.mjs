import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1209 — "404: NOT_FOUND" no lugar do app quando o dono compartilhava a conversa do WhatsApp.
//
// Quem recebe o ZIP compartilhado é o service worker (o "recebedor" instalado no celular junto com
// o app). Se ele não estiver ligado na hora do compartilhamento — o Android limpa isso sozinho por
// falta de espaço, por tempo sem abrir o app, ou quando o navegador limpa os dados do site — o
// celular manda o POST direto pro servidor. Como não existia NADA em /share-target no servidor, a
// resposta era a página de erro crua da Vercel: sem app, sem botão, sem a conversa.
//
// Esta guarda cobre as três pontas da correção:
//   1) servidor: /share-target sempre devolve o dono pra dentro do app (redirecionamento 303);
//   2) app: esse retorno mostra um aviso explicando e religa o recebedor;
//   3) service worker: barra final no endereço não faz o compartilhamento escapar pro servidor.

const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');

// 1) Servidor — o endereço do compartilhamento não pode mais cair em 404.
const redirects = vercel.redirects || [];
for (const origem of ['/share-target', '/share-target/']) {
  const regra = redirects.find(r => r.source === origem);
  assert.ok(regra, `vercel.json precisa de um redirecionamento para ${origem} (senão volta o 404)`);
  assert.ok(
    String(regra.destination).includes('erro=sem-worker'),
    `${origem} precisa devolver pro app com erro=sem-worker, e não pra uma tela de erro`
  );
  // 307/308 mandariam o navegador REENVIAR o POST (com o ZIP) pro destino — que é uma página
  // estática e responderia erro de novo. 303 é o que troca pra uma abertura normal do app.
  assert.equal(regra.statusCode, 303, `${origem} precisa usar 303 (307/308 reenviariam o arquivo)`);
  assert.ok(!('permanent' in regra), `${origem} não pode usar "permanent" junto com statusCode`);
}

// 2) App — o aviso precisa vir ANTES da checagem de "marca velha" no endereço, senão ela devolve
// {handled:false} caladamente e o dono volta pra Home sem entender o que aconteceu.
const checkStart = app.indexOf('async function _checkSharedImpl()');
const checkEnd = app.indexOf('async function checkShared()', checkStart);
assert.ok(checkStart > -1 && checkEnd > checkStart, 'não achei _checkSharedImpl no app.js');
const checkBlock = app.slice(checkStart, checkEnd);

const posSemWorker = checkBlock.indexOf("erroUrl==='sem-worker'");
const posMarcaVelha = checkBlock.indexOf('const debugAntigo');
assert.ok(posSemWorker > -1, 'o app precisa tratar o retorno erro=sem-worker');
assert.ok(posMarcaVelha > -1, 'não achei a checagem de marca velha (v1193) no app.js');
assert.ok(posSemWorker < posMarcaVelha, 'o aviso de sem-worker precisa vir antes da checagem de marca velha');

const blocoSemWorker = checkBlock.slice(posSemWorker, posMarcaVelha);
assert.match(blocoSemWorker, /religarRecebedorDeConversa\(\)/, 'o app precisa religar o recebedor ao cair aqui');
assert.match(blocoSemWorker, /falhou:true/, 'o arranque precisa seguir carregando a carteira por trás do aviso');
assert.match(blocoSemWorker, /window\.__cpShareImportActive=false/, 'não pode ficar preso no modo importação');
assert.match(blocoSemWorker, /btnEscolherZipDoShare/, 'o aviso precisa oferecer a escolha do arquivo na hora');
assert.match(blocoSemWorker, /history\.replaceState/, 'o endereço precisa ser limpo pra atualizar a página não repetir o aviso');
assert.match(blocoSemWorker, /processingBox'\)\?\.classList\.remove\('show'\)/, 'a barra "Preparando a importação" não pode ficar girando por cima do aviso');
assert.match(blocoSemWorker, /scrollIntoView/, 'o aviso nasce fora da tela no celular — precisa ser trazido pra vista');

// A segunda passada de checkShared() (a que roda junto com o service worker, ~1s depois) não pode
// reentrar no modo importação: CP_VEIO_DE_SHARE continua verdadeiro mesmo com o endereço já limpo,
// e sem essa trava ela apagava o aviso e ficava 15 segundos procurando um ZIP que nunca chegou.
assert.match(blocoSemWorker, /__cpShareEncerrado=true/, 'o compartilhamento resolvido precisa ser marcado como encerrado');
assert.match(checkBlock, /const cameFromShare=!__cpShareEncerrado &&/, 'cameFromShare precisa respeitar o compartilhamento já encerrado');
assert.match(app, /let __cpShareEncerrado = false;/, 'a trava precisa nascer desligada a cada abertura do app');
// O "Tentar recuperar" do aviso genérico (v983) depende de cameFromShare continuar valendo — a
// trava não pode ser ligada naquele caminho.
const blocoErroGenerico = checkBlock.slice(checkBlock.indexOf('btnRecuperarShare'));
assert.ok(!blocoErroGenerico.includes('__cpShareEncerrado=true'), 'o caminho do "Tentar recuperar" não pode ser encerrado');

assert.match(
  app,
  /function religarRecebedorDeConversa\(\)\{[\s\S]*navigator\.serviceWorker\.register\("\/service-worker\.js\?v=__VERSION__"/,
  'religarRecebedorDeConversa precisa registrar o service worker de novo'
);

// 3) Service worker — barra final não pode fazer o compartilhamento escapar pro servidor.
assert.match(sw, /url\.pathname\.replace\(\/\\\/\+\$\/, ''\)/, 'a comparação do caminho precisa ignorar barra final');
assert.match(sw, /caminho === '\/share-target' \|\| caminho === '\/share\.html'/, 'os dois endereços de compartilhamento continuam tratados no worker');

console.log('v1209-share-target-sem-worker: ok');
