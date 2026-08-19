import fs from 'node:fs';
import assert from 'node:assert/strict';
import { mensagensJaEnviadasPeloCorretor } from '../api/_pipeline.js';

// v1309 — "De novo, as sugestões estão sendo as mesmas coisas já enviadas. Você não está lendo o
// histórico do cliente." (dono, 19/08/2026, com o print da conversa da cliente do apartamento
// anunciado por R$ 430 mil.)
//
// Ele estava certo, e havia DUAS causas somadas:
//
//   1. quando a análise nova não é concluída (teto do dia, Cérebro sem instruções, IA fora do ar,
//      tempo estourado), o app devolve a análise ANTERIOR pra ele não ficar sem nada — e as três
//      mensagens dessa análise anterior são exatamente as que ele já copiou e mandou. Na tela elas
//      apareciam iguaizinhas a sugestões novas, e o motivo da falha nem aparecia;
//   2. a IA não recebia o texto do que o corretor já tinha escrito nesta conversa. A lista de
//      perguntas já feitas (v1297) não cobre este caso: o que se repetiu foi a INFORMAÇÃO
//      ("são 2 dormitórios e box de garagem, apartamento novo, pronto para morar"), não a pergunta.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. O que o corretor já mandou vira FATO no pedido (executado, não lido) ───────────────────
{
  const timeline = [
    { author: 'Construtora Senger', text: 'Anúncio do Facebook Olá, temos um apartamento com 2 dormitórios e box de garagem por R$ 430.000. Quer agendar uma visita?' },
    { author: 'Rose Groders Quality', text: 'Olá! Quero saber mais sobre o apartamento de R$ 430 mil.' },
    { author: 'Construtora Senger', text: 'Bom dia Rose, obrigado pelo interesse! Te passo as informações atualizadas do apartamento anunciado por R$ 430 mil: são 2 dormitórios e box de garagem, apartamento novo, pronto para morar.' },
    { author: 'Rose Groders Quality', text: 'Oi, gostaria de saber mais detalhes, inclusive a localização!' },
    { author: 'Construtora Senger', text: 'ok' },
    { author: 'Construtora Senger', text: '[Arquivo enviado nesta mensagem: vídeo — conteúdo não analisado pela IA]' }
  ];
  const jaEnviadas = mensagensJaEnviadasPeloCorretor(timeline, 'Construtora Senger', {});

  assert.ok(
    jaEnviadas.some(t => t.includes('são 2 dormitórios e box de garagem, apartamento novo, pronto para morar')),
    'a mensagem que o corretor já mandou precisa chegar à IA — é a que voltou como "sugestão"'
  );
  assert.ok(!jaEnviadas.some(t => t.includes('Quero saber mais')), 'mensagem do CLIENTE não entra nesta lista');
  assert.ok(!jaEnviadas.includes('ok'), 'concordância de uma palavra não ensina nada e só ocupa espaço');
  assert.ok(!jaEnviadas.some(t => /Arquivo enviado/.test(t)), 'anexo não é texto escrito por ele');
  assert.ok(jaEnviadas.length <= 6, 'a lista é das mais recentes, não da conversa inteira');
}

// ── 2. E entra no pedido com a regra de não repetir ───────────────────────────────────────────
{
  assert.match(pipeline, /MENSAGENS QUE O CORRETOR JÁ ENVIOU NESTA CONVERSA/,
    'o bloco precisa existir no pedido enviado à IA');
  assert.match(pipeline, /Nenhuma das três mensagens pode repetir o que está aí em cima/,
    'com a regra de não repetir — nem reescrito com outras palavras');
  assert.match(pipeline, /\$\{blocoJaEnviadas \? `\\n\\n\$\{blocoJaEnviadas\}` : ""\}/,
    'e precisa estar realmente colado no prompt (não só declarado)');
}

// ── 3. Quando a análise nova não sai, a tela DIZ que as sugestões são as antigas — e por quê ──
{
  assert.match(pipeline, /function motivoDaAnaliseNovaNaoTerValido\(analiseNova\)/,
    'o motivo da falha da análise nova precisa ser calculado');
  assert.match(pipeline, /analiseReutilizadaMotivo: motivoDaAnaliseNovaNaoTerValido\(analiseNova\)/,
    'e viajar junto da análise reaproveitada');
  assert.match(pipeline, /const salva = manterAnaliseSalva\(previousAnalysis, analysis\);/,
    'a análise que falhou precisa ser passada, senão não há motivo nenhum a informar');

  const fonte = pipeline.match(/function motivoDaAnaliseNovaNaoTerValido\(analiseNova\) \{[\s\S]*?\n\}/);
  const motivo = new Function(`${fonte[0]}; return motivoDaAnaliseNovaNaoTerValido;`)();
  assert.match(motivo({ validacaoSugestoes: ['Limite diário de 5 análises atingido.'] }), /Limite diário de 5/,
    'quando o servidor sabe o motivo, é ele que aparece');
  assert.match(motivo({ mode: 'limite_diario_excedido' }), /teto de análises do dia/i);
  assert.match(motivo({ mode: 'erro_api' }), /não respondeu/i);
  assert.ok(motivo(null).length > 0, 'sem nada em mãos, ainda sai uma frase em português');

  assert.match(app, /Estas três mensagens são da análise ANTERIOR deste cliente\./,
    'o aviso precisa vir colado nas sugestões, não num quadro pequeno longe delas');
  assert.match(app, /Por que a nova não saiu:/, 'com o motivo real do servidor');
  assert.match(app, /const motivoReuso = cp704Text\(a\.analiseReutilizadaMotivo\);/,
    'lido da própria análise devolvida');
}

console.log('v1309-sugestao-antiga-nao-se-passa-por-nova: ok');
