import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1029 — o dono confirmou (depois de perguntado) que quer exatamente o que a v1025 já fazia:
// clicar na proposta salva reabre a proposta pronta, com o "Imprimir/Salvar PDF" já disponível
// ali — não um arquivo PDF separado guardado no lead. O que faltava era deixar isso ÓBVIO na
// própria tela: a única pista que existia era um "title" (dica que só aparece passando o MOUSE
// por cima) — que nunca aparece em celular, então o balão da proposta parecia só um texto
// informativo comum, igual aos outros itens do histórico, sem nenhum convite visível pra tocar.

const fnMatch = app.match(/function cp704TimelineHtml\(lead\)\{[\s\S]*?\n  \}/);
assert.ok(fnMatch, 'cp704TimelineHtml não encontrada em app.js');
const fn = fnMatch[0];

assert.match(fn, /propHint\s*=\s*'<small class="cp704-prop-hint">Toque para abrir e imprimir/,
  'precisa existir um texto VISÍVEL (não só o title, que some no celular) convidando a tocar');
assert.match(fn, /\$\{propHint\}/, 'a dica visível precisa estar de fato dentro da div renderizada');
// A dica só pode ser ATRIBUÍDA dentro do ramo de proposta (senão vira ruído em toda mensagem).
const linhaAtribuicao = fn.match(/^.*propHint\s*=\s*'<small.*$/m)[0];
const linhaDeclaracao = fn.match(/^.*let propAttr.*propHint.*$/m)[0];
const idxIf = fn.indexOf("if(tipo==='proposta' && m.proposta){");
assert.ok(idxIf > -1 && fn.indexOf(linhaAtribuicao) > idxIf && fn.indexOf(linhaDeclaracao) < idxIf,
  'a dica só pode ganhar texto dentro do "if" de proposta — declarada vazia antes, preenchida só ali');

assert.match(app, /\.cp704-prop-hint\{/, 'precisa existir o estilo da dica visível');

console.log('v1029-proposta-dica-visivel-pra-abrir: ok');
