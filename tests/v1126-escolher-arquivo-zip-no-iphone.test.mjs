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

// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
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
// v1130 — os passos da Home deixaram de ser cpPassosComoFunciona() (texto corrido) e viraram
// cpPassosImportar() (lista numerada, com o caminho do WhatsApp por extenso). O que este teste
// protege continua igual: iPhone e Android não podem receber a MESMA instrução, e o iPhone nunca
// pode ser mandado "compartilhar com o Corretor Pro" — lá isso não existe.
const ajuda = app.match(/function cpTextoAjudaImportar\(\)\{[\s\S]*?\n\}/)[0];
const passos = app.match(/function cpPassosImportar\(\)\{[\s\S]*?\n\}/)[0];
for (const [nome, txt] of [['ajuda da tela', ajuda], ['passos da Home', passos]]) {
  assert.match(txt, /cpEhIOS\(\)/, `${nome}: precisa distinguir iPhone de Android`);
}
assert.match(ajuda, /Atalho/,
  'a ajuda do iPhone precisa apontar o Atalho, que é o jeito de aparecer na lista de compartilhar');

// 4) Comportamento isolado: o mesmo texto NÃO pode sair pros dois aparelhos, e só o do Android
//    pode mandar "compartilhar o ZIP com o Corretor Pro".
function rodar(fnSrc, nomeFn, ehIphone, ehDesktop = false) {
  const fn = new Function('navigator', `
    function cpEhIOS(){ return ${ehIphone ? 'true' : 'false'}; }
    function isDesktop(){ return ${ehDesktop ? 'true' : 'false'}; }
    ${fnSrc}
    return ${nomeFn};
  `);
  return fn({ userAgent: '', platform: '', maxTouchPoints: 0 })();
}
const passosIphone = rodar(passos, 'cpPassosImportar', true).join(' | ');
const passosAndroid = rodar(passos, 'cpPassosImportar', false).join(' | ');
assert.notEqual(passosIphone, passosAndroid, 'iPhone e Android precisam receber instruções diferentes');
assert.doesNotMatch(passosIphone, /toque no <b>ícone do Corretor Pro<\/b>/i,
  'no iPhone essa instrução é impossível de cumprir — foi ela que travou o dono');
assert.match(passosAndroid, /ícone do Corretor Pro/i,
  'no Android o compartilhar continua sendo o caminho principal');
assert.match(passosIphone, /Salvar em Arquivos/, 'no iPhone, salvar em Arquivos e escolher aqui');
assert.match(passosIphone, /Atalho/, 'no iPhone os passos também apontam o Atalho, que evita o vai e volta');

const ajudaIphone = rodar(ajuda, 'cpTextoAjudaImportar', true);
assert.match(ajudaIphone, /Escolher o arquivo da conversa/, 'a ajuda do iPhone aponta o botão novo');

console.log('v1126-escolher-arquivo-zip-no-iphone: ok');
