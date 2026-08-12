import fs from 'node:fs';
import assert from 'node:assert/strict';

const raiz = new URL('../', import.meta.url);
const ler = (a) => fs.readFileSync(new URL(a, raiz), 'utf8');
const app = ler('app.js');
const css = ler('styles.css');
const html = ler('index.html');
const proposta = ler('js/proposta.js');
const importacao = ler('js/importacao.js');

// v1234 — três pedidos do dono no mesmo dia (12/08/2026):
//
//   1. "o q falamos ontem sobre as cores aleatórias q não são da paleta?" — print da Agenda. O
//      botão "Excluir" saía ROSA (#ffd7de sobre rgba(244,118,138,.10)) e havia mais famílias de
//      cor soltas espalhadas (magenta, ciano-neon antigo, roxo diferente, vermelhos variados).
//   2. "isso aqui precisa chamar mais a atenção também" — print do bloco da agenda no topo, que
//      sumia no fundo escuro (números cinza, contorno quase invisível).
//   3. "quero poder quebrar a linha nas observações e descrição da permuta... senão fica tudo
//      socado na mesma linha na proposta" — print da proposta com tudo numa tira só.

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. NENHUMA COR FORA DA PALETA pode voltar
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // Paleta oficial (styles.css :root): coral #FF6258, ciano #56C7F2, risco #E35454,
  // cérebro #9B8CFF + os neutros petróleo/cinza. Estas são as que foram embora na v1234.
  const proibidas = [
    ['#ffd7de',        'rosa claro (era o texto do botão Excluir)'],
    ['#ffdbe2',        'rosa claro (era o .btn.danger)'],
    ['#ff8a8a',        'vermelho solto'],
    ['#ff8a80',        'vermelho solto'],
    ['#ff7f74',        'vermelho solto'],
    ['#ffc4f4',        'rosa claro (avisos)'],
    ['#bdf8ff',        'ciano-neon claro'],
    ['#efffb0',        'verde-limão'],
    ['244,118,138',    'rosa (fundo/borda do Excluir)'],
    ['255,80,80',      'vermelho solto'],
    ['255,120,120',    'vermelho solto'],
    ['255,45,155',     'magenta'],
    ['55,232,255',     'ciano-neon antigo'],
    ['0,212,255',      'ciano-neon antigo'],
    ['196,92,255',     'roxo diferente do --cerebro'],
  ];
  const arquivos = { 'app.js':app, 'styles.css':css, 'index.html':html, 'js/proposta.js':proposta, 'js/importacao.js':importacao };
  for(const [cor, oquee] of proibidas){
    // aceita com ou sem espaço depois das vírgulas (rgba(255, 80, 80) e rgba(255,80,80))
    const re = new RegExp(cor.replace(/,/g, '\\s*,\\s*').replace('#','#'), 'i');
    for(const [nome, txt] of Object.entries(arquivos)){
      assert.ok(!re.test(txt), `${nome}: a cor ${cor} (${oquee}) não é da paleta e não pode voltar`);
    }
  }
  // E o botão Excluir da Agenda agora usa o vermelho oficial do sistema.
  const iniCard = app.indexOf('function agendaCardHTML(');
  const card = app.slice(iniCard, app.indexOf('\n}', iniCard));
  assert.match(card, /removerLembrete/, 'o botão Excluir continua no cartão da Agenda');
  assert.match(card, /rgba\(227,84,84/, 'o Excluir usa o vermelho oficial (--risco = 227,84,84)');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. O BLOCO DA AGENDA NO TOPO precisa saltar aos olhos
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  assert.match(css, /\.cp-agbloco\{[^}]*height:36px!important/, 'o bloco ficou maior (36px)');
  assert.match(css, /\.cp-agbloco-met\{[^}]*color:var\(--cp-text,var\(--text\)\)!important/,
    'os números do bloco saem na cor de texto (não mais no cinza apagado)');
  // Com agenda hoje / com atraso, a metade de hoje fica PREENCHIDA (não mais só tingida).
  assert.match(css, /#topBell\.cp-hoje-alerta\{background:var\(--acao\)!important/,
    'com compromisso hoje o sino fica preenchido no ciano da agenda');
  assert.match(css, /#topBell\.cp-hoje-atraso\{background:var\(--risco\)!important/,
    'com atraso o sino fica preenchido no vermelho oficial');
  assert.match(css, /#topBell\.cp-hoje-atraso\{[^}]*animation:cpAgPulsa/, 'o atraso pulsa pra puxar o olho');
  assert.match(css, /prefers-reduced-motion: reduce\)\{ #topBell\.cp-hoje-atraso\{animation:none/,
    'quem pediu menos movimento na tela não é obrigado a ver o pulso');
  assert.match(css, /html\[data-theme="light"\] #topBell\.cp-hoje-alerta\{color:#fff!important\}/,
    'no tema claro o texto sobre o ciano é branco (contraste conferido no navegador)');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. QUEBRA DE LINHA na descrição da permuta e nas observações da proposta
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // O campo da permuta virou caixa de várias linhas (era input de uma linha só).
  assert.match(html, /<textarea class="prop-input" id="pf-permuta-desc"/,
    'a descrição da permuta precisa ser uma caixa de várias linhas');
  assert.doesNotMatch(html, /<input class="prop-input" type="text" id="pf-permuta-desc"/,
    'não pode voltar a ser campo de uma linha só');
  assert.match(html, /<textarea id="pf-obs"/, 'observações continua sendo caixa de várias linhas');
  // E a proposta impressa precisa RESPEITAR as linhas (sem isto o navegador junta tudo).
  assert.match(html, /\.pp-idesc\{[^}]*white-space:pre-line\}/,
    'a descrição da condição precisa preservar as quebras de linha na proposta');
  assert.match(html, /\.pp-obs #pp-obs\{white-space:pre-line\}/,
    'as observações precisam preservar as quebras de linha na proposta');
  // O texto continua sendo escapado (não vira HTML) — quebrar linha não pode abrir essa porta.
  assert.match(proposta, /tr\.innerHTML = `<td><div class="pp-itit">\$\{escapeHtml\(tit\)\}<\/div><div class="pp-idesc">\$\{descHtml \? desc : escapeHtml\(desc\)\}/,
    'a descrição escrita pelo corretor continua escapada');
  assert.match(proposta, /qs\("#pp-obs"\)\.textContent = obs;/,
    'as observações continuam entrando como texto puro (textContent)');
}

console.log('v1234-paleta-destaque-topo-e-quebra-linha: ok');
