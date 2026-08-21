import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1138 — item 4 do plano do dono: o app passa a COBRAR o corretor. A pesquisa da auditoria de
// 05/08/2026: a maioria das vendas sai depois do 5º contato e quase metade dos corretores para no
// 1º — e os concorrentes ganham exatamente no lembrete automático.
//
// O app grava um retrato local a cada carga de leads, e o service worker — acordado pelo navegador
// uma vez por dia (Periodic Background Sync, Android com app instalado) — mostra a notificação com
// o app fechado. Sem rota nova (o limite de 12 funções da Vercel está em 11), sem servidor, sem
// dado saindo do aparelho.
//
// v1190 — DUAS COISAS MUDARAM DE RAIZ AQUI, e este teste passou a travar as duas:
//
// 1) A FONTE. O lembrete nascia de cpLeadsAguardandoResposta — "clientes esperando resposta há
//    mais de 24h", deduzido de lastInteractionAt/daysSinceClientReply/lastCorretorMsgIso, ou seja,
//    de quem falou por último no retrato importado. É a inferência que a v1158 e a v1189 baniram:
//    o app não é integrado ao WhatsApp, o corretor já respondeu lá, e a notificação cobrava
//    conversa resolvida. Agora o retrato conta só fato registrado com data: compromisso atrasado
//    + a dose de "Fazer agora" do dia, pela MESMA fila oficial que o sino do topo usa.
// 2) A PRIVACIDADE. O retrato guardava até 3 NOMES DE CLIENTES e o worker os imprimia na tela
//    bloqueada do celular. Nome de cliente não entra mais nem no retrato nem na notificação.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// 1) A inferência proibida não pode voltar por nenhum caminho.
// ---------------------------------------------------------------------------
assert.doesNotMatch(app, /function cpLeadsAguardandoResposta\s*\(/,
  'cpLeadsAguardandoResposta foi removida na v1190 — se voltou, a cobrança sem lastro voltou junto');
// lastCorretorMsgIso continua existindo e pode: cpUltimoContatoCorretorTs o usa pra medir há
// quanto tempo O CORRETOR não fala com o cliente (régua dos resgates), o que é fato, não palpite.
// O que não pode é ele voltar a decidir quem entra na cobrança do lembrete diário.
// v1268 — o fim do bloco era marcado por 'function leadEhQuente', que foi apagada na faxina (era
// usada só por um filtro de tela que já não existia). Com o marcador ausente, o indexOf devolvia
// -1 e a fatia passava a ser o ARQUIVO QUASE INTEIRO — o teste falhava sem nada estar errado.
// Agora o marcador é o fim real do bloco, e a fatia é conferida antes de valer.
const iniLembrete = app.indexOf('CP_LEMBRETE_DIARIO_KEY');
const fimLembrete = app.indexOf('window.cpLembreteDiario = cpLembreteDiario;', iniLembrete);
assert.ok(iniLembrete > -1 && fimLembrete > iniLembrete, 'não achei o bloco do lembrete diário em app.js');
const blocoLembrete = app.slice(iniLembrete, fimLembrete);
assert.ok(blocoLembrete.length > 500, 'o bloco do lembrete diário encolheu demais — confira o marcador');
assert.ok(blocoLembrete.length < app.length / 3, 'a fatia pegou muito mais que o bloco do lembrete');
assert.doesNotMatch(blocoLembrete.replace(/\/\/[^\n]*/g, ''), /lastCorretorMsgIso|daysSinceClientReply|lastInteractionAt/,
  'o lembrete diário não pode voltar a deduzir pendência de quem falou por último');

// ---------------------------------------------------------------------------
// 2) A régua nova — comportamento de verdade, com casos reais.
// ---------------------------------------------------------------------------
const fnSrc = app.match(/function cpAcoesFactuaisDeHoje\(items\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpAcoesFactuaisDeHoje não encontrada');
const contar = new Function(
  'leadEhAtivo', 'cp786CompromissoAtrasado', 'cpFilaFazerAgora', 'cpFazerAgoraDose',
  `${fnSrc[0]}; return cpAcoesFactuaisDeHoje;`
)(
  (l) => l.etapa !== 'Arquivado',
  (l) => !!l._atrasado,
  (items) => items.filter(l => l._naFila),
  () => 3
);

const leads = [
  { name: 'Ana', etapa: 'Ativo', _atrasado: true },                 // compromisso vencido: conta
  { name: 'Bruno', etapa: 'Ativo', _naFila: true },                 // entrou na fila oficial: conta
  { name: 'Carla', etapa: 'Ativo', _naFila: true },                 // idem
  { name: 'Davi', etapa: 'Ativo' },                                 // sem fato nenhum: não conta
  { name: 'Gil', etapa: 'Arquivado', _atrasado: true, _naFila: true } // arquivado nunca cobra
];
const acoes = contar(leads);
assert.equal(acoes.atrasados, 1, 'só o compromisso atrasado de lead ativo conta');
assert.equal(acoes.fazerAgora, 2, 'a fila oficial entra pela contagem dela, limitada pela dose do dia');
assert.equal(acoes.total, 3, 'total = compromisso atrasado + dose de "Fazer agora"');

// A dose limita: fila grande não vira número inflado na notificação.
const filaGrande = Array.from({ length: 12 }, (_, i) => ({ name: `L${i}`, etapa: 'Ativo', _naFila: true }));
assert.equal(contar(filaGrande).fazerAgora, 3, 'a dose do dia (3) é o teto — igual ao que a tela entrega');

// Lead que falou por último NÃO entra por isso: sem fato com data, não há cobrança.
const soFalouPorUltimo = [{
  name: 'Eva', etapa: 'Ativo',
  daysSinceClientReply: 1, lastInteractionAt: new Date(Date.now() - 30 * 3600e3).toISOString(),
  lastCorretorMsgIso: new Date(Date.now() - 50 * 3600e3).toISOString()
}];
assert.equal(contar(soFalouPorUltimo).total, 0,
  'cliente que falou por último no retrato importado NÃO gera cobrança (v1190)');

// ---------------------------------------------------------------------------
// 3) O retrato é gravado a cada carga de leads — e sem nome de cliente.
// ---------------------------------------------------------------------------
assert.match(app, /cpAtualizarRetratoAcoes\(all\)/,
  'toda carga do dashboard precisa atualizar o retrato que o lembrete lê');
const retratoSrc = app.match(/function cpAtualizarRetratoAcoes\(items\)\{[\s\S]*?\n\}/);
assert.ok(retratoSrc, 'cpAtualizarRetratoAcoes não encontrada');
assert.doesNotMatch(retratoSrc[0], /nome/i, 'o retrato não pode gravar nome de cliente (v1190)');
assert.match(retratoSrc[0], /calculadoEm: Date\.now\(\)/,
  'o retrato carrega quando foi calculado — é o que deixa o worker ser honesto com dado velho');

// ---------------------------------------------------------------------------
// 4) O worker: tag certo, anti-incômodo, honestidade com retrato velho e SEM nomes.
// ---------------------------------------------------------------------------
assert.match(sw, /addEventListener\('periodicsync'/, 'o worker precisa ouvir o periodicsync');
assert.match(sw, /event\.tag !== 'cp-cobranca-diaria'/, 'só o tag do lembrete dispara');
// v1344 — a trava deixou de ser "a cada 20 horas" e passou a ser "um por DIA DE CALENDÁRIO". A de
// horas descartava o despertar do dia seguinte quando o do dia anterior tinha sido tarde, e junto
// com a janela de horário da v1336 quase matou o lembrete (ver v1344-lembrete-nao-morre-pela-janela).
// A garantia guardada aqui é a mesma de sempre: nunca dois avisos no mesmo dia.
assert.match(sw, /if \(diaDoUltimoAviso === hoje\) return;/, 'no máximo um aviso por dia de calendário');
assert.match(sw, /idade > 30 \* 24 \* 60 \* 60 \* 1000/, 'retrato com mais de 30 dias PARA de avisar — insistir com dado morto só faz silenciar o app');
assert.match(sw, /idade > 48 \* 60 \* 60 \* 1000/, 'retrato com mais de 48h vira texto genérico (o número pode ter mudado)');
assert.match(sw, /ações comerciais para revisar/, 'o texto do aviso fala de ação comercial, não de cliente esperando');
assert.match(sw, /addEventListener\('notificationclick'/, 'tocar no aviso precisa abrir o app');
assert.match(sw, /openWindow\('\/'\)/, 'sem janela aberta, abre uma nova');
assert.ok(!/fetch\(/.test(sw.slice(sw.indexOf("periodicsync"))),
  'o lembrete NÃO faz chamada de rede: lê só o retrato local — o worker não tem sessão e nada sai do aparelho');

// Privacidade e honestidade do texto, travadas por asserção negativa:
const blocoSync = sw.slice(sw.indexOf("periodicsync"));
assert.doesNotMatch(blocoSync, /retrato\.nomes|\.nomes\b/,
  'a notificação não pode ler nomes do retrato (v1190 — iam parar na tela bloqueada do celular)');
assert.doesNotMatch(blocoSync.replace(/\/\/[^\n]*/g, ''), /esperando sua resposta/,
  'a notificação não pode afirmar que há cliente esperando resposta (v1158/v1189/v1190)');

// ---------------------------------------------------------------------------
// 5) A tela: cartão no menu, permissão só no clique, registro do sync, honestidade.
// ---------------------------------------------------------------------------
assert.match(html, /id="lembreteDiarioCard"/, 'o cartão do lembrete precisa existir no menu');
assert.match(html, /ação comercial pra revisar/, 'o cartão diz o que o lembrete faz de verdade');
assert.doesNotMatch(html.slice(html.indexOf('lembreteDiarioCard'), html.indexOf('lembreteDiarioCard') + 900), /esperando resposta/,
  'o cartão não promete mais detectar cliente esperando resposta');
assert.match(html, /onclick="cpLembreteDiario\(\)"/, 'o botão liga/desliga');
assert.match(app, /await Notification\.requestPermission\(\)/, 'a permissão é pedida só no clique (gesto do corretor), nunca na abertura');
// v1336 — o intervalo pedido ao navegador caiu de 20h pra 4h. O que este teste guarda é o que
// sempre importou aqui: o TAG pedido é o mesmo que o worker escuta (errar o tag deixa o lembrete
// mudo sem ninguém perceber). A frequência de um aviso por dia mudou de lugar: quem garante isso é
// a trava por dia de calendário dentro do service worker (v1344).
assert.match(app, /periodicSync\.register\("cp-cobranca-diaria", \{ minInterval: \d+ \* 60 \* 60 \* 1000 \}\)/,
  'o sync periódico é registrado com o mesmo tag que o worker escuta');
assert.match(app, /o aviso em segundo plano não é suportado/,
  'onde o navegador não suporta (iPhone/desktop), o corretor fica sabendo — sem fingir que funciona');
assert.match(app, /cpLembreteDiarioDesregistrar/, 'desativar também desregistra o sync');

console.log('v1138-lembrete-diario-cobranca: ok (v1190 — fonte factual, sem nomes na notificação)');
