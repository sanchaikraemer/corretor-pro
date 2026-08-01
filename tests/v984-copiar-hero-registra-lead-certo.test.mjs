import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// v984 — o dono disse "copiei muitas, muitas sugestões de mensagem" mas o Desempenho mostrava
// "Mensagens copiadas: 0". Achado: window.copiarMensagemLead (botão de copiar rápido do card
// "Prioridade agora" na Home) registrava o evento via registrarAprendizado(evento, estilo,
// detalhes), que sempre usa state.lead?.id — o lead ABERTO na tela de detalhe. Copiando direto
// da lista da Home nenhum lead está aberto, então o evento nunca era salvo (ou, se por acaso
// outro lead estivesse aberto, era salvo no lead ERRADO). Corrigido pra registrar direto no
// lead do card (l.id) via fetch ao lead-update.

const ini = app.indexOf('window.copiarMensagemLead = function(id){');
const fim = app.indexOf('\n};', ini) + 3;
assert.ok(ini > -1, 'window.copiarMensagemLead não encontrada em app.js');
const bloco = app.slice(ini, fim);

assert.doesNotMatch(bloco, /registrarAprendizado\(/,
  'não pode mais usar registrarAprendizado aqui — ela ignora o lead do card e usa state.lead?.id (o lead aberto, se houver)');
assert.match(bloco, /action:\s*"aprendizado"/, 'precisa registrar o evento de aprendizado direto');
assert.match(bloco, /evento:\s*"mensagem_copiada"/, 'precisa registrar o evento "mensagem_copiada"');
assert.match(bloco, /id:\s*l\.id/, 'precisa usar o id do lead do CARD (l.id), não o lead aberto na tela');

// v984 — Desempenho passou de "últimos 7 dias corridos" pra "mês corrente" (dia 1 até hoje):
// pedido do dono, que revisa uma vez por mês, não por dia.
assert.match(app, /function cpInicioMesMs\(\)\{/, 'precisa existir um helper de início do mês corrente');
assert.doesNotMatch(app, /cutoff7d/, 'a janela antiga de 7 dias corridos não pode mais existir no cálculo do Desempenho');
assert.match(html, /Seu mês no Corretor Pro/, 'o título do card precisa refletir a janela mensal');
// v1106 — os subtítulos viraram dinâmicos (rotuloMes): dizem "este mês" na visão corrente e
// "em julho" quando o dono abre o mês passado — o que este teste protegia (a janela mensal)
// continua, agora com o mês explícito.
assert.match(app, /"Mensagens trocadas", `Com clientes, \$\{rotuloMes\}`/, 'o subtítulo de mensagens acompanha o mês escolhido');
assert.match(app, /"Leads atendidos", vendoMesPassado \? `Em \$\{nomeMes\(iniAnt\)\}` : "Este mês"/, 'o subtítulo de leads acompanha o mês escolhido');

console.log('v984-copiar-hero-registra-lead-certo: ok');
