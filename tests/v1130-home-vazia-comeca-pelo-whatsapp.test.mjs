import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1130 — relato do dono sobre a primeira tela de quem acabou de criar a conta:
//
//   "não pode iniciar dizendo 'importar conversa', a gente já falou sobre isso, que o whats não
//    salva exportação. Nessa página inicial precisa ter a informação (vá em tal lugar na sua
//    conversa do WhatsApp, exporte a conversa para o ícone do app), etc."
//
// A tela abria com um botão grande "⇪ Importar conversa do WhatsApp" e as instruções em letra
// miúda no rodapé, sob "COMO FUNCIONA". Isso promete o que o app não faz: ele não entra na conversa
// de ninguém, e o WhatsApp NÃO guarda conversa exportada em lugar nenhum — não existe arquivo
// esperando pra ser buscado. A exportação e o envio são o mesmo gesto, feito de dentro do WhatsApp.
// Quem chegava novo clicava no botão esperando ver as conversas e não via nada.
//
// Guarda de regressão: a Home vazia precisa ABRIR com o caminho dentro do WhatsApp, e o botão não
// pode voltar a prometer importação.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// O bloco da Home vazia (empty state) — o que aparece pra conta sem nenhum lead.
const bloco = app.match(/\/\/ Empty state: nenhum lead ainda[\s\S]*?<\/div>`;/);
assert.ok(bloco, 'não achei o bloco da Home vazia em app.js');
const html = bloco[0];

// 1. O título e o texto de abertura precisam mandar o corretor PRO WHATSAPP, não pro botão.
assert.match(html, /Comece pelo WhatsApp/, 'a Home vazia precisa abrir dizendo por onde começar: o WhatsApp');
assert.match(html, /não guarda conversa exportada/i,
  'precisa dizer que o WhatsApp não guarda a exportação — é o mal-entendido que o dono apontou duas vezes');

// 2. O botão não pode mais prometer "importar conversa do WhatsApp"; ele é o caso de quem JÁ tem
//    o arquivo salvo. Se alguém reescrever a tela e voltar com a promessa, este teste barra.
assert.doesNotMatch(html, /Importar conversa do WhatsApp/i,
  'o botão não pode prometer importar do WhatsApp — o app não busca conversa nenhuma');
assert.match(html, /Escolher o arquivo da conversa/,
  'o botão precisa dizer o que ele realmente faz: escolher um arquivo que já está no aparelho');
assert.match(html, /Já exportou e salvou o arquivo/i,
  'o botão precisa vir com a condição dele (só serve pra quem já exportou), senão vira a ação principal de novo');

// 3. Os passos precisam ser a parte principal da tela — lista numerada, montada por
//    cpPassosImportar(), e não um parágrafo solto no rodapé.
assert.match(html, /cpPassosImportar\(\)/, 'a Home vazia precisa montar os passos por cpPassosImportar()');
assert.match(html, /<ol[\s\S]*<li/, 'os passos precisam ser uma lista de verdade, não texto corrido');
assert.doesNotMatch(html, /Como funciona/i,
  'o rodapé "Como funciona" saiu: as instruções deixaram de ser nota de rodapé e viraram o conteúdo da tela');

// 4. O conteúdo dos passos: precisa citar o caminho concreto dentro do WhatsApp.
const passosSrc = app.match(/function cpPassosImportar\(\)\{[\s\S]*?\n\}/);
assert.ok(passosSrc, 'não achei cpPassosImportar()');
function rodar(ehIphone, ehDesktop) {
  return new Function(`
    function cpEhIOS(){ return ${ehIphone}; }
    function isDesktop(){ return ${ehDesktop}; }
    ${passosSrc[0]}
    return cpPassosImportar();
  `)();
}
for (const [nome, passos] of [
  ['iPhone', rodar(true, false)],
  ['Android', rodar(false, false)],
  ['computador', rodar(false, true)]
]) {
  const txt = passos.join(' | ');
  assert.ok(passos.length >= 4, `${nome}: os passos precisam ser detalhados (achei ${passos.length})`);
  assert.match(txt, /Exportar conversa/i, `${nome}: precisa dizer onde fica "Exportar conversa"`);
  assert.match(txt, /Incluir mídia/i, `${nome}: precisa mandar incluir mídia, senão os áudios não vêm`);
  assert.match(passos[0], /Abra o WhatsApp/i, `${nome}: o primeiro passo é abrir o WhatsApp, não mexer no Corretor Pro`);
}

// 5. No computador, o primeiro passo precisa avisar que isso é no celular — senão o corretor fica
//    procurando "Exportar conversa" no WhatsApp Web.
assert.match(rodar(false, true)[0], /celular/i,
  'no computador, o passo 1 precisa dizer que a exportação é feita no celular');

console.log('v1130-home-vazia-comeca-pelo-whatsapp: ok');
