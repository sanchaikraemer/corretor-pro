import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// v963 — revisão de api/analisar.js. Era a ÚNICA rota do projeto sem requireApiKey() — rodava o
// pipeline completo da OpenAI (transcrição + análise, o trabalho mais caro do app) pra qualquer
// POST não autenticado. Já tinha sido flagado como achado em NOTAS-v860.md ("rota pública que
// gasta crédito") e adiado a pedido do dono na época; nesta revisão o mesmo problema apareceu de
// novo (segunda vez, independente) — corrigido agora com o mesmo requireApiKey() que toda outra
// rota já usa.
//
// Guarda de regressão: em vez de travar só nesse arquivo, varre TODO handler de rota em api/ e
// garante que cada um chama requireApiKey (ou, a partir da v998, resolveOrganizationId — que
// por dentro sempre passa por requireApiKey no caminho sem login novo, e é mais forte que ela
// quando existe login; ou, a partir da v1035, resolveOrganizationIdByAtalhoToken — mesma força,
// mas pra chamadas do Atalho do iPhone, que não tem sessão do Supabase; ou, a partir da v1038,
// requirePlatformAdmin — mais forte ainda, exige login real de administrador da plataforma, usada
// em rotas que não fazem sentido pra nenhum corretor comum; ou, a partir da v1128,
// requireLoginSemEmpresa — confirma o token de login no Supabase igual às outras, mas SEM exigir
// que o login já tenha empresa, porque a única rota que a usa é justamente a que cria a empresa
// de quem acabou de se cadastrar) — pra um endpoint novo nunca nascer sem alguma dessas checagens.

const apiDir = new URL('../api/', import.meta.url);
const arquivos = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));

const rotasSemHandler = []; // arquivos utilitários (sem "export default async function handler") — não são rota HTTP.
const rotasVerificadas = [];
const rotasSemApiKey = [];

for (const nome of arquivos) {
  const src = fs.readFileSync(new URL(nome, apiDir), 'utf8');
  const ehRota = /export default async function handler\s*\(/.test(src);
  if (!ehRota) { rotasSemHandler.push(nome); continue; }
  rotasVerificadas.push(nome);
  if (!/requireApiKey\s*\(/.test(src) && !/resolveOrganizationId\s*\(/.test(src) && !/resolveOrganizationIdByAtalhoToken\s*\(/.test(src) && !/requirePlatformAdmin\s*\(/.test(src) && !/requireLoginSemEmpresa\s*\(/.test(src)) rotasSemApiKey.push(nome);
}

// v1083 — api/analisar.js foi removida (rota de compatibilidade sem nenhum chamador). A
// varredura genérica acima continua valendo pra TODA rota que existir em api/.
assert.ok(rotasVerificadas.length >= 8, `esperava achar pelo menos 8 rotas com handler, achei ${rotasVerificadas.length}: ${rotasVerificadas.join(', ')}`);
assert.deepEqual(rotasSemApiKey, [], `toda rota (handler default) precisa chamar requireApiKey — faltando em: ${rotasSemApiKey.join(', ')}`);

console.log(`v963-todas-rotas-exigem-api-key: ok (${rotasVerificadas.length} rotas verificadas, ${rotasSemHandler.length} arquivo(s) utilitário(s) ignorado(s): ${rotasSemHandler.join(', ')})`);
