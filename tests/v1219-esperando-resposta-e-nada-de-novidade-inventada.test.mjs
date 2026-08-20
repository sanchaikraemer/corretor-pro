import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const importacao = fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1219 — dois relatos do dono no mesmo minuto.

// ══ 1. "de novo dando pau" — o app estava ESPERANDO ELE, mas a tela dizia que estava salvando ══
//
// Print: linha de andamento em "Salvando — preparando pra salvar", rodinha girando, barra quase
// cheia. Só que a importação estava PARADA, esperando ele responder "é o mesmo cliente?" logo
// abaixo. Trabalho em andamento que não termina nunca só pode ser lido como travamento.
{
  // A pergunta que espera resposta precisa mudar a linha de andamento.
  assert.match(importacao, /renderEtapas\(5, "responda a pergunta acima pra continuar", \{ aguardando: true \}\);/,
    'a única pergunta que trava a importação precisa dizer que está esperando o corretor');
  const ramo = importacao.slice(importacao.indexOf('if(nomeSoParecido){', importacao.indexOf('qs("#btnVerCadastroParecido")')));
  assert.ok(ramo.indexOf('aguardando: true') > -1 && ramo.indexOf('aguardando: true') < ramo.indexOf('}else if(perguntarNome)'),
    'o aviso pertence ao ramo do nome só parecido — os outros salvam sozinhos e continuam girando');

  // O resto é conferido EXECUTANDO renderEtapas contra um DOM falso (mesma bancada da v862):
  // o que importa é o que aparece na tela, não o texto do código.
  const ini = app.indexOf('function setBotoesImportacao(');
  const fim = app.indexOf('export function userFriendlyError(');
  const fonte = app.slice(ini, fim).replace(/^export\s+/gm, '');
  const botao = () => ({ disabled:false, classList:{ toggle(){} } });
  const el = () => ({ style:{}, textContent:'', innerHTML:'', classList:{ add(){}, remove(){} } });
  const nodes = {
    '#clearAnalysis': botao(), '#diagnoseOpenAI': botao(),
    '#processingSteps': { innerHTML:'' }, '#progressBar': el(), '#processingText': el()
  };
  const ETAPAS = ['Recebendo','Enviando','Extraindo','Transcrevendo','Analisando','Salvando','Concluído','Falha recuperável'];
  // eslint-disable-next-line no-new-func
  const { renderEtapas } = new Function('qs','escapeHtml','ETAPAS_PROCESSAMENTO','cpImportOverlaySincronizar',
    fonte + '\nreturn { renderEtapas };'
  )((sel) => nodes[sel] || null, (s) => String(s ?? ''), ETAPAS, () => {});

  // Salvando de verdade: gira, avisa que está salvando e trava os botões.
  renderEtapas(5, 'salvando no banco de dados...');
  assert.match(nodes['#processingText'].innerHTML, /<span class="spinner">/, 'salvando de verdade continua girando');
  assert.match(nodes['#processingText'].innerHTML, /^<span class="spinner"><\/span>Salvando/, 'e continua dizendo "Salvando"');
  assert.equal(nodes['#clearAnalysis'].disabled, true, 'enquanto salva de verdade, "Nova análise" fica travado');

  // Esperando o corretor: não gira, diz o que falta e devolve os botões pra ele.
  renderEtapas(5, 'responda a pergunta acima pra continuar', { aguardando: true });
  const txt = nodes['#processingText'].innerHTML;
  assert.ok(!txt.includes('spinner'), 'esperando o corretor, a rodinha NÃO pode girar — é o que fez parecer travado');
  assert.match(txt, /^Esperando sua resposta — responda a pergunta acima pra continuar/, 'a linha precisa dizer que a vez é dele');
  assert.ok(!txt.includes('Salvando'), 'não pode continuar dizendo que está salvando: não está');
  assert.match(nodes['#processingSteps'].innerHTML, /Esperando sua resposta/, 'a lista de passos também precisa mudar');
  assert.match(nodes['#processingSteps'].innerHTML, /var\(--morno\)/, 'o passo em espera não usa a cor de trabalho em curso');
  assert.equal(nodes['#clearAnalysis'].disabled, false, 'esperando resposta, "Nova análise" destrava — não há nada rodando pra proteger');
  assert.equal(nodes['#diagnoseOpenAI'].disabled, false, 'idem "Diagnóstico"');
}

