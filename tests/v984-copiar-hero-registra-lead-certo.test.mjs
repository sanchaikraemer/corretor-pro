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

// v1293 — O BOTÃO DE COPIAR DO CARD DA HOME NÃO EXISTE MAIS, E A FUNÇÃO SAIU COM ELE.
//
// A correção da v984 (registrar o evento no lead DO CARD, não no lead aberto) valeu enquanto a
// Home desenhava cartões com botão de copiar. A v1076 trocou os cartões por linhas de tabela e o
// botão sumiu; a função `window.copiarMensagemLead` ficou no arquivo mais de 200 versões sem
// ninguém a chamar, e saiu na faxina da v1293.
//
// O que a v984 protegia continua protegido nos dois caminhos que EXISTEM: copiar dentro do
// cliente (cp704CopyMsg) e copiar na tela de importação — os dois gravam o evento com o id certo,
// conferido em v1142-copiar-sugestao-sempre-marca-atendimento e v1248-gravacoes-nao-se-atropelam.
assert.ok(!app.includes('window.copiarMensagemLead'),
  'o copiar do card da Home saiu na v1293 — se voltar, precisa voltar com botão e com esta checagem');

// O contador de "Mensagens copiadas" do Desempenho, que era o sintoma da v984, continua sendo
// alimentado pelo caminho vivo, e com o id explícito do cliente.
const copiar = app.slice(app.indexOf('window.cp704CopyMsg=async function'));
const blocoCopiar = copiar.slice(0, copiar.indexOf('\n  };'));
assert.match(blocoCopiar, /action:\s*"aprendizado"/, 'precisa registrar o evento de aprendizado direto');
assert.match(blocoCopiar, /evento:\s*"mensagem_copiada"/, 'precisa registrar o evento "mensagem_copiada"');
assert.match(blocoCopiar, /id:\s*leadId/, 'precisa gravar no cliente aberto, com o id explícito');

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
