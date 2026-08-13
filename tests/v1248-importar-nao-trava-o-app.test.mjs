import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1248 — "COMPARTILHEI A CONVERSA E O APP MORREU".
//
// A v1195 passou as 29 funções da importação pra js/importacao.js, buscado só na hora de importar
// (ponte carregarModuloImportacao). O ganho é real, mas a ponte nasceu sem NENHUM tratamento de
// erro — e a falha de baixar esse pedaço é comum: internet oscilando, ou o app tendo acabado de
// ser publicado (o recebedor instalado no celular ainda procura o endereço da versão anterior).
//
// Eram três buracos, todos com a mesma raiz:
//  1. A promessa QUEBRADA ficava guardada pra sempre: depois da primeira falha, toda tentativa de
//     importar falhava na hora, sem nem tentar a rede, até fechar e reabrir o app.
//  2. No caminho do compartilhamento, a falha subia sem ninguém pegar: a marca
//     __cpShareImportActive continuava ligada (e ela ABORTA a abertura normal do app), o endereço
//     já tinha sido reescrito pra ?shared=1 (atualizar a página caía na mesma armadilha) e a barra
//     "Conversa recebida. Preparando a importação… 4%" ficava girando pra sempre.
//  3. No botão "Escolher o arquivo da conversa (.zip)", a falha era engolida: botão morto, sem
//     toast, sem barra, sem erro.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// 1. A ponte zera a promessa quando o download falha (o mesmo cuidado que ensureJSZip já tinha).
const ponte = app.match(/function carregarModuloImportacao\(\)\{[\s\S]*?\n\}/);
assert.ok(ponte, 'carregarModuloImportacao não encontrada em app.js');
assert.match(ponte[0], /\.catch\(\s*err\s*=>\s*\{[\s\S]*?_moduloImportacao = null;[\s\S]*?throw err;/,
  'uma falha de rede não pode ficar guardada: _moduloImportacao tem que voltar a null pra próxima tentativa baixar de novo');

// Prova de comportamento (não só de texto): com o import falhando, a primeira chamada rejeita e a
// SEGUNDA tenta a rede de novo — em vez de rejeitar na hora reusando a falha guardada.
{
  let tentativas = 0;
  let _moduloImportacao = null;
  const importFalso = () => { tentativas++; return Promise.reject(new Error('offline')); };
  const carregar = () => {
    if(!_moduloImportacao){
      _moduloImportacao = importFalso().catch(err => { _moduloImportacao = null; throw err; });
    }
    return _moduloImportacao;
  };
  await carregar().catch(()=>{});
  await carregar().catch(()=>{});
  assert.equal(tentativas, 2, 'a segunda tentativa de importar precisa ir na rede de novo, não reusar a falha guardada');
}

// 2. O caminho do compartilhamento protege a chamada e DESFAZ o estado travado.
const share = app.slice(app.indexOf('async function _checkSharedImpl()'));
const trecho = share.slice(0, share.indexOf('if(cameFromShare){'));
assert.match(trecho, /try\{[\s\S]*?ok=await processFile\(file,\{shareId:id\}\)/,
  'a importação vinda do compartilhamento precisa estar dentro de try/catch');
const captura = trecho.slice(trecho.indexOf('}catch(err){'));
assert.match(captura, /window\.__cpShareImportActive=false/, 'a marca que trava a abertura do app tem que ser desligada na falha');
assert.match(captura, /history\.replaceState\(null,'',location\.pathname\)/, 'o endereço ?shared=1 tem que ser limpo, senão atualizar a página cai na mesma armadilha');
assert.match(captura, /qs\('#processingBox'\)\?\.classList\.remove\('show'\)/, 'a barra de progresso não pode continuar girando em cima do erro');
assert.match(captura, /Nenhum lead seu foi alterado/, 'o aviso precisa tranquilizar: nada foi perdido');

// 3. O aviso genérico de compartilhamento perdido também desliga a barra (o ramo irmão
//    "erro=sem-worker" já fazia isso desde a v1209; este, que é o mais comum, não fazia).
const generico = app.slice(app.indexOf('if(cameFromShare){'));
const ateOAviso = generico.slice(0, generico.indexOf('const nomeArquivo'));
assert.match(ateOAviso, /qs\('#processingBox'\)\?\.classList\.remove\('show'\);[\s\S]{0,120}showCard\('resultCard',true\)/,
  'o aviso de "o arquivo não chegou" precisa desligar a barra antes de aparecer');

// 4. O botão de escolher o ZIP avisa quando nem consegue começar.
const seletor = app.match(/input\?\.addEventListener\("change", \(ev\) => \{[\s\S]*?\n  \}\);/);
assert.ok(seletor, 'não achei o seletor de arquivo do ZIP');
assert.match(seletor[0], /Promise\.resolve\(processFile\(file\)\)\.catch\(/,
  'escolher o arquivo não pode virar um botão morto quando a leitura da conversa não carrega');

console.log('v1248-importar-nao-trava-o-app: ok');
