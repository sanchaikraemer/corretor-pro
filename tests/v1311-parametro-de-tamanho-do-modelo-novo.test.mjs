import fs from 'node:fs';
import assert from 'node:assert/strict';
import { criarChatComLimite, limiteDeSaida } from '../api/_pipeline.js';

// v1311 — TODA ANÁLISE VOLTAVA ERRO 400, E NÃO ERA FALTA DE CRÉDITO.
//
// Print do dono (19/08/2026, 16h15, logo depois de recarregar os créditos da OpenAI):
//   "[HTTP 400 · code=unsupported_parameter · type=invalid_request_error] Unsupported parameter:
//    'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead."
//
// A v1308 subiu o modelo da análise para a linha atual da OpenAI (gpt-5.6-terra) e deixou o
// parâmetro antigo no pedido. Nessa família a OpenAI RECUSA `max_tokens` — ou seja, desde as 14h34
// daquele dia nenhuma análise saía, e cada tentativa morria antes de gastar um centavo.

const raiz = new URL('../', import.meta.url);
const pipeline = fs.readFileSync(new URL('api/_pipeline.js', raiz), 'utf8');
const diagnostico = fs.readFileSync(new URL('api/diagnostico.js', raiz), 'utf8');

// ── 1. O nome certo por família de modelo (executado) ────────────────────────────────────────
{
  assert.deepEqual(limiteDeSaida('gpt-5.6-terra', 3600), { max_completion_tokens: 3600 },
    'o modelo da análise de hoje exige o nome novo');
  assert.deepEqual(limiteDeSaida('gpt-5.6-sol', 900), { max_completion_tokens: 900 });
  assert.deepEqual(limiteDeSaida('o3-mini', 700), { max_completion_tokens: 700 });
  assert.deepEqual(limiteDeSaida('gpt-4o-mini', 700), { max_tokens: 700 },
    'os modelos antigos continuam com o nome antigo');
  assert.deepEqual(limiteDeSaida('gpt-4.1', 16), { max_tokens: 16 });
  assert.deepEqual(limiteDeSaida('gpt-5.6-terra', 0), {}, 'sem número, nenhum dos dois entra');
}

// ── 2. E se o modelo mudar de novo, a chamada se conserta sozinha ────────────────────────────
// Nome de modelo é configurado na hospedagem (DIRECIONA_MAIN_MODEL) e muda sem publicar código:
// depender só da lista acima seria repetir o defeito daqui a alguns meses.
{
  const chamadas = [];
  const openaiFalso = {
    chat: { completions: { create: async (corpo) => {
      chamadas.push(corpo);
      if (Object.prototype.hasOwnProperty.call(corpo, 'max_tokens')) {
        throw new Error("400 unsupported_parameter: Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.");
      }
      return { ok: true };
    } } }
  };
  const r = await criarChatComLimite(openaiFalso, { model: 'modelo-futuro', max_tokens: 500, messages: [] });
  assert.deepEqual(r, { ok: true }, 'a segunda tentativa precisa dar certo');
  assert.equal(chamadas.length, 2, 'uma tentativa com cada nome, e só');
  assert.equal(chamadas[1].max_completion_tokens, 500, 'o valor é o mesmo, só o nome muda');
  assert.ok(!('max_tokens' in chamadas[1]), 'e o nome recusado sai do pedido');

  // O caminho contrário (modelo antigo que só aceita o nome velho) também se conserta.
  const chamadas2 = [];
  const openaiAntigo = {
    chat: { completions: { create: async (corpo) => {
      chamadas2.push(corpo);
      if (Object.prototype.hasOwnProperty.call(corpo, 'max_completion_tokens')) {
        throw new Error("400 unsupported_parameter: Unsupported parameter: 'max_completion_tokens'.");
      }
      return { ok: true };
    } } }
  };
  await criarChatComLimite(openaiAntigo, { model: 'modelo-antigo', max_completion_tokens: 300, messages: [] });
  assert.equal(chamadas2[1].max_tokens, 300);

  // Erro que NÃO é de parâmetro não pode virar segunda chamada (nem gasto duplo).
  let tentativas = 0;
  const openaiSemCredito = {
    chat: { completions: { create: async () => { tentativas++; throw new Error('429 insufficient_quota: You have no credits remaining.'); } } }
  };
  await assert.rejects(() => criarChatComLimite(openaiSemCredito, { model: 'x', max_tokens: 10, messages: [] }), /no credits/);
  assert.equal(tentativas, 1, 'falta de crédito não se resolve repetindo — uma chamada só');
}

// ── 3. Nenhum pedido à OpenAI escreve mais o nome do parâmetro na mão ────────────────────────
{
  const chamadasCruas = pipeline.match(/chat\.completions\.create\(\{[\s\S]{0,600}?max_tokens:/g) || [];
  assert.equal(chamadasCruas.length, 0,
    'toda chamada precisa passar por criarChatComLimite/limiteDeSaida — senão o defeito volta na próxima troca de modelo');
  assert.doesNotMatch(diagnostico, /max_tokens: 16/,
    'o Diagnóstico precisa chamar do mesmo jeito que a análise real, senão acusa erro onde não há');
  assert.match(diagnostico, /criarChatComLimite\(oaRaw, \{/, 'inclusive no teste da chave da OpenAI');
  assert.match(pipeline, /\.\.\.limiteDeSaida\(model, maxOutputTokens\),/,
    'a chamada da análise (a que quebrou) precisa usar o nome certo');
}

console.log('v1311-parametro-de-tamanho-do-modelo-novo: ok');
