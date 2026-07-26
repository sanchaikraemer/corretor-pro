import fs from 'node:fs';
import assert from 'node:assert/strict';

// v990 — cadastro público (teste de 7 dias), login e painel administrativo publicados como
// páginas novas ao lado do app existente, falando direto com o Supabase real via anon key
// (RLS já protege o isolamento por empresa — ver supabase/migrations/). Não troca a entrada
// principal do app (index.html continua com a chave compartilhada de hoje).

const arquivosNovos = ['cadastro.html', 'entrar.html', 'admin-plataforma.html', 'contas-estilo.css', 'contas-config.js'];
for (const arquivo of arquivosNovos) {
  assert.ok(fs.existsSync(new URL(`../${arquivo}`, import.meta.url)), `${arquivo} precisa existir na raiz do projeto`);
}

const buildSrc = fs.readFileSync(new URL('../build.js', import.meta.url), 'utf8');
for (const arquivo of arquivosNovos) {
  assert.ok(buildSrc.includes(`"${arquivo}"`), `build.js precisa publicar ${arquivo}`);
}
assert.ok(buildSrc.includes('vendor/supabase.js') && buildSrc.includes('vendorDir, "supabase.js"'),
  'build.js precisa empacotar o supabase-js localmente (sem CDN), igual já faz com o JSZip');

// Nenhuma das 3 páginas pode carregar bibliotecas de CDN — a mesma regra de segurança que
// já vale pro resto do app (script empacotado localmente, sem execução remota).
for (const arquivo of ['cadastro.html', 'entrar.html', 'admin-plataforma.html']) {
  const html = fs.readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
  assert.ok(!/https?:\/\//.test(html.match(/<script[^>]*src="([^"]*)"/g)?.join('') || ''),
    `${arquivo} não pode carregar script de CDN/URL externa`);
  assert.match(html, /src="vendor\/supabase\.js"/, `${arquivo} precisa usar o supabase-js vendorizado localmente`);
}

// A anon key é pública de propósito — mas a service_role (secreta) nunca pode aparecer aqui.
// Decodifica o JWT de verdade em vez de só procurar a palavra no texto — o comentário do
// próprio arquivo cita "service_role" como aviso, o que faria uma busca simples por texto
// disparar um alarme falso.
const config = fs.readFileSync(new URL('../contas-config.js', import.meta.url), 'utf8');
assert.match(config, /CORRETOR_PRO_SUPABASE_ANON_KEY/, 'contas-config.js precisa expor a anon key pro cliente');
const jwt = config.match(/CORRETOR_PRO_SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)?.[1];
assert.ok(jwt, 'não encontrei o valor da anon key em contas-config.js');
const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
assert.equal(payload.role, 'anon', `a chave publicada precisa ser a "anon", nunca a "service_role" (veio: ${payload.role})`);

console.log('v990-cadastro-login-admin-publicados: ok');
