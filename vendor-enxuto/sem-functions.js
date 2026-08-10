// v1196 — SUBSTITUTO VAZIO DAS "EDGE FUNCTIONS" DO SUPABASE.
//
// O Corretor Pro não usa Edge Functions: as rotas de servidor são as da Vercel, em `api/*.js`,
// chamadas por `fetch("./api/...")`. O navegador nunca chama `.functions.invoke(` (varredura da
// v1196; a guarda `tests/v1196-supabase-enxuto.test.mjs` cobra isso).

const AVISO = 'As rotas de servidor do Corretor Pro são as de /api (Vercel), não Edge Functions do ' +
  'Supabase. Se isso mudar, remova a troca do módulo em build.js (vendor-enxuto/sem-functions.js).';

export class FunctionsError extends Error {
  constructor(mensagem, nome = 'FunctionsError', contexto) { super(mensagem || AVISO); this.name = nome; this.context = contexto; }
}
export class FunctionsFetchError extends FunctionsError {
  constructor(contexto) { super('Falha ao enviar a requisição', 'FunctionsFetchError', contexto); }
}
export class FunctionsRelayError extends FunctionsError {
  constructor(contexto) { super('Erro de retransmissão', 'FunctionsRelayError', contexto); }
}
export class FunctionsHttpError extends FunctionsError {
  constructor(contexto) { super('Erro de resposta', 'FunctionsHttpError', contexto); }
}
export const FunctionRegion = { Any: 'any' };
export class FunctionsClient {
  constructor(url, opcoes = {}) { this.url = url; this.headers = opcoes.headers || {}; this.region = opcoes.region || FunctionRegion.Any; }
  setAuth() {}
  invoke() { throw new Error(AVISO); }
}
