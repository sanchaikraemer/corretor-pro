import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1045 — auditoria: "para uma comercialização SaaS, o produto precisa formalizar política de
// privacidade, termos de uso, base de tratamento..." (seção 07). Cria privacidade.html e
// termos.html, publicadas e linkadas no cadastro. Não substitui revisão jurídica de verdade
// (aviso visível nas duas páginas) — mas cobre com fidelidade o que o sistema faz hoje: dados
// coletados, terceiros que recebem dado (OpenAI/Supabase), retenção, e os direitos do titular
// pela LGPD (acesso, correção, exclusão, portabilidade).

const privacidade = fs.readFileSync(new URL('../privacidade.html', import.meta.url), 'utf8');
const termos = fs.readFileSync(new URL('../termos.html', import.meta.url), 'utf8');

// 1. Conteúdo mínimo exigido pela LGPD precisa estar coberto de verdade, não só existir a página.
for (const trecho of [
  /OpenAI/i, /Supabase/i,               // quem recebe o dado
  /LGPD|Lei Geral de Proteção de Dados/i, // base legal citada
  /[Ee]xclus[ãa]o/i, /[Pp]ortabilidade/i, /[Cc]orre[çc][ãa]o/i, // direitos do titular
  /[Aa]tualiza[çc][ãa]o:/                 // data de atualização visível
]) {
  assert.match(privacidade, trecho, `privacidade.html precisa mencionar: ${trecho}`);
}
assert.match(privacidade, /áudio/i, 'privacidade.html precisa citar que áudios são coletados/transcritos');
assert.match(privacidade, /[Ww]hatsApp/, 'privacidade.html precisa citar a origem dos dados (conversas de WhatsApp importadas)');

// 2. Termos cobre teste grátis, responsabilidade do corretor e ausência de garantia de resultado
// (a IA sugere, não garante venda) — sem cravar preço nenhum (ver CLAUDE.md: preço nunca no código).
assert.match(termos, /teste\s+grat/i, 'termos.html precisa citar o período de teste grátis');
assert.doesNotMatch(termos, /R\$\s?\d/, 'termos.html não pode cravar nenhum preço em reais — CLAUDE.md proíbe informação comercial fixa no código');
assert.match(termos, /LGPD|Lei Geral de Proteção de Dados/i, 'termos.html precisa citar a LGPD');

// 3. As duas páginas se linkam uma à outra, e o cadastro linka as duas — ninguém deveria criar
// conta sem ter como achar os dois documentos.
assert.match(privacidade, /href="termos\.html"/);
assert.match(termos, /href="privacidade\.html"/);
const cadastro = fs.readFileSync(new URL('../cadastro.html', import.meta.url), 'utf8');
assert.match(cadastro, /href="termos\.html"/, 'cadastro.html precisa linkar os Termos de Uso');
assert.match(cadastro, /href="privacidade\.html"/, 'cadastro.html precisa linkar a Política de Privacidade');

// 4. As duas páginas realmente são publicadas (build.js) e servidas sem cache antigo (vercel.json)
// — mesmo padrão já usado nas demais telas de conta.
const buildSrc = fs.readFileSync(new URL('../build.js', import.meta.url), 'utf8');
assert.match(buildSrc, /"privacidade\.html"/, 'build.js precisa publicar privacidade.html');
assert.match(buildSrc, /"termos\.html"/, 'build.js precisa publicar termos.html');
const vercelJson = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const fontes = (vercelJson.headers || []).map(h => h.source);
assert.ok(fontes.includes('/privacidade.html'), 'vercel.json precisa ter regra de cache pra /privacidade.html');
assert.ok(fontes.includes('/termos.html'), 'vercel.json precisa ter regra de cache pra /termos.html');

console.log('v1045-privacidade-e-termos: ok');
