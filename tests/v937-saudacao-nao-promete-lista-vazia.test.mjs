import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v937 — dois pedidos/reclamações do dono:
//
// 1) "Cadê a última mensagem?" — a v934 tinha removido a metalinha "Última mensagem" do
// cabeçalho do lead (a pedido dele mesmo, na hora), mas ela é informação que falta de verdade:
// saber se o cliente respondeu DEPOIS da última análise. Voltou.
//
// 2) "E os 9 prioritários pra hoje são o quê? E os 200+ clientes são o quê?" — a saudação da
// Home dizia "9 leads pra atender hoje, de cima pra baixo", prometendo uma LISTA pronta e
// ordenada. Quando o balde de urgentes (acao-hoje/retomar-cuidado) vem vazio, essa lista não
// existe — o corpo da própria Home, bem abaixo, já mostra "Nenhum lead prioritário pelas
// regras agora" (v933). O cabeçalho contradizia o corpo na mesma tela. Agora, nesse cenário, o
// cabeçalho muda de frase pra não prometer uma lista que não existe.

// 1. "Última mensagem" está de volta no cabeçalho do lead.
const iniFoco = app.indexOf('function renderLeadFoco(lead){');
const fimFoco = app.indexOf('\nfunction ', app.indexOf('cp7ObsStatus', iniFoco));
const foco = app.slice(iniFoco, fimFoco);
assert.match(foco, /const ultimaMsgReal=\(typeof cp786UltimaMensagemReal==='function'\)\?cp786UltimaMensagemReal\(lead\):null;/,
  'deve calcular a última mensagem real de novo');
assert.match(foco, /Última mensagem — \$\{ultimaMsgEm\}/, '"Última mensagem" precisa voltar a aparecer');
assert.match(foco, /Última análise — \$\{analiseEm\}/, '"Última análise" continua aparecendo (não foi tocada)');

// 2. renderSaudacao: quando não há candidato real no balde de urgentes (acao-hoje/
// retomar-cuidado), a frase não pode mais prometer "de cima pra baixo" — precisa bater com a
// mensagem "Nenhum lead prioritário" que a Home mostra no corpo pra esse mesmo cenário.
const iniSaud = app.indexOf('function renderSaudacao(items){');
const fimSaud = app.indexOf('\nfunction ', iniSaud + 1);
const saud = app.slice(iniSaud, fimSaud);
assert.match(saud, /const semCandidatosReais ?= ?!\(\(gruposH\["acao-hoje"\]\|\|\[\]\)\.length \|\| \(gruposH\["retomar-cuidado"\]\|\|\[\]\)\.length\)/,
  'renderSaudacao precisa checar se existe candidato real no balde de urgentes');
assert.match(saud, /semCandidatosReais\s*\n?\s*\?\s*`<span class="destaque">Meta de hoje: \$\{acaoMostrada\}<\/span>, mas nenhum lead prioritário pelas regras agora/,
  'sem candidato real, a frase não pode prometer uma lista "de cima pra baixo" que não existe');

console.log('v937-saudacao-nao-promete-lista-vazia: ok');
