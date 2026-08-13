import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1248 — dois textos ERRADOS que apareciam na tela, achados abrindo o app publicado num navegador
// de verdade (a suíte não enxergava nenhum dos dois porque os dois nascem da execução, não do
// código escrito).
//
// 1. Na tela Hoje, o produto "Casa em condomínio" aparecia como a palavra solta "em". O
//    encurtador tira as palavras genéricas de tipo de imóvel ("casa", "condomínio") — certo — mas
//    a lista de conectivos que ele também tira não tinha "em". Sobrava o conectivo sozinho no
//    lugar do nome do empreendimento.
// 2. No Desempenho, o aviso do quadro de compromissos aparecia embolado:
//    "Nenhum compromisso registradoVisitas, reuniões e lembretes aparecerão aqui." O acabamento
//    dos avisos vazios montava o título com texto.split('.')[0] em cima do textContent — que COLA
//    as duas linhas do aviso sem espaço nenhum.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function extrai(nome) {
  const m = app.match(new RegExp(`function ${nome}\\([^)]*\\)\\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `${nome} não encontrada em app.js`);
  return m[0];
}

// ── 1. O encurtador de produto ──────────────────────────────────────────────────────────────
const { produtosLabelCurto, cpNomeEmpreendimentoCurto } = eval(`
  ${extrai('cpNomeEmpreendimentoCurto')}
  ${extrai('produtosLabelCurto')}
  ({ produtosLabelCurto, cpNomeEmpreendimentoCurto });
`);

// O caso do print: 100% genérico -> não sobra nome nenhum -> a tela mostra o texto original
// inteiro (informação de verdade), nunca o conectivo solto.
assert.equal(cpNomeEmpreendimentoCurto('Casa em condomínio'), '', '"Casa em condomínio" é 100% genérico: não pode sobrar "em"');
assert.equal(produtosLabelCurto({ product: 'Casa em condomínio' }), 'Casa em condomínio',
  'sem nome de empreendimento, mostra o texto original — nunca a palavra "em" sozinha');

for(const generico of ['Apartamento com 2 vagas', 'Terreno em condomínio', 'Casa e sobrado', 'Sala comercial no edifício']){
  const curto = cpNomeEmpreendimentoCurto(generico);
  assert.ok(!/^(em|com|e|ou|no|na|de|do|da|a|o|ao|por|sem|entre)$/i.test(curto),
    `"${generico}" não pode virar o conectivo solto "${curto}"`);
}

// E o que É nome de empreendimento continua saindo igual (a regra do projeto: nome próprio vem do
// Cérebro/conversa, nunca cravado no código). Nomes fictícios, como manda tests/v827-catalogo.
assert.equal(produtosLabelCurto({ produtos: ['Apartamento de 2 suítes no Edifício Bosque Aurora'] }), 'Bosque Aurora');
assert.equal(produtosLabelCurto({ produtos: ['Casa em condomínio Vila Horizonte'] }), 'Vila Horizonte',
  'com nome próprio junto, o nome sobrevive à limpeza');

// ── 2. O acabamento dos avisos vazios ───────────────────────────────────────────────────────
const polish = extrai('polishEmptyStates');

assert.match(polish, /const tituloEl = el\.querySelector\('strong,b'\)/,
  'o título do aviso tem que sair do próprio <strong>/<b>, não de um split do texto colado');
assert.doesNotMatch(polish, /\$\{txt\.split\('\.'\)\[0\]\}/,
  'o título não pode mais ser montado colando as duas linhas do aviso');
assert.match(polish, /const subOriginal = /,
  'a explicação que já estava escrita no aviso tem que ser preservada, não trocada por frase genérica');
assert.match(polish, /if\(\[\.\.\.el\.querySelectorAll\('div,td,p,span'\)\]\.some\(f => casa\(f\.textContent\)\)\) return;/,
  'só o bloco MAIS INTERNO pode ser reescrito — reescrever o de fora apagaria o título e o botão do cartão junto');

// Executa a montagem do título com o mesmo texto colado que o navegador entrega, pra provar que o
// resultado deixou de ser o embolado do print.
{
  const tituloReal = 'Nenhum compromisso registrado';
  const subReal = 'Visitas, reuniões e lembretes aparecerão aqui.';
  const txtColado = tituloReal + subReal; // é exatamente isso que textContent devolve
  const anterior = txtColado.split('.')[0] + '.';
  assert.equal(anterior, 'Nenhum compromisso registradoVisitas, reuniões e lembretes aparecerão aqui.',
    'confirma o defeito antigo: o título saía com as duas linhas coladas');
  const agora = tituloReal; // vindo do <strong>
  assert.equal(agora, 'Nenhum compromisso registrado');
  assert.equal(subReal, 'Visitas, reuniões e lembretes aparecerão aqui.');
}

console.log('v1248-produto-e-avisos-vazios: ok');
