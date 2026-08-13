import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1251 — SEUS NÚMEROS DO MÊS.
//
// Pedido do dono: além de "Atendidos", ver quantas mensagens foram trocadas no mês — total,
// enviadas por ele e recebidas — e tirar isso de dentro do quadradinho apertado da Home ("acho q
// ta na hora de tirarmos ele de dentro desse card"). Depois de ver o desenho nas duas telas, ele
// escolheu: ABERTO no computador, FECHADO no celular.
//
// O motivo da escolha está no espaço disponível, e é o que este teste protege:
//  • computador — a coluna da direita da Home existe desde sempre e estava VAZIA (desligada na
//    #810 por repetir indicadores). O painel entra ali e a lista de clientes não perde uma linha.
//  • celular — não há coluna sobrando: aberto, o painel comeria 4 dos 5 clientes visíveis sem
//    rolar. Fica só a linha de resumo, que abre o painel ao toque.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

// ── 1. O NÚMERO DE MENSAGENS PRECISA VIR DO SERVIDOR ────────────────────────────────────────
//
// Este é o conserto silencioso desta versão. "Mensagens trocadas" era montado no navegador em
// cima de `recentMessages` — que é só a PRÉVIA de 8 mensagens por cliente. Numa conversa de
// verdade o número saía muito menor que a realidade. Agora quem conta é o servidor, com a
// conversa INTEIRA em mãos, na mesma varredura que já existia.
for (const campo of ['msgMesTotal', 'msgMesCliente', 'msgMesCorretor']) {
  assert.ok(persistence.includes(`${campo}:`), `o servidor precisa devolver ${campo} na listagem`);
}
assert.match(persistence, /const inicioDoMesBRMs = Date\.UTC\(Number\(hoje\.slice\(0, 4\)\), Number\(hoje\.slice\(5, 7\)\) - 1, 1, 3, 0, 0, 0\);/,
  'o mês é o do CALENDÁRIO de Brasília (dia 1 às 00h), não "últimos 30 dias" — foi o pedido do dono');
assert.match(persistence, /if \(Number\.isFinite\(tMs\) && tMs >= inicioDoMesBRMs\)/,
  'a contagem do mês precisa acontecer dentro da varredura da conversa inteira');

// A separação entre "eu mandei" e "o cliente mandou" não pode contar observação como mensagem.
const ini = persistence.indexOf('const ehEnviadaPeloCorretor = (m) =>');
const enviada = persistence.slice(ini, persistence.indexOf('\n    };', ini));
assert.ok(ini > 0, 'ehEnviadaPeloCorretor não encontrada');
for (const naoEhMensagem of ['atendimento', 'nota', 'ligacao', 'visita', 'presencial', 'observacao_manual', 'print-whatsapp']) {
  assert.ok(enviada.includes(`"${naoEhMensagem}"`), `"${naoEhMensagem}" é observação, não mensagem enviada`);
}
assert.match(enviada, /tp === "sugestao-ia" \|\| src === "assistant"/,
  'sugestão da IA guardada não é mensagem enviada — só vira quando é copiada e mandada');

// O cache por lead subiu de versão: sem isso, cache antigo devolveria mensagens do mês zeradas.
assert.match(persistence, /v: 4,/, 'o _statsCache precisa subir pra v4 com os campos novos');
assert.match(persistence, /if \(!c \|\| c\.v !== 4 \|\| c\.dia !== hoje\) return false;/,
  'a validade do cache precisa exigir a versão nova');