// ══ 2. "eu não sugeri novas opções em momento algum. A IA está inventando" ═══════════════════
//
// Print das sugestões: "Aproveitei para conferir se surgiram opções novas desde nossa última
// conversa", "alguma alternativa diferente que tenha surgido por aqui nos últimos dias", "as
// melhores opções disponíveis hoje". Nada disso aconteceu — o corretor não conferiu nada e não
// há novidade nenhuma. As regras já proibiam inventar FATO (preço, endereço, prazo); faltava
// proibir inventar AÇÃO DO CORRETOR e NOVIDADE, que é o que apareceu aqui.
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O dono reescreveu as instruções inteiras: o bloco longo
// "AÇÃO E NOVIDADE QUE NÃO EXISTEM — PROIBIDO", com a lista de verbos e de frases flagradas nos
// prints, saiu do produto. A garantia que sobrou (e que este teste passa a guardar) está escrita
// em duas linhas curtas: nas proteções de integridade do prompt de sistema e na regra das três
// mensagens. É menos texto para o mesmo objetivo — se a invenção de ação/novidade voltar a
// aparecer nas sugestões, é aqui que precisa engrossar de novo.
{
  const integridade = pipeline.slice(
    pipeline.indexOf('Aplique sempre estas proteções de integridade'),
    pipeline.indexOf('=== INÍCIO DO CÉREBRO COMERCIAL ===')
  );
  assert.ok(integridade.length > 200, 'a regra precisa existir no pedido enviado à IA');
  assert.match(integridade, /não invente fatos, datas, autoria, materiais, valores, condições, disponibilidade, promessas ou ações/,
    'inventar ação do corretor continua proibido');
  assert.match(integridade, /não transforme silêncio em confirmação, aceite, objeção ou diagnóstico psicológico/,
    'e continua proibido adivinhar o que o cliente pensa a partir do silêncio');

// v1330 — as regras das três mensagens viraram um bloco próprio (blocoRegrasDasMensagens),
// declarado antes do prompt e colado na etapa que ESCREVE. Os recortes abaixo passaram a apontar
// pro bloco, não pro texto solto no meio do pedido.
  const inicioTres = pipeline.indexOf('const blocoRegrasDasMensagens = `');
  const tresMensagens = pipeline.slice(inicioTres, pipeline.indexOf('`;', inicioTres));
  assert.match(tresMensagens, /Não invente ação já realizada, novidade, disponibilidade, prazo, condição, urgência ou escassez/,
    'novidade inventada — o relato do print — continua proibida nas três sugestões');
  assert.match(tresMensagens, /Diferencie "vou verificar" de "verifiquei"/,
    'e o tempo verbal continua travado: oferecer fazer, nunca dizer que já fez');

  // A regra vale sempre: fica no prompt de SISTEMA, fora do Cérebro (que é configurável e pode
  // estar vazio numa conta nova).
  assert.ok(
    pipeline.indexOf('Aplique sempre estas proteções de integridade') < pipeline.indexOf('=== INÍCIO DO CÉREBRO COMERCIAL ==='),
    'a regra precisa estar no prompt de sistema, valendo inclusive em modo prévia'
  );

  // E o código continua NÃO reescrevendo mensagem: a correção é pela regra, não por filtro local.
  // (v1274: a única coisa que o código acrescenta é a saudação que faltou numa retomada — nada
  // do conteúdo comercial escrito pela IA é apagado, trocado ou reescrito.)
  assert.match(pipeline, /Nenhuma sugestão de mensagem é reinterpretada nem tem conteúdo comercial reescrito pelo\n\s*\/\/ código/,
    'a decisão de não mexer no conteúdo das sugestões continua valendo');
}

console.log('v1219-esperando-resposta-e-nada-de-novidade-inventada: ok');
