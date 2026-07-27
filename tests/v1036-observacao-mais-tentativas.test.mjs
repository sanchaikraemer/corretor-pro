import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1036 — o dono testou a correção da v1034 (2 tentativas) e relatou que, mesmo assim, "só na
// terceira tentativa salvou": a rede do celular às vezes demora mais que duas tentativas de 30s
// (uma logo atrás da outra) pra reconectar depois de voltar do WhatsApp. Sobe pra 3 tentativas
// automáticas — o mesmo número que confirmadamente funcionou pro dono — com uma pausa curta
// entre elas (dá tempo real da rede reconectar, em vez de bater de novo instantaneamente contra
// a mesma rede ainda caída) e mostra "tentativa X de 3" na tela em vez de ficar só em "Salvando…".

const ini = app.indexOf('window.cp7ObsSalvar = async function(btn){');
assert.ok(ini > -1, 'cp7ObsSalvar não encontrada em app.js');
const fim = app.indexOf('\nwindow.ui670Reanalisar', ini);
assert.ok(fim > ini, 'fim de cp7ObsSalvar não encontrado');
const bloco = app.slice(ini, fim);

// 1. Três tentativas, não duas.
assert.match(bloco, /const TENTATIVAS = 3;/, 'precisa tentar salvar a observação 3 vezes antes de desistir (não mais 2)');
assert.match(bloco, /for\(let tentativa=1;\s*tentativa<=TENTATIVAS\s*&&\s*!data;\s*tentativa\+\+\)/,
  'o laço de tentativas precisa ir até TENTATIVAS (3), parando cedo se já deu certo');

// 2. Pausa entre tentativas (não bate de novo instantaneamente contra a rede ainda caída).
assert.match(bloco, /if\(tentativa<TENTATIVAS\)\s*await new Promise\(r=>setTimeout\(r,\s*1500\)\)/,
  'precisa esperar um pouco entre as tentativas, não repetir instantaneamente');

// 3. Feedback visível de que está tentando de novo (não fica preso em "Salvando…" as 3 vezes).
assert.match(bloco, /tentando de novo \(tentativa \$\{tentativa\} de \$\{TENTATIVAS\}\)/,
  'o corretor precisa ver que o app está tentando de novo, não só "Salvando…" parado');

// 4. Só desiste (lança erro) depois que TODAS as tentativas falharam.
assert.match(bloco, /if\(!data\) throw ultimoErro \|\| new Error\("Não foi possível salvar a observação\.\"\);/,
  'só pode mostrar erro depois que nenhuma das 3 tentativas deu certo');

console.log('v1036-observacao-mais-tentativas: ok');
