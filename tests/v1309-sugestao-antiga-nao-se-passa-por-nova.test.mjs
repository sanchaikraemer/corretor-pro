import fs from 'node:fs';
import assert from 'node:assert/strict';
import { motivoDaAnaliseNovaNaoTerValido } from '../api/_pipeline.js';

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

// v1315 — a parte que checava "as mensagens que o corretor já enviou entram no pedido" saiu:
// aquilo era uma das camadas empilhadas no miolo da análise entre 18 e 19/08, e o dono mandou
// voltar tudo ao estado de 17/08. O que este teste guarda hoje é o aviso da análise reaproveitada,
// que é tela, não análise.

// ── 3. Quando a análise nova não sai, a tela DIZ que as sugestões são as antigas — e por quê ──
{
  assert.match(pipeline, /export function motivoDaAnaliseNovaNaoTerValido\(analiseNova\)/,
    'o motivo da falha da análise nova precisa ser calculado');
  assert.match(pipeline, /analiseReutilizadaMotivo: motivoDaAnaliseNovaNaoTerValido\(analiseNova\)/,
    'e viajar junto da análise reaproveitada');
  assert.match(pipeline, /const salva = manterAnaliseSalva\(previousAnalysis, analysis\);/,
    'a análise que falhou precisa ser passada, senão não há motivo nenhum a informar');

  const motivo = motivoDaAnaliseNovaNaoTerValido;
  assert.match(motivo({ validacaoSugestoes: ['Limite diário de 5 análises atingido.'] }), /Limite diário de 5/,
    'quando o servidor sabe o motivo, é ele que aparece');
  assert.match(motivo({ mode: 'limite_diario_excedido' }), /teto de análises do dia/i);
  assert.match(motivo({ mode: 'erro_api' }), /não respondeu/i);
  assert.ok(motivo(null).length > 0, 'sem nada em mãos, ainda sai uma frase em português');

  assert.match(app, /Estas três mensagens são da análise ANTERIOR deste cliente<\/b>/,
    'o aviso precisa vir colado nas sugestões, não num quadro pequeno longe delas');
  assert.match(app, /<b>Motivo:<\/b>/, 'com o motivo real do servidor');
  assert.match(app, /const motivoBruto = cp704Text\(a\.analiseReutilizadaMotivo\);/,
    'lido da própria análise devolvida');
  // v1314 — e traduzido na hora de mostrar: análise que falhou antes da v1310 guardou o erro cru
  // em inglês, e era ele que aparecia na tela.
  assert.match(app, /const motivoReuso = cpErroDaIAEmPortugues\(motivoBruto\) \|\| motivoBruto;/,
    'o texto técnico da OpenAI não pode chegar assim na tela do corretor');
}

console.log('v1309-sugestao-antiga-nao-se-passa-por-nova: ok');
