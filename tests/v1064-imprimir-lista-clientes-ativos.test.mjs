import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v1064 — pedido do dono: "eu quero uma lista pra imprimir" dos clientes ATIVOS (sem
// arquivados), pra olhar/guardar uma vez. Testado de verdade num navegador (Playwright/Chromium
// headless) antes de fechar esta versão: abri a tela "Carteira ativa", cliquei no botão
// "🖨️ Imprimir lista" de verdade (não chamando a função direto) e confirmei que só os clientes
// ativos aparecem (o "Vendido" ficou de fora), que o texto é escapado (sem XSS) e que o PDF
// gerado tem 1 página só — achei e corrigi 2 bugs nesse processo:
// 1) o filtro de impressão da tela "Gerador de proposta" já existente em index.html usa
//    "visibility:hidden!important", que ganhava da minha regra sem !important;
// 2) "visibility:hidden" sozinho não tira o espaço do resto do app da página — sobrava uma 2ª
//    folha em branco; resolvido com display:none nos outros filhos diretos do body.
// Depois, pra não brigar com o print da Proposta em impressões futuras, escondi minha regra
// atrás de uma classe (body.cp1064-imprimindo) ligada só durante ESTA impressão.
// Este teste (estático, no padrão já usado pelo resto da suíte) trava esses achados no código.

// ===== Parte A — a função existe, filtra só ativos e não chama o servidor de novo =====
const fnMatch = app.match(/function imprimirCarteiraAtiva\(\)\{[\s\S]*?\n\}\nwindow\.imprimirCarteiraAtiva/);
assert.ok(fnMatch, 'imprimirCarteiraAtiva não encontrada em app.js');
const fn = fnMatch[0];

assert.match(fn, /leadEhAtivo/, 'precisa usar o mesmo filtro de "ativo" (leadEhAtivo) usado pela tela Carteira ativa — arquivados fora, sem regra própria e divergente');
assert.match(fn, /state\?\.(todosLeads|itemsAtivos|carteiraLeads)/, 'precisa usar os leads já carregados em memória, sem chamada nova ao servidor');
assert.match(fn, /escapeHtml\(l\.name/, 'nome do cliente precisa ser escapado (nunca HTML cru — risco de XSS via nome importado)');
assert.match(fn, /window\.print\(\)/, 'precisa disparar a impressão do navegador');
assert.match(app, /window\.imprimirCarteiraAtiva\s*=\s*imprimirCarteiraAtiva/, 'precisa expor a função em window (onclick precisa alcançá-la)');

// ===== Parte B — a classe de impressão só liga/desliga por esta função (não vaza pro resto) =====
assert.match(fn, /classList\.add\(["']cp1064-imprimindo["']\)/, 'precisa ligar a classe que escopa o CSS de impressão só pra esta lista');
assert.match(fn, /afterprint/, 'precisa soltar a classe no evento "afterprint" — soltar logo após print() quebraria a impressão no celular (onde print()/compartilhar não trava a execução)');

// ===== Parte C — o botão real existe na tela "Carteira ativa" (filtro "todos" da Condução) =====
assert.match(app, /filtro===['"]todos['"]\?'<button type="button" onclick="imprimirCarteiraAtiva\(\)">/,
  'o botão "Imprimir lista" só pode aparecer na visão "Carteira ativa" (filtro todos), igual ao "Ver clientes ativos"');

// ===== Parte D — CSS: escapa da briga com o print já existente da tela "Gerador de proposta" =====
assert.match(css, /body\.cp1064-imprimindo\s*\*\{visibility:hidden!important\}/,
  '!important precisa vencer o "body *{visibility:hidden!important}" que já existe pro print da Proposta em index.html');
assert.match(css, /body\.cp1064-imprimindo\s*#cpImprimirLista,body\.cp1064-imprimindo\s*#cpImprimirLista\s*\*\{visibility:visible!important\}/,
  'precisa forçar visível só dentro da classe de impressão, nunca fora dela');
assert.match(css, /body\.cp1064-imprimindo>\*:not\(#cpImprimirLista\)\{display:none!important\}/,
  'precisa tirar o resto do app do FLUXO da página (display:none, não só visibility:hidden) — sem isso sobra folha em branco na impressão');

console.log('v1064-imprimir-lista-clientes-ativos: ok');
