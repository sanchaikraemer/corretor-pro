import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// v1100 — o dono mandou dois prints e perguntou "o q vc ve de errado ai?". Duas coisas eram texto
// mal escrito chegando na tela dele:
//
//   1. "atendido há hoje" — erro meu, criado na v1098 ao montar a explicação da coluna.
//   2. "vencido há 43 dia(s)" — o "(s)" é abreviação de programador pra não decidir singular ou
//      plural. Na tela de um corretor isso é lixo.

// ── 1. "atendido há hoje" não pode existir ────────────────────────────────────────────────────
{
  const m = app.match(/const quando = desde === 0 \?[\s\S]{0,220}?;/);
  assert.ok(m, 'não localizei a explicação da coluna "Volta em"');
  const quando = eval(`((desde) => { ${m[0]} return quando; })`);

  assert.equal(quando(0), 'atendido hoje', 'atendido no próprio dia é "hoje", sem "há"');
  assert.equal(quando(1), 'atendido ontem', 'um dia atrás é "ontem"');
  assert.equal(quando(3), 'atendido há 3 dias');
  assert.equal(quando(14), 'atendido há 14 dias');

  for (const d of [0, 1, 2, 3, 10, 14, 30]) {
    assert.doesNotMatch(quando(d), /há hoje|há ontem|há 1 dias|há \d+ dia$/,
      `"${quando(d)}" está mal escrito`);
  }
}

// ── 2. Nada de "(s)" em NENHUM texto que chega na tela ────────────────────────────────────────
// Varre só o que está dentro de texto (aspas ou crase) — comentário de código pode citar o
// defeito à vontade, e chamada de função tipo test(s) não é texto.
{
  const IGNORAR = new Set(['test(s)', 'exec(s)', 'appendChild(s)', 'querySelector(s)',
    'querySelectorAll(s)', 'semAcento(s)', 'ehDataPassada(s)', 'normalizarJanelaAudioCliente(s)', 'if(s)']);
  const ABREVIACAO = /[A-Za-zÀ-ÿ]{2,}\((s|ns|ões|es)\)/g;
  const TEXTOS = /`[^`]*`|"[^"\n]*"|'[^'\n]*'/g;

  for (const [nome, src] of [['app.js', app], ['index.html', html]]) {
    // Tira comentário de bloco, de linha inteira E de fim de linha (sem confundir com https://).
    const semComentarios = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/([^:'"\`])\/\/[^\n]*/g, '$1');
    const achados = [];
    for (const t of semComentarios.match(TEXTOS) || []) {
      for (const a of t.match(ABREVIACAO) || []) {
        if (!IGNORAR.has(a)) achados.push(a);
      }
    }
    assert.deepEqual([...new Set(achados)], [],
      `${nome} ainda tem texto com "(s)" chegando na tela: ${[...new Set(achados)].join(', ')}`);
  }
}

// ── 2b. O ajudante que escolhe singular/plural existe e funciona ──────────────────────────────
{
  const m = app.match(/function pl\(n, um, muitos\)\{[^}]*\}/);
  assert.ok(m, 'o ajudante pl() precisa existir — é o que evita "(s)" voltar');
  const { pl } = eval(`${m[0]}\n({ pl });`);
  assert.equal(pl(1, 'dia', 'dias'), 'dia');
  assert.equal(pl(0, 'dia', 'dias'), 'dias', 'zero é plural em português ("0 dias")');
  assert.equal(pl(2, 'dia', 'dias'), 'dias');
  assert.equal(pl('1', 'lead', 'leads'), 'lead', 'precisa funcionar com número em texto também');
}

// ── 3. As frases corrigidas escolhem singular/plural de verdade ───────────────────────────────
{
  const frases = [
    { re: /`O retorno combinado está vencido há \$\{idade\}[^`]*`/, v: 'idade', nome: 'retorno combinado vencido' },
    { re: /`O compromisso combinado venceu há \$\{Math\.abs\(diff\)\}[^`]*`/, v: 'Math.abs(diff)', nome: 'compromisso vencido' },
    { re: /`retorno agendado para daqui a \$\{diasLembrete\}[^`]*`/, v: 'diasLembrete', nome: 'retorno agendado' }
  ];
  for (const f of frases) {
    const m = app.match(f.re);
    assert.ok(m, `não localizei a frase "${f.nome}"`);
    assert.match(m[0], /\? "dia" : "dias"/,
      `a frase "${f.nome}" precisa escolher entre dia e dias, não usar "(s)"`);
  }

  // O efeito, com números de verdade.
  const texto = (idade) => `O retorno combinado está vencido há ${idade} ${idade === 1 ? "dia" : "dias"}. Retome pela pendência.`;
  assert.match(texto(1), /vencido há 1 dia\./, 'um dia é "1 dia"');
  assert.match(texto(43), /vencido há 43 dias\./, 'quarenta e três é "43 dias"');
}

console.log('v1100-textos-em-portugues-de-gente: ok');
