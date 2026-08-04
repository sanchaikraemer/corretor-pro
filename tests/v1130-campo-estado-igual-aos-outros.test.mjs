import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1130 — o dono mandou print da tela de criar conta: o campo "Estado (UF)" saía com o visual cru
// do navegador (fundo claro, moldura amarelada, altura diferente) no meio de campos escuros. Causa:
// `contas-estilo.css` estilizava `input` e nunca `select`, e o cadastro é a única tela dessas com
// uma caixinha de escolha — então ela era o único campo sem estilo nenhum do formulário inteiro.
//
// Guarda de regressão: a mesma regra que veste os campos de digitar precisa vestir também as
// caixinhas de escolha. Sem isto, um `select` novo em qualquer tela de conta nasce feio de novo, e
// nenhum outro teste enxergaria — é diferença visual, não erro de execução.

const css = fs.readFileSync(new URL('../contas-estilo.css', import.meta.url), 'utf8');
const cadastro = fs.readFileSync(new URL('../cadastro.html', import.meta.url), 'utf8');

// 1. A regra base dos campos precisa valer pros dois tipos ao mesmo tempo (mesma altura, mesma
//    borda, mesmo fundo — é o que garante que fiquem lado a lado sem destoar).
const regraBase = /(^|\})\s*([^{}]*\bselect\b[^{}]*)\{([^}]*)\}/m.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''));
assert.ok(/input\s*,\s*select\s*\{/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')),
  'contas-estilo.css precisa vestir `input, select` na MESMA regra — foi a separação entre os dois que deixou o campo Estado feio');

const blocoBase = /input\s*,\s*select\s*\{([^}]*)\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''))?.[1] || '';
for (const prop of ['padding', 'border-radius', 'border', 'background', 'color', 'font-size']) {
  assert.match(blocoBase, new RegExp(`\\b${prop}\\s*:`),
    `a regra compartilhada de input/select precisa definir ${prop} (senão os dois campos não ficam iguais)`);
}

// 2. Sem a setinha nativa não adianta pintar o resto: ela vem com o fundo claro colado nela.
assert.match(css, /select\s*\{[^}]*appearance\s*:\s*none/,
  'o `select` precisa esconder a setinha nativa (ela traz o visual claro do navegador junto)');
assert.match(css, /select\s*\{[^}]*background-image\s*:\s*url\(/,
  'escondendo a setinha nativa, é obrigatório desenhar uma no lugar — senão não dá pra saber que o campo abre uma lista');

// 3. As telas de conta são escuras: o navegador precisa saber disso pra desenhar a listinha que
//    abre (e as barras de rolagem) no tom certo.
assert.match(css, /color-scheme\s*:\s*dark/,
  'contas-estilo.css precisa declarar color-scheme: dark — é o que faz a lista do campo Estado abrir escura');

// 4. Foco: o destaque precisa ser o nosso nos DOIS tipos de campo, não o contorno padrão do
//    navegador em um e o nosso no outro.
assert.match(css.replace(/\/\*[\s\S]*?\*\//g, ''), /input:focus\s*,\s*select:focus\s*\{/,
  'input e select precisam compartilhar o mesmo destaque de foco');

// 5. Enquanto nada foi escolhido, "UF" é dica (cinza), não resposta. O CSS não enxerga qual opção
//    está selecionada, então quem marca isso é o cadastro.html — se a classe sumir de um dos dois
//    lados, o campo volta a parecer preenchido sem estar.
assert.match(css, /select\.sem-escolha\s*\{[^}]*color\s*:/,
  'contas-estilo.css precisa da regra .sem-escolha (o "UF" em cinza de dica)');
assert.match(cadastro, /classList\.toggle\(\s*['"]sem-escolha['"]/,
  'cadastro.html precisa ligar/desligar a classe .sem-escolha conforme o corretor escolhe o estado');

// 6. As 27 UFs continuam lá (a faxina visual não pode ter comido nenhuma).
const ufs = [...cadastro.matchAll(/<option>([A-Z]{2})<\/option>/g)].map(m => m[1]);
assert.equal(ufs.length, 27, `o campo Estado precisa listar as 27 UFs — achei ${ufs.length}`);
assert.ok(ufs.includes('RS') && ufs.includes('SP') && ufs.includes('DF'), 'faltou UF na lista');

console.log('v1130-campo-estado-igual-aos-outros: ok');
