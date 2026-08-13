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
{
  const bloco = pipeline.slice(
    pipeline.indexOf('AÇÃO E NOVIDADE QUE NÃO EXISTEM — PROIBIDO'),
    pipeline.indexOf('LINGUAGEM DE IA — PROIBIDO')
  );
  assert.ok(bloco.length > 200, 'a regra precisa existir no pedido enviado à IA');

  // Ação que o corretor não fez.
  for(const verbo of ['conferiu', 'pesquisou', 'separou', 'verificou', 'aproveitou pra ver']){
    assert.ok(bloco.includes(verbo), `a regra precisa citar "${verbo}" — é o tipo de ação inventada do print`);
  }
  // Novidade que não existe (as frases exatas que o dono flagrou).
  for(const frase of ['surgiram opções novas', 'as melhores opções disponíveis hoje', 'tenho novidades']){
    assert.ok(bloco.includes(frase), `a regra precisa citar a frase inventada "${frase}"`);
  }
  // A saída permitida: oferecer fazer AGORA, em vez de dizer que já fez.
  assert.match(bloco, /O QUE É PERMITIDO no lugar: OFERECER fazer agora/, 'a regra precisa dizer o que fazer no lugar');
  assert.match(bloco, /Verbo no futuro ou no\ncondicional — nunca no passado/, 'a regra precisa fixar o tempo verbal');
  // Conversa parada é justamente onde a IA inventa um motivo pra voltar.
  assert.match(bloco, /o motivo tem que ser real/, 'conversa parada não autoriza inventar motivo de retomada');

  // A regra vale sempre: fica no prompt de SISTEMA, fora do Cérebro (que é configurável e pode
  // estar vazio numa conta nova).
  assert.ok(
    pipeline.indexOf('AÇÃO E NOVIDADE QUE NÃO EXISTEM — PROIBIDO') > pipeline.indexOf('=== FIM DO CÉREBRO COMERCIAL ==='),
    'a regra precisa estar no prompt de sistema, valendo inclusive em modo prévia'
  );

  // E o código continua NÃO reescrevendo mensagem: a correção é pela regra, não por filtro local.
  assert.match(pipeline, /Nenhuma sugestão de mensagem é reinterpretada, corrigida ou substituída pelo código\./,
    'a decisão de não mexer no conteúdo das sugestões continua valendo');
}

console.log('v1219-esperando-resposta-e-nada-de-novidade-inventada: ok');
