import fs from 'node:fs';
import assert from 'node:assert/strict';

// v994 — liga o login (entrar.html) no sistema principal, mas SÓ pra empresa original: o
// sistema principal (index.html/app.js) ainda não separa dados por empresa (toda consulta em
// api/_persistence.js lê/grava em whatsapp_processamentos sem filtrar organization_id). Deixar
// qualquer empresa nova entrar lá hoje faria uma empresa ver os clientes da outra. Até essa
// separação estar pronta, só a empresa original (id fixo criado na migração
// 0002_migrar_dados_existentes.sql) é redirecionada pra "/"; qualquer outra fica numa tela de
// espera.

const EMPRESA_1_ID = '00000000-0000-0000-0000-000000000001';

const migracao = fs.readFileSync(new URL('../supabase/migrations/0002_migrar_dados_existentes.sql', import.meta.url), 'utf8');
assert.match(migracao, new RegExp(EMPRESA_1_ID), 'o id fixo da Empresa 1 usado no teste precisa bater com o da migração real');

const config = fs.readFileSync(new URL('../contas-config.js', import.meta.url), 'utf8');
assert.match(config, /CORRETOR_PRO_EMPRESA_PRINCIPAL_ID\s*=\s*"00000000-0000-0000-0000-000000000001"/,
  'contas-config.js precisa expor o id da empresa original pro entrar.html comparar');

const entrar = fs.readFileSync(new URL('../entrar.html', import.meta.url), 'utf8');
assert.match(entrar, /CORRETOR_PRO_EMPRESA_PRINCIPAL_ID/, 'entrar.html precisa comparar a empresa logada com a empresa principal');
assert.match(entrar, /window\.location\.href\s*=\s*['"]\/['"]/, 'entrar.html precisa redirecionar pra "/" quando for a empresa principal');

// O redirecionamento só pode estar dentro do bloco condicional da empresa principal —
// nunca incondicional (senão qualquer empresa nova cairia no sistema sem separação de dados).
const redirectIdx = entrar.indexOf("window.location.href = '/'");
const condIdx = entrar.indexOf('ehEmpresaPrincipal');
assert.ok(condIdx !== -1 && redirectIdx !== -1 && condIdx < redirectIdx,
  'o redirecionamento precisa vir DEPOIS da checagem de qual empresa é, nunca antes/incondicional');

// Empresa que não é a principal precisa ver uma mensagem de espera, não erro nem redirecionamento.
assert.match(entrar, /quase pronta/, 'empresas que não são a principal precisam ver uma mensagem de espera amigável');

console.log('v994-login-empresa-principal-vai-pro-sistema: ok');
