import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1249 — ORDEM DIRETA DO DONO, repetida várias vezes: no produto dele **nada é "importado"**.
// A conversa é EXPORTADA no WhatsApp e ENVIADA/COMPARTILHADA com o Corretor Pro. "Importar" é
// palavra de programador e não descreve o que ele faz — ele compartilha.
//
// Este teste tranca o vocabulário DA TELA. Nomes internos de código (ids, classes, arquivos)
// continuam como estão de propósito: trocá-los não muda nada pro dono e só geraria risco.

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// Tira comentários (HTML e JS) — o vocabulário proibido vale pro que APARECE, não pra explicação
// escrita no código.
const semComentarios = (txt) => txt
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

// 1. Os caminhos que levam à tela falam a língua do dono.
// v1252 — o botão que ficava na tela Hoje do celular foi removido a pedido dele; sobrou o item do
// menu da esquerda (computador), o título da tela e o cartão do Menu, todos checados aqui.
assert.match(html, /<\/svg><\/span>Enviar conversa<\/button>/, 'item do menu da esquerda: "Enviar conversa"');
assert.match(html, /<div class="label">Enviar conversa do WhatsApp<\/div>/, 'título da tela: "Enviar conversa do WhatsApp"');
assert.match(html, /<div class="menu-card-titulo">Enviar conversa<\/div>/, 'cartão do Menu: "Enviar conversa"');

// 2. O desenho do ícone aponta pra CIMA (enviar), não pra baixo (baixar/importar).
const setaEnviar = '<path d="M12 16V4"/><path d="M8 8l4-4 4 4"/>';
assert.equal((html.match(new RegExp(setaEnviar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1,
  'o atalho precisa do ícone de ENVIAR (seta pra cima) — seta pra baixo lê como "baixar"');

// 3. Nenhum texto visível pode voltar a dizer "importar/importação" pro dono.
const proibido = /Importar conversa|Importa[çc][ãa]o (descartada|em andamento)|Aguardando importa[çc][ãa]o/i;
for (const [nome, fonte] of [['index.html', html], ['app.js', app]]) {
  const visivel = semComentarios(fonte);
  const achado = visivel.match(proibido);
  assert.equal(achado, null, `${nome}: texto de tela ainda diz "${achado?.[0]}" — a conversa é ENVIADA pelo compartilhar do WhatsApp, nunca importada`);
}

console.log('v1249-a-conversa-e-enviada-nunca-importada: ok');
