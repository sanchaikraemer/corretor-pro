import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1138 — item 4 do plano do dono: o app passa a COBRAR o corretor. A pesquisa da auditoria de
// 05/08/2026: a maioria das vendas sai depois do 5º contato e quase metade dos corretores para no
// 1º — e os concorrentes ganham exatamente no lembrete automático. O Corretor Pro já sabia QUEM
// estava esperando resposta (sino), mas só avisava com o app ABERTO.
//
// Agora: o app grava um retrato local (total esperando + 3 nomes) a cada carga de leads, e o
// service worker — acordado pelo navegador uma vez por dia (Periodic Background Sync, Android com
// app instalado) — mostra a notificação com o app fechado. Sem rota nova (o limite de 12 funções
// da Vercel está em 11), sem servidor, sem dado saindo do aparelho.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// 1) A régua de "esperando resposta" — comportamento de verdade, com casos reais.
// ---------------------------------------------------------------------------
const fnSrc = app.match(/function cpLeadsAguardandoResposta\(items\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpLeadsAguardandoResposta não encontrada');
const contar = new Function('leadEhAtivo', 'ultimoAtendimentoTs', `${fnSrc[0]}; return cpLeadsAguardandoResposta;`)(
  (l) => l.etapa !== 'Arquivado',
  (l) => Number(l._atendidoTs || 0)
);
const h = (horas) => new Date(Date.now() - horas * 3600 * 1000).toISOString();

const leads = [
  // Esperando de verdade: cliente falou por último, há 30h, sem atendimento depois.
  { name: 'Ana', etapa: 'Ativo', daysSinceClientReply: 1, lastInteractionAt: h(30), lastCorretorMsgIso: h(50) },
  // Esperando há mais tempo ainda (precisa vir PRIMEIRO na lista).
  { name: 'Bruno', etapa: 'Ativo', daysSinceClientReply: 3, lastInteractionAt: h(80), lastCorretorMsgIso: null },
  // O corretor respondeu DEPOIS da última mensagem real → não está esperando.
  { name: 'Carla', etapa: 'Ativo', daysSinceClientReply: 2, lastInteractionAt: h(40), lastCorretorMsgIso: h(20) },
  // Atendimento registrado depois (copiou mensagem / marcou atendido) → não está esperando.
  { name: 'Davi', etapa: 'Ativo', daysSinceClientReply: 2, lastInteractionAt: h(40), lastCorretorMsgIso: h(60), _atendidoTs: Date.now() - 10 * 3600 * 1000 },
  // Fresco demais (10h): ainda não virou cobrança.
  { name: 'Eva', etapa: 'Ativo', daysSinceClientReply: 0, lastInteractionAt: h(10), lastCorretorMsgIso: h(60) },
  // Cliente nunca mandou mensagem real (lead só de anotações): fora — o fallback de
  // lastInteractionAt (atualizado_em) faria ele entrar por engano.
  { name: 'Fabio', etapa: 'Ativo', daysSinceClientReply: null, lastInteractionAt: h(100), lastCorretorMsgIso: null },
  // Arquivado não cobra.
  { name: 'Gil', etapa: 'Arquivado', daysSinceClientReply: 5, lastInteractionAt: h(120), lastCorretorMsgIso: null }
];
const espera = contar(leads);
assert.deepEqual(espera.map(x => x.nome), ['Bruno', 'Ana'],
  `só Ana e Bruno estão esperando, com o mais antigo primeiro — veio: ${espera.map(x => x.nome).join(',')}`);

// ---------------------------------------------------------------------------
// 2) O retrato é gravado a cada carga de leads — é dele que o worker lê de madrugada.
// ---------------------------------------------------------------------------
assert.match(app, /cpAtualizarRetratoCobranca\(all\)/,
  'toda carga do dashboard precisa atualizar o retrato que o lembrete lê');
assert.match(app, /nomes: lista\.slice\(0, 3\)\.map\(x => x\.nome\)/, 'o retrato leva até 3 nomes');
assert.match(app, /calculadoEm: Date\.now\(\)/, 'o retrato carrega quando foi calculado — é o que deixa o worker ser honesto com dado velho');

// ---------------------------------------------------------------------------
// 3) O worker: acorda no tag certo, respeita anti-incômodo e honestidade com retrato velho.
// ---------------------------------------------------------------------------
assert.match(sw, /addEventListener\('periodicsync'/, 'o worker precisa ouvir o periodicsync');
assert.match(sw, /event\.tag !== 'cp-cobranca-diaria'/, 'só o tag do lembrete dispara');
assert.match(sw, /20 \* 60 \* 60 \* 1000/, 'no máximo um aviso a cada 20h — o navegador pode acordar mais vezes');
assert.match(sw, /idade > 30 \* 24 \* 60 \* 60 \* 1000/, 'retrato com mais de 30 dias PARA de avisar — insistir com dado morto só faz silenciar o app');
assert.match(sw, /idade > 48 \* 60 \* 60 \* 1000/, 'retrato com mais de 48h vira texto genérico (o número pode ter mudado)');
assert.match(sw, /esperando sua resposta há mais de 24 horas/, 'o texto do aviso diz o que importa');
assert.match(sw, /addEventListener\('notificationclick'/, 'tocar no aviso precisa abrir o app');
assert.match(sw, /openWindow\('\/'\)/, 'sem janela aberta, abre uma nova');
assert.ok(!/fetch\(/.test(sw.slice(sw.indexOf("periodicsync"))),
  'o lembrete NÃO faz chamada de rede: lê só o retrato local — o worker não tem sessão e nada sai do aparelho');

// ---------------------------------------------------------------------------
// 4) A tela: cartão no menu, permissão só no clique, registro do sync, e honestidade
//    sobre onde funciona.
// ---------------------------------------------------------------------------
assert.match(html, /id="lembreteDiarioCard"/, 'o cartão do lembrete precisa existir no menu');
assert.match(html, /cliente esperando resposta há mais de\s*\n?\s*24 horas/, 'o cartão diz o que o lembrete faz');
assert.match(html, /onclick="cpLembreteDiario\(\)"/, 'o botão liga/desliga');
assert.match(app, /await Notification\.requestPermission\(\)/, 'a permissão é pedida só no clique (gesto do corretor), nunca na abertura');
assert.match(app, /periodicSync\.register\("cp-cobranca-diaria", \{ minInterval: 20 \* 60 \* 60 \* 1000 \}\)/,
  'o sync periódico é registrado com o mesmo tag que o worker escuta');
assert.match(app, /o aviso em segundo plano não é suportado/,
  'onde o navegador não suporta (iPhone/desktop), o corretor fica sabendo — sem fingir que funciona');
assert.match(app, /cpLembreteDiarioDesregistrar/, 'desativar também desregistra o sync');

console.log('v1138-lembrete-diario-cobranca: ok');
