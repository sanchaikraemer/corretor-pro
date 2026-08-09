import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1189 — "CLIENTE RESPONDEU" NÃO É ALGO QUE O APP TEM COMO SABER. Regra do dono, dita mais de
// uma vez (v1158: "retire isso e do código também, já te falei ontem que você não tem como
// saber, pois não é integrado com o WhatsApp"; repetida em 09/08/2026 ao revogar a v1188):
//
//   O app lê um RETRATO da conversa — o arquivo que o corretor exporta — não o WhatsApp ao vivo.
//   O corretor SEMPRE responde o cliente no WhatsApp, na hora. A mensagem do cliente só entra no
//   app quando ele importa, e NESSE momento o app já analisa e gera a resposta (fluxo
//   automático). Dias depois, "a última fala é do cliente" significa só "ainda não reimportou" —
//   nunca "cliente esperando resposta". Qualquer alerta/categoria/fila construída em cima disso
//   cobra o corretor por conversa que ele já respondeu (o ruído que v938/v1019/v1052 mataram:
//   só o atendimento MARCADO decide descanso e retomada).
//
// A v1188 caiu exatamente nessa: achou o detector órfão (morto desde a troca de geração da
// Home), concluiu "feature perdida" e o religou — mesmo erro da v1186 com o painel de duplicados
// (NOTAS-v1187: órfão NÃO é feature perdida). Este teste trava as portas pra isso nunca voltar.
//
// O que NÃO está em jogo aqui: a pergunta manual "O cliente respondeu?" depois de mandar
// mensagem (evento cliente_respondeu do aprendizado) continua — ali é o CORRETOR informando um
// fato, não o app adivinhando.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const codigo = app.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

// ── 1. O detector e os ajudantes que só serviam a ele saíram de vez ──────────────────────────
assert.doesNotMatch(codigo, /cp786ClienteRespondeu|cp786UltimoFoiCliente|cp786UltimaMensagemTs|cp786UltimoAtendimentoTs/,
  'o detector de "cliente respondeu" e seus ajudantes não podem voltar (nem como órfãos)');

// ── 2. A categoria 'respondeu' não existe em produção, ordem, rótulo, contagem ou grupo ──────
assert.doesNotMatch(codigo, /'respondeu'|"respondeu"/,
  "nenhum código pode produzir ou comparar a categoria 'respondeu'");
assert.doesNotMatch(codigo, /respondeu:0|respondeu:'|respondeu:\[|respondeu:grupos|respondeu,agora/,
  "nenhuma ordem, contagem, mapa de rótulos ou grupo da Home pode ter a chave 'respondeu'");
assert.doesNotMatch(app, /\["Cliente respondeu"/, 'a linha "Cliente respondeu" não pode voltar pra legenda do gráfico');

// ── 3. A fila do dia decide como o dono mandou: só nunca-atendido ou prazo vencido ───────────
const filaSrc = app.match(/function cpFilaFazerAgora\(items\)\{[\s\S]*?\n\}/)[0];
assert.match(filaSrc, /return !ehContatadoHoje\(l\) && !cp786TemCompromisso\(l\) && \(nuncaAtendido \|\| passouPrazo\);/,
  'a regra v1069/v1052 é a única: NUNCA atendido ou descanso vencido (contado do atendimento MARCADO) — sem furo por "cliente respondeu"');

// ── 4. E o comportamento: cliente falou por último DENTRO do descanso → nada de prioridade ───
// (é o caso que a v1188 promovia: atendi ontem, importei, a última fala é dele. O dono já
// respondeu no WhatsApp — o app deixa o lead descansar como sempre.)
const catSrc = app.match(/function cp786Categoria\(l,modelo=null,ultimaReal=null\)\{[\s\S]*?\n\}/)[0];
{
  const fn = new Function(
    'cp786TemCompromisso','cpAguardandoResposta','emJanelaDeEspera','mensagensDoCliente',
    'CP_MIN_MSGS_PRIORIDADE','entraEmRetomada','leadEhAtivo',
    `${catSrc}\nreturn cp786Categoria;`
  );
  // Atendido ontem (dentro da janela) e o cliente falou depois → cpAguardandoResposta é false
  // (a última fala é dele) e entraEmRetomada é false (descanso). Resultado: 'sem-acao' — o lead
  // descansa em "Total de leads", sem virar cobrança.
  const categoria = fn(()=>false, ()=>false, ()=>true, ()=>10, 5, ()=>false, ()=>true)({});
  assert.equal(categoria, 'sem-acao',
    'cliente que falou por último dentro do descanso NÃO vira prioridade — o corretor já respondeu no WhatsApp');
}

console.log('v1189-cliente-respondeu-nao-existe: ok');