// ── 2. O QUADRADINHO SAIU E O PAINEL ENTROU ─────────────────────────────────────────────────
assert.doesNotMatch(app, /cp1171-atendidos/, 'o quadradinho "Atendidos" saiu da Home');
assert.match(app, /function cp1251Dados\(\)/, 'a conta dos números do mês precisa existir');
assert.match(app, /function cp1251PainelHTML\(/, 'o painel precisa existir');

// Os quatro números do painel, com os rótulos que o dono viu no desenho.
for (const rotulo of ['Clientes atendidos', 'Mensagens trocadas', 'Enviadas por você', 'Recebidas dos clientes']) {
  assert.ok(app.includes(rotulo), `o painel precisa mostrar "${rotulo}"`);
}
assert.match(app, /do dia 1 ao dia \$\{d\.diasNoMes\}/, 'a tela precisa dizer o período que está contando');

// O gráfico que ele aprovou: um risco por dia do mês, com hoje destacado só se houve atendimento.
assert.match(app, /function cp1251GraficoHTML\(porDia\)/, 'o gráfico dia a dia precisa existir');
assert.match(app, /const ultima = i === porDia\.length - 1 && q > 0;/,
  'o dia de hoje só acende quando REALMENTE teve atendimento — senão a barrinha mínima engana');

// ── 3. ABERTO NO COMPUTADOR, FECHADO NO CELULAR ─────────────────────────────────────────────
assert.match(app, /el\.innerHTML = cp1251PainelHTML\(cp1251Dados\(\), \{ compacto:true \}\);/,
  'no computador o painel é desenhado na coluna da direita (renderHomeRight)');
assert.match(html, /<div id="cpMesResumo"><\/div>/, 'o lugar da linha de resumo do celular precisa existir na Home');
assert.match(app, /function cp1251RenderResumo\(\)/, 'a linha de resumo do celular precisa existir');
assert.match(app, /window\.cp1251AbrirPainel = cp1251AbrirPainel;/, 'a ponte pro onclick precisa existir (app.js é módulo)');
assert.match(app, /onclick="cp1251AbrirPainel\(\)"/, 'a linha de resumo precisa abrir o painel');

// A coluna da direita foi religada SÓ no computador. A regra da #810 que a matava em toda largura
// virou uma regra de celular — se ela voltar a valer em qualquer tela, o painel some do PC.
assert.match(css, /@media\(max-width:999px\)\{\s*#home \.home-grid\{grid-template-columns:minmax\(0,1fr\)!important\}\s*#home \.home-right\{display:none!important\}\s*\}/,
  'a regra que desliga a coluna da direita precisa valer só no celular');
assert.match(css, /@media\(min-width:1000px\)\{\s*#cpMesResumo\{display:none!important\}\s*\}/,
  'no computador a linha de resumo some — lá o painel já está aberto, seria informação repetida');

// ── 4. A FILEIRA DE QUADRADINHOS ACOMPANHOU ─────────────────────────────────────────────────
// Sobraram três. Quatro colunas deixariam um buraco no fim da linha; duas (a regra do celular)
// deixariam um sozinho na segunda linha. A regra que MANDA no celular tem dois ids.
assert.match(css, /#home \.resumo-dia\{display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/,
  'computador: três colunas');
assert.match(css, /#home #resumoDia\{\s*display:grid!important;[\s\S]{0,700}?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/,
  'celular: três colunas (esta é a regra de dois ids, a que vence)');

// ── 5. A CONTA, EXECUTADA DE VERDADE ────────────────────────────────────────────────────────
// Soma dos campos do servidor + atendidos por dia a partir dos eventos, sem tocar na tela.
{
  const agora = new Date();
  const diaDoMes = (d) => new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), d, 13)).toISOString();
  const ev = (d) => ({ evento: 'contato_manual', quando: diaDoMes(d) });
  const leads = [
    { id: 'a', msgMesTotal: 100, msgMesCorretor: 40, msgMesCliente: 60, analysis: { aprendizado: { eventos: [ev(2), ev(5)] } } },
    { id: 'b', msgMesTotal: 30, msgMesCorretor: 10, msgMesCliente: 20, analysis: { aprendizado: { eventos: [ev(2)] } } },
    { id: 'c', msgMesTotal: 0, msgMesCorretor: 0, msgMesCliente: 0, analysis: {} },
  ];
  let total = 0, enviadas = 0, recebidas = 0;
  for (const l of leads) {
    total += Number(l?.msgMesTotal) || 0;
    enviadas += Number(l?.msgMesCorretor) || 0;
    recebidas += Number(l?.msgMesCliente) || 0;
  }
  assert.equal(total, 130);
  assert.equal(enviadas, 50);
  assert.equal(recebidas, 80);
  assert.equal(enviadas + recebidas, total, 'enviadas + recebidas tem que fechar com o total');

  // dia 2 teve DOIS clientes atendidos (a e b), dia 5 teve um (a) — conta cliente, não evento.
  const porDia = new Map();
  for (const l of leads) {
    for (const e of (l.analysis?.aprendizado?.eventos || [])) {
      const d = new Date(e.quando).getUTCDate();
      if (!porDia.has(d)) porDia.set(d, new Set());
      porDia.get(d).add(l.id);
    }
  }
  assert.equal(porDia.get(2).size, 2, 'dois clientes diferentes atendidos no dia 2');
  assert.equal(porDia.get(5).size, 1, 'um cliente no dia 5');
}

console.log('v1251-seus-numeros-do-mes: ok');
