import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1126 — relato do dono, com prints, tentando usar o app no iPhone:
// "quando eu vou enviar a conversa, o ZIP, não consegue achar o app no iPhone pra enviar."
//
// Causa raiz: existia UM caminho só pro ZIP entrar no app — o "compartilhar com o Corretor Pro"
// (share_target do manifest), que o iPhone NÃO suporta (o Safari não implementa Web Share Target;
// pedido aberto no WebKit desde 2019). E a tela "Importar conversa" não tinha NENHUM seletor de
// arquivo. Ou seja: no iPhone o app dependia 100% de um caminho que o aparelho não tem — beco sem
// saída. No Android ninguém esbarrava nisso porque lá o compartilhar funciona.
//
// Correção: um seletor de arquivo comum na tela de importar, que reusa o MESMO processFile do
// compartilhamento, e instruções que mudam conforme o aparelho.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// 1) A tela de importar tem o seletor e o botão que o abre.
assert.match(html, /<input type="file" id="zipFileInput"[^>]*accept="[^"]*\.zip/,
  'a tela "Importar conversa" precisa de um seletor de arquivo .zip');
assert.match(html, /id="btnEscolherZip"/, 'e de um botão visível que abre esse seletor');
assert.match(html, /id="importAjuda"/, 'e do texto de ajuda que muda conforme o aparelho');

// 2) O arquivo escolhido entra pelo MESMO caminho do compartilhamento (nada de fluxo paralelo).
const liga = app.match(/\(function cpLigarSeletorDeZip\(\)\{[\s\S]*?\}\)\(\);/);
assert.ok(liga, 'não achei a ligação do seletor de arquivo');
assert.match(liga[0], /qs\("#btnEscolherZip"\)\?\.addEventListener\("click", \(\) => input\?\.click\(\)\)/,
  'o botão precisa abrir o seletor');
assert.match(liga[0], /processFile\(file\)/,
  'o arquivo escolhido precisa entrar pelo mesmo processFile do compartilhamento');
assert.match(liga[0], /ev\.target\.value = ""/,
  'precisa zerar o campo, senão escolher o MESMO arquivo de novo (depois de um erro) não faz nada');

// 3) As instruções não podem mandar o corretor de iPhone "compartilhar com o Corretor Pro" —
//    lá isso não existe, e era exatamente o que o fazia girar em falso.
const ajuda = app.match(/function cpTextoAjudaImportar\(\)\{[\s\S]*?\n\}/)[0];
const passos = app.match(/function cpPassosComoFunciona\(\)\{[\s\S]*?\n\}/)[0];
for (const [nome, txt] of [['ajuda da tela', ajuda], ['passos da Home', passos]]) {
  assert.match(txt, /cpEhIOS\(\)/, `${nome}: precisa distinguir iPhone de Android`);
}
assert.match(ajuda, /Atalho/,
  'a ajuda do iPhone precisa apontar o Atalho, que é o jeito de aparecer na lista de compartilhar');

// 4) Comportamento isolado: o mesmo texto NÃO pode sair pros dois aparelhos, e só o do Android
//    pode mandar "compartilhar o ZIP com o Corretor Pro".
function rodar(fnSrc, nomeFn, ehIphone) {
  const fn = new Function('navigator', `
    function cpEhIOS(){ return ${ehIphone ? 'true' : 'false'}; }
    ${fnSrc}
    return ${nomeFn};
  `);
  return fn({ userAgent: '', platform: '', maxTouchPoints: 0 })();
}
const passosIphone = rodar(passos, 'cpPassosComoFunciona', true);
const passosAndroid = rodar(passos, 'cpPassosComoFunciona', false);
assert.notEqual(passosIphone, passosAndroid, 'iPhone e Android precisam receber instruções diferentes');
assert.doesNotMatch(passosIphone, /Compartilhe o ZIP com o Corretor Pro/i,
  'no iPhone essa instrução é impossível de cumprir — foi ela que travou o dono');
assert.match(passosAndroid, /Compartilhe o ZIP com o Corretor Pro/i,
  'no Android o compartilhar continua sendo o caminho principal');
assert.match(passosIphone, /Salvar em Arquivos/, 'no iPhone, salvar em Arquivos e escolher aqui');

const ajudaIphone = rodar(ajuda, 'cpTextoAjudaImportar', true);
assert.match(ajudaIphone, /Escolher o arquivo da conversa/, 'a ajuda do iPhone aponta o botão novo');

console.log('v1126-escolher-arquivo-zip-no-iphone: ok');
