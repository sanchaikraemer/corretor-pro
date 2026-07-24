import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v978 — 2 pedidos do dono junto (print com círculos vermelhos apontando os dois problemas):
//
// 1) "quero as barras MAIS COMPRIDAS, MAIORES HORIZONTALMENTE" — a v976 (92px) não foi o
//    suficiente. Aumentada de novo (92px→180px desktop, 130px→190px mobile), coluna "bar" do
//    grid também (144px→240px).
// 2) "diminua um pouco o texto do imóvel... ali tem que aparecer só o nome do empreendimento" —
//    detalhe completo (dormitório/condição/preço/tipo) fica só dentro do lead. Nova função
//    produtosLabelCurto (usada SÓ na Home) limpa palavras genéricas de tipo/condição de cada
//    item de l.produtos/l.product — NUNCA um nome próprio (isso vem do Cérebro/conversa, nunca
//    cravado aqui) — e junta com " - ". produtosLabel (a versão completa) não muda; é usada em
//    todo o resto do app (dentro do lead, etc.).
//
// A coluna "pr" (produto) encolheu (1.3fr→.7fr) porque o texto agora é bem mais curto, sobrando
// espaço pra "bar" crescer sem espremer nada.
//
// Os exemplos abaixo usam nomes de empreendimento FICTÍCIOS (nunca os reais do dono — nem em
// teste; ver tests/v827-catalogo.test.mjs, que trava isso pro código ativo).

function extrai(nome) {
  const m = app.match(new RegExp(`function ${nome}\\([^)]*\\)\\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `${nome} não encontrada em app.js`);
  return m[0];
}

const curtoSrc = extrai('cpNomeEmpreendimentoCurto');
const labelCurtoSrc = extrai('produtosLabelCurto');
const labelCompletoSrc = extrai('produtosLabel');
const rowSrc = extrai('cpHomeLeadRow');

// 1. produtosLabel (completo) não foi tocada.
assert.match(labelCompletoSrc, /arr\.join\(", "\)/, 'produtosLabel continua devolvendo a lista completa (sem cortar) — usada no resto do app');

// 2. cpHomeLeadRow usa produtosLabelCurto (não produtosLabel) pro produto exibido.
assert.match(rowSrc, /produtosLabelCurto\(l\)/, 'cpHomeLeadRow usa a versão curta do produto');

// 3. Barra: 180px desktop / 190px mobile; número ao lado continua 11px/900 (não mudou de novo).
assert.match(app, /\.cp-hoje-row \.chr-track\{width:180px;height:7px/, 'barra (desktop) 180px, 7px de altura (só comprimento, não grossura)');
assert.match(app, /\.cp-hoje-row \.chr-track\{width:190px\}/, 'barra (mobile) 190px');
assert.match(app, /\.cp-hoje-row \.chr-bar b\{font-size:11px;font-weight:900/, 'número ao lado da barra não mudou de tamanho');
assert.match(app, /grid-template-columns:10px minmax\(0,1\.05fr\) minmax\(0,\.7fr\) 240px 42px/, 'coluna "bar" cresceu (240px) e "pr" encolheu (.7fr) pra caber');

// 4. Comportamento real do encurtador — casos no mesmo PADRÃO do print real do dono, com nomes
// fictícios (Bosque Aurora, Vila Horizonte etc.) no lugar dos empreendimentos reais dele.
const sandbox = `
  ${curtoSrc}
  ${labelCurtoSrc}
  ({ cpNomeEmpreendimentoCurto, produtosLabelCurto });
`;
const { produtosLabelCurto } = eval(sandbox);

// 4a. Descrição cheia -> só o nome do empreendimento.
assert.equal(produtosLabelCurto({ produtos: ['Apartamento de 2 suítes no Edifício Bosque Aurora'] }), 'Bosque Aurora');

// 4b. Vários produtos -> nomes juntados com " - ", sem repetir "Apartamento" toda hora.
// (nomes de 1 palavra de propósito — nome com preposição no meio, tipo "Recanto da Serra",
// perde o "da" junto com as preposições genéricas: limitação conhecida e aceita da heurística,
// documentada no comentário de cpNomeEmpreendimentoCurto.)
assert.equal(
  produtosLabelCurto({ produtos: ['Apartamento Horizonte', 'Apartamento Nobre', 'Apartamento Alvorada', 'Apartamento Aurora'] }),
  'Horizonte - Nobre - Alvorada - Aurora'
);

// 4c. Nome dentro de parênteses não pode ser perdido (só desembrulha, não apaga o conteúdo).
assert.equal(
  produtosLabelCurto({ produtos: ['Futuros lançamentos (Bosque Aurora)'] }),
  'Bosque Aurora'
);

// 4d. "lote NN quadra NN" e o tipo (terreno/loteamento) somem; fase (I/II, III) sobrevive porque
// pode ser parte real do nome (nunca inventa nem funde nomes diferentes por conta própria).
assert.equal(
  produtosLabelCurto({ produtos: ['Terreno Vale Verde I/II', 'lote 01 quadra 144', 'Terreno Vale Verde III'] }),
  'Vale Verde I/II - Vale Verde III'
);

// 4e. Item 100% genérico (sem nome nenhum) ao lado de um item com nome real: o genérico é
// OMITIDO — não faz sentido misturar "Vale Verde III" com "Terrenos prontos para construir"
// inteiro.
assert.equal(
  produtosLabelCurto({ produtos: ['Terreno no Loteamento Vale Verde III', 'Terrenos prontos para construir'] }),
  'Vale Verde III'
);

// 4f. SEM nome nenhum sobrando em NENHUM item — nunca inventa um nome; mostra o texto original
// completo (melhor que "--", que apagaria a única informação real que existe pra esse lead).
assert.equal(produtosLabelCurto({ produtos: ['Sala comercial'] }), 'Sala comercial');

// 4g. Lead sem produto algum -> "--" (mesma convenção de sempre, não inventa).
assert.equal(produtosLabelCurto({}), '--');
assert.equal(produtosLabelCurto(null), '--');

console.log('v978-produto-curto-barra-maior: ok');
